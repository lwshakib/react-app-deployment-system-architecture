import express, { Request, Response, Router } from "express";
import cors from "cors";
import { Server } from "socket.io";
import { z } from "zod";
import { generateSlug } from "random-word-slugs";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { sqsService } from "./services/sqs.service";
import { kafkaService } from "./services/kafka.service";
import { clickHouseService } from "./services/clickhouse.service";
import { postgresService } from "./services/postgres.service";
import { eventBus } from "./services/event-bus.service";

const app = express();
const port = process.env.PORT || 8000;
const socketPort = 9002;

// AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// API Router
const apiRouter = Router();

// Socket.io (Legacy support for other features if any, but now secondary to SSE)
const io = new Server({ cors: { origin: "*" } });
io.listen(socketPort);

// Helper: Extract repo name from Git URL
function getRepoName(gitURL: string): string {
  try {
    const url = new URL(gitURL);
    return url.pathname.split("/").pop()?.replace(".git", "") || "project";
  } catch {
    return "project";
  }
}

// Helper: Ensure unique subdomain
async function generateUniqueSubDomain(baseName: string): Promise<string> {
  let subDomain = baseName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const checkQuery = "SELECT id FROM projects WHERE sub_domain = $1";
    const res = await postgresService.query(checkQuery, [subDomain]);
    if (res.rowCount === 0) isUnique = true;
    else {
      attempts++;
      subDomain = `${baseName}-${generateSlug(1)}`.toLowerCase().replace(/[^a-z0-9]/g, "-");
    }
  }
  return isUnique ? subDomain : `${subDomain}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * SSE ENDPOINTS
 */

// GET /api/deployments/stream - SSE for the dashboard
apiRouter.get("/deployments/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log("🔌 New Dashboard SSE Client connected");

  const sendUpdate = async () => {
    try {
      const query = `
        SELECT d.id, d.status, d.created_at, p.name as repo, p.sub_domain
        FROM deployments d JOIN projects p ON d.project_id = p.id
        ORDER BY d.created_at DESC
      `;
      const result = await postgresService.query(query);
      const data = result.rows.map((row: any) => ({
        id: row.id,
        repo: row.repo,
        url: `http://${row.sub_domain}.localhost:8080`,
        status: row.status.toLowerCase(),
        created_at: row.created_at,
      }));
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error("SSE Update Error:", err);
    }
  };

  // Initial push
  sendUpdate();

  // Listen for status changes
  eventBus.on("deployment-status-changed", sendUpdate);

  req.on("close", () => {
    eventBus.off("deployment-status-changed", sendUpdate);
    console.log("🔌 Dashboard SSE Client disconnected");
  });
});

// GET /api/logs/:id/stream - SSE for specific build logs
apiRouter.get("/logs/:id/stream", (req: Request, res: Response) => {
  const deploymentId = req.params.id;
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log(`🔌 New Log SSE Client connected for ${deploymentId}`);

  const logHandler = (data: { DEPLOYMENT_ID: string; log: string }) => {
    if (data.DEPLOYMENT_ID === deploymentId) {
      res.write(`data: ${JSON.stringify({ log: data.log })}\n\n`);
    }
  };

  eventBus.on("log-received", logHandler);

  req.on("close", () => {
    eventBus.off("log-received", logHandler);
    console.log(`🔌 Log SSE Client disconnected for ${deploymentId}`);
  });
});

/**
 * STANDARD API
 */

apiRouter.get("/deployments", async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT d.id, d.status, d.created_at, p.name as repo, p.sub_domain
      FROM deployments d JOIN projects p ON d.project_id = p.id
      ORDER BY d.created_at DESC
    `;
    const result = await postgresService.query(query);
    res.json(result.rows.map((row: any) => ({
      id: row.id,
      repo: row.repo,
      url: `http://${row.sub_domain}.localhost:9000`,
      status: row.status.toLowerCase(),
      created_at: row.created_at,
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch deployments" });
  }
});

apiRouter.post("/deployments", async (req: Request, res: Response) => {
  const schema = z.object({ repo: z.string(), url: z.string().url() });
  const safeParseResult = schema.safeParse(req.body);
  if (safeParseResult.error) return res.status(400).json({ error: safeParseResult.error });

  const { repo, url } = safeParseResult.data;
  try {
    const checkQuery = "SELECT * FROM projects WHERE git_url = $1";
    const checkRes = await postgresService.query(checkQuery, [url]);
    
    let project = checkRes.rowCount === 0 
      ? (await postgresService.query(
          "INSERT INTO projects (name, git_url, sub_domain) VALUES ($1, $2, $3) RETURNING *",
          [repo, url, await generateUniqueSubDomain(repo)]
        )).rows[0]
      : checkRes.rows[0];

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

    eventBus.emit("deployment-status-changed"); // Trigger dashboard SSE
    res.json({ status: "success", deploymentId: deployment.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to start deployment" });
  }
});

apiRouter.delete("/deployments/:id", async (req: Request, res: Response) => {
  try {
    await postgresService.query("DELETE FROM deployments WHERE id = $1", [req.params.id]);
    eventBus.emit("deployment-status-changed");
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete deployment" });
  }
});

apiRouter.get("/logs/:id", async (req: Request, res: Response) => {
  try {
    const logs = await clickHouseService.query(
      "SELECT event_id, log, timestamp from log_events where deployment_id = {deployment_id:String}",
      { deployment_id: req.params.id }
    );
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

apiRouter.get("/deployments/:id/files", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const projectRes = await postgresService.query(
      "SELECT p.sub_domain FROM projects p JOIN deployments d ON p.id = d.project_id WHERE d.id = $1",
      [id]
    );

    if (projectRes.rowCount === 0) return res.status(404).json({ error: "Deployment not found" });
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

    res.json({ files });
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

app.use("/api", apiRouter);

// Kafka Consumers
async function initKafkaLogConsumer() {
  await kafkaService.listenBatch("container-logs", "api-server-logs-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
    const logEntries = [];
    const validMessages = [];

    for (const message of batch.messages) {
      if (!message.value) continue;
      try {
        const data = JSON.parse(message.value.toString());
        logEntries.push({ event_id: uuidv4(), deployment_id: data.DEPLOYMENT_ID, log: data.log });
        eventBus.emit("log-received", data); // Bridge to SSE
        validMessages.push(message);
      } catch (err) {
        console.error("❌ Kafka Log Consumer: Error parsing JSON:", err, message.value.toString());
        // For malformed JSON, we resolve it to skip it, otherwise it blocks the queue
        resolveOffset(message.offset);
      }
    }

    if (logEntries.length > 0) {
      try {
        await clickHouseService.insert("log_events", logEntries);
        // ONLY resolve offsets after successful storage in ClickHouse
        for (const message of validMessages) {
          resolveOffset(message.offset);
        }
        console.log(`📝 Log Consumer: Batched ${logEntries.length} logs to ClickHouse.`);
      } catch (err) {
        console.error("❌ Kafka Log Consumer: ClickHouse Insertion Failed:", err);
        // We DON'T resolve offsets here, so Kafka will retry this batch later
        throw err;
      }
    }
    await heartbeat();
  });
}

async function initKafkaStatusConsumer() {
  await kafkaService.listenBatch("deployment-status", "api-server-status-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
    for (const message of batch.messages) {
      if (!message.value) continue;
      try {
        const payload = message.value.toString();
        const data = JSON.parse(payload);
        const { DEPLOYMENT_ID, status } = data;
        
        if (!status) {
            console.warn(`⚠️ Status Consumer: Received message without status for deployment ${DEPLOYMENT_ID}. Skipping DB update.`);
            resolveOffset(message.offset);
            continue;
        }

        const res = await postgresService.query("UPDATE deployments SET status = $1 WHERE id = $2", [status, DEPLOYMENT_ID]);
        eventBus.emit("deployment-status-changed"); // Bridge to SSE Dashboard
        
        if (res.rowCount === 0) {
          console.warn(`⚠️ Status Consumer: No deployment found with ID ${DEPLOYMENT_ID}`);
        } else {
          console.log(`🔔 Status Consumer: Updated deployment ${DEPLOYMENT_ID} to ${status}`);
        }
        resolveOffset(message.offset);
      } catch (err) {
        console.error("❌ Kafka Status Consumer Error:", err, message.value?.toString());
        if (err instanceof SyntaxError) {
          resolveOffset(message.offset);
        } else {
          throw err;
        }
      }
    }
    await heartbeat();
  });
}

initKafkaLogConsumer().catch(console.error);
initKafkaStatusConsumer().catch(console.error);
sqsService.startPolling().catch(console.error);

app.listen(port, () => console.log(`\n✨ Server is glowing at http://localhost:${port}`));