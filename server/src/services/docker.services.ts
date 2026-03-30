import { spawn } from "child_process";
import logger from "../logger/winston.logger";
import * as envs from "../envs";

class DockerService {
  /**
   * Run the builder container locally via Docker
   */
  async runTask(params: {
    gitURL: string;
    projectId: string;
    deploymentId: string;
    projectName: string;
  }) {
    const { gitURL, projectId, deploymentId, projectName } = params;

    const envVars: Record<string, string | undefined> = {
      AWS_REGION: envs.AWS_REGION,
      AWS_ACCESS_KEY_ID: envs.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: envs.AWS_SECRET_ACCESS_KEY,
      KAFKA_BROKER: envs.KAFKA_BROKER,
      KAFKA_USERNAME: envs.KAFKA_USERNAME,
      KAFKA_PASSWORD: envs.KAFKA_PASSWORD,
      KAFKA_CA_CERT: envs.KAFKA_CA_CERT,
      S3_BUCKET_NAME: envs.S3_BUCKET_NAME
    };

    const args = ["run", "--rm"];

    // Add environment variables from envs
    Object.entries(envVars).forEach(([key, value]) => {
      if (value) {
        args.push("-e", `${key}=${value}`);
      }
    });

    // Add dynamic build parameters
    args.push("-e", `GIT_REPOSITORY__URL=${gitURL}`);
    args.push("-e", `PROJECT_ID=${projectId}`);
    args.push("-e", `DEPLOYMENT_ID=${deploymentId}`);
    args.push("-e", `PROJECT_NAME=${projectName}`);

    // Add image name
    args.push("build-container:latest");

    logger.info(`🛠️ Triggering local Docker build for project: ${projectName}...`);

    return new Promise((resolve, reject) => {
      const p = spawn("docker", args);

      p.stdout?.on("data", (data) => logger.info(`[Docker Stdout]: ${data}`));
      p.stderr?.on("data", (data) => logger.error(`[Docker Stderr]: ${data}`));

      p.on("close", (code) => {
        if (code === 0) {
          logger.info(`✅ Local Docker build completed successfully.`);
          resolve(true);
        } else {
          logger.error(`❌ Local Docker build failed with exit code ${code}`);
          reject(new Error(`Docker build failed with code ${code}`));
        }
      });
    });
  }
}

export const dockerService = new DockerService();
export default dockerService;
