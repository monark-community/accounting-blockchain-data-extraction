'use client';

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from 'wagmi';
import { WalletProvider } from "@/contexts/WalletContext";
import { config } from "@/lib/wagmi";
import { Web3AuthProvider } from '@web3auth/no-modal-react-hooks';
import { web3authConfig } from '@/lib/web3auth';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <Web3AuthProvider config={web3authConfig}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WalletProvider>
              <Toaster />
              <Sonner />
              {children}
            </WalletProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Web3AuthProvider>
  );
}


