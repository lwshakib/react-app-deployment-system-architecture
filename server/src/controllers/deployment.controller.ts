import { Request, Response } from "express";
import { z } from "zod";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { sqsService } from "../services/sqs.services";
import { postgresService } from "../services/postgres.services";
import { eventBus } from "../services/event-bus.services";
import { generateUniqueSubDomain } from "../utils/project.utils";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import logger from "../logger/winston.logger";

// AWS S3 Client Initialization
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
  const listCommand = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME!,
    Prefix: prefix,
  });

  const s3Res = await s3Client.send(listCommand);
  if (s3Res.Contents && s3Res.Contents.length > 0) {
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Delete: {
        Objects: s3Res.Contents.map((obj) => ({ Key: obj.Key! })),
      },
    });
    await s3Client.send(deleteCommand);
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

  const command = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME!,
    Prefix: `__outputs/${subDomain}/`,
  });

  const s3Res = await s3Client.send(command);
  const files = s3Res.Contents?.map((item) => ({
    key: item.Key?.replace(`__outputs/${subDomain}/`, ""),
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
