/** Convert raw token quantity (hex or decimal string) to a JS number using decimals. */
export async function toDecimalQty(
  input: string | number,
  decimals = 18
): number {
  // Accepts "0x..." hex, decimal string, or number
  let raw: bigint;
  if (typeof input === "number") {
    raw = BigInt(Math.trunc(input));
  } else if (typeof input === "string" && input.startsWith("0x")) {
    raw = BigInt(input);
  } else {
    raw = BigInt(String(input));
  }

  if (decimals === 0) return Number(raw);

  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;

  // Keep up to 6 fractional digits to avoid huge floats
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6);
  return Number(`${whole}.${fracStr}`);
}

export function toHumanQty(row: {
  value?: number;
  amount?: string;
  decimals?: number;
}): string {
  // Prefer Token API's 'value' (already in human units)
  if (typeof row.value === "number" && Number.isFinite(row.value)) {
    return String(row.value);
  }
  // Fallback: divide amount by 10^decimals
  const amountStr = row.amount ?? "0";
  const decimals = Number.isFinite(row.decimals) ? Number(row.decimals) : 18;

  // Avoid BigInt → float precision issues for large amounts:
  // do a string-based decimal shift
  const s = amountStr.replace(/^0+/, "") || "0";
  if (s === "0" || decimals === 0) return s;

  if (s.length <= decimals) {
    // pad on the left with zeros
    const pad = "0".repeat(decimals - s.length);
    return `0.${pad}${s}`.replace(/\.?0+$/, "") || "0";
  }
  const intPart = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}
