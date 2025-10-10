'use client';

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AllTransactionsTab from "@/components/dashboard/AllTransactionsTab";
import IncomeTab from "@/components/dashboard/IncomeTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import CapitalGainsTab from "@/components/dashboard/CapitalGainsTab";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function DashboardPage() {
  const { isConnected, userWallet } = useWallet();
  const params = useSearchParams();
  const urlAddress = params.get("address") || "";

  // Use connected wallet address if available, otherwise use URL address
  const address = isConnected && userWallet ? userWallet : urlAddress;

  if (!address) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">No Wallet Address</h1>
            <p className="text-gray-600 mb-4">
              Please connect your wallet or provide an address in the URL.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Home
            </Button>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Portfolio Dashboard</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {address}
            </Badge>
            {isConnected && userWallet && (
              <Badge variant="default">Connected Wallet</Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="gains">Capital Gains</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <AllTransactionsTab address={address} />
          </TabsContent>
          
          <TabsContent value="income">
            <IncomeTab address={address} />
          </TabsContent>
          
          <TabsContent value="expenses">
            <ExpensesTab address={address} />
          </TabsContent>
          
          <TabsContent value="gains">
            <CapitalGainsTab address={address} />
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
