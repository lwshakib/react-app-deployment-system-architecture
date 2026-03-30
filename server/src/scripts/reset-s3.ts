/**
 * AWS S3 Reset Script.
 * This script automates the complete cleanup of the S3 bucket associated with the deployment system,
 * including deleting all objects within the bucket before deleting the bucket itself.
 */

import { s3Service } from "../services/s3.services";
import logger from "../logger/winston.logger";
import { AWS_REGION, S3_BUCKET_NAME } from "../envs";

// Configuration for S3
const region = AWS_REGION;
const bucketName = S3_BUCKET_NAME;

// Validation: Ensure required environment variables are present
if (!region || !bucketName) {
  logger.error("❌ Missing AWS environment variables (AWS_REGION, S3_BUCKET_NAME).");
  process.exit(1);
}

/**
 * Main Reset function for S3.
 */
async function resetS3() {
  if (!bucketName) return;
  logger.info(`🔥 Resetting S3 bucket: ${bucketName}...`);

  try {
    // 1. List all objects in the bucket
    // S3 buckets cannot be deleted unless they are empty
    const listRes = await s3Service.listObjects();

    if (listRes.Contents && listRes.Contents.length > 0) {
      logger.info(`🗑️ Deleting ${listRes.Contents.length} objects...`);
      // Extract keys and perform bulk deletion
      const keys = listRes.Contents.map((obj) => obj.Key!).filter(Boolean);
      await s3Service.deleteObjects(keys);
    }

    // 2. Delete the bucket itself
    await s3Service.deleteBucket();
    logger.info("✅ S3 bucket deleted successfully.");
  } catch (error: any) {
    // Handle specific error: Bucket already deleted or never existed
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
