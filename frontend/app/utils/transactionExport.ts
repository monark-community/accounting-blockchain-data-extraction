import type { TxRow } from "@/lib/types/transactions";
import { shortAddr } from "./transactionHelpers";

export type Scope = "visible" | "loaded";

export const nowStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export const shortForFile = (a: string) =>
  a ? `${a.slice(0, 6)}_${a.slice(-4)}` : "wallet";

export function mapTxForCsv(tx: TxRow) {
  return {
    date_iso: tx.ts,
    type: tx.type,
    direction: tx.direction,
    asset: tx.asset?.symbol ?? "",
    contract: tx.asset?.contract ?? "",
    decimals: tx.asset?.decimals ?? "",
    qty: tx.qty ?? "",
    price_usd_at_ts: tx.priceUsdAtTs ?? "",
    usd_at_ts: tx.usdAtTs ?? "",
    network: tx.network ?? "",
    tx_hash: tx.hash ?? "",
    counterparty: tx.counterparty?.address ?? "",
    counterparty_label: tx.counterparty?.label ?? "",
  };
}

export function toCsv(rows: ReturnType<typeof mapTxForCsv>[]) {
  const headers = Object.keys(rows[0] ?? { date_iso: "", type: "" });
  const escape = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
  ].join("\n");
  return new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), lines], {
    type: "text/csv;charset=utf-8",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(
  address: string,
  rows: TxRow[],
  scope: Scope,
  typeLabel: string
) {
  if (!rows?.length) return;
  const blob = toCsv(rows.map(mapTxForCsv));
  downloadBlob(
    blob,
    `ledgerlift_${shortForFile(
      address
    )}_${typeLabel}_${nowStamp()}_${scope}.csv`
  );
}

export function exportJson(
  address: string,
  rows: TxRow[],
  scope: Scope,
  typeLabel: string
) {
  if (!rows?.length) return;
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: "application/json",
  });
  downloadBlob(
    blob,
    `ledgerlift_${shortForFile(
      address
    )}_${typeLabel}_${nowStamp()}_${scope}.json`
  );
}

