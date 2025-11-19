# 🚀 Render.com Quick Deployment

## ⚡ Express Guide (5 steps)

### 1️⃣ Prepare your API keys

Grab your keys here:
- [Ankr](https://www.ankr.com/) → ANKR_API_KEY
- [Alchemy](https://www.alchemy.com/) → ALCHEMY_API_KEY  
- [The Graph](https://thegraph.com/) → GRAPH_TOKEN_API_JWT + GRAPH_TOKEN_API_KEY
- [Web3Auth](https://web3auth.io/) → WEB3AUTH_CLIENT_ID
- [WalletConnect](https://walletconnect.com/) → WALLETCONNECT_PROJECT_ID

### 2️⃣ Push to Git

```bash
git add .
git commit -m "Deploy to Render"
git push origin main
```

### 3️⃣ Create the Blueprint on Render

1. Go to [render.com](https://render.com)
2. Create an account (free)
3. Click **"New +"** → **"Blueprint"**
4. Select your repository
5. Click **"Apply"**

⏱️ Wait 10-15 minutes for the first deployment

### 4️⃣ Configure environment variables

#### Backend (ledgerlift-backend)

Dashboard → ledgerlift-backend → Environment → Add:
```
ANKR_API_KEY=your_key
ALCHEMY_API_KEY=your_key
GRAPH_TOKEN_API_JWT=your_jwt
GRAPH_TOKEN_API_KEY=your_key
```

#### Frontend (ledgerlift-frontend)

Dashboard → ledgerlift-frontend → Environment → Add:
```
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_id
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id
NEXT_PUBLIC_ANKR_API_KEY=your_key
```

#### Update the URLs

Frontend → Environment → Set `API_BASE`:
```
API_BASE=https://ledgerlift-backend-xxx.onrender.com
```

Backend → Environment → Set `FRONTEND_URL`:
```
FRONTEND_URL=https://ledgerlift-frontend-xxx.onrender.com
```

### 5️⃣ Test everything

- Backend: `https://ledgerlift-backend-xxx.onrender.com/api/health`
- Frontend: `https://ledgerlift-frontend-xxx.onrender.com`

## 🎉 That's it!

Your app is live!

---

**Full docs**: [README-RENDER.md](./README-RENDER.md)  
**Detailed checklist**: [DEPLOY-CHECKLIST.md](./DEPLOY-CHECKLIST.md)

