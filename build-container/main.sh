#!/bin/bash

# Ensure GIT_REPOSITORY__URL is set
if [ -z "$GIT_REPOSITORY__URL" ]; then
  echo "❌ ERROR: GIT_REPOSITORY__URL environment variable is missing"
  exit 1
fi

echo "🚀 Starting Deployment Infrastructure Build Process..."
echo "📂 Cloning repository: $GIT_REPOSITORY__URL"

# Clone the repository into /home/app/output
git clone "$GIT_REPOSITORY__URL" /home/app/output

# Verify clone success
if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to clone repository"
  exit 1
fi

echo "✅ Repository cloned successfully"

# Run the build and upload script
# We're using bun here for high performance and direct TS support
exec bun run index.ts
