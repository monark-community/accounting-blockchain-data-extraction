// import { alchemy } from "../utils/alchemy";
// import { getEthUsdAt, getErc20UsdAt } from "../utils/priceApi";

// type TxRow = {
//   ts: string;
//   hash: string;
//   network: "eth-mainnet";
//   wallet: string;
//   blockNumber: number; // NEW
//   direction: "in" | "out";
//   type: "income" | "expense" | "swap" | "gas";
//   asset: {
//     symbol: string; // normalized to non-null string (e.g., "ETH")
//     contract: string | null;
//     decimals: number; // normalized to a number (18 default)
//   };
//   qty: string;
//   priceUsdAtTs: number | null;
//   usdAtTs: number | null;
//   counterparty: { address: string; label: string | null }; // normalized address string ("" if unknown)
//   fee: null | {
//     asset: "ETH";
//     qty: string;
//     priceUsdAtTs: number | null;
//     usdAtTs: number | null;
//   };
//   isApprox: boolean;
// };

// type CursorState = {
//   out?: string | null; // Alchemy pageKey for outbound transfers
//   in?: string | null; // Alchemy pageKey for inbound transfers
//   kind: "all" | "transactions" | "tokens";
//   limit: number; // page size requested by client
// };

// // What the frontend expects as the response wrapper:
// type TxFeed = {
//   network: "eth-mainnet";
//   wallet: { input: string; address: string; ens: string | null };
//   window: { from: string | null; to: string | null };
//   page: {
//     limit: number;
//     cursor: string | null;
//     nextCursor: string | null;
//     total: number | null;
//   };
//   items: TxRow[];
// };

// function normAddr(a?: string | null) {
//   return a ? a.toLowerCase() : null;
// }

// const kindToCategories = (kind?: string) => {
//   switch ((kind || "all").toLowerCase()) {
//     case "transactions":
//       return ["external", "internal"] as const; // ETH only (normal + internal)
//     case "tokens":
//       return ["erc20"] as const; // ERC-20 only
//     default:
//       return ["external", "internal", "erc20"] as const; // everything (default)
//   }
// };

// async function pullTransfers(
//   direction: "in" | "out",
//   address: string,
//   categories: readonly ("external" | "internal" | "erc20")[],
//   target: number,
//   startPageKey?: string | null
// ): Promise<{ items: any[]; nextPageKey: string | null }> {
//   const paramsBase =
//     direction === "out" ? { fromAddress: address } : { toAddress: address };

//   let pageKey: string | undefined = startPageKey ?? undefined;
//   const acc: any[] = [];
//   const MAX_PAGES = 6; // safety cap

//   for (let i = 0; i < MAX_PAGES; i++) {
//     const res = await alchemy.core.getAssetTransfers({
//       ...paramsBase,
//       category: categories as any,
//       withMetadata: true,
//       order: "desc",
//       maxCount: 100n,
//       pageKey,
//     });
//     acc.push(...(res.transfers || []));
//     pageKey = res.pageKey;
//     if (!pageKey || acc.length >= target) break;
//   }
//   return { items: acc, nextPageKey: pageKey ?? null };
// }

// async function enrichUsdAtTs(rows: TxRow[]) {
//   // group rows by unix-second to batch price lookups
//   const groups = new Map<
//     number,
//     { eth: TxRow[]; erc20ByAddr: Map<string, TxRow[]> }
//   >();

//   for (const r of rows) {
//     const tsSec = Math.floor(new Date(r.ts).getTime() / 1000);
//     let g = groups.get(tsSec);
//     if (!g) {
//       g = { eth: [], erc20ByAddr: new Map() };
//       groups.set(tsSec, g);
//     }
//     const isEth = !r.asset.contract;
//     if (isEth) {
//       g.eth.push(r);
//     } else {
//       const addr = String(r.asset.contract).toLowerCase();
//       const arr = g.erc20ByAddr.get(addr) ?? [];
//       arr.push(r);
//       g.erc20ByAddr.set(addr, arr);
//     }
//   }

//   for (const [tsSec, g] of groups) {
//     // ETH rows
//     if (g.eth.length) {
//       const p = await getEthUsdAt(tsSec);
//       for (const r of g.eth) {
//         const qty = Number(r.qty) || 0;
//         r.priceUsdAtTs = p;
//         r.usdAtTs = p > 0 ? qty * p : null;
//       }
//     }
//     // ERC-20 rows (batch by timestamp)
//     if (g.erc20ByAddr.size) {
//       const addrs = Array.from(g.erc20ByAddr.keys());
//       const priceMap = await getErc20UsdAt(addrs, tsSec); // Map<addrLower, price>
//       for (const addr of addrs) {
//         const price = priceMap.get(addr) ?? 0;
//         for (const r of g.erc20ByAddr.get(addr)!) {
//           const qty = Number(r.qty) || 0;
//           r.priceUsdAtTs = price || null;
//           r.usdAtTs = price > 0 ? qty * price : null;
//         }
//       }
//     }
//   }

//   return rows;
// }

// // BigInt → ETH string (no precision loss)
// function weiToEthString(wei: bigint) {
//   const base = 10n ** 18n;
//   const i = wei / base;
//   const f = (wei % base).toString().padStart(18, "0").replace(/0+$/, "");
//   return f.length ? `${i.toString()}.${f}` : i.toString();
// }

// // Fetch receipts for outbound hashes and create synthetic gas rows
// async function addGasRows(
//   items: TxRow[],
//   walletLower: string
// ): Promise<TxRow[]> {
//   const byHash = new Map<string, TxRow>();
//   for (const r of items) if (r.direction === "out") byHash.set(r.hash, r);
//   if (!byHash.size) return items;

//   const hashes = Array.from(byHash.keys());
//   const batches = [];
//   const cap = 5;
//   for (let i = 0; i < hashes.length; i += cap) {
//     const slice = hashes.slice(i, i + cap);
//     batches.push(
//       Promise.all(
//         slice.map(async (h) => {
//           try {
//             const rcpt = await alchemy.core.getTransactionReceipt(h);
//             if (!rcpt) return null;
//             let gasPrice = rcpt.effectiveGasPrice
//               ? BigInt(rcpt.effectiveGasPrice)
//               : undefined;
//             if (!gasPrice) {
//               const tx = await alchemy.core.getTransaction(h);
//               gasPrice = tx?.gasPrice ? BigInt(tx.gasPrice) : 0n;
//             }
//             const gasUsed = rcpt.gasUsed ? BigInt(rcpt.gasUsed) : 0n;
//             const wei = gasPrice * gasUsed;
//             return { h, wei };
//           } catch {
//             return null;
//           }
//         })
//       )
//     );
//   }

//   const gasRows: TxRow[] = [];
//   for (const batch of await Promise.all(batches)) {
//     for (const entry of batch) {
//       if (!entry) continue;
//       const baseRow = byHash.get(entry.h);
//       if (!baseRow) continue;
//       gasRows.push({
//         ts: baseRow.ts,
//         hash: entry.h,
//         network: baseRow.network,
//         wallet: walletLower,
//         blockNumber: baseRow.blockNumber,
//         direction: "out",
//         type: "gas",
//         asset: { symbol: "ETH", contract: null, decimals: 18 },
//         qty: weiToEthString(entry.wei),
//         priceUsdAtTs: null,
//         usdAtTs: null,
//         counterparty: baseRow.counterparty,
//         fee: null,
//         isApprox: false,
//       });
//     }
//   }

//   const merged = [...items, ...gasRows];
//   merged.sort((a, b) => {
//     if (a.blockNumber !== b.blockNumber) return b.blockNumber - a.blockNumber;
//     return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0;
//   });
//   return merged;
// }

// export async function getLast20Transfers(
//   address: string,
//   type?: "income" | "expense" | "swap" | "gas",
//   kind: "all" | "transactions" | "tokens" = "all",
//   cursor?: string | null,
//   limit: number = 20
// ) {
//   const acct = address.toLowerCase();
//   const categories = kindToCategories(kind);

//   // decode cursor (opaque JSON string)
//   let state: CursorState = { out: null, in: null, kind, limit };
//   try {
//     if (cursor)
//       state = {
//         ...state,
//         ...(JSON.parse(
//           Buffer.from(cursor, "base64").toString("utf8")
//         ) as CursorState),
//       };
//   } catch {}

//   // Over-fetch to classify swaps before slicing
//   const NEED = Math.max(4 * limit, 80);

//   const [
//     { items: outRaw, nextPageKey: outNext },
//     { items: inRaw, nextPageKey: inNext },
//   ] = await Promise.all([
//     pullTransfers("out", acct, categories, NEED, state.out),
//     pullTransfers("in", acct, categories, NEED, state.in),
//   ]);

//   // Normalize
//   const rows: TxRow[] = [];
//   const pushRows = (items: any[], direction: "in" | "out") => {
//     for (const t of items ?? []) {
//       const cat = t.category as string | undefined;
//       const isEth = cat === "external" || cat === "internal";
//       const blockNumber =
//         typeof t.blockNum === "string"
//           ? parseInt(t.blockNum, 16)
//           : t.metadata?.blockNumber
//           ? Number(t.metadata.blockNumber)
//           : 0;
//       const symbol = isEth ? "ETH" : t.asset ?? "TOKEN";
//       const decimals = isEth
//         ? 18
//         : typeof t.rawContract?.decimals === "number"
//         ? t.rawContract.decimals
//         : 18;
//       const contract = isEth ? null : normAddr(t.rawContract?.address);
//       const qty = String(t.value ?? "0");
//       const ts = new Date(
//         t.metadata?.blockTimestamp ?? Date.now()
//       ).toISOString();
//       const hash = t.hash ?? t.uniqueId ?? "";
//       const other = direction === "in" ? normAddr(t.from) : normAddr(t.to);

//       rows.push({
//         ts,
//         hash,
//         network: "eth-mainnet",
//         wallet: acct,
//         blockNumber,
//         direction,
//         type: direction === "in" ? "income" : "expense",
//         asset: { symbol, contract, decimals },
//         qty,
//         priceUsdAtTs: null,
//         usdAtTs: null,
//         counterparty: { address: other ?? "", label: null },
//         fee: null,
//         isApprox: false,
//       });
//     }
//   };

//   pushRows(outRaw, "out");
//   pushRows(inRaw, "in");

//   // Swap marking
//   const byHash = new Map<string, { hasIn: boolean; hasOut: boolean }>();
//   for (const r of rows) {
//     const e = byHash.get(r.hash) ?? { hasIn: false, hasOut: false };
//     if (r.direction === "in") e.hasIn = true;
//     else e.hasOut = true;
//     byHash.set(r.hash, e);
//   }
//   for (const r of rows) {
//     const e = byHash.get(r.hash);
//     if (e && e.hasIn && e.hasOut) r.type = "swap";
//   }

//   // Add gas rows (do not slice yet)
//   let items = await addGasRows(rows, acct);

//   // Final sort and type filter
//   items.sort((a, b) => {
//     if (a.blockNumber !== b.blockNumber) return b.blockNumber - a.blockNumber;
//     return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0;
//   });
//   if (type) items = items.filter((r) => r.type === type);

//   // Page slice at the very end
//   const pageItems = items.slice(0, limit);

//   // Price enrichment on the page slice
//   try {
//     await enrichUsdAtTs(pageItems);
//   } catch (e) {
//     console.error("enrichUsdAtTs failed:", e);
//   }

//   // Build nextCursor from remaining pageKeys if any
//   const nextCursor =
//     outNext || inNext
//       ? Buffer.from(
//           JSON.stringify({
//             out: outNext ?? null,
//             in: inNext ?? null,
//             kind,
//             limit,
//           }),
//           "utf8"
//         ).toString("base64")
//       : null;

//   const feed = {
//     network: "eth-mainnet" as const,
//     wallet: { input: address, address: acct, ens: null },
//     window: { from: null, to: null },
//     page: { limit, cursor: cursor ?? null, nextCursor, total: null },
//     items: pageItems,
//   };

//   return feed;
// }
