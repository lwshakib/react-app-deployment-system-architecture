import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { ecsService } from "./ecs.service";
import { dockerService } from "./docker.service";
import { postgresService } from "./postgres.service";
import { eventBus } from "./event-bus.service";

class SQSService {
  private client: SQSClient;
  private queueUrl: string;

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const queueUrl = process.env.AWS_SQS_QUEUE_URL;

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
      console.log("📨 Message pushed to SQS:", response.MessageId);
      return response;
    } catch (error) {
      console.error("❌ Failed to send message to SQS:", error);
      throw error;
    }
  }

  async startPolling() {
    console.log(`🎧 Started polling SQS queue: ${this.queueUrl}`);

    while (true) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 1, // Control concurrency per worker
          WaitTimeSeconds: 20, // Long polling
        });

        const response = await this.client.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            if (message.Body) {
              const payload = JSON.parse(message.Body);
              console.log("📥 Received deployment request from SQS:", payload.deploymentId);

              const isDev = process.env.NODE_ENV === "development";
              
              const taskParams = {
                gitURL: payload.gitURL,
                projectId: payload.projectId,
                deploymentId: payload.deploymentId,
                projectName: payload.projectName,
              };

              // Update status to BUILDING immediately
              try {
                await postgresService.query("UPDATE deployments SET status = 'BUILDING' WHERE id = $1", [payload.deploymentId]);
                eventBus.emit("deployment-status-changed");
              } catch (err) {
                console.error("❌ Failed to update status to BUILDING:", err);
              }

              if (isDev) {
                // Trigger Local Docker Task (Faster, free, perfect for dev)
                console.log(`🏠 Development Mode: Starting local Docker container build...`);
                await dockerService.runTask(taskParams);
              } else {
                // Trigger AWS ECS Task (Production-grade, cloud-based)
                console.log(`🌩️ Deployment Mode: Triggering AWS ECS task...`);
                await ecsService.runTask(taskParams);
              }

              // Delete message after successful trigger
              await this.client.send(new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle,
              }));
              console.log("✅ Message deleted from SQS:", message.MessageId);
            }
          }
        }
      } catch (error) {
        console.error("❌ Error polling SQS:", error);
        // Wait a bit before retrying to avoid tight loop on persistent errors
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

export const sqsService = new SQSService();
export default sqsService;
