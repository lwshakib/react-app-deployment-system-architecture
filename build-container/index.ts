import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { Kafka, type Producer } from "kafkajs";

// AWS Configuration
const REGION = process.env.AWS_REGION!;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const PROJECT_ID = process.env.PROJECT_ID!;
const PROJECT_NAME = process.env.PROJECT_NAME || PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID!;
const KAFKA_BROKER = process.env.KAFKA_BROKER!;
const S3_BUCKET = process.env.S3_BUCKET_NAME!;

// Kafka Configuration
const kafka = new Kafka({
  clientId: `docker-build-server-${DEPLOYMENT_ID}`,
  brokers: [KAFKA_BROKER],
  ssl: process.env.KAFKA_CA_FILE ? {
    ca: [fs.readFileSync(path.join(__dirname, process.env.KAFKA_CA_FILE), "utf-8")],
  } : undefined,
  sasl: {
    username: process.env.KAFKA_USERNAME!,
    password: process.env.KAFKA_PASSWORD!,
    mechanism: "plain",
  },
});

let producer: Producer;

async function publishLog(log: string) {
  console.log(log);
  if (!producer) return;
  
  try {
    await producer.send({
      topic: "container-logs",
      messages: [
        {
          key: "log",
          value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, log }),
        },
      ],
    });
  } catch (err) {
    console.error("❌ Failed to publish log to Kafka:", err);
  }
}

async function publishStatus(status: "READY" | "FAILED") {
  console.log(`📡 Publishing final status: ${status}`);
  if (!producer) return;
  
  try {
    await producer.send({
      topic: "deployment-status",
      messages: [
        {
          key: "status",
          value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, status }),
        },
      ],
    });
  } catch (err) {
    console.error(`❌ Failed to publish ${status} status to Kafka:`, err);
  }
}

async function shutdown(exitCode: number = 0) {
  console.log(`🛑 Shutting down with code ${exitCode}...`);
  if (producer) {
    try {
      await producer.disconnect();
      console.log("✅ Kafka Producer disconnected");
    } catch (err) {
      console.error("❌ Error disconnecting Kafka Producer:", err);
    }
  }
  process.exit(exitCode);
}

async function getAllFiles(dirPath: string): Promise<string[]> {
  let results: string[] = [];
  if (!fs.existsSync(dirPath)) return [];
  
  const list = fs.readdirSync(dirPath);
  for (const file of list) {
    const filePath = path.join(dirPath, file);
    const stat = fs.lstatSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(await getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

async function init() {
  console.log("🚀 Initializing Build Process...");
  
  try {
    producer = kafka.producer();
    await producer.connect();
    console.log("✅ Kafka Producer connected");
  } catch (err) {
    console.error("❌ Kafka Connection Error (logs will not be streamed):", err);
  }

  const GIT_URL = process.env.GIT_REPOSITORY__URL;
  if (!GIT_URL) {
    await publishLog("❌ ERROR: GIT_REPOSITORY__URL is missing!");
    await publishStatus("FAILED");
    await shutdown(1);
  }

  const outDirPath = path.join(__dirname, "output");
  
  // 1. Clone the repository
  await publishLog(`📂 Cloning repository: ${GIT_URL}...`);
  
  const cloneCmd = `git clone ${GIT_URL} ${outDirPath}`;
  
  await new Promise((resolve, reject) => {
    const p = exec(cloneCmd);
    p.stdout?.on("data", (data) => publishLog(data.toString()));
    p.stderr?.on("data", (data) => publishLog(data.toString()));
    p.on("exit", async (code) => {
      if (code === 0) {
        publishLog("✅ Repository cloned successfully.");
        resolve(true);
      } else {
        publishLog(`❌ Failed to clone repository with code ${code}`);
        reject(new Error(`Clone failed with code ${code}`));
        await shutdown(1);
      }
    });
  });

  // 2. Build: Install and Bundle
  await publishLog("📦 Starting build (npm install && npm run build)...");
  
  const buildCommand = `cd ${outDirPath} && npm install && npm run build`;
  
  const p = exec(buildCommand);

  p.stdout?.on("data", (data) => {
    publishLog(data.toString());
  });

  p.stderr?.on("data", (data) => {
    publishLog(data.toString());
  });

  p.on("exit", async (code) => {
    if (code !== 0) {
      await publishLog(`❌ Build failed with exit code ${code}`);
      await publishStatus("FAILED");
      await shutdown(1);
    }

    await publishLog("✅ Build Complete");

    // Detect output folder dynamically after build
    let distFolderPath = path.join(outDirPath, "dist");
    if (!fs.existsSync(distFolderPath)) {
      distFolderPath = path.join(outDirPath, "build");
    }
    if (!fs.existsSync(distFolderPath)) {
      distFolderPath = path.join(outDirPath, "out");
    }

    if (!fs.existsSync(distFolderPath)) {
      await publishLog(`❌ ERROR: No build output folder found (checked dist, build, out)`);
      await publishStatus("FAILED");
      await shutdown(1);
    }

    await publishLog("✅ Build Complete");

    try {
      const distFolderContents = await getAllFiles(distFolderPath);
      await publishLog(`📤 Starting upload to S3 (${distFolderContents.length} files)`);

      for (const filePath of distFolderContents) {
        const fileKey = path.relative(distFolderPath, filePath).replace(/\\/g, "/"); // Ensure POSIX paths
        const fileBuffer = fs.readFileSync(filePath);

        const command = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: `__outputs/${PROJECT_NAME}/${fileKey}`, 
          Body: fileBuffer,
          ContentLength: fileBuffer.length,
          ContentType: mime.lookup(filePath) || "application/octet-stream",
        });

        await s3Client.send(command);
        await publishLog(`✅ Uploaded: ${fileKey}`);
      }

      await publishLog("✨ Deployment Successful! Done.");
      await publishStatus("READY");
      await shutdown(0);
    } catch (err: any) {
      await publishLog(`❌ ERROR during upload: ${err.message}`);
      await publishStatus("FAILED");
      await shutdown(1);
    }
  });
}

init().catch(async (err) => {
    await publishLog(`❌ ERROR in init: ${err.message}`);
    await publishStatus("FAILED");
    await shutdown(1);
});