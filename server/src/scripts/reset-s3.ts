import { s3Service } from "../services/s3.services";
import logger from "../logger/winston.logger";
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME } from "../envs";

const region = AWS_REGION;
const bucketName = S3_BUCKET_NAME;

if (!region || !bucketName) {
  logger.error("❌ Missing AWS environment variables (AWS_REGION, S3_BUCKET_NAME).");
  process.exit(1);
}

async function resetS3() {
  if (!bucketName) return;
  logger.info(`🔥 Resetting S3 bucket: ${bucketName}...`);

  try {
    // 1. List all objects
    const listRes = await s3Service.listObjects();

    if (listRes.Contents && listRes.Contents.length > 0) {
      logger.info(`🗑️ Deleting ${listRes.Contents.length} objects...`);
      const keys = listRes.Contents.map((obj) => obj.Key!).filter(Boolean);
      await s3Service.deleteObjects(keys);
    }

    // 2. Delete bucket
    await s3Service.deleteBucket();
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
