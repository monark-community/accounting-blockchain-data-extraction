# ✅ Checklist de Déploiement Render.com

## 🎯 Avant de déployer

- [ ] Tous les fichiers sont committés sur Git
- [ ] Vous avez toutes les clés API nécessaires
- [ ] Vous avez un compte Render.com

## 📋 Fichiers créés pour le déploiement

- ✅ `render.yaml` - Configuration automatique Render
- ✅ `backend/.dockerignore` - Fichiers à exclure du build backend
- ✅ `frontend/.dockerignore` - Fichiers à exclure du build frontend
- ✅ `README-RENDER.md` - Guide complet de déploiement
- ✅ `.env.backend.example` - Template des variables backend
- ✅ `.env.frontend.example` - Template des variables frontend

## 🔑 Clés API à préparer

### Backend

- [ ] **ANKR_API_KEY** → Créer sur [ankr.com](https://www.ankr.com/)
- [ ] **ALCHEMY_API_KEY** → Créer sur [alchemy.com](https://www.alchemy.com/)
- [ ] **GRAPH_TOKEN_API_JWT** → Obtenir sur [thegraph.com](https://thegraph.com/)
- [ ] **GRAPH_TOKEN_API_KEY** → Obtenir sur [thegraph.com](https://thegraph.com/)

### Frontend

- [ ] **NEXT_PUBLIC_WEB3AUTH_CLIENT_ID** → Créer sur [web3auth.io](https://web3auth.io/)
- [ ] **NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID** → Créer sur [walletconnect.com](https://walletconnect.com/)
- [ ] **NEXT_PUBLIC_ANKR_API_KEY** → Même clé que le backend

## 🚀 Étapes de déploiement

### 1. Push sur Git
```bash
git add .
git commit -m "Prêt pour déploiement Render"
git push origin main
```

### 2. Créer un Blueprint sur Render
- [ ] Aller sur [render.com](https://render.com)
- [ ] Créer un compte / Se connecter
- [ ] New + → Blueprint
- [ ] Sélectionner votre repository
- [ ] Cliquer sur "Apply"

### 3. Attendre le déploiement initial
- [ ] Base de données créée (~2 min)
- [ ] Backend déployé (~5 min)
- [ ] Frontend déployé (~5 min)

### 4. Configurer les variables Backend
- [ ] Dashboard → ledgerlift-backend → Environment
- [ ] Ajouter `ANKR_API_KEY`
- [ ] Ajouter `ALCHEMY_API_KEY`
- [ ] Ajouter `GRAPH_TOKEN_API_JWT`
- [ ] Ajouter `GRAPH_TOKEN_API_KEY`
- [ ] Save Changes (redémarrage automatique)

### 5. Configurer les variables Frontend
- [ ] Dashboard → ledgerlift-frontend → Environment
- [ ] Ajouter `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`
- [ ] Ajouter `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- [ ] Ajouter `NEXT_PUBLIC_ANKR_API_KEY`
- [ ] Save Changes (redémarrage automatique)

### 6. Mettre à jour l'URL du Backend dans le Frontend
- [ ] Noter l'URL du backend : `https://ledgerlift-backend-xxx.onrender.com`
- [ ] Dashboard → ledgerlift-frontend → Environment
- [ ] Modifier `API_BASE` avec l'URL notée ci-dessus
- [ ] Save Changes

### 7. Mettre à jour l'URL du Frontend dans le Backend
- [ ] Noter l'URL du frontend : `https://ledgerlift-frontend-xxx.onrender.com`
- [ ] Dashboard → ledgerlift-backend → Environment
- [ ] Modifier `FRONTEND_URL` avec l'URL notée ci-dessus
- [ ] Save Changes

## ✅ Vérification

### Backend
- [ ] Tester : `https://ledgerlift-backend-xxx.onrender.com/api/health`
- [ ] Devrait retourner : `{"status":"ok",...}`

### Frontend
- [ ] Ouvrir : `https://ledgerlift-frontend-xxx.onrender.com`
- [ ] La page d'accueil s'affiche correctement

### Base de données
- [ ] Dashboard → ledgerlift-db → Connect
- [ ] Vérifier que les tables existent (users, wallets, mfa_secrets, transactions)

### Authentification
- [ ] Tester la connexion avec Web3Auth
- [ ] Vérifier l'accès au dashboard

## 🎉 Déploiement terminé !

Votre application est maintenant en ligne ! 

**Prochaines étapes :**
1. Configurer un nom de domaine personnalisé (optionnel)
2. Activer le SSL (activé par défaut sur Render)
3. Configurer les alertes et monitoring
4. Mettre en place des backups de la base de données

## 📚 Documentation

Pour plus de détails, consultez :
- **Guide complet** : [README-RENDER.md](./README-RENDER.md)
- **Documentation Render** : [render.com/docs](https://render.com/docs)

---

**Note sur les coûts :**
- Services web (backend + frontend) : Gratuit avec limitations
- Base de données : Gratuit pendant 90 jours, puis ~7$/mois
- Alternatives gratuites : Neon, Supabase, ElephantSQL

---

**Besoin d'aide ?**
- Consultez le [README-RENDER.md](./README-RENDER.md)
- Ouvrez une issue sur GitHub
- Contactez le support Render

