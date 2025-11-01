## Environment — Docker Quickstart

### Frontend (Vite/React)

**Dev (hot reload on save)**

```powershell
# Build dev image (once)
cd frontend
docker build -t ledgerlift-frontend:dev --target dev .

# Run Vite with your source mounted (HMR)
docker rm -f frontend-dev 2>$null
docker run --name frontend-dev `
  -p 3000:5173 `
  -e CHOKIDAR_USEPOLLING=true `
  --mount type=bind,source="$((Get-Location).Path)",target=/app `
  -v /app/node_modules `
  ledgerlift-frontend:dev
# Open http://localhost:3000
```

**Prod (static build served by Nginx)**

```powershell
cd frontend
docker build -t ledgerlift-frontend:prod --target prod .
docker rm -f frontend 2>$null
docker run --name frontend -p 3000:80 `
  -e BACKEND_URL=http://host.docker.internal:8080 `
  ledgerlift-frontend:prod
# Open http://localhost:3000
```

> The prod container serves `/dist` via Nginx and proxies `/api/*` to `BACKEND_URL`.

---

### Backend (Express + TypeScript)

**Dev (hot reload via ts-node-dev)**

```powershell
cd backend
docker build -t ledgerlift-backend:dev --target dev .
docker rm -f backend-dev 2>$null
docker run --name backend-dev -p 8080:8080 `
  --mount type=bind,source="$((Get-Location).Path)",target=/app `
  -v /app/node_modules `
  -e PORT=8080 `
  ledgerlift-backend:dev
# Test: curl http://localhost:8080/api/health
```

**Prod (compiled TypeScript)**

```powershell
cd backend
docker build -t ledgerlift-backend:prod --target prod .
docker rm -f backend 2>$null
docker run --name backend -p 8080:8080 `
  -e NODE_ENV=production -e PORT=8080 `
  ledgerlift-backend:prod
# Test: curl http://localhost:8080/api/health
```

---

## Docker Compose (orchestration) — Quickstart

### Dev (hot reload)

```powershell
docker compose --profile dev up --build
# Open http://localhost:3000
```

### Prod (built, Nginx)

```powershell
docker compose --profile prod up --build -d
# Open http://localhost:3000
```

### Notes

- Frontend dev maps **localhost:3000 → Vite:5173** (HMR on save).
- Frontend prod proxies `/api/*` to `http://backend:8080` inside the compose network.
- Backend health: `GET http://localhost:8080/api/health`.
