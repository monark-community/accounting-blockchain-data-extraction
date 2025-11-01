export const formatCurrency = (
  amount: number,
  currency: string = "USD",
  locale: string = "en-CA"
): string => {
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedAmount = formatter.format(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";

  if (currency === "USD" || currency === "CAD") {
    return `${sign}$ ${formattedAmount}`;
  }

  return `${sign}${currency} ${formattedAmount}`;
};

export const cryptoColors: Record<string, string> = {
  ETH: "bg-blue-100 text-blue-800 border-blue-200",
  BTC: "bg-orange-100 text-orange-800 border-orange-200",
  USDC: "bg-blue-100 text-blue-800 border-blue-200",
  USDT: "bg-green-100 text-green-800 border-green-200",
  MATIC: "bg-purple-100 text-purple-800 border-purple-200",
  SOL: "bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-200",
  BNB: "bg-yellow-100 text-yellow-800 border-yellow-200",
  AVAX: "bg-red-100 text-red-800 border-red-200",
  LINK: "bg-blue-100 text-blue-800 border-blue-200",
  UNI: "bg-pink-100 text-pink-800 border-pink-200",
};

export const networkNames: Record<string, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
  bsc: "Binance Smart Chain",
  avalanche: "Avalanche",
};

export const getCryptoColor = (ticker: string): string => {
  return (
    cryptoColors[ticker.toUpperCase()] ||
    "bg-gray-100 text-gray-800 border-gray-200"
  );
};

export const getNetworkName = (network: string): string => {
  return networkNames[network.toLowerCase()] || network;
};
