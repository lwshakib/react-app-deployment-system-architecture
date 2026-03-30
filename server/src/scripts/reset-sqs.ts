import { SQSClient, DeleteQueueCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, AWS_SQS_QUEUE_URL } from "../envs";
import path from "path";
import logger from "../logger/winston.logger";
import { updateEnv } from "../utils/env-updater";

const region = AWS_REGION;
const accessKeyId = AWS_ACCESS_KEY_ID;
const secretAccessKey = AWS_SECRET_ACCESS_KEY;
const queueUrl = AWS_SQS_QUEUE_URL;

if (!region || !accessKeyId || !secretAccessKey || !queueUrl) {
  throw new Error("❌ SQS Environment variables are missing.");
}

const sqsClient = new SQSClient({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

async function resetSQS() {
  const queueName = "react-app-deploy-queue";
  logger.info(`🔥 Resetting SQS queue: ${queueName}...`);

  try {
    const getUrlRes = await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }));
    const queueUrl = getUrlRes.QueueUrl;

    if (queueUrl) {
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
      logger.info(`✅ Queue ${queueName} deleted successfully.`);
    }

    // .env Update with dummy value
    updateEnv("AWS_SQS_QUEUE_URL", "https://sqs.ap-south-1.amazonaws.com/YOUR_ACCOUNT_ID/YOUR_QUEUE_NAME");
    logger.info("✅ .env file updated with placeholder for SQS.");

  } catch (error: any) {
    if (error.name === "QueueDoesNotExist") {
      logger.info("ℹ️ Queue does not exist, skipping.");
    } else {
      logger.error("❌ SQS reset failed:", error);
    }
  }
}

resetSQS().then(() => {
  process.exit(0);
});
