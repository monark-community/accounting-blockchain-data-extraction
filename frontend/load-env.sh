#!/bin/sh
# Script to load environment variables for Next.js build
# Loads .env.build file if it exists, then executes the command

# Load .env.build if it exists
if [ -f .env.build ]; then
  set -a
  . .env.build
  set +a
fi

# Execute the command passed as arguments
exec "$@"

