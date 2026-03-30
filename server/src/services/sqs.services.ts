import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { ecsService } from "./ecs.services";
import { dockerService } from "./docker.services";
import { postgresService } from "./postgres.services";
import { eventBus } from "./event-bus.services";
import logger from "../logger/winston.logger";
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SQS_QUEUE_URL, NODE_ENV } from "../envs";

class SQSService {
  private client: SQSClient;
  private queueUrl: string;

  constructor() {
    const region = AWS_REGION;
    const accessKeyId = AWS_ACCESS_KEY_ID;
    const secretAccessKey = AWS_SECRET_ACCESS_KEY;
    const queueUrl = AWS_SQS_QUEUE_URL;

    if (!region || !accessKeyId || !secretAccessKey || !queueUrl) {
      throw new Error("❌ AWS/SQS environment variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SQS_QUEUE_URL) are missing. SQS service cannot be initialized.");
    }

    this.queueUrl = queueUrl;
    this.client = new SQSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async sendMessage(payload: any) {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(payload),
    });

    try {
      const response = await this.client.send(command);
      logger.info(`📨 Message pushed to SQS: ${response.MessageId}`);
      return response;
    } catch (error) {
      logger.error("❌ Failed to send message to SQS:", error);
      throw error;
    }
  }

  async startPolling() {
    logger.info(`🎧 Started polling SQS queue: ${this.queueUrl}`);

    while (true) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
        });

        const response = await this.client.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            if (message.Body) {
              const payload = JSON.parse(message.Body);
              logger.info(`📥 Received deployment request from SQS: ${payload.deploymentId}`);

              const isDev = NODE_ENV === "development";
              
              const taskParams = {
                gitURL: payload.gitURL,
                projectId: payload.projectId,
                deploymentId: payload.deploymentId,
                projectName: payload.projectName,
              };

              try {
                await postgresService.query("UPDATE deployments SET status = 'BUILDING' WHERE id = $1", [payload.deploymentId]);
                eventBus.emit("deployment-status-changed");
              } catch (err) {
                logger.error("❌ Failed to update status to BUILDING:", err);
              }

              try {
                if (isDev) {
                  logger.info(`🏠 Development Mode: Starting local Docker container build...`);
                  await dockerService.runTask(taskParams);
                } else {
                  logger.info(`🌩️ Deployment Mode: Triggering AWS ECS task...`);
                  await ecsService.runTask(taskParams);
                }

                await this.client.send(new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle,
                }));
                logger.info(`✅ Message deleted from SQS: ${message.MessageId}`);
              } catch (error) {
                logger.error("❌ Failed to execute build task, updating status to FAILED:", error);
                await postgresService.query("UPDATE deployments SET status = 'FAILED' WHERE id = $1", [payload.deploymentId]);
                eventBus.emit("deployment-status-changed");
                
                await this.client.send(new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle,
                }));
              }
            }
          }
        }
      } catch (error) {
        logger.error("❌ Error polling SQS:", error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

export const sqsService = new SQSService();
export default sqsService;
