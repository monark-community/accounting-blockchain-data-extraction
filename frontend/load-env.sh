#!/bin/sh
# Script to load environment variables for Next.js build
# Works both locally (with ARG from docker-compose) and on Render.com (with .env.build or environment variables)

# Priority: 1) .env.build file, 2) Environment variables from build context, 3) Already set ENV from ARG

# Load .env.build if it exists (for Render.com - commit this file with your values)
if [ -f .env.build ]; then
  set -a
  . .env.build
  set +a
fi

# Variables are already set as ENV from ARG in Dockerfile
# If they're empty (Render.com case), they'll remain empty unless .env.build or environment variables provide them
# The ENV values set from ARG are already available, so we just need to ensure they're exported

# Execute the command passed as arguments
exec "$@"

