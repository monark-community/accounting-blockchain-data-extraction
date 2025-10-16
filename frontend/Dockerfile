# ---------- Base deps layer (cache-friendly) ----------
FROM node:20-alpine AS deps
WORKDIR /app
# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --legacy-peer-deps

# ---------- Dev stage: Next.js dev server (final image: dev) ----------
FROM node:20-alpine AS dev
WORKDIR /app
# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++
# copy only lockfiles; app code will be bind-mounted at runtime
COPY package*.json ./
# Install dependencies with retry and network timeout
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install --legacy-peer-deps
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- Prod build stage: Next.js build ----------
FROM deps AS builder
COPY . .
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Prod runtime: Node.js serving Next.js (final image: prod) ----------
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --legacy-peer-deps --only=production --legacy-peer-deps
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["npm", "start"]
