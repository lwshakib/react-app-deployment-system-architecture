import { exec } from "child_process";
import path from "path";

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

    // We point to the root .env to inherit Kafka, S3, and ClickHouse credentials
    const envPath = path.join(process.cwd(), ".env");

    // Construct the docker run command
    // --rm: Remove container after exit
    // --env-file: Load credentials from the server's .env
    // -e: Dynamic overrides for this specific build
    const dockerCommand = [
      `docker run --rm`,
      `--env-file "${envPath}"`,
      `-e GIT_REPOSITORY__URL="${gitURL}"`,
      `-e PROJECT_ID="${projectId}"`,
      `-e DEPLOYMENT_ID="${deploymentId}"`,
      `-e PROJECT_NAME="${projectName}"`,
      `build-container:latest`
    ].join(" ");

    console.log(`🛠️ Triggering local Docker build for project: ${projectName}...`);

    return new Promise((resolve, reject) => {
      const p = exec(dockerCommand);

      p.stdout?.on("data", (data) => console.log(`[Docker Stdout]: ${data}`));
      p.stderr?.on("data", (data) => console.error(`[Docker Stderr]: ${data}`));

      p.on("close", (code) => {
        if (code === 0) {
          console.log(`✅ Local Docker build completed successfully.`);
          resolve(true);
        } else {
          console.error(`❌ Local Docker build failed with exit code ${code}`);
          reject(new Error(`Docker build failed with code ${code}`));
        }
      });
    });
  }
}

export const dockerService = new DockerService();
export default dockerService;
