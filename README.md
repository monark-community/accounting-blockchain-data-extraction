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

- **Frontend (`frontend/`)**
  - `npm run dev` — start the Next.js dev server on port 3000.
  - `npm run build` — create a production build in `.next/`.
  - `npm run start` — run the production server from the built assets.
  - `npm run lint` — lint the frontend codebase.
- **Backend (`backend/`)**
  - `npm run dev` — run the Express API with `ts-node-dev` and hot reload on port 8080.
  - `npm run build` — compile TypeScript sources to `dist/`.
  - `npm run start` — run the compiled API from `dist/index.js`.

## Deployment

- Render.com: use `render.yaml` (see README-RENDER.md for step-by-step). Set backend env vars: `DATABASE_URL` (from Render Postgres), `SESSION_SECRET`, `SESSION_NAME` (optional), `SESSION_TTL_SECONDS` (optional), `FRONTEND_URL`, `ALCHEMY_API_KEY`, `ANKR_API_KEY`, `GRAPH_TOKEN_API_JWT`/`GRAPH_TOKEN_API_KEY`, optional `PINAX_RPC_URL` or per-chain `RPC_URL_*`. Set frontend env vars: `API_BASE` (backend URL), `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_ANKR_API_KEY`, and any other `NEXT_PUBLIC_*` values used in the UI.
- Docker Compose: `docker compose --profile prod up --build -d` (frontend on 3000, backend on 8081 → 8080 in-container, Postgres on 5432). Provide env files in `backend/.env` and `frontend/.env` or override via `environment` in the compose file.
- Database: Postgres initializes from `db/init/*.sql` on first boot; backend also runs the same migrations at startup (idempotent). Persist data with the `pg_data` volume.
- Health checks: backend `GET /api/health` (ports: 8080 in-container, 8081 via compose). Frontend serves on port 3000.
- Production tips: set `NODE_ENV=production`, rotate `SESSION_SECRET`, keep API keys and JWTs in the platform’s secret store (Render Env Vars). Increase container size/worker count if you see timeouts; enable logs to monitor rate-limit issues.

## Environment Reference

- **Backend (`backend/.env`)**
  - `PORT` / `NODE_ENV` — server port and mode; usually `PORT=8080`, `NODE_ENV=production` in prod.
  - `DATABASE_URL` — Postgres connection string; from your DB service (Render Postgres or local compose).
  - `SESSION_SECRET` / `SESSION_NAME` / `SESSION_TTL_SECONDS` — cookie signing and TTL; generate a long random secret.
  - `FRONTEND_URL` — public URL of the frontend for CORS and cookies.
  - `ALCHEMY_API_KEY` / `ALCHEMY_NETWORK` — get from alchemy.com; used for helper RPC utilities (optional).
  - `PINAX_BASE_URL` / `PINAX_API_KEY` / `PINAX_JWT` — from pinax.cloud; used for Pinax REST data.
  - `TOKEN_API_BASE_URL` / `GRAPH_TOKEN_API_KEY` / `GRAPH_TOKEN_API_JWT` — from The Graph token API; primary transaction source.
  - `RPC_URL_*` (e.g., `RPC_URL_MAINNET`) — JSON-RPC endpoints per chain; needed for receipts/gas/status.
  - `ENABLE_*`, `HTTP_TIMEOUT_MS`, `NETWORK_FETCH_CONCURRENCY`, `TOKEN_API_RPM`, `COVALENT_RPM`, `LLAMA_RPM` — feature toggles and rate/timeout tuning.
  - `ENABLE_SPAM_FILTER`, `SPAM_FILTER_MODE`, `TX_DEFAULT_LIMIT`, `TX_MAX_LIMIT`, `TX_DEFAULT_MIN_USD`, `TX_FETCH_WINDOW_CAP`, `TX_RETURN_CAP` — transaction filtering and pagination defaults.
  - `COVALENT_API_KEY` / `MORALIS_API_KEY` — fallbacks for token/tx data; get from covalenthq.com / moralis.io.
  - `DEBUG_TOKEN_API` / `LOGS_DEBUG` — verbose logging switches.
  - `ANKR_API_KEY` — from ankr.com; used for RPC access and pricing fallbacks.
- **Frontend (`frontend/.env`)**
  - `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` — from web3auth.io; enables Web3Auth login.
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from walletconnect.com; powers WalletConnect.
  - `NEXT_PUBLIC_ANKR_API_KEY` — from ankr.com; used client-side where required.
  - `NEXT_PUBLIC_TRANSACTIONS_TIMEOUT_MS` — UI request timeout for long-running tx fetches.
  - `API_BASE` — backend URL the UI calls; set to the API host (e.g., `http://localhost:8080` or Render URL).

## Documentation

- **API**
  - Swagger UI: `GET /api/docs` (served from backend).
  - Endpoints: auth (`/api/auth/*`), wallets (`/api/wallets` CRUD), transactions (`/api/transactions/:address` with filters/cursor), holdings (`/api/holdings/:address`), analytics (`/api/analytics/historical/:address`), networks (`/api/networks/activity/:address`), MFA (`/api/mfa/*`), health (`/api/health`).
- **Data model (Postgres)**
  - `users`: wallet_address (PK), name, MFA fields, timestamps; indexes on wallet_address and MFA.
  - `user_wallets`: (main_wallet_address, address) PK, name, chain_id, is_active, timestamps; indexes on main_wallet_address and address.
- **Flow & operations**
  - Fetch tx data via The Graph Token API (`TOKEN_API_*`), with Pinax/Alchemy helpers and chain RPCs (`RPC_URL_*`) for receipts/gas.
  - Normalize, spam-filter (`ENABLE_SPAM_FILTER` / `SPAM_FILTER_MODE`), then price via DeFiLlama (`ENABLE_DEFI_LLAMA`, `LLAMA_RPM`) with fallbacks (Ankr, DexScreener, Covalent/Moralis if keys set).
  - Timeouts/concurrency/rate limits: `HTTP_TIMEOUT_MS`, `NETWORK_FETCH_CONCURRENCY`, `TOKEN_API_RPM`, `COVALENT_RPM`.
  - Health check: `GET /api/health`. Long requests allowed up to 5 minutes server-side.
- **Dev & testing**
  - Backend dev: `cd backend && npm run dev` (8080). Frontend dev: `cd frontend && npm run dev` (3000; set `API_BASE`).
  - Docker Compose dev: `docker compose --profile dev up --build` (Postgres auto-inits from `db/init/*.sql`; backend reruns migrations idempotently).
  - Testing: no automated suite yet; recommended to add API tests (Jest/Vitest + supertest) for auth/wallets/transactions and UI tests (Testing Library/Playwright) for auth + wallet flows.

## Contribution

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for expected behavior.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](./LICENSE) for details.
