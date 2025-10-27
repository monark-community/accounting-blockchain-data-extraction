// src/config/networks.ts
export type EvmNetwork =
  | "mainnet"
  | "bsc"
  | "polygon"
  | "optimism"
  | "base"
  | "arbitrum-one"
  | "avalanche"
  | "unichain";

export const EVM_NETWORKS: EvmNetwork[] = [
  "mainnet",
  "bsc",
  "polygon",
  "optimism",
  "base",
  "arbitrum-one",
  "avalanche",
  "unichain",
];

export function parseNetworks(q?: string | string[]): EvmNetwork[] {
  if (!q) return EVM_NETWORKS;
  const input = Array.isArray(q) ? q.join(",") : q;
  const picked = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as EvmNetwork[];
  const invalid = picked.filter((p) => !EVM_NETWORKS.includes(p));
  if (invalid.length)
    throw new Error(`Invalid network(s): ${invalid.join(", ")}`);
  return picked.length ? picked : EVM_NETWORKS;
}
