export const NETWORK_OPTIONS = [
  { id: "mainnet", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "polygon", label: "Polygon" },
  { id: "optimism", label: "Optimism" },
  { id: "arbitrum-one", label: "Arbitrum" },
  { id: "bsc", label: "BSC" },
  { id: "avalanche", label: "Avalanche" },
  { id: "unichain", label: "Unichain" },
] as const;

export type NetworkId = (typeof NETWORK_OPTIONS)[number]["id"];
export const NETWORK_IDS: NetworkId[] = NETWORK_OPTIONS.map((n) => n.id);
export const PRIMARY_NETWORK_ID: NetworkId = NETWORK_OPTIONS[0].id;

export const networkLabel = (network?: string | null) => {
  if (!network) return "Unknown";
  return NETWORK_OPTIONS.find((opt) => opt.id === network)?.label ?? network;
};

export const serializeNetworks = (networks: string[]) => {
  return networks.join(",");
};

export const normalizeNetworkListFromString = (
  raw?: string | null
): NetworkId[] => {
  const value = raw ?? "";
  const requested = value
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  const deduped = new Set(requested);
  const ordered = NETWORK_IDS.filter((id) => deduped.has(id));
  return ordered.length ? ordered : [PRIMARY_NETWORK_ID];
};

export const normalizeNetworkList = (
  list: string[] | readonly string[]
): NetworkId[] => {
  const deduped = new Set(list.map((n) => n.trim().toLowerCase()));
  const ordered = NETWORK_IDS.filter((id) => deduped.has(id));
  return ordered.length ? ordered : [PRIMARY_NETWORK_ID];
};
