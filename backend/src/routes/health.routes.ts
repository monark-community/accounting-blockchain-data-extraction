// backend/src/routes/health.routes.ts

import { Router } from "express";
import { currentNetwork } from "../utils/alchemy";
import { testCovalentConnection, getTransactionCountFromCovalent } from "../services/tx.count.covalent";
import { isCovalentConfigured, getCovalentApiKey } from "../config/covalent";

const router = Router();
router.get("/", (_req, res) => {
  res.json({
    ok: true,
    network: currentNetwork,
    env: process.env.ALCHEMY_NETWORK,
  });
});

// Test endpoint for Covalent connection
router.get("/covalent-test", async (_req, res) => {
  try {
    const configured = isCovalentConfigured();
    const apiKey = getCovalentApiKey();
    
    if (!configured) {
      return res.json({
        ok: false,
        error: "Covalent API key not configured (COVALENT_API_KEY missing)",
        debug: {
          envKeyExists: !!process.env.COVALENT_API_KEY,
          apiKeyLength: apiKey?.length || 0,
        },
      });
    }

    // Debug info
    const debug = {
      apiKeyConfigured: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : null,
      testUrl: `https://api.covalenthq.com/v1/1/address/0xd8da6bf26964af9d7eed9e03e53415d37aa96045/transactions_v3/?page-size=0&key=${apiKey ? '***' : 'MISSING'}`,
    };

    const testResult = await testCovalentConnection();
    
    // Also test with a specific address if provided
    const testAddress = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" as `0x${string}`;
    const count = await getTransactionCountFromCovalent(testAddress, "mainnet");

    res.json({
      ok: testResult,
      configured: true,
      connectionTest: testResult,
      testCount: count,
      debug,
      message: testResult 
        ? "Covalent API connection successful" 
        : "Covalent API connection failed - check API key and network (see logs for details)",
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    });
  }
});

export default router;
