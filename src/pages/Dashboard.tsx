
import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Repeat, Coins, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";

const Dashboard = () => {
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Sample transaction data grouped by type
  const transactionsByType = {
    income: [
      {
        id: "1",
        date: "2024-06-15",
        description: "Freelance Payment - Web3 Consulting",
        amount: "2.5 ETH",
        usdValue: "$6,250.00",
        hash: "0x1234...5678"
      },
      {
        id: "2",
        date: "2024-06-13",
        description: "DAO Governance Reward",
        amount: "150.0 COMP",
        usdValue: "$8,250.00",
        hash: "0x9876...5432"
      }
    ],
    swaps: [
      {
        id: "3",
        date: "2024-06-14",
        description: "USDC → ETH",
        amount: "-1000 USDC / +0.4 ETH",
        usdValue: "$0.00",
        hash: "0xabcd...efgh"
      },
      {
        id: "4",
        date: "2024-06-12",
        description: "ETH → USDT",
        amount: "-0.5 ETH / +1250 USDT",
        usdValue: "$0.00",
        hash: "0xdef0...1234"
      }
    ],
    expenses: [
      {
        id: "5",
        date: "2024-06-11",
        description: "DeFi Protocol Fee",
        amount: "-25 USDC",
        usdValue: "-$25.00",
        hash: "0x5678...90ab"
      }
    ]
  };

  const summary = {
    totalIncome: "$14,500.00",
    totalExpenses: "$25.00",
    totalSwaps: 12,
    netWorth: "$14,475.00"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />
      <div className="pt-20 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Accounting Dashboard</h1>
            <p className="text-slate-600">Overview of your connected wallets and transactions</p>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Income</p>
                  <p className="text-2xl font-bold text-green-600">{summary.totalIncome}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{summary.totalExpenses}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Swaps</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.totalSwaps}</p>
                </div>
                <Repeat className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Net Worth</p>
                  <p className="text-2xl font-bold text-slate-800">{summary.netWorth}</p>
                </div>
                <Coins className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </div>

          {/* Transaction Groups */}
          <Card className="bg-white shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Transaction Groups</h2>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            <Tabs defaultValue="income" className="p-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="income" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Income ({transactionsByType.income.length})
                </TabsTrigger>
                <TabsTrigger value="swaps" className="flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  Swaps ({transactionsByType.swaps.length})
                </TabsTrigger>
                <TabsTrigger value="expenses" className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Expenses ({transactionsByType.expenses.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="income" className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>USD Value</TableHead>
                      <TableHead>Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsByType.income.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.date}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="text-green-600 font-mono">{tx.amount}</TableCell>
                        <TableCell className="text-green-600 font-mono">{tx.usdValue}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {tx.hash}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="swaps" className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>USD Value</TableHead>
                      <TableHead>Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsByType.swaps.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.date}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="text-blue-600 font-mono">{tx.amount}</TableCell>
                        <TableCell className="text-slate-600 font-mono">{tx.usdValue}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {tx.hash}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="expenses" className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>USD Value</TableHead>
                      <TableHead>Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsByType.expenses.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.date}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="text-red-600 font-mono">{tx.amount}</TableCell>
                        <TableCell className="text-red-600 font-mono">{tx.usdValue}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {tx.hash}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
