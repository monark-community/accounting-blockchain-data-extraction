import { useState } from "react";
import { ArrowLeft, Wallet, Download, FileText, BarChart3, TrendingUp, TrendingDown, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";

const Demo = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Sample transaction data
  const sampleTransactions = [
    {
      id: "1",
      hash: "0x1234...5678",
      date: "2024-06-15",
      time: "14:30:22",
      type: "Income",
      description: "Freelance Payment - Web3 Consulting",
      amount: "2.5 ETH",
      usdValue: "$6,250.00",
      gasUsed: "0.0021 ETH",
      category: "Professional Services"
    },
    {
      id: "2",
      hash: "0xabcd...efgh",
      date: "2024-06-14",
      time: "09:15:43",
      type: "Expense",
      description: "Token Swap - USDC to ETH",
      amount: "-1000 USDC",
      usdValue: "-$1,000.00",
      gasUsed: "0.0035 ETH",
      category: "Trading"
    },
    {
      id: "3",
      hash: "0x9876...5432",
      date: "2024-06-13",
      time: "16:45:12",
      type: "Income",
      description: "DAO Governance Reward",
      amount: "150.0 COMP",
      usdValue: "$8,250.00",
      gasUsed: "0.0018 ETH",
      category: "Governance"
    },
    {
      id: "4",
      hash: "0xdef0...1234",
      date: "2024-06-12",
      time: "11:20:35",
      type: "Gas Fee",
      description: "Contract Interaction",
      amount: "-0.0045 ETH",
      usdValue: "-$11.25",
      gasUsed: "0.0045 ETH",
      category: "Network Fees"
    }
  ];

  const handleAnalyze = () => {
    if (!walletAddress) return;
    
    setIsAnalyzing(true);
    // Simulate API call
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowResults(true);
    }, 2000);
  };

  const summary = {
    totalIncome: "$14,500.00",
    totalExpenses: "$1,011.25",
    netIncome: "$13,488.75",
    gasFeesTotal: "$31.85",
    transactionCount: 47
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />
      <div className="pt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center text-blue-200 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center mr-2">
              <BarChart3 className="text-white w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold text-white">LedgerLift Demo</h1>
          </div>
        </div>

        {/* Wallet Input Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <Wallet className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-2">Analyze Your Wallet</h2>
              <p className="text-blue-200">
                Enter your wallet address to see how LedgerLift transforms your transactions into audit-ready reports
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="wallet" className="text-white font-medium">
                  Wallet Address
                </Label>
                <Input
                  id="wallet"
                  type="text"
                  placeholder="0x742d35Cc6634C0532925a3b8D756E..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-blue-300"
                />
              </div>
              
              <Button
                onClick={handleAnalyze}
                disabled={!walletAddress || isAnalyzing}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 text-lg font-semibold rounded-xl"
              >
                {isAnalyzing ? "Analyzing Transactions..." : "Analyze Wallet"}
                {!isAnalyzing && <BarChart3 className="ml-2 w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {showResults && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-sm font-medium">Total Income</p>
                    <p className="text-2xl font-bold text-green-400">{summary.totalIncome}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-sm font-medium">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-400">{summary.totalExpenses}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-400" />
                </div>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-sm font-medium">Net Income</p>
                    <p className="text-2xl font-bold text-blue-400">{summary.netIncome}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-400" />
                </div>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-sm font-medium">Gas Fees</p>
                    <p className="text-2xl font-bold text-yellow-400">{summary.gasFeesTotal}</p>
                  </div>
                  <Fuel className="w-8 h-8 text-yellow-400" />
                </div>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-sm font-medium">Transactions</p>
                    <p className="text-2xl font-bold text-purple-400">{summary.transactionCount}</p>
                  </div>
                  <FileText className="w-8 h-8 text-purple-400" />
                </div>
              </Card>
            </div>

            {/* Export Actions */}
            <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="outline" className="border-2 border-blue-300 text-blue-100 bg-slate-900/50 hover:bg-blue-800/70 hover:border-blue-200 hover:text-white">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" className="border-2 border-blue-300 text-blue-100 bg-slate-900/50 hover:bg-blue-800/70 hover:border-blue-200 hover:text-white">
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="outline" className="border-2 border-blue-300 text-blue-100 bg-slate-900/50 hover:bg-blue-800/70 hover:border-blue-200 hover:text-white">
                <BarChart3 className="w-4 h-4 mr-2" />
                Tax Report
              </Button>
            </div>

            {/* Transactions Table */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
              <div className="p-6 border-b border-white/20">
                <h3 className="text-2xl font-bold text-white">Transaction History</h3>
                <p className="text-blue-200 mt-1">Categorized and formatted for audit readiness</p>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/20 hover:bg-white/5">
                      <TableHead className="text-blue-200 font-semibold">Date</TableHead>
                      <TableHead className="text-blue-200 font-semibold">Type</TableHead>
                      <TableHead className="text-blue-200 font-semibold">Description</TableHead>
                      <TableHead className="text-blue-200 font-semibold">Amount</TableHead>
                      <TableHead className="text-blue-200 font-semibold">USD Value</TableHead>
                      <TableHead className="text-blue-200 font-semibold">Gas</TableHead>
                      <TableHead className="text-blue-200 font-semibold">Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleTransactions.map((tx) => (
                      <TableRow key={tx.id} className="border-white/20 hover:bg-white/5">
                        <TableCell className="text-blue-100">
                          <div>
                            <div className="font-medium">{tx.date}</div>
                            <div className="text-sm text-blue-300">{tx.time}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${
                              tx.type === 'Income' ? 'border-green-400 text-green-400' :
                              tx.type === 'Expense' ? 'border-red-400 text-red-400' :
                              'border-yellow-400 text-yellow-400'
                            }`}
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-blue-100 max-w-xs">
                          <div className="truncate" title={tx.description}>
                            {tx.description}
                          </div>
                          <div className="text-xs text-blue-300 mt-1">
                            {tx.hash}
                          </div>
                        </TableCell>
                        <TableCell className="text-blue-100 font-mono">
                          {tx.amount}
                        </TableCell>
                        <TableCell className="text-blue-100 font-mono">
                          {tx.usdValue}
                        </TableCell>
                        <TableCell className="text-blue-100 font-mono text-sm">
                          {tx.gasUsed}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                            {tx.category}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Demo;
