# Instant React Deploy 🚀

A high-performance, event-driven deployment infrastructure for React applications. Deploy your code in seconds with real-time build monitoring and automated S3-backed hosting.

![System Overview](https://img.shields.io/badge/Architecture-Event--Driven-blue?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Express%20%7C%20Kafka%20%7C%20ECS-original?style=for-the-badge)
![Hosting](https://img.shields.io/badge/Hosting-AWS%20S3%20%2B%20SQS-orange?style=for-the-badge)

## 🏗️ Core Architecture

This system allows users to deploy React repositories by simply providing a GitHub URL. It automates the entire lifecycle:
1.  **Orchestration**: Express Server receives requests and queues them via AWS SQS.
2.  **Build Execution**: AWS ECS (or local Docker) workers pull the code, build the project, and sync artifacts to S3.
3.  **Real-time Logs**: Build progress is streamed via Kafka to the dashboard using Server-Sent Events (SSE).
4.  **Edge Serving**: A specialized S3 Reverse Proxy serves the built apps via custom subdomains.

## 📂 Project Structure

| Component | Description |
| :--- | :--- |
| [`/web`](./web) | Next.js Dashboard for managing projects and viewing live builds. |
| [`/server`](./server) | Main API server (Express) orchestrating the deployment lifecycle. |
| [`/build-container`](./build-container) | The ephemeral build environment (Docker) that compiles the React app. |
| [`/s3-reverse-proxy`](./s3-reverse-proxy) | Wildcard subdomain proxy for serving S3-hosted applications. |

## 🛠️ Getting Started

### Prerequisites

- **Bun** (Preferred) or **Node.js** v20+
- **Docker** & **Docker Compose**
- **AWS Account** (S3, SQS, ECS configured)
- **Aiven/Upstash** (Kafka, Redis, Postgres, ClickHouse)

### Local Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/react-app-deployment-system-architecture.git
    cd react-app-deployment-system-architecture
    ```

2.  **Install Dependencies**:
    ```bash
    # Root dependencies (if any)
    bun install

    # Install for all services
    cd server && bun install
    cd ../web && bun install
    cd ../build-container && bun install
    cd ../s3-reverse-proxy && bun install
    ```

3.  **Environment Variables**:
    Copy `.env.example` to `.env` in `/server`, `/web`, and `/s3-reverse-proxy`. Update with your actual credentials.

4.  **Run Infrastructure**:
    ```bash
    docker-compose up -d
    ```

5.  **Start Services**:
    Open multiple terminals and run `bun run dev` (or `bun run index.ts`) in each service directory.

## 📖 Detailed Documentation

- [System Architecture](./ARCHITECTURE.md) - Deep dive into data flow and diagrams.
- [AWS Setup Guide](./AWS_CONFIGURATION.md) - Step-by-step infrastructure provisioning.
- [Contributing](./CONTRIBUTING.md) - How to help improve the system.
- [Code of Conduct](./CODE_OF_CONDUCT.md) - Our community standards.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.