// backend/src/services/tx.count.covalent.ts

import {
  getCovalentApiKey,
  getCovalentApiBase,
  getCovalentChainId,
  isNetworkSupportedByCovalent,
  isCovalentConfigured,
} from "../config/covalent";
import type { EvmNetwork } from "../config/networks";
import { fetchWithRetry } from "../utils/http";

/**
 * Get total transaction count for an address from Covalent API
 * Returns null if Covalent is not configured, network not supported, or API call fails
 */
export async function getTransactionCountFromCovalent(
  address: `0x${string}`,
  network: EvmNetwork
): Promise<number | null> {
  // Check if Covalent is configured
  if (!isCovalentConfigured()) {
    return null;
  }

  // Check if network is supported
  if (!isNetworkSupportedByCovalent(network)) {
    return null;
  }

  const chainId = getCovalentChainId(network);
  if (!chainId) {
    return null;
  }

  const apiKey = getCovalentApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    // Covalent endpoint: GET /v1/{chain_id}/address/{address}/transactions_v3/
    // Strategy: Get first page to find last page number, then fetch last page to get exact count
    const pageSize = 1000;
    const firstPageUrl = `${getCovalentApiBase()}/${chainId}/address/${address}/transactions_v3/?page-size=${pageSize}&key=${apiKey}`;

    // First, get first page to see pagination info
    const firstPageResponse = await fetchWithRetry(firstPageUrl, {}, { retries: 1, timeoutMs: 10000 });

    if (!firstPageResponse.ok) {
      const errorText = await firstPageResponse.text().catch(() => "");
      console.error(
        `[Covalent] Failed to fetch count for ${address} on ${network}: ${firstPageResponse.status} ${firstPageResponse.statusText}`
      );
      console.error(`[Covalent] Response: ${errorText.substring(0, 500)}`);
      return null;
    }

    const firstPageJson = await firstPageResponse.json() as any;
    
    if (!firstPageJson?.data) {
      console.error(`[Covalent] Invalid response structure: missing data`);
      return null;
    }

    const firstPageData = firstPageJson.data;
    const currentPageNumber = firstPageData.current_page || 1;
    const hasNextPage = firstPageData.links?.next !== null;
    const items = Array.isArray(firstPageData.items) ? firstPageData.items : [];
    const itemsOnCurrentPage = items.length;

    // If we're on the last page (next is null), calculate exact total
    if (!hasNextPage && currentPageNumber > 0) {
      // Total = (current_page - 1) * page_size + items_on_current_page
      const totalCount = (currentPageNumber - 1) * pageSize + itemsOnCurrentPage;
      
      console.log(`[Covalent] Calculated exact count: ${totalCount} (page ${currentPageNumber}, items on page: ${itemsOnCurrentPage})`);
      
      if (totalCount >= 0) {
        return totalCount;
      }
    }

    // If there are more pages, estimate based on current page
    // Note: Covalent doesn't provide total_count directly when not on last page
    const estimatedTotal = currentPageNumber * pageSize; // Conservative estimate (at least this many)
    
    console.log(`[Covalent] Estimated count: ${estimatedTotal}+ (at least page ${currentPageNumber} * ${pageSize})`);
    
    return estimatedTotal;
  } catch (error: any) {
    console.error(
      `[Covalent] Error fetching count for ${address} on ${network}:`,
      error?.message || error
    );
    return null;
  }
}

/**
 * Test Covalent API connection
 * Returns true if API is accessible and key is valid
 */
export async function testCovalentConnection(): Promise<boolean> {
  if (!isCovalentConfigured()) {
    console.log("[Covalent] API key not configured");
    return false;
  }

  try {
    // Test with a known address on Ethereum mainnet (chain_id: 1)
    // Using Vitalik's address as a test (should always have transactions)
    const testAddress = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" as `0x${string}`;
    const count = await getTransactionCountFromCovalent(testAddress, "mainnet");
    
    if (count !== null && count >= 0) {
      console.log(`[Covalent] Connection test successful. Count: ${count}`);
      return true;
    }
    
    console.log("[Covalent] Connection test failed: invalid response");
    return false;
  } catch (error: any) {
    console.error("[Covalent] Connection test failed:", error?.message || error);
    return false;
  }
}

