# Deployment Orchestrator ⚙️

The core API and lifecycle manager for the Instant React Deploy system. It manages user projects, build tasks, and live status streaming.

## 🏗️ Core Responsibilities

The server acts as the central brain, coordinating between AWS infrastructure and the frontend dashboard:
1.  **API Services**: Provides endpoints for project creation, deletion, and deployment history (`/api/deployments`).
2.  **Task Queuing**: Pushes new build jobs to AWS SQS with full metadata for workers to consume.
3.  **Real-Time SSE**: Provides a Server-Sent Events (SSE) endpoint for streaming live logs and status changes (`/api/logs/:id/stream`).
4.  **Kafka Consumer**: Consumes status and log events from Kafka topics and relays them to the corresponding active SSE connections.
5.  **Analytics**: Queries ClickHouse for historical build logs on-demand.

## 🛠️ Infrastructure Requirements

-   **PostgreSQL**: Metadata storage for projects and deployments.
-   **ClickHouse**: High-throughput storage for build logs.
-   **Kafka**: Real-time event bus for log and status streaming.
-   **SQS**: Reliable job queue for build task distribution.

## 📡 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/api/deployments`| Triggers a new build task. |
| **GET** | `/api/deployments` | Lists all active and past deployments. |
| **GET** | `/api/deployments/:id` | Returns metadata for a specific deployment. |
| **GET** | `/api/logs/:id`| Fetches historical logs from ClickHouse. |
| **GET** | `/api/logs/:id/stream` | (SSE) Streams real-time build logs. |

## 🚀 Running Locally

### Development
```bash
bun install
bun run dev
```

### Build & Run
```bash
npm run build
npm start
```
