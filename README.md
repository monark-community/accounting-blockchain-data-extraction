# LedgerLift

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![GitHub Issues](https://img.shields.io/github/issues/monark-community/accounting-blockchain-data-extraction)
![GitHub PRs](https://img.shields.io/github/issues-pr/monark-community/accounting-blockchain-data-extraction)
![GitHub Stars](https://img.shields.io/github/stars/monark-community/accounting-blockchain-data-extraction)
![GitHub Forks](https://img.shields.io/github/forks/monark-community/accounting-blockchain-data-extraction)

LedgerLift is a multi-chain analytics platform for financial reporting and audit preparation across individuals, DAOs, and crypto businesses. It connects to user wallets, pulls on-chain history via public APIs or subgraphs, normalizes and classifies flows (income, expenses, transfers, swaps, gas), and turns the results into human-readable outputs for accounting, compliance, or treasury reports (CSV, summaries, QuickBooks/Excel-ready).

## Overview

- Connect user-provided wallets and fetch full transaction history and gas usage.
- Normalize, classify, and enrich transactions with token pricing and metadata.
- Aggregate across multiple wallets and networks for a single financial picture.
- Export results to CSV, financial summaries, QuickBooks/Excel formats, or PDF reports.
- Built to bridge on-chain data with off-chain accounting and audit workflows.

## Key Features

- 📑 Transactions workspace and advanced viewer with filtering, search, and pagination.
- 🧭 Wallet overview with multi-wallet aggregation and labeling.
- 📈 Charts and portfolio analytics (allocation, flows, movers, network activity).
- 🧾 Exports: CSV/JSON, financial reports, QuickBooks/PDF.
- 📊 Capital gains snapshot and cost-basis heuristics.
- 📉 Financial ratios and KPIs for treasury and audit readiness.
- 🛠️ Pricing enrichment and gas aggregation to make reports audit-friendly.

## Project Structure

```
accounting-blockchain-data-extraction/
├── frontend/                 # Next.js app router UI (dashboard, auth, exports)
│   ├── app/                  # Routes, dashboards, and UI logic
│   └── public/               # Static assets
├── backend/                  # Express + TypeScript API (ETL, pricing, routing)
│   ├── src/routes/           # API endpoints
│   ├── src/services/         # Business logic, pricing, ETL
│   ├── src/repositories/     # Data access helpers
│   └── src/utils/            # Shared utilities
├── db/                       # Database assets (e.g., seeds/migrations)
├── docs/                     # Diagrams and deployment guides
├── docker-compose.yml        # Dev/prod orchestration
└── render.yaml               # Render.com deployment config
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Optional: Node.js LTS if running services without containers

### Docker Quickstart

**Frontend (dev, hot reload)**

```bash
cd frontend
docker build -t ledgerlift-frontend:dev --target dev .
docker rm -f frontend-dev 2>/dev/null || true
docker run --name frontend-dev \
  -p 3000:5173 \
  -e CHOKIDAR_USEPOLLING=true \
  -v "$PWD":/app \
  -v /app/node_modules \
  ledgerlift-frontend:dev
# Open http://localhost:3000
```

**Frontend (prod, Nginx)**

```bash
cd frontend
docker build -t ledgerlift-frontend:prod --target prod .
docker rm -f frontend 2>/dev/null || true
docker run --name frontend -p 3000:80 \
  -e BACKEND_URL=http://host.docker.internal:8080 \
  ledgerlift-frontend:prod
# Open http://localhost:3000
```

**Backend (dev, hot reload)**

```bash
cd backend
docker build -t ledgerlift-backend:dev --target dev .
docker rm -f backend-dev 2>/dev/null || true
docker run --name backend-dev -p 8080:8080 \
  -e PORT=8080 \
  -v "$PWD":/app \
  -v /app/node_modules \
  ledgerlift-backend:dev
# Test: curl http://localhost:8080/api/health
```

**Backend (prod)**

```bash
cd backend
docker build -t ledgerlift-backend:prod --target prod .
docker rm -f backend 2>/dev/null || true
docker run --name backend -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  ledgerlift-backend:prod
# Test: curl http://localhost:8080/api/health
```

**Docker Compose**

```bash
# Dev (hot reload)
docker compose --profile dev up --build
# Prod (built, Nginx)
docker compose --profile prod up --build -d
```

Notes:
- Frontend dev maps localhost:3000 → Vite/Next dev server on 5173.
- Frontend prod proxies `/api/*` to `http://backend:8080` inside the compose network.
- Backend health: `GET http://localhost:8080/api/health`.

## Available Scripts

- TODO: document package scripts for frontend and backend.

## Deployment

- Render.com: use `render.yaml` (see README-RENDER.md for step-by-step).
- Docker Compose: `docker compose --profile prod up --build -d`.
- TODO: add cloud-specific notes (env vars, secrets, and storage).

## Documentation

- TODO: link API reference, data model docs, and architectural diagrams.

## Contribution

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for expected behavior.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](./LICENSE) for details.
