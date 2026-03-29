import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { kafkaService } from "./services/kafka.services";
import { s3Service } from "./services/s3.services";
import logger from "./logger/winston.logger";

const PROJECT_ID = process.env.PROJECT_ID!;
const PROJECT_NAME = process.env.PROJECT_NAME || PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID!;

async function shutdown(exitCode: number = 0) {
  logger.info(`🛑 Shutting down with code ${exitCode}...`);
  await kafkaService.disconnect();
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

// Helper: Run shell command with real-time log streaming
async function runCommand(command: string, cwd: string, stepName: string): Promise<boolean> {
  await kafkaService.publishLog(`👉 Running: ${stepName} (${command})...`);
  
  return new Promise((resolve) => {
    const p = exec(command, { cwd });

    p.stdout?.on("data", (data) => {
      kafkaService.publishLog(`[${stepName}] ${data.toString().trim()}`);
    });

    p.stderr?.on("data", (data) => {
      kafkaService.publishLog(`[${stepName}:ERR] ${data.toString().trim()}`);
    });

    p.on("exit", (code) => {
      if (code === 0) {
        kafkaService.publishLog(`✅ ${stepName} completed successfully.`);
        resolve(true);
      } else {
        kafkaService.publishLog(`❌ ${stepName} failed with code ${code}`);
        resolve(false);
      }
    });

    p.on("error", (err) => {
      kafkaService.publishLog(`❌ ${stepName} encountered an error: ${err.message}`);
      resolve(false);
    });
  });
}

async function init() {
  logger.info("🚀 Initializing Build Process via Modernized Architecture...");
  
  try {
    await kafkaService.connect();
  } catch (err: any) {
    logger.warn(`❌ Kafka connection failed (logs will not be streamed): ${err.message}`);
  }

  const outDirPath = path.join(process.cwd(), "output");

  const GIT_URL = process.env.GIT_REPOSITORY__URL;
  if (!GIT_URL) {
    await kafkaService.publishLog("❌ ERROR: GIT_REPOSITORY__URL is missing!");
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  // Ensure output directory exists for git clone
  if (!fs.existsSync(outDirPath)) {
    fs.mkdirSync(outDirPath);
  }

  // 1. Clone Repository
  const cloneSuccess = await runCommand(`git clone ${GIT_URL} .`, outDirPath, "Cloning Repository");
  if (!cloneSuccess) {
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  // 2. Install Dependencies
  const installSuccess = await runCommand("npm install", outDirPath, "npm install");
  if (!installSuccess) {
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  // 3. Run Build
  const buildSuccess = await runCommand("npm run build", outDirPath, "npm run build");
  if (!buildSuccess) {
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  await kafkaService.publishLog("✅ Build and Install Complete");

  // Detect output folder dynamically after build
  let distFolderPath = path.join(outDirPath, "dist");
  if (!fs.existsSync(distFolderPath)) {
    distFolderPath = path.join(outDirPath, "build");
  }
  if (!fs.existsSync(distFolderPath)) {
    distFolderPath = path.join(outDirPath, "out");
  }

  if (!fs.existsSync(distFolderPath)) {
    await kafkaService.publishLog(`❌ ERROR: No build output folder found (checked dist, build, out)`);
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  try {
    const distFolderContents = await getAllFiles(distFolderPath);
    await kafkaService.publishLog(`📤 Starting upload to S3 (${distFolderContents.length} files)`);

    for (const filePath of distFolderContents) {
      const fileKey = path.relative(distFolderPath, filePath).replace(/\\/g, "/"); // Ensure POSIX paths
      const s3Path = `__outputs/${PROJECT_ID}/${DEPLOYMENT_ID}/${fileKey}`;
      
      await s3Service.uploadFile(filePath, s3Path);
      await kafkaService.publishLog(`✅ Uploaded: ${fileKey}`);
    }

    await kafkaService.publishLog("✨ Deployment Successful! Done.");
    await kafkaService.publishStatus("READY");
    await shutdown(0);
  } catch (err: any) {
    await kafkaService.publishLog(`❌ ERROR during upload: ${err.message}`);
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
  }
}

init().catch(async (err) => {
    logger.error(`❌ ERROR in init: ${err.message}`);
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
});
