"use client";

import { Toaster as UIToster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import MonarkBannerWrapper from "@/components/MonarkDemoWrapper";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { clearWeb3AuthLocalStorage } from "@/lib/utils";

const DynamicToaster = dynamic(
  () => import("@/components/ui/toaster").then((mod) => mod.Toaster),
  { ssr: false }
);

const Web3AuthProvider = dynamic(
  () => import("@web3auth/no-modal-react-hooks").then((mod) => mod.Web3AuthProvider),
  { ssr: false, loading: () => null }
);

const WalletProvider = dynamic(
  () => import("@/contexts/WalletContext").then((mod) => mod.WalletProvider),
  { ssr: false, loading: () => null }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [web3authConfig, setWeb3authConfig] = useState<any>(null);

  // Initialize on mount
  useEffect(() => {
    clearWeb3AuthLocalStorage();
    
    // Initialize Web3Auth config only on client side using dynamic import
    (async () => {
      try {
        const { getWeb3AuthConfig } = await import("@/lib/web3auth");
        setWeb3authConfig(getWeb3AuthConfig());
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Failed to initialize Web3Auth config:", error);
        }
      }
    })();
  }, []);

  // Don't render Web3AuthProvider until config is ready
  if (!web3authConfig) {
    return null;
  }

  return (
    <Web3AuthProvider config={web3authConfig}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WalletProvider>
              <DynamicToaster />
              <Sonner />
              <UIToster />
              <MonarkBannerWrapper>{children}</MonarkBannerWrapper>
            </WalletProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Web3AuthProvider>
  );
}
