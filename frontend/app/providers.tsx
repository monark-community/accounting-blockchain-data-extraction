"use client";

import { Toaster as UIToster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { WalletProvider } from "@/contexts/WalletContext";
import { config } from "@/lib/wagmi";
import { Web3AuthProvider } from "@web3auth/no-modal-react-hooks";
import { web3authConfig } from "@/lib/web3auth";
import MonarkBannerWrapper from "@/components/MonarkDemoWrapper";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { clearWeb3AuthLocalStorage } from "@/lib/utils";

const DynamicToaster = dynamic(
  () => import("@/components/ui/toaster").then((mod) => mod.Toaster),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Clean up old localStorage Web3Auth data on mount (migration from localStorage to sessionStorage)
  useEffect(() => {
    clearWeb3AuthLocalStorage();
  }, []);

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
