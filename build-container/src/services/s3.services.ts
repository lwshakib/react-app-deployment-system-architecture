/**
 * S3 Service Module.
 * This service handles the uploading of build artifacts to Amazon S3. 
 * It automatically detects MIME types to ensure files are served correctly by CDNs.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import fs from "fs";

// Import AWS credentials and bucket configuration
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME } from "../envs";

class S3Service {
  // Internal AWS S3 SDK client
  private client: S3Client;
  // Destination bucket name
  private bucketName: string;

  /**
   * Initializes the S3 client with region and credentials.
   */
  constructor() {
    this.bucketName = S3_BUCKET_NAME;
    this.client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Uploads a single file to S3.
   * @param filePath - Local path to the file on disk
   * @param fileKey - Destination path (key) within the S3 bucket
   */
  async uploadFile(filePath: string, fileKey: string) {
    // Read the file content into a buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Prepare the S3 upload command
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentLength: fileBuffer.length,
      // Dynamically lookup the Content-Type (e.g., text/html, application/javascript)
      ContentType: mime.lookup(filePath) || "application/octet-stream",
    });

    try {
      // Execute the upload request
      await this.client.send(command);
    } catch (err: any) {
      // Log failure and re-throw to allow parent to handle the error state
      console.error(`❌ Failed to upload file ${fileKey} to S3:`, err.message);
      throw err;
    }
  }
}

// Export a singleton instance of the S3Service
export const s3Service = new S3Service();
