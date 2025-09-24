# ---------- Base deps layer (cache-friendly) ----------
FROM node:20-alpine AS deps
WORKDIR /app
# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ---------- Dev stage: Vite HMR (final image: dev) ----------
FROM node:20-alpine AS dev
WORKDIR /app
# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++
# copy only lockfiles; app code will be bind-mounted at runtime
COPY package*.json ./
# re-use the deps install (faster when Docker cache is warm)
# (optional: if you want to stick to single-step: RUN npm ci)
# keeping npm ci here for independence:
RUN npm ci
ENV HOST=0.0.0.0
ENV CHOKIDAR_USEPOLLING=true
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------- Prod build stage: Vite build ----------
FROM deps AS builder
COPY . .
ENV CI=true
RUN npm run build

# ---------- Prod runtime: Nginx serving /dist (final image: prod) ----------
FROM nginx:1.27-alpine AS prod
WORKDIR /
RUN apk add --no-cache bash gettext
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=builder /app/dist /usr/share/nginx/html
ENV BACKEND_URL=http://backend:8080
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
