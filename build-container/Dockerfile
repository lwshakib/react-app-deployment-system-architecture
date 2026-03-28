# Use Node.js 20 as the base for maximum compatibility with generic project builds
FROM node:20-slim

# Install system dependencies (git for cloning, curl for health checks, unzip for bun)
RUN apt-get update && \
    apt-get install -y git curl unzip && \
    rm -rf /var/lib/apt/lists/*

# Install Bun for high-performance script execution
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install pnpm for broad package manager support
RUN npm install -g pnpm

WORKDIR /home/app

# Copy dependency files and install
COPY package*.json ./
RUN npm install

# Copy application source and orchestration script
COPY index.ts main.sh ./

# Ensure kafka.pem is present in the build directory if required by your broker
COPY kafka_ca.pem kafka_ca.pem 

# Make the orchestration script executable
RUN chmod +x main.sh index.ts

# Entrypoint: clones repo and executes build script
ENTRYPOINT [ "/home/app/main.sh" ]
