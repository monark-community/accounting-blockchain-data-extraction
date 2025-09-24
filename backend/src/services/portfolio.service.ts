import { alchemy } from "../utils/alchemy";

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
