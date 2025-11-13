import { EVM_NETWORKS, type EvmNetwork } from "../config/networks";
import {
  fetchFungibleTransfersPage,
  fetchNftTransfersPage,
} from "./tx.sources.pinax";
import type { PageParams } from "../types/transactions";

export type NetworkActivitySummary = {
  network: EvmNetwork;
  lastActivityTs: number | null;
  direction: "in" | "out" | "unknown";
  txHash?: `0x${string}` | null;
};

const ACTIVITY_PAGE_LIMIT = Math.max(
  1,
  Number(process.env.NETWORK_ACTIVITY_PAGE_LIMIT ?? 5)
);
const ACTIVITY_CONCURRENCY = Math.max(
  1,
  Number(process.env.NETWORK_ACTIVITY_CONCURRENCY ?? 2)
);

const toChecksum = (address: string): `0x${string}` =>
  (address || "0x0").toLowerCase() as `0x${string}`;

async function getLatestActivityForNetwork(
  network: EvmNetwork,
  wallet: `0x${string}`
): Promise<NetworkActivitySummary> {
  const params: PageParams = {
    network,
    address: wallet,
    page: 1,
    limit: ACTIVITY_PAGE_LIMIT,
  };
  const [fungible, nft] = await Promise.all([
    fetchFungibleTransfersPage(params).catch((err) => {
      console.error(
        `[network-activity] fungible fetch failed for ${network}:`,
        err?.message ?? err
      );
      return [];
    }),
    fetchNftTransfersPage(params).catch((err) => {
      console.error(
        `[network-activity] nft fetch failed for ${network}:`,
        err?.message ?? err
      );
      return [];
    }),
  ]);

  let latestTs = 0;
  let latestDirection: "in" | "out" | "unknown" = "unknown";
  let latestHash: `0x${string}` | null = null;

  const consider = (
    ts?: number | null,
    txHash?: string | null,
    direction: "in" | "out" | "unknown" = "unknown"
  ) => {
    if (!ts || !txHash) return;
    if (ts > latestTs) {
      latestTs = ts;
      latestHash = txHash as `0x${string}`;
      latestDirection = direction;
    }
  };

  const walletLc = wallet.toLowerCase();
  for (const row of fungible) {
    const from = row.from?.toLowerCase();
    const direction: "in" | "out" =
      from === walletLc ? "out" : "in";
    consider(row.timestamp, row.transaction_id, direction);
  }
  for (const row of nft) {
    const from = row.from?.toLowerCase() ?? "";
    const direction: "in" | "out" =
      from === walletLc ? "out" : "in";
    consider(row.timestamp, row.transaction_id, direction);
  }

  return {
    network,
    lastActivityTs: latestTs || null,
    direction: latestTs ? latestDirection : "unknown",
    txHash: latestHash,
  };
}

export async function getNetworkActivitySummary(
  address: string,
  networks: EvmNetwork[] = EVM_NETWORKS
): Promise<NetworkActivitySummary[]> {
  const wallet = toChecksum(address);
  const queue = [...networks];
  const results: NetworkActivitySummary[] = [];

  async function worker() {
    while (queue.length) {
      const net = queue.shift();
      if (!net) break;
      try {
        const summary = await getLatestActivityForNetwork(net, wallet);
        results.push(summary);
      } catch (err: any) {
        console.error(
          `[network-activity] failed for ${net}:`,
          err?.message ?? err
        );
        results.push({
          network: net,
          lastActivityTs: null,
          direction: "unknown",
          txHash: null,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: ACTIVITY_CONCURRENCY }, () => worker())
  );

  return results.sort(
    (a, b) => (b.lastActivityTs ?? 0) - (a.lastActivityTs ?? 0)
  );
}
