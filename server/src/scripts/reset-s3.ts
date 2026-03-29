import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import logger from "../logger/winston.logger";

const region = process.env.AWS_REGION;
const bucketName = process.env.S3_BUCKET_NAME;

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function resetS3() {
  if (!bucketName) return;
  logger.info(`🔥 Resetting S3 bucket: ${bucketName}...`);

  try {
    // 1. List all objects
    const listCommand = new ListObjectsV2Command({ Bucket: bucketName });
    const listRes = await s3Client.send(listCommand);

    if (listRes.Contents && listRes.Contents.length > 0) {
      logger.info(`🗑️ Deleting ${listRes.Contents.length} objects...`);
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: listRes.Contents.map((obj) => ({ Key: obj.Key })),
        },
      });
      await s3Client.send(deleteCommand);
    }

    // 2. Delete bucket
    await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    logger.info("✅ S3 bucket deleted successfully.");
  } catch (error: any) {
    if (error.name === "NoSuchBucket") {
      logger.info("ℹ️ Bucket does not exist, skipping.");
    } else {
      logger.error("❌ S3 reset failed:", error);
    }
  }
}

resetS3().then(() => {
  process.exit(0);
});
