import { alchemy } from "../utils/alchemy";
import { getEthUsd, getErc20Usd } from "../utils/coingecko";

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
