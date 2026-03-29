import { Request, Response } from "express";
import { z } from "zod";
import { sqsService } from "../services/sqs.services";
import { postgresService } from "../services/postgres.services";
import { eventBus } from "../services/event-bus.services";
import { s3Service } from "../services/s3.services";
import { generateUniqueSubDomain } from "../utils/project.utils";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import logger from "../logger/winston.logger";

export const getDeployments = asyncHandler(async (req: Request, res: Response) => {
  const query = `
    SELECT d.id, d.status, d.created_at, p.name as repo, p.sub_domain
    FROM deployments d JOIN projects p ON d.project_id = p.id
    ORDER BY d.created_at DESC
  `;
  const result = await postgresService.query(query);
  const proxyUrl = process.env.S3_REVERSE_PROXY_URL || "http://localhost:8080";
  
  const data = result.rows.map((row: any) => ({
    id: row.id,
    repo: row.repo,
    url: proxyUrl.replace("://", `://${row.sub_domain}.`),
    status: row.status.toLowerCase(),
    created_at: row.created_at,
  }));

  return res.status(200).json(new ApiResponse(200, data, "Deployments fetched successfully"));
});

export const getDeploymentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const query = `
    SELECT d.id, d.status, d.created_at, p.name as repo, p.sub_domain
    FROM deployments d JOIN projects p ON d.project_id = p.id
    WHERE d.id = $1
  `;
  const result = await postgresService.query(query, [id]);
  
  if (result.rowCount === 0) {
    throw new ApiError(404, "Deployment not found");
  }

  const row = result.rows[0];
  const proxyUrl = process.env.S3_REVERSE_PROXY_URL || "http://localhost:8080";
  const data = {
    id: row.id,
    repo: row.repo,
    url: proxyUrl.replace("://", `://${row.sub_domain}.`),
    status: row.status.toLowerCase(),
    created_at: row.created_at,
  };

  return res.status(200).json(new ApiResponse(200, data, "Deployment fetched successfully"));
});

export const createDeployment = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ repo: z.string(), url: z.string().url() });
  const safeParseResult = schema.safeParse(req.body);
  if (safeParseResult.error) {
    throw new ApiError(400, "Invalid request data", safeParseResult.error.issues);
  }

  const { repo, url } = safeParseResult.data;
  const projectRes = await postgresService.query(
    "INSERT INTO projects (name, git_url, sub_domain) VALUES ($1, $2, $3) RETURNING *",
    [repo, url, await generateUniqueSubDomain(repo)]
  );
  const project = projectRes.rows[0];

  const deployRes = await postgresService.query(
    "INSERT INTO deployments (project_id, status) VALUES ($1, 'QUEUED') RETURNING *",
    [project.id]
  );
  const deployment = deployRes.rows[0];

  await sqsService.sendMessage({
    gitURL: project.git_url,
    projectId: project.id,
    deploymentId: deployment.id,
    projectName: project.sub_domain,
  });

  eventBus.emit("deployment-status-changed");
  
  return res.status(201).json(new ApiResponse(201, { deploymentId: deployment.id }, "Deployment started successfully"));
});

export const deleteDeployment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const metaRes = await postgresService.query(
    "SELECT p.id as project_id, p.sub_domain FROM projects p JOIN deployments d ON p.id = d.project_id WHERE d.id = $1",
    [id]
  );

  if (metaRes.rowCount === 0) {
    throw new ApiError(404, "Deployment not found");
  }
  
  const { project_id, sub_domain } = metaRes.rows[0];

  const prefix = `__outputs/${sub_domain}/`;
  const s3Res = await s3Service.listObjects(prefix);
  
  if (s3Res.Contents && s3Res.Contents.length > 0) {
    const keys = s3Res.Contents.map((obj) => obj.Key!).filter(Boolean);
    await s3Service.deleteObjects(keys);
    logger.info(`🗑️ S3 Cleanup: Deleted ${s3Res.Contents.length} objects for ${sub_domain}`);
  }

  await postgresService.query("DELETE FROM deployments WHERE id = $1", [id]);
  await postgresService.query("DELETE FROM projects WHERE id = $1", [project_id]);

  eventBus.emit("deployment-status-changed");
  
  return res.status(200).json(new ApiResponse(200, null, "Deployment deleted successfully"));
});

export const getDeploymentFiles = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const projectRes = await postgresService.query(
    "SELECT p.sub_domain FROM projects p JOIN deployments d ON p.id = d.project_id WHERE d.id = $1",
    [id]
  );

  if (projectRes.rowCount === 0) {
    throw new ApiError(404, "Deployment not found");
  }
  
  const subDomain = projectRes.rows[0].sub_domain;
  const prefix = `__outputs/${subDomain}/`;
  const s3Res = await s3Service.listObjects(prefix);
  
  const files = s3Res.Contents?.map((item) => ({
    key: item.Key?.replace(prefix, ""),
    size: item.Size,
    lastModified: item.LastModified,
  })) || [];

  return res.status(200).json(new ApiResponse(200, { files }, "Files fetched successfully"));
});

export const dashboardStream = (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  logger.info("🔌 New Dashboard SSE Client connected");

  const sendUpdate = async () => {
    try {
      const query = `
        SELECT d.id, d.status, d.created_at, p.name as repo, p.sub_domain
        FROM deployments d JOIN projects p ON d.project_id = p.id
        ORDER BY d.created_at DESC
      `;
      const result = await postgresService.query(query);
      const proxyUrl = process.env.S3_REVERSE_PROXY_URL || "http://localhost:8080";
      const data = result.rows.map((row: any) => ({
        id: row.id,
        repo: row.repo,
        url: proxyUrl.replace("://", `://${row.sub_domain}.`),
        status: row.status.toLowerCase(),
        created_at: row.created_at,
      }));
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      logger.error("SSE Update Error:", err);
    }
  };

  sendUpdate();
  eventBus.on("deployment-status-changed", sendUpdate);

  req.on("close", () => {
    eventBus.off("deployment-status-changed", sendUpdate);
    logger.info("🔌 Dashboard SSE Client disconnected");
  });
};
