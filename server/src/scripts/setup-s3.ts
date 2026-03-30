import { s3Service } from "../services/s3.services";
import logger from "../logger/winston.logger";
import { AWS_REGION, S3_BUCKET_NAME } from "../envs";

const region = AWS_REGION;
const bucketName = S3_BUCKET_NAME;

if (!region || !bucketName) {
  logger.error("❌ Missing AWS environment variables (AWS_REGION, S3_BUCKET_NAME).");
  process.exit(1);
}

async function setupS3() {
  logger.info(`🚀 Starting S3 setup for bucket: ${bucketName}...`);

  try {
    let exists = false;
    try {
      await s3Service.headBucket();
      exists = true;
      logger.info(`ℹ️ Bucket ${bucketName} already exists. Proceeding to update configuration.`);
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        exists = false;
      } else {
        throw err;
      }
    }

    if (!exists) {
      await s3Service.createBucket(region!);
      logger.info(`✅ Bucket ${bucketName} created successfully.`);
    }

    await s3Service.putPublicAccessBlock({
      BlockPublicAcls: false,
      IgnorePublicAcls: false,
      BlockPublicPolicy: false,
      RestrictPublicBuckets: false,
    });
    logger.info(`✅ Public access blocks disabled.`);

    const publicPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`]
        }
      ]
    };

    await s3Service.putBucketPolicy(JSON.stringify(publicPolicy));
    
    logger.info(`✅ Public read policy attached.`);
    logger.info(`🎉 S3 setup complete! Your web files will be publicly accessible.`);

  } catch (error) {
    logger.error("❌ S3 setup failed:", error);
    process.exit(1);
  }
}

setupS3().then(() => {
  process.exit(0);
});
