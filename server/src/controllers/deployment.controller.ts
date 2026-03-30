/**
 * Deployment Controller.
 * Handles the business logic for managing projects and their deployments.
 * This includes fetching deployment lists, triggering new builds via SQS, 
 * cleanup of S3 artifacts, and real-time status streaming via SSE.
 */

import { Request, Response } from "express";
import { z } from "zod";

// Core services for infrastructure and database interaction
import { sqsService } from "../services/sqs.services";
import { S3_REVERSE_PROXY_URL } from "../envs";
import { postgresService } from "../services/postgres.services";
import { eventBus } from "../services/event-bus.services";
import { s3Service } from "../services/s3.services";

// Helper utilities
import { generateUniqueSubDomain } from "../utils/project.utils";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import logger from "../logger/winston.logger";

/**
 * Retrieves a list of deployments, optionally filtered by project.
 * Enriches each deployment with a preview URL pointing to the reverse proxy.
 */
export const getDeployments = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.query;
  
  // Base query joining deployments with their parent projects
  let query = `
    SELECT d.id, d.project_id, d.status, d.created_at, p.name as repo, p.sub_domain
    FROM deployments d JOIN projects p ON d.project_id = p.id
  `;
  const params: any[] = [];
  
  // Apply project filter if provided in query params
  if (projectId) {
    query += ` WHERE d.project_id = $1`;
    params.push(projectId);
  }
  
  // Order by newest deployments first
  query += ` ORDER BY d.created_at DESC`;

  const result = await postgresService.query(query, params);
  const proxyUrl = S3_REVERSE_PROXY_URL;
  
  // Map database rows to a clean API response format
  const data = result.rows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    repo: row.repo,
    // Generate the preview URL: http://<deployment-id>.localhost:8080/
    url: proxyUrl.replace("://", `://${row.id}.`),
    status: row.status.toLowerCase(),
    created_at: row.created_at,
  }));

  return res.status(200).json(new ApiResponse(200, data, "Deployments fetched successfully"));
});

/**
 * Retrieves full details for a single specific deployment by ID.
 */
export const getDeploymentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const query = `
    SELECT d.id, d.status, d.created_at, p.name as repo, p.sub_domain
    FROM deployments d JOIN projects p ON d.project_id = p.id
    WHERE d.id = $1
  `;
  const result = await postgresService.query(query, [id]);
  
  // Return early if deployment is not found
  if (result.rowCount === 0) {
    throw new ApiError(404, "Deployment not found");
  }

  const row = result.rows[0];
  const proxyUrl = S3_REVERSE_PROXY_URL;
  const data = {
    id: row.id,
    repo: row.repo,
    subDomain: row.sub_domain,
    // Provide the deployment-specific URL
    url: proxyUrl.replace("://", `://${row.id}.`),
    status: row.status.toLowerCase(),
    created_at: row.created_at,
  };

  return res.status(200).json(new ApiResponse(200, data, "Deployment fetched successfully"));
});

/**
 * Triggers a new deployment.
 * If a projectId is provided, it adds a new deployment to that project.
 * If not, it creates a new project first.
 */
export const createDeployment = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  
  // Validation schema for the request body
  const schema = z.object({ 
    repo: z.string().optional(), 
    url: z.string().url().optional(),
    projectId: z.string().uuid().optional() // Alternative way to pass projectId in Body
  });

  const safeParseResult = schema.safeParse(req.body || {});
  if (safeParseResult.error) {
    throw new ApiError(400, "Invalid request data", safeParseResult.error.issues);
  }

  const { repo, url, projectId: bodyProjectId } = safeParseResult.data;
  const effectiveProjectId = projectId || bodyProjectId;

  let project;
  
  // --- PROJECT RESOLUTION ---
  if (effectiveProjectId) {
    // Lookup existing project
    const projectRes = await postgresService.query("SELECT * FROM projects WHERE id = $1", [effectiveProjectId]);
    if (projectRes.rowCount === 0) throw new ApiError(404, "Project not found");
    project = projectRes.rows[0];
  } else {
    // Validate new project requirements
    if (!repo || !url) throw new ApiError(400, "Repo name and Git URL are required for new projects");
    
    // Create new project and generate a unique subdomain (e.g., 'myapp-123')
    const projectRes = await postgresService.query(
      "INSERT INTO projects (name, git_url, sub_domain) VALUES ($1, $2, $3) RETURNING *",
      [repo, url, await generateUniqueSubDomain(repo)]
    );
    project = projectRes.rows[0];
  }

  // --- DEPLOYMENT CREATION ---
  // Initialize deployment record with 'QUEUED' status
  const deployRes = await postgresService.query(
    "INSERT INTO deployments (project_id, status) VALUES ($1, 'QUEUED') RETURNING *",
    [project.id]
  );
  const deployment = deployRes.rows[0];

  // --- TRIGGER BUILD ---
  // Send message to SQS; the worker/ECS will eventually pick this up to run the build
  await sqsService.sendMessage({
    gitURL: project.git_url,
    projectId: project.id,
    deploymentId: deployment.id,
    projectName: project.sub_domain,
  });

  // Notify the SSE stream to push updates to dashboards
  eventBus.emit("deployment-status-changed");
  
  return res.status(201).json(new ApiResponse(201, deployment, "Deployment started successfully"));
});

/**
 * Deletes a deployment and its associated S3 artifacts.
 */
export const deleteDeployment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Fetch deployment and project metadata required for cleanup
  const metaRes = await postgresService.query(
    "SELECT p.id as project_id, p.sub_domain FROM projects p JOIN deployments d ON p.id = d.project_id WHERE d.id = $1",
    [id]
  );

  if (metaRes.rowCount === 0) {
    throw new ApiError(404, "Deployment not found");
  }
  
  const { project_id } = metaRes.rows[0];
  
  // --- S3 CLEANUP ---
  // Target only files belonging to this specific deployment UUID
  const prefix = `__outputs/${project_id}/${id}/`;
  const s3Res = await s3Service.listObjects(prefix);
  
  if (s3Res.Contents && s3Res.Contents.length > 0) {
    // Collect all keys and delete them in bulk
    const keys = s3Res.Contents.map((obj) => obj.Key!).filter(Boolean);
    await s3Service.deleteObjects(keys);
    logger.info(`🗑️ S3 Cleanup: Deleted ${s3Res.Contents.length} objects for deployment ${id}`);
  }

  // --- DB CLEANUP ---
  // Remove record from local database
  await postgresService.query("DELETE FROM deployments WHERE id = $1", [id]);
  
  // Notification for real-time UI updates
  eventBus.emit("deployment-status-changed");
  
  return res.status(200).json(new ApiResponse(200, null, "Deployment deleted successfully"));
});

/**
 * Fetches project-level metadata by project ID.
 */
export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await postgresService.query("SELECT * FROM projects WHERE id = $1", [id]);
  if (result.rowCount === 0) throw new ApiError(404, "Project not found");
  return res.status(200).json(new ApiResponse(200, result.rows[0], "Project fetched successfully"));
});

/**
 * Lists all generated build artifacts for a given deployment from S3.
 */
export const getDeploymentFiles = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Need Project ID to resolve the correct S3 storage path
  const projectRes = await postgresService.query(
    "SELECT p.id as project_id FROM projects p JOIN deployments d ON p.id = d.project_id WHERE d.id = $1",
    [id]
  );

  if (projectRes.rowCount === 0) {
    throw new ApiError(404, "Deployment not found");
  }
  
  const { project_id } = projectRes.rows[0];
  const prefix = `__outputs/${project_id}/${id}/`;
  
  // Query S3 for the list of objects
  const s3Res = await s3Service.listObjects(prefix);
  
  // Format results to remove the internal path prefix for the client
  const files = s3Res.Contents?.map((item) => ({
    key: item.Key?.replace(prefix, ""),
    size: item.Size,
    lastModified: item.LastModified,
  })) || [];

  return res.status(200).json(new ApiResponse(200, { files }, "Files fetched successfully"));
});

/**
 * Server-Sent Events (SSE) Stream for Dashboard Updates.
 * Provides real-time updates of the deployment list to all connected clients.
 */
export const dashboardStream = (req: Request, res: Response) => {
  // Set headers for standard EventStream protocol
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  logger.info("🔌 New Dashboard SSE Client connected");

  /**
   * Re-queries the database and pushes the latest deployment list to the client.
   */
  const sendUpdate = async () => {
    try {
      const query = `
        SELECT d.id, d.project_id, d.status, d.created_at, p.name as repo, p.sub_domain
        FROM deployments d JOIN projects p ON d.project_id = p.id
        ORDER BY d.created_at DESC
      `;
      const result = await postgresService.query(query);
      const proxyUrl = S3_REVERSE_PROXY_URL;
      
      const data = result.rows.map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        repo: row.repo,
        url: proxyUrl.replace("://", `://${row.id}.`),
        status: row.status.toLowerCase(),
        created_at: row.created_at,
      }));
      
      // Standard message format: 'data: <json>\n\n'
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      logger.error("SSE Update Error:", err);
    }
  };

  // Push immediate update upon connection
  sendUpdate();
  
  // Subscribe to backend event bus for project/status changes
  eventBus.on("deployment-status-changed", sendUpdate);

  // Stop sending updates and clean up subscription when client closes connection
  req.on("close", () => {
    eventBus.off("deployment-status-changed", sendUpdate);
    logger.info("🔌 Dashboard SSE Client disconnected");
  });
};
