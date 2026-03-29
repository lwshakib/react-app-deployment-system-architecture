# Use Node.js 20-slim as the base for broad build compatibility
FROM node:20-slim

# Labels for better image management
LABEL maintainer="Antigravity Build System"
LABEL description="Highly-performant build container for serverless React deployments"

# Install system dependencies (git for cloning, curl for health checks, unzip for bun)
# Consolidate RUN commands to reduce layer count and clean up apt cache
RUN apt-get update && \
    apt-get install -y git curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    rm -rf /var/lib/apt/lists/*

# Add Bun to the system PATH
ENV PATH="/root/.bun/bin:$PATH"

# Install pnpm for broad package manager support in user projects
RUN npm install -g pnpm

# Set working directory
WORKDIR /home/app

# Optimized Layer: Copy only dependency files first to leverage Docker's cache
COPY package.json tsconfig.json bun.lock ./

# Use high-performance Bun for container's internal dependency setup
RUN bun install --production

# Strategy: Copy source code and orchestration script after dependencies are ready
COPY src/ ./src/
COPY main.sh ./

# Final permissions check for execution
RUN chmod +x main.sh

# Entrypoint: Bootstraps the orchestration logic
ENTRYPOINT [ "/home/app/main.sh" ]
