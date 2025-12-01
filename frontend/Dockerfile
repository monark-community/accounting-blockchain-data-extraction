# ---------- Base deps layer (cache-friendly) ----------
FROM node:20-alpine AS deps
WORKDIR /app
# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --legacy-peer-deps

# ---------- Dev stage: Next.js dev server ----------
FROM node:20-alpine AS dev
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy only lockfiles (source will be mounted by Docker Compose)
COPY package*.json ./

# Install dependencies (network retries for stability)
RUN npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-retries 5 \
 && npm install --legacy-peer-deps

# Environment variables for Next dev mode
ENV NODE_ENV=development
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Enable reliable file watching on Mac/Windows
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

EXPOSE 3000

# Start the Next.js dev server
CMD ["npm", "run", "dev", "--", "-p", "3000", "-H", "0.0.0.0"]

# ---------- Prod build stage: Next.js build ----------
FROM deps AS builder
COPY . .

# Next.js requires NEXT_PUBLIC_* variables to be available at build time
# This works both with docker-compose (via ARG) and Render.com (via .env.build file)
# On Render.com: .env.build file is committed in the repo
# On local: docker-compose passes variables as ARG from .env at root
ARG NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=""
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ARG NEXT_PUBLIC_ANKR_API_KEY=""
ARG NEXT_PUBLIC_DEFAULT_NETWORKS=""
ARG NEXT_PUBLIC_DASHBOARD_DEFAULT_NETWORKS=""
ARG NEXT_PUBLIC_DASHBOARD_MULTI_LIMIT=""
ARG API_BASE=""

# Convert ARG to ENV (for docker-compose local builds)
ENV NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=${NEXT_PUBLIC_WEB3AUTH_CLIENT_ID}
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}
ENV NEXT_PUBLIC_ANKR_API_KEY=${NEXT_PUBLIC_ANKR_API_KEY}
ENV NEXT_PUBLIC_DEFAULT_NETWORKS=${NEXT_PUBLIC_DEFAULT_NETWORKS}
ENV NEXT_PUBLIC_DASHBOARD_DEFAULT_NETWORKS=${NEXT_PUBLIC_DASHBOARD_DEFAULT_NETWORKS}
ENV NEXT_PUBLIC_DASHBOARD_MULTI_LIMIT=${NEXT_PUBLIC_DASHBOARD_MULTI_LIMIT}
ENV API_BASE=${API_BASE}

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

# Load .env.build if it exists (for Render.com), then run build
# Priority: .env.build file > ENV from ARG
RUN if [ -f .env.build ]; then \
      set -a && \
      . .env.build && \
      set +a; \
    fi && \
    npm run build

# ---------- Prod runtime: Node.js serving Next.js ----------
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --legacy-peer-deps --only=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
