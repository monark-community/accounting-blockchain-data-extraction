# ✅ Render.com Deployment Checklist

## 🎯 Before you deploy

- [ ] All files committed to Git
- [ ] Required API keys are ready
- [ ] Render.com account created

## 📋 Files created for deployment

- ✅ `render.yaml` – Render blueprint configuration
- ✅ `backend/.dockerignore` – Files ignored during backend builds
- ✅ `frontend/.dockerignore` – Files ignored during frontend builds
- ✅ `README-RENDER.md` – Full deployment guide
- ✅ `.env.backend.example` – Backend environment template
- ✅ `.env.frontend.example` – Frontend environment template

## 🔑 API keys to gather

### Backend

- [ ] **ANKR_API_KEY** → Create at [ankr.com](https://www.ankr.com/)
- [ ] **ALCHEMY_API_KEY** → Create at [alchemy.com](https://www.alchemy.com/)
- [ ] **GRAPH_TOKEN_API_JWT** → Get from [thegraph.com](https://thegraph.com/)
- [ ] **GRAPH_TOKEN_API_KEY** → Get from [thegraph.com](https://thegraph.com/)

### Frontend

- [ ] **NEXT_PUBLIC_WEB3AUTH_CLIENT_ID** → Create at [web3auth.io](https://web3auth.io/)
- [ ] **NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID** → Create at [walletconnect.com](https://walletconnect.com/)
- [ ] **NEXT_PUBLIC_ANKR_API_KEY** → Same value as the backend key

## 🚀 Deployment steps

### 1. Push to Git
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 2. Create a Blueprint on Render
- [ ] Go to [render.com](https://render.com)
- [ ] Create an account / sign in
- [ ] New + → Blueprint
- [ ] Select your repository
- [ ] Click "Apply"

### 3. Wait for the first deploy
- [ ] Database created (~2 min)
- [ ] Backend deployed (~5 min)
- [ ] Frontend deployed (~5 min)

### 4. Configure backend variables
- [ ] Dashboard → ledgerlift-backend → Environment
- [ ] Add `ANKR_API_KEY`
- [ ] Add `ALCHEMY_API_KEY`
- [ ] Add `GRAPH_TOKEN_API_JWT`
- [ ] Add `GRAPH_TOKEN_API_KEY`
- [ ] Save Changes (auto restart)

### 5. Configure frontend variables
- [ ] Dashboard → ledgerlift-frontend → Environment
- [ ] Add `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`
- [ ] Add `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- [ ] Add `NEXT_PUBLIC_ANKR_API_KEY`
- [ ] Save Changes (auto restart)

### 6. Point the frontend to the backend
- [ ] Copy backend URL: `https://ledgerlift-backend-xxx.onrender.com`
- [ ] Dashboard → ledgerlift-frontend → Environment
- [ ] Update `API_BASE` with that URL
- [ ] Save Changes

### 7. Point the backend to the frontend
- [ ] Copy frontend URL: `https://ledgerlift-frontend-xxx.onrender.com`
- [ ] Dashboard → ledgerlift-backend → Environment
- [ ] Update `FRONTEND_URL` with that URL
- [ ] Save Changes

## ✅ Validation

### Backend
- [ ] Test `https://ledgerlift-backend-xxx.onrender.com/api/health`
- [ ] Response should be `{"status":"ok",...}`

### Frontend
- [ ] Open `https://ledgerlift-frontend-xxx.onrender.com`
- [ ] Landing page renders correctly

### Database
- [ ] Dashboard → ledgerlift-db → Connect
- [ ] Verify tables exist (users, wallets, mfa_secrets, transactions)

### Authentication
- [ ] Test Web3Auth sign-in
- [ ] Confirm dashboard access

## 🎉 Deployment complete!

Your application is online.

**Next steps:**
1. Configure a custom domain (optional)
2. SSL is on by default, confirm certificate status
3. Set up alerts/monitoring
4. Plan database backups

## 📚 Documentation

Need more detail?
- **Full guide** : [README-RENDER.md](./README-RENDER.md)
- **Render docs** : [render.com/docs](https://render.com/docs)

---

**Cost notes:**
- Web services (backend + frontend): free with limits
- Database: free for 90 days, then ~USD $7/month
- Free alternatives: Neon, Supabase, ElephantSQL

---

**Need help?**
- Read [README-RENDER.md](./README-RENDER.md)
- Open a GitHub issue
- Contact Render support
