import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';

export interface UserWallet {
  main_wallet_address: string;
  address: string;
  name: string;
  chain_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useWallets() {
  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSessionReady } = useWallet();

  // Check if we're in view-only mode (address in URL params)
  const isViewOnlyMode = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('address');
  };

  // Verify that the session cookie is actually available
  const verifySessionAvailable = async (maxRetries = 5, delay = 100): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (response.ok) {
          return true; // Session cookie is available
        }
      } catch {
        // Ignore errors, will retry
      }
      // Wait before retrying
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false; // Session not available after retries
  };

  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/wallets', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallets');
      }

      const data = await response.json();
      setWallets(data.wallets || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch wallets on mount (skip if in view-only mode or if session is not ready)
  useEffect(() => {
    if (isViewOnlyMode()) {
      // In view-only mode, don't fetch wallets - just set loading to false
      setLoading(false);
      setWallets([]);
      return;
    }

    // Wait for session to be ready before fetching wallets
    if (!isSessionReady) {
      setLoading(true);
      return;
    }

    // Verify that the cookie is actually available before fetching wallets
    const loadWallets = async () => {
      const sessionAvailable = await verifySessionAvailable();
      if (sessionAvailable) {
        await fetchWallets();
      } else {
        // If session is not available after retries, set error
        setError('Session not available. Please try again.');
        setLoading(false);
      }
    };

    loadWallets();
  }, [isSessionReady, fetchWallets]);

  const addWallet = async (address: string, name: string, chainId: number = 1) => {
    try {
      const response = await fetch('/api/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ address, name, chainId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add wallet');
      }

      const data = await response.json();
      
      // Refresh wallets list
      await fetchWallets();
      
      return data.wallet;
    } catch (err: any) {
      throw err;
    }
  };

  const removeWallet = async (address: string) => {
    try {
      const response = await fetch(`/api/wallets/${encodeURIComponent(address)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove wallet');
      }

      // Refresh wallets list
      await fetchWallets();
      
      return true;
    } catch (err: any) {
      throw err;
    }
  };

  const updateWallet = async (address: string, name: string) => {
    try {
      const response = await fetch(`/api/wallets/${encodeURIComponent(address)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update wallet');
      }

      const data = await response.json();
      
      // Refresh wallets list
      await fetchWallets();
      
      return data.wallet;
    } catch (err: any) {
      throw err;
    }
  };

  return {
    wallets,
    loading,
    error,
    refetch: fetchWallets,
    addWallet,
    removeWallet,
    updateWallet,
  };
}

