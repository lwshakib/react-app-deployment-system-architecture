# AWS Infrastructure Setup 🛡️

This guide outlines the manual and automated steps required to provision the AWS resources for the Instant React Deploy system.

## ⚡ Automated Setup (Recommended)

The project includes a suite of automation scripts in `server/src/scripts` that can automatically provision and configure your AWS resources. This is the fastest and most reliable way to get started.

### Prerequisites for Automation
- **AWS CLI** configured (`aws configure`).
- **Docker** running locally (required for ECS image pushing).
- **Environment Variables**: Ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` are set in your `server/.env` file.

### Step 0: Create IAM User & Access Keys
Before running the scripts, you need an IAM user with the permissions to provision infrastructure.

1.  **Create IAM User**:
    - Go to the [IAM Console](https://console.aws.amazon.com/iam/).
    - Click **Users** -> **Create user**.
    - **User name**: `shakib-deploy-orchestrator` (or your preferred name).
    - Click **Next**.
2.  **Set Permissions**:
    - Select **Attach policies directly**.
    - Search for and check **AdministratorAccess**.
    - > [!IMPORTANT]
      > While `AdministratorAccess` is recommended for the initial automated setup to ensure all roles and resources are created successfully, you can later scope down permissions once the infrastructure is stable.
    - Click **Next** -> **Create user**.
3.  **Generate Access Keys**:
    - Click on your newly created user in the list.
    - Select the **Security credentials** tab.
    - Scroll down to **Access keys** and click **Create access key**.
    - Select **Command Line Interface (CLI)**, check the disclaimer, and click **Next**.
    - Click **Create access key**.
    - **Copy** the `Access key ID` and `Secret access key`.
4.  **Configure Environment**:
    - Paste these values into your `server/.env` file:
      ```env
      AWS_ACCESS_KEY_ID=YOUR_COPIED_KEY_ID
      AWS_SECRET_ACCESS_KEY=YOUR_COPIED_SECRET_KEY
      AWS_REGION=ap-south-1
      ```

### Running the Setup Scripts
Execute these commands from the `server` directory. The scripts will create the resources and automatically update your `.env` file with the resulting ARNs and URLs.

```bash
# 1. Provision S3 Bucket & Public Policy
bun run src/scripts/setup-s3.ts

# 2. Provision SQS Task Queue
bun run src/scripts/setup-sqs.ts

# 3. Comprehensive ECS Setup (Roles, ECR, Cluster, Task Definition, Networking)
# Note: This will build and push the local build-container image to AWS ECR.
bun run src/scripts/setup-ecs.ts
```

> [!TIP]
> **Cleanup Scripts**: If you need to teardown your infrastructure, corresponding `reset-*.ts` scripts are available in the same directory. Use them with caution as they will delete AWS resources.

---

## 🛠 Manual Setup

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
    - **Image**: `lwshakib/build-container:latest`.
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
