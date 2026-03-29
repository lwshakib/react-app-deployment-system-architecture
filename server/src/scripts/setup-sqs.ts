import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";
import fs from "fs";
import path from "path";

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!region || !accessKeyId || !secretAccessKey) {
  console.error("❌ Missing AWS environment variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).");
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
  const queueName = "FastDeployQueue";

  console.log(`🚀 Starting SQS setup for queue: ${queueName}...`);

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

    console.log(`✅ Queue created successfully. URL: ${queueUrl}`);

    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (envContent.includes("AWS_SQS_QUEUE_URL=")) {
      // replace existing
      envContent = envContent.replace(/AWS_SQS_QUEUE_URL=.*/g, `AWS_SQS_QUEUE_URL='${queueUrl}'`);
    } else {
      envContent += `\nAWS_SQS_QUEUE_URL='${queueUrl}'\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log("✅ .env file updated with AWS_SQS_QUEUE_URL");

  } catch (error) {
    console.error("❌ SQS setup failed:", error);
    process.exit(1);
  }
}

setupSQS().then(() => {
  process.exit(0);
});
