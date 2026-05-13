/**
 * Main entry point for the Build Container.
 * This script handles cloning a Git repository, installing dependencies, 
 * building the project, and uploading the resulting artifacts to S3.
 */

import { exec } from "child_process";
import path from "path";
import fs from "fs";

// Import services for Kafka (logging/status) and S3 (storage)
import { kafkaService } from "./services/kafka.services";
import { s3Service } from "./services/s3.services";

// Import centralized Winston logger
import logger from "./logger/winston.logger";

// Import environment variables required for the build process
import { DEPLOYMENT_ID, GIT_REPOSITORY__URL, PROJECT_ID } from "./envs";

/**
 * Gracefully shuts down the process.
 * Disconnects from Kafka and exits with the provided status code.
 * @param exitCode - The process exit code (default: 0)
 */
async function shutdown(exitCode: number = 0) {
  logger.info(`🛑 Shutting down with code ${exitCode}...`);
  // Ensure Kafka producer is disconnected before exiting
  await kafkaService.disconnect();
  // Exit the Node.js process
  process.exit(exitCode);
}

/**
 * Recursively retrieves all file paths within a directory.
 * Used to identify all build artifacts for S3 upload.
 * @param dirPath - The directory to scan
 * @returns A promise that resolves to an array of absolute file paths
 */
async function getAllFiles(dirPath: string): Promise<string[]> {
  let results: string[] = [];
  
  // Return empty array if the directory doesn't exist
  if (!fs.existsSync(dirPath)) return [];
  
  // Read all files/folders in the current directory
  const list = fs.readdirSync(dirPath);
  for (const file of list) {
    const filePath = path.join(dirPath, file);
    const stat = fs.lstatSync(filePath);
    
    // If it's a directory, recurse into it
    if (stat && stat.isDirectory()) {
      results = results.concat(await getAllFiles(filePath));
    } else {
      // If it's a file, add its path to the results
      results.push(filePath);
    }
  }
  return results;
}

/**
 * Executes a shell command and streams its output to Kafka for real-time logging.
 * @param command - The shell command to execute
 * @param cwd - The working directory for the command
 * @param stepName - A descriptive name for the current build step
 * @returns A promise resolving to true if successful, false otherwise
 */
async function runCommand(command: string, cwd: string, stepName: string): Promise<boolean> {
  // Log the start of the command to Kafka
  await kafkaService.publishLog(`👉 Running: ${stepName} (${command})...`);
  
  return new Promise((resolve) => {
    // Execute the child process
    const p = exec(command, { cwd });

    // Stream standard output (stdout) to Kafka logs
    p.stdout?.on("data", (data) => {
      kafkaService.publishLog(`[${stepName}] ${data.toString().trim()}`);
    });

    // Stream error output (stderr) to Kafka logs
    p.stderr?.on("data", (data) => {
      kafkaService.publishLog(`[${stepName}] ${data.toString().trim()}`);
    });

    // Handle process termination
    p.on("exit", (code) => {
      if (code === 0) {
        kafkaService.publishLog(`✅ ${stepName} completed successfully.`);
        resolve(true); // Command succeeded
      } else {
        kafkaService.publishLog(`❌ ${stepName} failed with code ${code}`);
        resolve(false); // Command failed
      }
    });

    // Handle unexpected execution errors
    p.on("error", (err) => {
      kafkaService.publishLog(`❌ ${stepName} encountered an error: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Main initialization function that orchestrates the build and deployment workflow.
 */
async function init() {
  logger.info("🚀 Initializing Build Process via Modernized Architecture...");
  
  // Attempt to connect to Kafka for log streaming
  try {
    await kafkaService.connect();
  } catch (err: any) {
    // If Kafka fails, we continue but logs won't be streamed to the user dashboard
    logger.warn(`❌ Kafka connection failed (logs will not be streamed): ${err.message}`);
  }

  // Define the local path where the repository will be cloned and built
  const outDirPath = path.join(process.cwd(), "output");

  // Validate that the repository URL is provided
  if (!GIT_REPOSITORY__URL) {
    await kafkaService.publishLog("❌ ERROR: GIT_REPOSITORY__URL is missing!");
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  // Create the output directory if it doesn't already exist
  if (!fs.existsSync(outDirPath)) {
    fs.mkdirSync(outDirPath);
  }

  // --- STEP 1: Clone the Git Repository ---
  const cloneSuccess = await runCommand(`git clone ${GIT_REPOSITORY__URL} .`, outDirPath, "Cloning Repository");
  if (!cloneSuccess) {
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  // --- STEP 2: Install Node Dependencies ---
  const installSuccess = await runCommand("npm install", outDirPath, "npm install");
  if (!installSuccess) {
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  // --- STEP 3: Execute Project Build ---
  const buildSuccess = await runCommand("npm run build", outDirPath, "npm run build");
  if (!buildSuccess) {
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  await kafkaService.publishLog("✅ Build and Install Complete");

  // --- STEP 4: Detect Build Output Folder ---
  // Different frameworks use different output folders (dist, build, out)
  let distFolderPath = path.join(outDirPath, "dist");
  if (!fs.existsSync(distFolderPath)) {
    distFolderPath = path.join(outDirPath, "build");
  }
  if (!fs.existsSync(distFolderPath)) {
    distFolderPath = path.join(outDirPath, "out");
  }

  // Fail if no build directory is found
  if (!fs.existsSync(distFolderPath)) {
    await kafkaService.publishLog(`❌ ERROR: No build output folder found (checked dist, build, out)`);
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
    return;
  }

  // --- STEP 5: Upload Build Artifacts to S3 ---
  try {
    // Traverse all files in the build folder
    const distFolderContents = await getAllFiles(distFolderPath);
    await kafkaService.publishLog(`📤 Starting upload to S3 (${distFolderContents.length} files)`);

    for (const filePath of distFolderContents) {
      // Calculate relative path for S3 key (e.g., index.html, assets/main.js)
      const fileKey = path.relative(distFolderPath, filePath).replace(/\\/g, "/"); 
      
      // Construct final S3 path: __outputs/project-id/deployment-id/file-key
      const s3Path = `__outputs/${PROJECT_ID}/${DEPLOYMENT_ID}/${fileKey}`;
      
      // Upload the file to S3
      await s3Service.uploadFile(filePath, s3Path);
      await kafkaService.publishLog(`✅ Uploaded: ${fileKey}`);
    }

    // Mark deployment as successful and update status
    await kafkaService.publishLog("✨ Deployment Successful! Done.");
    await kafkaService.publishStatus("READY");
    await shutdown(0);
  } catch (err: any) {
    // Handle errors during upload phase
    await kafkaService.publishLog(`❌ ERROR during upload: ${err.message}`);
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
  }
}

/**
 * Execute the initialization sequence and catch top-level errors.
 */
init().catch(async (err) => {
    logger.error(`❌ ERROR in init: ${err.message}`);
    // Ensure the system reflects a failed state if an unhandled error occurs
    await kafkaService.publishStatus("FAILED");
    await shutdown(1);
});
