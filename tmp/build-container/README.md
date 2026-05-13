# Build Worker 🧱

Ephemeral, specialized Docker container for cloning repositories, building React projects, and syncing resulting artifacts to AWS S3.

## 🏗️ Core Logic

The Build Worker manages the entire compilation lifecycle of a deployment:
1.  **Clone**: Checks out the specified repository and commit from GitHub.
2.  **Install**: Resolves dependencies using `npm`, `yarn`, or `pnpm`.
3.  **Build**: Compiles the project (e.g., `npm run build`), generating a static distribution folder.
4.  **S3 Sync**: Recursively uploads the `dist/` or `build/` folder to S3 with correct Metadata and Content-Type headers.
5.  **Status Reporting**: Streams real-time status (`BUILDING`, `READY`, `FAILED`) and live logs to Kafka.

## 🛠️ Requirements

-   **Bun** v1.1+ (Runtime)
-   **Docker** (Containerization)
-   **Git** & **Node.js** (Package managers)

## 📡 Environment Variables

| Variable | Description |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | IAM User access key with S3 permissions. |
| `AWS_SECRET_ACCESS_KEY` | IAM User secret key. |
| `S3_BUCKET_NAME` | Target S3 bucket for build artifacts. |
| `KAFKA_BROKER` | Address of the Kafka cluster. |
| `DEPLOYMENT_ID` | UUID of the deployment for identification. |

## 🚀 Running Locally

Build the container manually for testing:

```bash
docker build -t build-container .
```

Run with required environment variables:

```bash
docker run -e DEPLOYMENT_ID=test-123 -e GIT_REPOSITORY_URL=... build-container
```
