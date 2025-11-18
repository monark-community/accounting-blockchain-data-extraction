# 🚀 Déploiement Rapide sur Render.com

## ⚡ Guide Express (5 étapes)

### 1️⃣ Préparer les clés API

Obtenez vos clés sur ces sites :
- [Ankr](https://www.ankr.com/) → ANKR_API_KEY
- [Alchemy](https://www.alchemy.com/) → ALCHEMY_API_KEY  
- [The Graph](https://thegraph.com/) → GRAPH_TOKEN_API_JWT + GRAPH_TOKEN_API_KEY
- [Web3Auth](https://web3auth.io/) → WEB3AUTH_CLIENT_ID
- [WalletConnect](https://walletconnect.com/) → WALLETCONNECT_PROJECT_ID

### 2️⃣ Push sur Git

```bash
git add .
git commit -m "Deploy to Render"
git push origin main
```

### 3️⃣ Créer le Blueprint sur Render

1. Allez sur [render.com](https://render.com)
2. Créez un compte (gratuit)
3. Cliquez **"New +"** → **"Blueprint"**
4. Sélectionnez votre repository
5. Cliquez **"Apply"**

⏱️ Attendez 10-15 minutes pour le premier déploiement

### 4️⃣ Configurer les variables d'environnement

#### Backend (ledgerlift-backend)

Dashboard → ledgerlift-backend → Environment → Ajouter :
```
ANKR_API_KEY=votre_clé
ALCHEMY_API_KEY=votre_clé
GRAPH_TOKEN_API_JWT=votre_jwt
GRAPH_TOKEN_API_KEY=votre_clé
```

#### Frontend (ledgerlift-frontend)

Dashboard → ledgerlift-frontend → Environment → Ajouter :
```
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=votre_id
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=votre_id
NEXT_PUBLIC_ANKR_API_KEY=votre_clé
```

#### Mettre à jour les URLs

Frontend → Environment → Modifier `API_BASE` :
```
API_BASE=https://ledgerlift-backend-xxx.onrender.com
```

Backend → Environment → Modifier `FRONTEND_URL` :
```
FRONTEND_URL=https://ledgerlift-frontend-xxx.onrender.com
```

### 5️⃣ Tester

- Backend : `https://ledgerlift-backend-xxx.onrender.com/api/health`
- Frontend : `https://ledgerlift-frontend-xxx.onrender.com`

## 🎉 C'est tout !

Votre app est en ligne !

---

**Documentation complète** : [README-RENDER.md](./README-RENDER.md)
**Checklist détaillée** : [DEPLOY-CHECKLIST.md](./DEPLOY-CHECKLIST.md)

