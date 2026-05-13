# Contributing to Instant React Deploy 🤝

Thank you for your interest in contributing! We welcome help in improving our deployment infrastructure, dashboard, and documentation.

## 🚀 Local Development Setup

To contribute to this project, you will need a complete local environment.

### Prerequisites
- **Bun** (Preferred) or **Node.js** v20+.
- **Docker** and **Docker Compose**.
- **AWS CLI** configured with an IAM user that has S3, SQS, and ECS permissions.

### Steps to Start Developing

1.  **Fork and Clone**:
    - Click the **Fork** button at the top right of the repository page.
    - Clone your fork locally:
      ```bash
      git clone https://github.com/your-username/react-app-deployment-system-architecture.git
      cd react-app-deployment-system-architecture
      ```
    - Add the original repository as an `upstream` remote to stay in sync:
      ```bash
      git remote add upstream https://github.com/lwshakib/react-app-deployment-system-architecture.git
      ```
2.  **Run Infrastructure**:
    ```bash
    docker-compose up -d
    ```
    This starts a local ClickHouse instance for logging.
3.  **Environment Variables**:
    Setup `.env` files in `server`, `web`, and `s3-reverse-proxy`. Use their respective `.env.example` as a template.
4.  **Install & Run**:
    It is recommended to use **Bun** for the fastest developer experience.
    ```bash
    # In each service directory (server, web, s3-reverse-proxy, build-container)
    bun install
    bun run dev # web (Next.js)
    bun run index.ts # other services
    ```

## 🛠 Project Structure Overview

-   **`/web`**: Next.js frontend using Tailwind and Radix.
-   **`/server`**: Express backend orchestrating AWS and local builds.
-   **`/build-container`**: Dockerized build worker.
-   **`/s3-reverse-proxy`**: High-performance subdomain proxy.

## 📬 Submitting Changes

1.  **Create a Branch**: `git checkout -b feat/your-feature-name`.
2.  **Commit with Clarity**: Use conventional commits (e.g., `feat:`, `fix:`, `docs:`).
3.  **Verify Built Packages**: Ensure `npm run build` passes in `server` and `web`.
4.  **Open a Pull Request**: Provide a clear description of your changes and why they are necessary.

## 🐛 Reporting Bugs

Please use the GitHub Issue tracker to report bugs. Include:
- A clear description of the bug.
- Steps to reproduce.
- Your local environment details (OS, Bun/Node version).

## 📄 License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
