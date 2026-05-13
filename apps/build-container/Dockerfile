# Use Node.js 20-slim as the base for broad build compatibility
FROM node:20-slim

# Labels for better image management
LABEL maintainer="React App Deployment System"
LABEL description="Highly-performant build container for automated React deployments"

# Install system dependencies (git for cloning, curl for health checks)
RUN apt-get update && \
    apt-get install -y git curl && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm to support building user projects that use it as their package manager
# This ensures the build worker can handle any React project regardless of its package manager
RUN npm install -g pnpm

# Set working directory
WORKDIR /home/app

# Optimized Layer: Copy only manifest files first to leverage Docker's cache
# Note: Lock file is excluded per user preference for build container internal setup
COPY package.json tsconfig.json ./

# Internal dependency setup using npm
RUN npm install

# Copy source code
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Entrypoint: Executes the build orchestration directly via Node.js
ENTRYPOINT [ "node", "dist/index.js" ]
