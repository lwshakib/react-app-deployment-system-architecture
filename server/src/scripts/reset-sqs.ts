import { SQSClient, DeleteQueueCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const sqsClient = new SQSClient({
  region: region!,
  credentials: {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  },
});

async function resetSQS() {
  const queueName = "FastDeployQueue";
  console.log(`🔥 Resetting SQS queue: ${queueName}...`);

  try {
    const getUrlRes = await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }));
    const queueUrl = getUrlRes.QueueUrl;

    if (queueUrl) {
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
      console.log(`✅ Queue ${queueName} deleted successfully.`);
    }
  } catch (error: any) {
    if (error.name === "QueueDoesNotExist") {
      console.log("ℹ️ Queue does not exist, skipping.");
    } else {
      console.error("❌ SQS reset failed:", error);
    }
  }
}

resetSQS();
