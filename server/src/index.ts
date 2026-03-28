import express, { Request, Response } from "express";
import cors from "cors";
import { Server } from "socket.io";
import { z } from "zod";
import { generateSlug } from "random-word-slugs";
import { v4 as uuidv4 } from "uuid";
import { sqsService } from "./services/sqs.service";
import { kafkaService } from "./services/kafka.service";
import { clickHouseService } from "./services/clickhouse.service";
import { postgresService } from "./services/postgres.service";

const app = express();
const port = process.env.PORT || 8000;
const socketPort = 9002;

const io = new Server({ cors: { origin: "*" } });

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io Setup
io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", JSON.stringify({ log: `Subscribed to ${channel}` }));
  });
});

io.listen(socketPort);
console.log(`📡 Socket Server running on port ${socketPort}`);

// Helper: Extract repo name from Git URL
function getRepoName(gitURL: string): string {
  try {
    const url = new URL(gitURL);
    const pathname = url.pathname; // e.g., /user/repo.git
    const parts = pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1];
    return lastPart ? lastPart.replace(".git", "") : "project";
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
    
    if (res.rowCount === 0) {
      isUnique = true;
    } else {
      attempts++;
      const randomSuffix = generateSlug(1); // Add a random word
      subDomain = `${baseName}-${randomSuffix}`.toLowerCase().replace(/[^a-z0-9]/g, "-");
    }
  }
  
  // Final fallback if still not unique
  if (!isUnique) {
    subDomain = `${subDomain}-${Math.floor(Math.random() * 1000)}`;
  }

  return subDomain;
}

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "🚀 Fast-Deploy API Server is running!",
    status: "Healthy",
    timestamp: new Date().toISOString(),
  });
});

// POST /project - Create a new project
app.post("/project", async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string(),
    gitURL: z.string().url(),
  });

  const safeParseResult = schema.safeParse(req.body);
  if (safeParseResult.error) {
    res.status(400).json({ error: safeParseResult.error });
    return;
  }

  const { name, gitURL } = safeParseResult.data;

  try {
    const repoName = getRepoName(gitURL);
    const subDomain = await generateUniqueSubDomain(repoName);

    const insertQuery = `
      INSERT INTO projects (name, git_url, sub_domain)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await postgresService.query(insertQuery, [name, gitURL, subDomain]);
    const project = result.rows[0];

    res.json({ status: "success", data: { project } });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// POST /deploy - Trigger a deployment
app.post("/deploy", async (req: Request, res: Response) => {
  const schema = z.object({
    projectId: z.string().uuid(),
  });

  const safeParseResult = schema.safeParse(req.body);
  if (safeParseResult.error) {
    res.status(400).json({ error: safeParseResult.error });
    return;
  }

  const { projectId } = safeParseResult.data;

  try {
    const projectQuery = "SELECT * FROM projects WHERE id = $1";
    const projectRes = await postgresService.query(projectQuery, [projectId]);
    
    if (projectRes.rowCount === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const project = projectRes.rows[0];

    // Create deployment entry
    const deployQuery = `
      INSERT INTO deployments (project_id, status)
      VALUES ($1, 'QUEUED')
      RETURNING *
    `;
    const deployRes = await postgresService.query(deployQuery, [projectId]);
    const deployment = deployRes.rows[0];

    // Push deployment to SQS Queue
    await sqsService.sendMessage({
      gitURL: project.git_url,
      projectId,
      deploymentId: deployment.id,
      projectName: project.sub_domain,
    });

    res.json({ status: "queued", data: { deploymentId: deployment.id } });
  } catch (error) {
    console.error("Error triggering deployment:", error);
    res.status(500).json({ error: "Failed to trigger deployment" });
  }
});

// GET /logs/:id - Fetch logs from ClickHouse
app.get("/logs/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const logs = await clickHouseService.query(
      `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
      { deployment_id: id }
    );
    res.json({ logs });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// Kafka Consumer for Log Ingestion
async function initKafkaLogConsumer() {
  await kafkaService.listenBatch(
    "container-logs",
    "api-server-logs-consumer",
    async ({ batch, heartbeat, commitOffsetsIfNecessary, resolveOffset }: any) => {
      const messages = batch.messages;
      console.log(`📥 Received ${messages.length} log messages from Kafka`);

      const logEntries = [];
      for (const message of messages) {
        if (!message.value) continue;
        try {
          const stringMessage = message.value.toString();
          const { DEPLOYMENT_ID, log } = JSON.parse(stringMessage);
          
          logEntries.push({
            event_id: uuidv4(),
            deployment_id: DEPLOYMENT_ID,
            log,
          });

          // Stream to Socket.io for real-time updates
          io.to(DEPLOYMENT_ID).emit("message", JSON.stringify({ log }));

          resolveOffset(message.offset);
        } catch (err) {
          console.error("Error decoding Kafka message:", err);
        }
      }

      if (logEntries.length > 0) {
        try {
          await clickHouseService.insert("log_events", logEntries);
        } catch (err) {
          console.error("Error inserting logs to ClickHouse:", err);
        }
      }

      await commitOffsetsIfNecessary();
      await heartbeat();
    }
  );
}

// Start Kafka Consumer
initKafkaLogConsumer().catch(err => console.error("❌ Kafka Log Consumer initialization error:", err));

// Start SQS Consumer
sqsService.startPolling().catch(err => console.error("❌ SQS Consumer initialization error:", err));

// Start the server
app.listen(port, () => {
  console.log(`\n✨ Server is glowing at http://localhost:${port}`);
  console.log(`📦 Runtime: Bun`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}\n`);
});