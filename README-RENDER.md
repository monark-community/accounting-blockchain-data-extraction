# 🚀 Render.com Deployment Guide

This guide walks through deploying **LedgerLift** on Render.com using the automated `render.yaml` file.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Preparation](#preparation)
3. [Automatic Deployment](#automatic-deployment)
4. [Environment Variables](#environment-variables)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Free Plan Limitations](#free-plan-limitations)

---

## 🔧 Prerequisites

Before starting, make sure you have:

- ✅ A GitHub/GitLab account containing your LedgerLift project
- ✅ A Render.com account (free) : [render.com](https://render.com)
- ✅ These API keys:
  - **ANKR_API_KEY** : [ankr.com](https://www.ankr.com/)
  - **ALCHEMY_API_KEY** : [alchemy.com](https://www.alchemy.com/)
  - **GRAPH_TOKEN_API_JWT** : [thegraph.com](https://thegraph.com/)
  - **WEB3AUTH_CLIENT_ID** : [web3auth.io](https://web3auth.io/)
  - **WALLETCONNECT_PROJECT_ID** : [walletconnect.com](https://walletconnect.com/)

---

## 📦 Preparation

### 1. Confirm your code is in Git

```bash
# Check status
git status

# Stage files
git add .

# Commit changes
git commit -m "Ready for Render deployment"

# Push to your repository
git push origin main
```

### 2. Confirm the configuration files exist

Make sure these files are available in your project:
- ✅ `render.yaml` (project root)
- ✅ `backend/Dockerfile`
- ✅ `frontend/Dockerfile`
- ✅ `backend/.dockerignore`
- ✅ `frontend/.dockerignore`
- ✅ `db/init/*.sql` (database initialization scripts)

---

## 🎯 Automatic Deployment

### Step 1: Create your Render account

1. Visit [render.com](https://render.com)
2. Click **"Get Started"**
3. Sign in with your GitHub/GitLab account

### Step 2: Create a Blueprint

1. In the Render dashboard, click **"New +"** in the top right corner
2. Select **"Blueprint"**
3. Connect your GitHub/GitLab repository if needed
4. Pick the **ledgerlift** repository
5. Render automatically detects `render.yaml`
6. Click **"Apply"**

### Step 3: Wait for the first deployment

Render automatically provisions:
- 📊 **PostgreSQL database** : `ledgerlift-db`
- 🔧 **Backend API** : `ledgerlift-backend`
- 🎨 **Frontend** : `ledgerlift-frontend`

⏱️ **Estimated time** : 10-15 minutes for the initial deployment

---

## 🔑 Environment Variables

After the first deploy completes, add the API keys manually.

### Backend (ledgerlift-backend)

1. In the Render dashboard, open **ledgerlift-backend**
2. Go to the **"Environment"** tab
3. Add the **required** variables:

```bash
ANKR_API_KEY=your_ankr_key
ALCHEMY_API_KEY=your_alchemy_key
GRAPH_TOKEN_API_JWT=your_thegraph_jwt
GRAPH_TOKEN_API_KEY=your_thegraph_key
```

4. Optional variables (advanced features):

```bash
PINAX_RPC_URL=optional_pinax_url
RPC_URL_MAINNET=optional_rpc_url
```

5. Click **"Save Changes"**
6. The service restarts automatically

### Frontend (ledgerlift-frontend)

1. In the Render dashboard, open **ledgerlift-frontend**
2. Go to the **"Environment"** tab
3. Add the **required** variables:

```bash
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_web3auth_client_id
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ANKR_API_KEY=your_ankr_key
```

4. Click **"Save Changes"** (auto restart)

### Update service URLs

After Render assigns public URLs, wire the two services together.

#### Frontend ➝ Backend

1. Copy the backend URL: `https://ledgerlift-backend-xxx.onrender.com`
2. Dashboard → **ledgerlift-frontend** → **Environment**
3. Update `API_BASE` with that URL
4. Save and redeploy

#### Backend ➝ Frontend

1. Copy the frontend URL: `https://ledgerlift-frontend-xxx.onrender.com`
2. Dashboard → **ledgerlift-backend** → **Environment**
3. Update `FRONTEND_URL` with that URL
4. Save and redeploy

---

## ✅ Verification

### 1. Check the backend health endpoint

- Navigate to `https://ledgerlift-backend-xxx.onrender.com/api/health`
- You should see `{"status":"ok",...}`

### 2. Load the frontend

- Visit `https://ledgerlift-frontend-xxx.onrender.com`
- Confirm the landing page renders

### 3. Confirm database initialization

- Dashboard → **ledgerlift-db** → **Connect**
- Tables `users`, `wallets`, `mfa_secrets`, `transactions` should exist

### 4. Test authentication

- Click **"Connect Wallet"**
- Log in via Web3Auth
- Confirm you can reach the dashboard

---

## 🔧 Troubleshooting

### Service fails to start

**Symptom**: The service shows "Deploy failed"

**Fixes**:
1. Open the **"Logs"** tab for details
2. Verify that required environment variables are set
3. Confirm the Dockerfile builds locally without errors

### Backend not responding

**Symptom**: HTTP 502 or timeout

**Fixes**:
1. Wait 30-60 seconds (cold start on free plan)
2. Confirm `DATABASE_URL` is populated
3. Tail backend logs to identify stack traces

### Frontend cannot reach backend

**Symptom**: CORS or `Network Error`

**Fixes**:
1. Ensure `API_BASE` in the frontend points to the backend URL
2. Ensure `FRONTEND_URL` in the backend matches the frontend URL
3. Make sure both services are running

### Database connection errors

**Symptom**: "Connection refused" or "Connection timeout"

**Fixes**:
1. Confirm the database service is running
2. Ensure `DATABASE_URL` is the value generated by Render
3. Remember `db/init/*.sql` runs only on the very first boot

---

## ⚠️ Free Plan Limitations

### Web services (backend & frontend)

- 🕐 **Idle timeout**: services sleep after ~15 minutes of no traffic
- ⏱️ **Cold start**: first request after sleep may take 30-60 seconds
- 💾 **Memory**: limited to 512 MB RAM per service
- 🔄 **Restarts**: Render can recycle services periodically

### PostgreSQL database

- 🆓 **Free for 90 days**
- 💾 **Storage**: capped at 1 GB on the free tier
- 📅 **After 90 days**: upgrade to a paid plan (~$7/month)

### Alternative databases

Use an external free tier if you want to avoid future costs:
- **Neon** : [neon.tech](https://neon.tech) — perpetual free tier with limits
- **Supabase** : [supabase.com](https://supabase.com) — free with 500 MB storage
- **ElephantSQL** : [elephantsql.com](https://www.elephantsql.com/) — free with 20 MB

---

## 🔄 Automatic Redeploys

Render redeploys the app every time you push `main`:

```bash
# Make your changes
git add .
git commit -m "Update application"
git push origin main
```

Render then:
1. Detects the new commit
2. Rebuilds the Docker images
3. Re-deploys each service
4. ⏱️ Finishes within ~5-10 minutes

---

## 📊 Monitoring & Logs

### View logs

1. Render dashboard → select a service
2. Open **"Logs"**
3. Stream the live application output

### Metrics

1. Render dashboard → select a service
2. Open **"Metrics"**
3. Inspect CPU, memory, request counts, etc.

---

## 🎉 Congrats!

LedgerLift is now live on Render.com.

**Default URLs**:
- Frontend : `https://ledgerlift-frontend-xxx.onrender.com`
- Backend : `https://ledgerlift-backend-xxx.onrender.com`

---

## 📞 Support

- **Render docs** : [render.com/docs](https://render.com/docs)
- **Render community** : [community.render.com](https://community.render.com)
- **LedgerLift support** : open a GitHub issue

---

**Made with ❤️ by the LedgerLift Team**
