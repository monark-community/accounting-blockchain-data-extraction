// light helpers for formatting, analytics, and colors
export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export const fmtPct = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / 100);

export const CHAIN_LABEL: Record<string, string> = {
  mainnet: "Ethereum",
  polygon: "Polygon",
  base: "Base",
  optimism: "Optimism",
  "arbitrum-one": "Arbitrum",
  bsc: "BNB",
  avalanche: "Avalanche",
  unichain: "Unichain",
};

// keep colors consistent across charts (recharts will pick fill if not set; this is for badges)
export const chainBadgeClass: Record<string, string> = {
  mainnet: "bg-purple-100 text-purple-700",
  polygon: "bg-fuchsia-100 text-fuchsia-700",
  base: "bg-blue-100 text-blue-700",
  optimism: "bg-red-100 text-red-700",
  "arbitrum-one": "bg-sky-100 text-sky-700",
  bsc: "bg-yellow-100 text-yellow-700",
  avalanche: "bg-rose-100 text-rose-700",
  unichain: "bg-emerald-100 text-emerald-700",
};

// Colors for chain stacked area charts and visualizations
export const CHAIN_STACK_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#e11d48",
  "#facc15",
  "#0ea5e9",
];

const BLUE_CHIP_SYMBOLS = [
  "ETH",
  "WETH",
  "WBTC",
  "BTC",
  "STETH",
  "RETH",
  "CBETH",
  "OSMO",
  "BNB",
];

// Herfindahl–Hirschman Index (concentration)
export function computeHHI(weightsPct: number[]) {
  const shares = weightsPct.map((w) => w / 100);
  const hhi = shares.reduce((s, p) => s + p * p, 0); // 0..1
  return hhi * 100; // 0..100 (more intuitive for a badge)
}

// naive stablecoin detector by symbol (optional)
export function isStable(symbol?: string) {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  return [
    "USDT",
    "USDC",
    "DAI",
    "FRAX",
    "TUSD",
    "USDD",
    "LUSD",
    "GUSD",
    "PYUSD",
  ].some((x) => s.startsWith(x));
}

export function isBlueChip(symbol?: string) {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  return BLUE_CHIP_SYMBOLS.some((name) => s.startsWith(name));
}

export type RiskBucketId = "stable" | "bluechip" | "longtail";

export function classifyRiskBucket(symbol?: string): RiskBucketId {
  if (isStable(symbol)) return "stable";
  if (isBlueChip(symbol)) return "bluechip";
  return "longtail";
}
