# ---------- Dependencies layer ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---------- Dev target: ts-node-dev ----------
FROM node:20-alpine AS dev
WORKDIR /app
# Keep dev independent (fast for new contributors)
COPY package*.json ./
RUN npm ci
ENV NODE_ENV=development
ENV PORT=8080
EXPOSE 8080
# Code is bind-mounted at runtime; entry runs in watch mode
CMD ["npm", "run", "dev"]

# ---------- Build target: compile TS ----------
FROM deps AS builder
WORKDIR /app
COPY . .
# Expect "build": "tsc" in package.json
RUN npm run build

# ---------- Prod target: node runtime ----------
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev
# Copy compiled JS
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]