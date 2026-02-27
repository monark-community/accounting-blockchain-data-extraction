/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * BlockchainService
 * - Récupère les transferts (transactions) d'une adresse via Pinax / The Graph Token API.
 * - Normalise les données dans un format interne stable pour LedgerLift.
 *
 * Prérequis:
 *   npm i @pinax/token-api
 *
 * Env:
 *   TOKENAPI_KEY=...   (API token depuis The Graph Market; voir FAQ sur la différence token vs key)
 */

import { TokenAPI, EVMChains } from "@pinax/token-api";

export type NormalizedTransfer = {
  chain: string;
  txHash: string;
  blockNumber: number;
  timestamp?: string; // ISO si disponible dans la source
  from: string;
  to: string;
  contract?: string; // adresse du token (si ERC-20)
  symbol?: string;
  value: string; // string pour éviter overflow
  decimals?: number;
  direction?: "in" | "out";
};

function chainToEvmNetwork(
  chain: string,
): (typeof EVMChains)[keyof typeof EVMChains] {
  const c = chain.trim().toLowerCase();

  // Ajuste si ton projet utilise d'autres noms
  switch (c) {
    case "eth":
    case "ethereum":
      return EVMChains.Ethereum;
    case "polygon":
    case "matic":
      return EVMChains.Polygon;
    case "bnb":
    case "bsc":
      return EVMChains.BSC;
    case "arbitrum":
    case "arbitrumone":
      return EVMChains.ArbitrumOne;
    case "optimism":
      return EVMChains.Optimism;
    case "base":
      return EVMChains.Base;
    case "avalanche":
    case "avax":
      return EVMChains.Avalanche;
    default:
      throw new Error(`Unsupported chain for EVM transfers: "${chain}"`);
  }
}

export class BlockchainService {
  private client: TokenAPI;

  constructor(apiToken = process.env.TOKENAPI_KEY) {
    if (!apiToken) {
      throw new Error(
        "Missing TOKENAPI_KEY env variable (Pinax/TheGraph Token API token).",
      );
    }
    this.client = new TokenAPI({ apiToken });
  }

  /**
   * Fetch transfers involving an address (in + out) on a given chain.
   * Note: selon la FAQ Token API, l'historique transferts est 30 jours par défaut,
   * et on peut demander plus via `age` jusqu'à 180 jours (selon plan/limites).
   */
  async fetchTransactions(address: string, chain: string) {
    const network = chainToEvmNetwork(chain);

    // 1) entrants (to_address)
    const incoming = await this.client.evm.tokens.getTransfers({
      network,
      to_address: address,
      limit: 500,
      // age: 180, // à activer si supporté sur ton plan/version
    });

    // 2) sortants (from_address)
    const outgoing = await this.client.evm.tokens.getTransfers({
      network,
      from_address: address,
      limit: 500,
      // age: 180,
    });

    // Merge + dédoublonnage (txHash+log index si dispo, sinon txHash+from+to+value+block)
    const merged = [...(incoming.data ?? []), ...(outgoing.data ?? [])];

    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const t of merged) {
      const key =
        (t.transaction_id ?? "") +
        "|" +
        (t.block_num ?? "") +
        "|" +
        (t.from ?? "") +
        "|" +
        (t.to ?? "") +
        "|" +
        (t.amount ?? t.value ?? "");
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(t);
      }
    }

    return deduped;
  }

  /**
   * Normalize raw transfer object to a stable internal structure.
   * `chain` is stored as given (ex: "ethereum", "polygon").
   */
  normalize(
    raw: any,
    chain: string,
    ownerAddress?: string,
  ): NormalizedTransfer {
    const from = (raw.from ?? raw.from_address ?? "").toString();
    const to = (raw.to ?? raw.to_address ?? "").toString();

    const txHash = (
        raw.transaction_id ??
        raw.tx_hash ??
        raw.transaction_hash ??
        raw.hash ??
        ""
).toString();
    
    const blockNumber = Number(raw.block_num ?? raw.block_number ?? 0);

    const value = (raw.amount ?? raw.value ?? raw.value?.toString?.() ?? "0").toString();

    const contract =
      raw.contract?.toString?.() ?? raw.token?.contract?.toString?.();
    const symbol = raw.symbol?.toString?.() ?? raw.token?.symbol?.toString?.();
    const decimals =
      raw.decimals != null
        ? Number(raw.decimals)
        : raw.token?.decimals != null
          ? Number(raw.token.decimals)
          : undefined;

    // timestamp varie selon endpoint; on garde flexible
    const timestamp =
      raw.timestamp?.toString?.() ??
      raw.block_time?.toString?.() ??
      raw.datetime?.toString?.();

    let direction: NormalizedTransfer["direction"];
    if (ownerAddress) {
      const o = ownerAddress.toLowerCase();
      if (to.toLowerCase() === o) direction = "in";
      else if (from.toLowerCase() === o) direction = "out";
    }

    return {
      chain,
      txHash,
      blockNumber,
      timestamp,
      from,
      to,
      contract,
      symbol,
      value,
      decimals,
      direction,
    };
  }
}