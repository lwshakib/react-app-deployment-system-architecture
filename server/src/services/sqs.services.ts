/**
 * AWS SQS Service.
 * This service acts as a task queue manager. It pushes new build requests into
 * the queue and continuously polls the queue to trigger build processes
 * either locally (Docker) or in the cloud (ECS).
 */

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

  /**
   * Initializes the SQS client with AWS credentials and target queue URL.
   */
  constructor() {
    const region = AWS_REGION;
    const accessKeyId = AWS_ACCESS_KEY_ID;
    const secretAccessKey = AWS_SECRET_ACCESS_KEY;
    const queueUrl = AWS_SQS_QUEUE_URL;

    // Critical check for environment configuration
    if (!region || !accessKeyId || !secretAccessKey || !queueUrl) {
      throw new Error("❌ SQS environment variables are missing. SQS service cannot be initialized.");
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

  /**
   * Pushes a new build task payload to the SQS queue.
   * @param payload - Data containing Git URL, Project ID, and Deployment ID
   */
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

  /**
   * Continuous Polling Loop.
   * Periodically checks SQS for new messages and triggers builds.
   */
  async startPolling() {
    logger.info(`🎧 Started polling SQS queue: ${this.queueUrl}`);

    while (true) {
      try {
        // Long polling for 20 seconds to reduce empty API calls and costs
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
        });

        const response = await this.client.send(command);

        // Check if any messages were returned
        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            if (message.Body) {
              const payload = JSON.parse(message.Body);
              logger.info(`📥 Received deployment request from SQS: ${payload.deploymentId}`);

              // Determine execution mode (Local Docker vs AWS ECS)
              const isDev = NODE_ENV === "development";
              
              const taskParams = {
                gitURL: payload.gitURL,
                projectId: payload.projectId,
                deploymentId: payload.deploymentId,
                projectName: payload.projectName,
              };

              // --- STATUS UPDATE: BUILDING ---
              try {
                await postgresService.query("UPDATE deployments SET status = 'BUILDING' WHERE id = $1", [payload.deploymentId]);
                eventBus.emit("deployment-status-changed");
              } catch (err) {
                logger.error("❌ Failed to update status to BUILDING:", err);
              }

              // --- TRIGGER EXECUTION ---
              try {
                if (isDev) {
                  // In development, we run the build-container locally using Docker
                  logger.info(`🏠 Development Mode: Starting local Docker container build...`);
                  await dockerService.runTask(taskParams);
                } else {
                  // In production, we trigger an AWS ECS Fargate task
                  logger.info(`🌩️ Deployment Mode: Triggering AWS ECS task...`);
                  await ecsService.runTask(taskParams);
                }

                // Delete the message from SQS only IF the trigger was successful
                await this.client.send(new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle,
                }));
                logger.info(`✅ Message deleted from SQS: ${message.MessageId}`);
              } catch (error) {
                // Fail-safe: Update status if the build task fails to even start
                logger.error("❌ Failed to execute build task, updating status to FAILED:", error);
                await postgresService.query("UPDATE deployments SET status = 'FAILED' WHERE id = $1", [payload.deploymentId]);
                eventBus.emit("deployment-status-changed");
                
                // Cleanup the dead message from the queue
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
        // Wait before retrying on network/API failure
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// Export a singleton instance of the SQS service
export const sqsService = new SQSService();
export default sqsService;
