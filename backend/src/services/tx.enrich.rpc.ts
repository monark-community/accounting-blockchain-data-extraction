// src/services/tx.enrich.rpc.ts
import type { EvmNetwork } from "../config/networks";

type JsonRpc = { jsonrpc: "2.0"; id: number; method: string; params: any[] };
type Receipt = {
  status?: string; // "0x1" | "0x0"
  gasUsed?: string; // hex
  effectiveGasPrice?: string; // hex
  logs?: Array<{ logIndex?: string }>;
};

function hexToNumber(hex?: string): number {
  if (!hex) return 0;
  return Number(BigInt(hex));
}

/** Resolve per-network RPC URL from env. Fallback to PINAX_RPC_URL if provided. */
function rpcUrlFor(network: EvmNetwork): string {
  // Example env names: PINAX_RPC_URL_MAINNET, PINAX_RPC_URL_ARBITRUM_ONE, etc.
  const envKey = `RPC_URL_${network.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const perNet = process.env[envKey];
  const generic = process.env.RPC_URL_MAINNET;
  if (perNet) return perNet;
  if (generic) return generic;
  throw new Error(
    `No RPC URL configured for ${network} (set ${envKey} or RPC_URL_MAINNET)`
  );
}

/** Batch receipts for a single network. */
export async function fetchReceiptsBatch(
  network: EvmNetwork,
  txHashes: `0x${string}`[]
): Promise<
  Record<
    string,
    {
      status: "success" | "reverted" | "unknown";
      gasUsed: number;
      effectiveGasPrice: number;
    }
  >
> {
  if (!txHashes.length) return {};

  const url = rpcUrlFor(network);
  const body: JsonRpc[] = txHashes.map((h, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: "eth_getTransactionReceipt",
    params: [h],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC receipts ${network}: ${res.status}`);

  const json: Array<{ id: number; result?: Receipt; error?: any }> =
    await res.json();

  const out: Record<
    string,
    {
      status: "success" | "reverted" | "unknown";
      gasUsed: number;
      effectiveGasPrice: number;
    }
  > = {};
  json.forEach((r, idx) => {
    const hash = txHashes[idx];
    const rc = r?.result;
    if (!rc) {
      out[hash] = { status: "unknown", gasUsed: 0, effectiveGasPrice: 0 };
      return;
    }
    const status =
      rc.status === "0x1"
        ? "success"
        : rc.status === "0x0"
        ? "reverted"
        : "unknown";
    out[hash] = {
      status,
      gasUsed: hexToNumber(rc.gasUsed),
      effectiveGasPrice: hexToNumber(rc.effectiveGasPrice),
    };
  });

  return out;
}
