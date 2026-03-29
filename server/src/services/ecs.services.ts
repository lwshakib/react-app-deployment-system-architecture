import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import logger from "../logger/winston.logger";

class ECSService {
  private client: ECSClient;

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error("❌ AWS environment variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing. ECS service cannot be initialized.");
    }

    this.client = new ECSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Run an ECS Fargate task
   */
  async runTask(params: {
    gitURL: string;
    projectId: string;
    deploymentId: string;
    projectName: string;
  }) {
    const { gitURL, projectId, deploymentId, projectName } = params;

    const command = new RunTaskCommand({
      cluster: process.env.ECS_CLUSTER_ARN,
      taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          subnets: process.env.ECS_SUBNETS!.split(","),
          securityGroups: process.env.ECS_SECURITY_GROUPS!.split(","),
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "builder-image",
            environment: [
              { name: "GIT_REPOSITORY__URL", value: gitURL },
              { name: "PROJECT_ID", value: projectId },
              { name: "DEPLOYMENT_ID", value: deploymentId },
              { name: "PROJECT_NAME", value: projectName },
            ],
          },
        ],
      },
    });

    try {
      const response = await this.client.send(command);
      logger.info(`🚀 ECS Task triggered: ${response.tasks?.[0]?.taskArn}`);
      return response;
    } catch (error) {
      logger.error("❌ ECS Task trigger error:", error);
      throw error;
    }
  }
}

// Export a singleton instance
export const ecsService = new ECSService();
export default ecsService;
