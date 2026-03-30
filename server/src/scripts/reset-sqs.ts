import { SQSClient, DeleteQueueCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, AWS_SQS_QUEUE_URL } from "../envs";
import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger";

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

    // .env Cleanup
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf-8");
      
      // Remove automated SQS block
      envContent = envContent.replace(/\n?# \[AUTOMATED - SQS\][\s\S]*?(?=\n# |$)/g, "").trim();
      // Safeguard: remove any orphaned AWS_SQS_QUEUE_URL
      envContent = envContent.replace(/AWS_SQS_QUEUE_URL=.*/g, "").trim();

      fs.writeFileSync(envPath, envContent + "\n");
      logger.info("✅ .env file cleaned up for SQS.");
    }

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
