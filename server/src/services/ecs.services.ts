import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import logger from "../logger/winston.logger";

class ECSService {
  private client: ECSClient;

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    const containerName = process.env.ECS_CONTAINER_NAME;
    const clusterArn = process.env.ECS_CLUSTER_ARN;
    const taskDefinitionArn = process.env.ECS_TASK_DEFINITION_ARN;

    if (!region || !accessKeyId || !secretAccessKey || !containerName || !clusterArn || !taskDefinitionArn) {
      throw new Error(`❌ Missing AWS/ECS Configuration: ${[
        !region && "AWS_REGION",
        !accessKeyId && "AWS_ACCESS_KEY_ID",
        !secretAccessKey && "AWS_SECRET_ACCESS_KEY",
        !containerName && "ECS_CONTAINER_NAME",
        !clusterArn && "ECS_CLUSTER_ARN",
        !taskDefinitionArn && "ECS_TASK_DEFINITION_ARN"
      ].filter(Boolean).join(", ")}`);
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
            name: process.env.ECS_CONTAINER_NAME!,
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
