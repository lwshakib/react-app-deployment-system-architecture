import { S3Client, CreateBucketCommand, PutPublicAccessBlockCommand, PutBucketPolicyCommand, HeadBucketCommand, CreateBucketCommandInput } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.S3_BUCKET_NAME;

if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("❌ Missing AWS environment variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME).");
  process.exit(1);
}

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function setupS3() {
  console.log(`🚀 Starting S3 setup for bucket: ${bucketName}...`);

  try {
    let exists = false;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      exists = true;
      console.log(`ℹ️ Bucket ${bucketName} already exists. Proceeding to update configuration.`);
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        exists = false;
      } else {
        throw err;
      }
    }

    if (!exists) {
      const createParams: CreateBucketCommandInput = {
        Bucket: bucketName,
      };
      
      if (region !== 'us-east-1') {
        createParams.CreateBucketConfiguration = {
          LocationConstraint: region as any,
        };
      }

      await s3Client.send(new CreateBucketCommand(createParams));
      console.log(`✅ Bucket ${bucketName} created successfully.`);
    }

    await s3Client.send(new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      }
    }));
    console.log(`✅ Public access blocks disabled.`);

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

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(publicPolicy),
    }));
    
    console.log(`✅ Public read policy attached.`);
    console.log(`🎉 S3 setup complete! Your web files will be publicly accessible.`);

  } catch (error) {
    console.error("❌ S3 setup failed:", error);
    process.exit(1);
  }
}

setupS3().then(() => {
  process.exit(0);
});
