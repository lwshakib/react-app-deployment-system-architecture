import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import logger from "../logger/winston.logger";
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, ECS_CLUSTER_ARN, ECS_CONTAINER_NAME, ECS_SECURITY_GROUPS, ECS_SUBNETS, ECS_TASK_DEFINITION_ARN, KAFKA_BROKER, KAFKA_CA_CERT, KAFKA_PASSWORD, KAFKA_USERNAME, S3_BUCKET_NAME } from "../envs";

class ECSService {
  private client: ECSClient;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private containerName: string;
  private clusterArn: string;
  private taskDefinitionArn: string;

  constructor() {
    this.region = AWS_REGION;
    this.accessKeyId = AWS_ACCESS_KEY_ID;
    this.secretAccessKey = AWS_SECRET_ACCESS_KEY;
    this.containerName = ECS_CONTAINER_NAME;
    this.clusterArn = ECS_CLUSTER_ARN;
    this.taskDefinitionArn = ECS_TASK_DEFINITION_ARN;

    this.client = new ECSClient({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
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
      cluster: ECS_CLUSTER_ARN,
      taskDefinition: ECS_TASK_DEFINITION_ARN,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          subnets: ECS_SUBNETS.split(","),
          securityGroups: ECS_SECURITY_GROUPS.split(","),
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: ECS_CONTAINER_NAME,
            environment: [
              { name: "GIT_REPOSITORY__URL", value: gitURL },
              { name: "PROJECT_ID", value: projectId },
              { name: "DEPLOYMENT_ID", value: deploymentId },
              { name: "PROJECT_NAME", value: projectName },
              // Sync Infrastructure Config
              { name: "AWS_REGION", value: AWS_REGION },
              { name: "AWS_ACCESS_KEY_ID", value: AWS_ACCESS_KEY_ID },
              { name: "AWS_SECRET_ACCESS_KEY", value: AWS_SECRET_ACCESS_KEY },
              { name: "KAFKA_BROKER", value: KAFKA_BROKER },
              { name: "KAFKA_USERNAME", value: KAFKA_USERNAME },
              { name: "KAFKA_PASSWORD", value: KAFKA_PASSWORD },
              { name: "KAFKA_CA_CERT", value: KAFKA_CA_CERT || "" },
              { name: "S3_BUCKET_NAME", value: S3_BUCKET_NAME },
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
