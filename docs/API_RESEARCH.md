# API Research — LedgerLift

Ce document résume les APIs externes utilisées par LedgerLift pour :

1. récupérer des transactions on-chain (Pinax / The Graph Token API)
2. récupérer des prix historiques (CoinGecko)

---

## 1) Pinax Token API (The Graph Token API)

### 1.1 Présentation

La Token API (développée avec Pinax + The Graph) permet d’obtenir :

- transferts de tokens (ERC-20 + natifs)
- balances, metadata de tokens
- swaps DEX, liquidité, etc. :contentReference[oaicite:0]{index=0}

Pour LedgerLift, le besoin principal = **Token Transfers** (transactions) afin de reconstruire un journal comptable.

### 1.2 Authentification

- Auth via **API Token** (fourni dans The Graph Market).
- Attention : il faut utiliser le **token** (pas seulement la “API key”). :contentReference[oaicite:1]{index=1}
- Les JWT émis par Pinax sont aussi supportés (selon la doc FAQ). :contentReference[oaicite:2]{index=2}

### 1.3 SDK TypeScript conseillé (plus simple que coder le REST à la main)

Le SDK `@pinax/token-api` fournit un client TS type-safe.
Exemple (transferts EVM) : :contentReference[oaicite:3]{index=3}

```ts
import { TokenAPI, EVMChains } from "@pinax/token-api";

const client = new TokenAPI({ apiToken: process.env.TOKENAPI_KEY! });

const transfers = await client.evm.tokens.getTransfers({
  network: EVMChains.Ethereum,
  to_address: "0x....",
  limit: 10,
});

console.log(transfers.data);
```
