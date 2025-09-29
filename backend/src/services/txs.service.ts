import { alchemy } from "../utils/alchemy";

type TxRow = {
  ts: string;
  hash: string;
  network: "eth-mainnet";
  wallet: string;
  direction: "in" | "out";
  type: "income" | "expense" | "swap";
  asset: {
    symbol: string | null;
    contract: string | null;
    decimals: number | null;
  };
  qty: string; // raw decimal string from Alchemy
  usdAtTs: number | null; // fill later
  priceUsdAtTs: number | null; // fill later
  counterparty: { address: string | null; label: string | null };
  fee: { eth: string | null; usd: number | null } | null; // fill later
  isApprox: boolean; // for pricing later
};

function normAddr(a?: string | null) {
  return a ? a.toLowerCase() : null;
}

const kindToCategories = (kind?: string) => {
  switch ((kind || "all").toLowerCase()) {
    case "transactions":
      return ["external", "internal"] as const; // ETH only (normal + internal)
    case "tokens":
      return ["erc20"] as const; // ERC-20 only
    default:
      return ["external", "internal", "erc20"] as const; // everything (default)
  }
};

async function pullTransfers(
  direction: "in" | "out",
  address: string,
  categories: readonly ("external" | "internal" | "erc20")[],
  target: number
) {
  const paramsBase =
    direction === "out" ? { fromAddress: address } : { toAddress: address };

  let pageKey: string | undefined;
  const acc: any[] = [];
  const MAX_PAGES = 6; // safety cap

  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await alchemy.core.getAssetTransfers({
      ...paramsBase,
      category: categories as any,
      withMetadata: true,
      order: "desc",
      maxCount: 100n,
      pageKey,
    });
    acc.push(...(res.transfers || []));
    if (!res.pageKey || acc.length >= target) break;
    pageKey = res.pageKey;
  }
  return acc;
}

export async function getLast20Transfers(
  address: string,
  type?: "income" | "expense" | "swap",
  kind?: "all" | "transactions" | "tokens"
) {
  const acct = address.toLowerCase();
  const categories = kindToCategories(kind);

  // Pull *both* directions with paging; over-fetch to ensure we can slice 20 after merging
  const NEED = 80; // fetch enough to classify swaps then slice to 20
  const [outRaw, inRaw] = await Promise.all([
    pullTransfers("out", acct, categories, NEED),
    pullTransfers("in", acct, categories, NEED),
  ]);

  const rows: TxRow[] = [];
  const pushRows = (items: any[], direction: "in" | "out") => {
    for (const t of items ?? []) {
      const isEthExternal =
        t.category === "external" || t.category === "internal";
      const sym = isEthExternal ? "ETH" : t.asset ?? null;
      const contract = isEthExternal ? null : normAddr(t.rawContract?.address);
      const qty = String(t.value ?? "0");
      const ts = new Date(
        t.metadata?.blockTimestamp ?? Date.now()
      ).toISOString();
      const hash = t.hash ?? t.uniqueId ?? "";
      const counterparty =
        direction === "in" ? normAddr(t.from) : normAddr(t.to);

      rows.push({
        ts,
        hash,
        network: "eth-mainnet",
        wallet: acct,
        direction,
        type: direction === "in" ? "income" : "expense", // temp; swap-marking below
        asset: { symbol: sym, contract, decimals: isEthExternal ? 18 : null },
        qty,
        usdAtTs: null,
        priceUsdAtTs: null,
        counterparty: { address: counterparty, label: null },
        fee: null,
        isApprox: false,
      });
    }
  };

  pushRows(outRaw, "out");
  pushRows(inRaw, "in");

  // Mark swaps: any hash with both in & out → set both legs to "swap"
  const byHash = new Map<string, { hasIn: boolean; hasOut: boolean }>();
  for (const r of rows) {
    const e = byHash.get(r.hash) ?? { hasIn: false, hasOut: false };
    if (r.direction === "in") e.hasIn = true;
    else e.hasOut = true;
    byHash.set(r.hash, e);
  }
  for (const r of rows) {
    const e = byHash.get(r.hash);
    if (e && e.hasIn && e.hasOut) r.type = "swap";
  }

  // Sort newest-first, then slice *exactly* 20 (after optional type filter)
  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  let items = rows;
  if (type) items = items.filter((r) => r.type === type);
  items = items.slice(0, 20);

  return { items, nextCursor: null, hasMore: items.length === 20 }; // cursor comes later
}
