import { alchemy } from "../utils/alchemy";
import {
  getEthUsd,
  getErc20Usd,
  getErc20UsdViaDexScreener,
  resolveContractsOnEthereum,
} from "../utils/prices";

function fromHexQty(hex: string, decimals = 18): string {
  const bi = BigInt(hex);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = bi / base;
  const frac = bi % base;
  const s = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, 8)
    .replace(/0+$/, "");
  return s ? `${whole}.${s}` : whole.toString();
}

export async function getHoldings(address: string) {
  const ethBal = await alchemy.core.getBalance(address).catch(() => null);
  if (!ethBal) {
    const err = new Error("Wallet not found");
    (err as any).code = "WalletNotFound";
    throw err;
  }
  const ethQty = fromHexQty((ethBal as any)._hex ?? (ethBal as any), 18);

  const tb = await alchemy.core.getTokenBalances(address);
  const nonZero = tb.tokenBalances.filter(
    (t) => t.tokenBalance && t.tokenBalance !== "0x0"
  );

  const tokens = await Promise.all(
    nonZero.map(async (t) => {
      const md = await alchemy.core
        .getTokenMetadata(t.contractAddress)
        .catch(() => null);
      const decimals = md?.decimals ?? 18;
      const symbol = md?.symbol ?? "UNKNOWN";
      const qty = fromHexQty(t.tokenBalance!, decimals);
      return { contract: t.contractAddress, symbol, decimals, qty };
    })
  );

  return {
    address,
    chain: process.env.ALCHEMY_NETWORK ?? "eth-sepolia",
    currency: "USD",
    asOf: new Date().toISOString(),
    holdings: [
      { contract: null as null, symbol: "ETH", decimals: 18, qty: ethQty },
      ...tokens,
    ],
  };
}

export async function getOverview(address: string) {
  const base = await getHoldings(address); // re-use your existing holdings
  // ETH price
  const ethUsd = await getEthUsd();

  // Collect ERC-20 contracts with qty > 0
  const erc20 = base.holdings.filter((h) => h.contract && Number(h.qty) > 0);
  const contracts = erc20.map((h) => (h.contract as string).toLowerCase());
  const priceMap = await getErc20Usd(contracts);

  // Fallback for missing tokens via DexScreener (objective, liquidity-based)
  const missing = contracts.filter((c) => !priceMap.has(c));
  if (missing.length) {
    const ds = await getErc20UsdViaDexScreener(missing.slice(0, 60)); // cap to stay gentle
    for (const [k, v] of ds) priceMap.set(k, v);
  }

  // Attach prices + values
  const pricedHoldings = base.holdings.map((h) => {
    const qty = Number(h.qty);
    const priceUsd =
      h.contract === null
        ? ethUsd
        : priceMap.get((h.contract || "").toLowerCase()) ?? 0;
    const valueUsd = qty * priceUsd;
    return { ...h, priceUsd, valueUsd };
  });

  // Totals + allocation
  const totalValueUsd = pricedHoldings.reduce((s, h) => s + h.valueUsd, 0);
  const allocation = pricedHoldings
    .filter((h) => h.valueUsd > 0)
    .map((h) => ({
      symbol: h.symbol || "(unknown)",
      valueUsd: h.valueUsd,
      weightPct: totalValueUsd ? (h.valueUsd / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  // Top holdings (top 10 by value)
  const topHoldings = allocation.slice(0, 10);

  return {
    address: base.address,
    asOf: new Date().toISOString(),
    currency: "USD",
    kpis: {
      totalValueUsd,
      delta24hUsd: 0, // next step
      delta24hPct: 0, // next step
    },
    holdings: pricedHoldings,
    allocation,
    topHoldings,
  };
}

export async function getTokenForAddress(params: {
  address: string;
  contract?: string;
  symbol?: string;
}) {
  const address = params.address.trim();
  let contracts: string[] = [];

  if (params.contract) {
    const c = params.contract.trim().toLowerCase();
    if (!c.startsWith("0x") || c.length !== 42)
      throw Object.assign(new Error("Bad contract"), { code: "BadRequest" });
    contracts = [c];
  } else if (params.symbol) {
    contracts = await resolveContractsOnEthereum(params.symbol);
    if (!contracts.length)
      return {
        matches: [],
        note: "No ethereum tokens matched that symbol/name.",
      };
  } else {
    throw Object.assign(new Error("contract or symbol required"), {
      code: "BadRequest",
    });
  }

  // Ask Alchemy for just these contracts (fast)
  const res: any = await alchemy.core.getTokenBalances(address, contracts);
  const balances = (res?.tokenBalances ?? []).map((t: any) => ({
    contract: String(t.contractAddress).toLowerCase(),
    balHex: t.tokenBalance as string | null,
  }));

  // Enrich metadata + qty only for matches with a non-null balance (zero hex still possible)
  const enriched = await Promise.all(
    balances.map(async (b) => {
      const md = await alchemy.core
        .getTokenMetadata(b.contract)
        .catch(() => null);
      const decimals = md?.decimals ?? 18;
      const symbol = md?.symbol ?? "";
      const name = md?.name ?? "";
      const qty = b.balHex ? fromHexQty(b.balHex, decimals) : "0";
      return { contract: b.contract, symbol, name, decimals, qty };
    })
  );

  // Price (DefiLlama first, DexScreener fallback)
  const addrs = enriched.map((e) => e.contract);
  const priceMap = await getErc20Usd(addrs);
  const missing = addrs.filter((a) => !priceMap.has(a));
  if (missing.length) {
    const ds = await getErc20UsdViaDexScreener(missing.slice(0, 60));
    for (const [k, v] of ds) priceMap.set(k, v);
  }

  const items = enriched.map((e) => {
    const priceUsd = priceMap.get(e.contract) ?? 0;
    const valueUsd = Number(e.qty) * priceUsd;
    return { ...e, priceUsd, valueUsd };
  });

  // If user searched by symbol, return all matches; if by contract, return single
  return params.symbol ? { matches: items } : items[0];
}
