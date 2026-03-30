# AWS Infrastructure Setup 🛡️

This guide outlines the manual and automated steps required to provision the AWS resources for the Instant React Deploy system.

## 🛠 Prerequisites

-   An active **AWS Account**.
-   **AWS CLI** installed and configured.
-   **IAM User** with programmatic access (Access Key and Secret Access Key).

## 🚀 1. S3 Storage Setup

### Create Bucket
1.  Go to the **S3 Console**.
2.  Create a new bucket (e.g., `react-deploy-exports-123`).
3.  **Block Public Access**: OFF (The reverse proxy needs to access the files, though we will restrict access via IAM).

### CORS Configuration
The built apps may need to fetch assets or make API calls. Add this CORS policy to the bucket:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

## 📨 2. SQS Task Queue Setup

### Create Standard Queue
1.  Go to the **SQS Console**.
2.  Create a **Standard** queue named `react-app-deploy-queue`.
3.  **Visibility Timeout**: 60 seconds (Ensure this is longer than your average build time).
4.  **Message Retention Period**: 4 days.

## 🚢 3. ECS Fargate Setup

### Create Cluster
1.  Go to the **ECS Console**.
2.  Create a new cluster (e.g., `react-app-deploy-cluster`).
3.  Select **AWS Fargate (serverless)**.

### Create Task Definition
1.  **Name**: `react-app-deploy-task`.
2.  **Infrastructure**: AWS Fargate.
3.  **Task Size**: 1 vCPU, 2 GB RAM (Adjust based on project complexity).
4.  **Container Definitions**:
    - **Image**: `your-docker-username/build-container:latest`.
    - **Environment Variables**:
        - `AWS_ACCESS_KEY_ID`: `...`
        - `AWS_SECRET_ACCESS_KEY`: `...`
        - `AWS_REGION`: `ap-south-1`
        - `S3_BUCKET_NAME`: `...`
        - `KAFKA_BROKER`: `...`
        - `KAFKA_USERNAME`: `...`
        - `KAFKA_PASSWORD`: `...`

## 🔑 4. IAM Permissions

Ensure your IAM user has the following permissions:

### S3 Access
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

### SQS & ECS Access
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "ecs:RunTask",
                "iam:PassRole"
            ],
            "Resource": "*"
        }
    ]
}
```

## 📝 Integration Notes
- Copy the **Bucket Name**, **Queue URL**, **Cluster ARN**, and **Task Definition ARN** into your `server/.env` file.
- The `S3_REVERSE_PROXY_URL` should point to your proxy service's public address (e.g., `http://localhost:8080`).
