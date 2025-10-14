'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import UseCases from "@/components/UseCases";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function HomePage() {
  const { isConnected, userWallet, isLoggingOut } = useWallet();
  const router = useRouter();
  const { toast } = useToast();

  // Remove automatic redirect - let users choose when to go to dashboard
  // useEffect(() => {
  //   // Only redirect if wallet is connected AND has an address AND not logging out
  //   if (isConnected && userWallet && !isLoggingOut) {
  //     toast({
  //       title: "Wallet Connected",
  //       description: "You can now access your dashboard from the navigation menu.",
  //       duration: 3000,
  //     });
  //   }
  // }, [isConnected]);

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
}
