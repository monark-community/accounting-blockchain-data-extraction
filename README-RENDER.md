# 🚀 Guide de Déploiement sur Render.com

Ce guide vous explique comment déployer **LedgerLift** sur Render.com en utilisant le fichier `render.yaml` automatisé.

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Préparation](#préparation)
3. [Déploiement automatique](#déploiement-automatique)
4. [Configuration des variables d'environnement](#configuration-des-variables-denvironnement)
5. [Vérification](#vérification)
6. [Dépannage](#dépannage)
7. [Limitations du plan gratuit](#limitations-du-plan-gratuit)

---

## 🔧 Prérequis

Avant de commencer, assurez-vous d'avoir :

- ✅ Un compte GitHub/GitLab avec votre projet LedgerLift
- ✅ Un compte Render.com (gratuit) : [render.com](https://render.com)
- ✅ Les clés API suivantes :
  - **ANKR_API_KEY** : [ankr.com](https://www.ankr.com/)
  - **ALCHEMY_API_KEY** : [alchemy.com](https://www.alchemy.com/)
  - **GRAPH_TOKEN_API_JWT** : [thegraph.com](https://thegraph.com/)
  - **WEB3AUTH_CLIENT_ID** : [web3auth.io](https://web3auth.io/)
  - **WALLETCONNECT_PROJECT_ID** : [walletconnect.com](https://walletconnect.com/)

---

## 📦 Préparation

### 1. Vérifier que votre code est sur Git

```bash
# Vérifier le statut
git status

# Ajouter tous les fichiers
git add .

# Commiter les changements
git commit -m "Prêt pour déploiement Render"

# Pousser vers votre repository
git push origin main
```

### 2. Vérifier les fichiers de configuration

Assurez-vous que ces fichiers existent dans votre projet :
- ✅ `render.yaml` (racine du projet)
- ✅ `backend/Dockerfile`
- ✅ `frontend/Dockerfile`
- ✅ `backend/.dockerignore`
- ✅ `frontend/.dockerignore`
- ✅ `db/init/*.sql` (scripts d'initialisation de la base de données)

---

## 🎯 Déploiement automatique

### Étape 1 : Créer un compte Render

1. Allez sur [render.com](https://render.com)
2. Cliquez sur **"Get Started"**
3. Connectez-vous avec votre compte GitHub/GitLab

### Étape 2 : Créer un Blueprint

1. Dans le dashboard Render, cliquez sur **"New +"** en haut à droite
2. Sélectionnez **"Blueprint"**
3. Connectez votre repository GitHub/GitLab si ce n'est pas déjà fait
4. Sélectionnez le repository **ledgerlift**
5. Render détectera automatiquement le fichier `render.yaml`
6. Cliquez sur **"Apply"**

### Étape 3 : Attendre le déploiement initial

Render va créer automatiquement :
- 📊 **Base de données PostgreSQL** : `ledgerlift-db`
- 🔧 **Backend API** : `ledgerlift-backend`
- 🎨 **Frontend** : `ledgerlift-frontend`

⏱️ **Temps estimé** : 10-15 minutes pour le premier déploiement

---

## 🔑 Configuration des variables d'environnement

Après le déploiement initial, vous devez configurer les clés API manuellement.

### Backend (ledgerlift-backend)

1. Dans le dashboard Render, cliquez sur **ledgerlift-backend**
2. Allez dans l'onglet **"Environment"**
3. Ajoutez ces variables **obligatoires** :

```bash
ANKR_API_KEY=votre_clé_ankr
ALCHEMY_API_KEY=votre_clé_alchemy
GRAPH_TOKEN_API_JWT=votre_jwt_thegraph
GRAPH_TOKEN_API_KEY=votre_clé_thegraph
```

4. Variables **optionnelles** (pour fonctionnalités avancées) :

```bash
PINAX_RPC_URL=votre_url_pinax_optionnelle
RPC_URL_MAINNET=votre_url_rpc_optionnelle
```

5. Cliquez sur **"Save Changes"**
6. Le service va automatiquement redémarrer

### Frontend (ledgerlift-frontend)

1. Dans le dashboard Render, cliquez sur **ledgerlift-frontend**
2. Allez dans l'onglet **"Environment"**
3. Ajoutez ces variables **obligatoires** :

```bash
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=votre_client_id_web3auth
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=votre_project_id_walletconnect
NEXT_PUBLIC_ANKR_API_KEY=votre_clé_ankr
```

4. Cliquez sur **"Save Changes"**
5. Le service va automatiquement redémarrer

### Mise à jour de l'URL du backend

Une fois le backend déployé, vous devez mettre à jour l'URL du backend dans le frontend :

1. Allez dans **ledgerlift-frontend** → **Environment**
2. Modifiez la variable `API_BASE` avec l'URL réelle du backend
   ```bash
   API_BASE=https://ledgerlift-backend-xxx.onrender.com
   ```
   (Remplacez `xxx` par l'identifiant unique de votre service)

---

## ✅ Vérification

### 1. Vérifier la base de données

1. Allez dans **ledgerlift-db** dans le dashboard Render
2. Cliquez sur **"Connect"** → **"External Connection"**
3. Utilisez les informations de connexion avec un client PostgreSQL (pgAdmin, DBeaver, etc.)
4. Vérifiez que les tables ont été créées (users, wallets, mfa_secrets, etc.)

### 2. Vérifier le backend

Ouvrez votre navigateur et testez :

```
https://ledgerlift-backend-xxx.onrender.com/api/health
```

Vous devriez voir une réponse JSON comme :
```json
{
  "status": "ok",
  "timestamp": "2025-01-18T...",
  "env": "mainnet"
}
```

### 3. Vérifier le frontend

Ouvrez votre navigateur :

```
https://ledgerlift-frontend-xxx.onrender.com
```

Vous devriez voir la page d'accueil de LedgerLift.

### 4. Tester l'authentification

1. Cliquez sur **"Connect Wallet"**
2. Testez la connexion avec Web3Auth
3. Vérifiez que vous pouvez accéder au dashboard

---

## 🔧 Dépannage

### Le service ne démarre pas

**Problème** : Le service affiche "Deploy failed"

**Solutions** :
1. Vérifiez les logs dans l'onglet **"Logs"**
2. Vérifiez que toutes les variables d'environnement obligatoires sont configurées
3. Vérifiez que le Dockerfile est correct et sans erreur

### Le backend ne répond pas

**Problème** : Erreur 502 ou timeout

**Solutions** :
1. Attendez 30-60 secondes (démarrage à froid sur le plan gratuit)
2. Vérifiez que `DATABASE_URL` est correctement configurée
3. Vérifiez les logs du backend pour voir les erreurs

### Le frontend ne peut pas contacter le backend

**Problème** : Erreurs CORS ou Network Error

**Solutions** :
1. Vérifiez que `API_BASE` dans le frontend pointe vers la bonne URL du backend
2. Vérifiez que `FRONTEND_URL` dans le backend correspond à l'URL du frontend
3. Vérifiez que les deux services sont en cours d'exécution

### La base de données ne se connecte pas

**Problème** : "Connection refused" ou "Connection timeout"

**Solutions** :
1. Vérifiez que le service de base de données est en cours d'exécution
2. Vérifiez que `DATABASE_URL` est correctement générée par Render
3. Les scripts SQL dans `db/init/` sont exécutés automatiquement au premier démarrage uniquement

---

## ⚠️ Limitations du plan gratuit

### Services Web (Backend & Frontend)

- 🕐 **Inactivité** : Les services "dorment" après 15 minutes d'inactivité
- ⏱️ **Démarrage à froid** : Premier démarrage peut prendre 30-60 secondes
- 💾 **Mémoire** : Limitée à 512 MB RAM par service
- 🔄 **Redémarrage** : Services peuvent redémarrer automatiquement après certaines limites

### Base de données PostgreSQL

- 🆓 **Gratuit pendant 90 jours** après création
- 💾 **Stockage** : Limité à 1 GB sur le plan gratuit
- 📅 **Après 90 jours** : Nécessite un upgrade vers un plan payant (~7$/mois)

### Alternatives pour la base de données

Si vous voulez éviter les frais après 90 jours, considérez :
- **Neon** : [neon.tech](https://neon.tech) - Plan gratuit permanent avec limites
- **Supabase** : [supabase.com](https://supabase.com) - Plan gratuit avec 500 MB
- **ElephantSQL** : [elephantsql.com](https://www.elephantsql.com/) - Plan gratuit avec 20 MB

---

## 🔄 Redéploiement automatique

Render redéploie automatiquement votre application à chaque push sur la branche `main` :

```bash
# Faire des modifications
git add .
git commit -m "Mise à jour de l'application"
git push origin main
```

Render va :
1. Détecter le nouveau commit
2. Rebuilder les images Docker
3. Redéployer les services automatiquement
4. ⏱️ Temps estimé : 5-10 minutes

---

## 📊 Monitoring et Logs

### Consulter les logs

1. Dashboard Render → Votre service
2. Onglet **"Logs"**
3. Logs en temps réel de votre application

### Métriques

1. Dashboard Render → Votre service
2. Onglet **"Metrics"**
3. Voir CPU, mémoire, requêtes, etc.

---

## 🎉 Félicitations !

Votre application LedgerLift est maintenant déployée sur Render.com !

**URLs de votre application** :
- Frontend : `https://ledgerlift-frontend-xxx.onrender.com`
- Backend : `https://ledgerlift-backend-xxx.onrender.com`

---

## 📞 Support

- **Documentation Render** : [render.com/docs](https://render.com/docs)
- **Community Render** : [community.render.com](https://community.render.com)
- **Support LedgerLift** : Ouvrir une issue sur GitHub

---

**Made with ❤️ by LedgerLift Team**

