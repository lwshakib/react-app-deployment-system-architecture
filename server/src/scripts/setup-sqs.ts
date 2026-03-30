import { CreateQueueCommand, SQSClient } from "@aws-sdk/client-sqs";
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, AWS_SQS_QUEUE_URL } from "../envs";
import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger";

const region = AWS_REGION;
const accessKeyId = AWS_ACCESS_KEY_ID;
const secretAccessKey = AWS_SECRET_ACCESS_KEY;
const queueUrl = AWS_SQS_QUEUE_URL;

if (!region || !accessKeyId || !secretAccessKey || !queueUrl) {
  logger.error("❌ Missing AWS environment variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SQS_QUEUE_URL).");
  process.exit(1);
}

const sqsClient = new SQSClient({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function setupSQS() {
  const queueName = "react-app-deploy-queue";

  logger.info(`🚀 Starting SQS setup for queue: ${queueName}...`);

  try {
    const createParams = {
      QueueName: queueName,
      Attributes: {
        VisibilityTimeout: "60", // seconds 
        MessageRetentionPeriod: "86400", // 1 day
      }
    };

    const response = await sqsClient.send(new CreateQueueCommand(createParams));
    const queueUrl = response.QueueUrl;
    
    if (!queueUrl) {
      throw new Error("QueueUrl is undefined");
    }

    logger.info(`✅ Queue created successfully. URL: ${queueUrl}`);

    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

    // Remove existing SQS automated block if any to maintain clean structure
    envContent = envContent.replace(/\n?# \[AUTOMATED - SQS\][\s\S]*?(?=\n# |$)/g, "");
    envContent = envContent.replace(/AWS_SQS_QUEUE_URL=.*/g, "").trim();

    // Append at the end
    envContent += `\n\n# [AUTOMATED - SQS]\nAWS_SQS_QUEUE_URL='${queueUrl}'\n`;

    fs.writeFileSync(envPath, envContent.trim() + "\n");
    logger.info("✅ .env file updated with AWS_SQS_QUEUE_URL (appended at bottom).");

  } catch (error) {
    logger.error("❌ SQS setup failed:", error);
    process.exit(1);
  }
}

setupSQS().then(() => {
  process.exit(0);
});
