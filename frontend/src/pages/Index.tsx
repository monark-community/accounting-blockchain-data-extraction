
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import UseCases from "@/components/UseCases";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  const { isConnected, userWallet, isLoggingOut } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Only redirect if wallet is connected AND has an address AND not logging out
    if (isConnected && userWallet && !isLoggingOut) {
      toast({
        title: "Wallet Connected",
        description: (
          <div>
            <div>Redirecting to your dashboard...</div>
            <div className="mt-1 text-xs opacity-75">
              You can disconnect anytime from the navigation menu to continue browsing.
            </div>
          </div>
        ),
        duration: 4000,
      });

      // Small delay to show the notification before redirecting
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    }
  }, [isConnected]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <UseCases />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;

