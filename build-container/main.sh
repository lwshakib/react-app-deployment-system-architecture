#!/bin/bash

# Ensure GIT_REPOSITORY__URL is set
if [ -z "$GIT_REPOSITORY__URL" ]; then
  echo "❌ ERROR: GIT_REPOSITORY__URL environment variable is missing"
  exit 1
fi

# Run the build and upload script
# We're using bun here for high performance and direct TS support
exec bun run src/index.ts
