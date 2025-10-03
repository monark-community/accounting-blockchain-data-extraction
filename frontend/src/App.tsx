import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from 'wagmi';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { config } from "@/lib/wagmi";
import { Web3AuthProvider } from '@web3auth/no-modal-react-hooks';
import { web3authConfig } from '@/lib/web3auth';
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Preferences from "./pages/Preferences";
import ManageWallets from "./pages/ManageWallets";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MonarkBannerWrapper from "./components/MonarkDemoWrapper";

const queryClient = new QueryClient();

const App = () => (
  <Web3AuthProvider config={web3authConfig}>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
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
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </Web3AuthProvider>
);

export default App;
