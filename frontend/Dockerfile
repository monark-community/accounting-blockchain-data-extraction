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
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

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
EXPOSE 3000
CMD ["npm", "start"]
