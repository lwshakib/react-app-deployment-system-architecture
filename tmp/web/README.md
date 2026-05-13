# Deployment Dashboard 📊

The specialized Next.js frontend for managing and monitoring the Instant React Deploy system. It provides a real-time, interactive interface for your developers.

## 🏗️ Core Interaction

The Deployment Dashboard provides a seamless, Vercel-like developer experience:
1.  **Project Management**: Create projects by simply pasting a GitHub URL.
2.  **Live Monitoring**: Watch the build progress in a real-time console with line-by-line logs streaming via SSE.
3.  **Deployment History**: View all previous versions, their build status, and their assigned domains.
4.  **Instant Preview**: Direct links to the deployed applications via the S3 Reverse Proxy.

## 🛠️ Stack

-   **Next.js** (App Router)
-   **Tailwind CSS** (Styling)
-   **Radix UI** (Accessible components)
-   **Lucide React** (Icons)
-   **Server-Sent Events (SSE)** (Real-time data streaming)

## 📡 Deployment State Overview

| Status | Description |
| :--- | :--- |
| **QUEUED** | The task has been pushed to SQS, waiting for an ECS worker. |
| **BUILDING** | A build container has picked up the task and is currently compiling. |
| **READY** | Build completed successfully, artifacts uploaded to S3. |
| **FAILED** | Build or upload error occurred. Consult logs. |

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

## 📝 Integration Notes
The dashboard connects to the orchestrator via the `NEXT_PUBLIC_API_BASE_URL` environment variable.
