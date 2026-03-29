import { 
  S3Client, 
  ListObjectsV2Command, 
  DeleteObjectsCommand, 
  HeadBucketCommand, 
  CreateBucketCommand, 
  PutPublicAccessBlockCommand, 
  PutBucketPolicyCommand, 
  DeleteBucketCommand,
  CreateBucketCommandInput
} from "@aws-sdk/client-s3";
import logger from "../logger/winston.logger";

class S3Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME!;
    this.client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async listObjects(prefix?: string) {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    });
    return await this.client.send(command);
  }

  async deleteObjects(keys: string[]) {
    if (keys.length === 0) return;
    const command = new DeleteObjectsCommand({
      Bucket: this.bucketName,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });
    return await this.client.send(command);
  }

  async headBucket() {
    const command = new HeadBucketCommand({ Bucket: this.bucketName });
    return await this.client.send(command);
  }

  async createBucket(region: string) {
    const createParams: CreateBucketCommandInput = {
      Bucket: this.bucketName,
    };
    
    if (region !== 'us-east-1') {
      createParams.CreateBucketConfiguration = {
        LocationConstraint: region as any,
      };
    }
    const command = new CreateBucketCommand(createParams);
    return await this.client.send(command);
  }

  async putPublicAccessBlock(config: any) {
    const command = new PutPublicAccessBlockCommand({
      Bucket: this.bucketName,
      PublicAccessBlockConfiguration: config,
    });
    return await this.client.send(command);
  }

  async putBucketPolicy(policy: string) {
    const command = new PutBucketPolicyCommand({
      Bucket: this.bucketName,
      Policy: policy,
    });
    return await this.client.send(command);
  }

  async deleteBucket() {
    const command = new DeleteBucketCommand({ Bucket: this.bucketName });
    return await this.client.send(command);
  }
}

export const s3Service = new S3Service();
