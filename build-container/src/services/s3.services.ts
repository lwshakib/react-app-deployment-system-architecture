import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import fs from "fs";

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

  async uploadFile(filePath: string, fileKey: string) {
    const fileBuffer = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentLength: fileBuffer.length,
      ContentType: mime.lookup(filePath) || "application/octet-stream",
    });

    try {
      await this.client.send(command);
    } catch (err: any) {
      console.error(`❌ Failed to upload file ${fileKey} to S3:`, err.message);
      throw err;
    }
  }
}

export const s3Service = new S3Service();
