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

### Compose (orchestration)

> **Placeholder** — will add once both services are green:

- `frontend` (prod or dev profile)
- `backend` (prod or dev profile)
- `db` (Postgres)
- Shared network; frontend proxies `/api` to `backend:8080`.

```

```
