import { useState, useEffect } from 'react';

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

  // Fetch wallets on mount
  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
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
  };

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

