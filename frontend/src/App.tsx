import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { Web3AuthProvider } from "@web3auth/modal/react";
import { WagmiProvider as Web3AuthWagmiProvider } from "@web3auth/modal/react/wagmi";
import web3AuthContextConfig from "@/config/web3auth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Preferences from "./pages/Preferences";
import ManageWallets from "./pages/ManageWallets";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MonarkBannerWrapper from "./components/MonarkDemoWrapper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Web3AuthProvider config={web3AuthContextConfig}>
        <Web3AuthWagmiProvider>
          <WalletProvider>
            <Toaster />
            <Sonner />
            <MonarkBannerWrapper>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/preferences" element={<Preferences />} />
                  <Route path="/manage-wallets" element={<ManageWallets />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </MonarkBannerWrapper>
          </WalletProvider>
        </Web3AuthWagmiProvider>
      </Web3AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
