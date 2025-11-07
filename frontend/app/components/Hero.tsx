"use client";

import {
  ArrowRight,
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart as RechartsPieChart,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Pie,
  AreaChart,
  Area,
} from "recharts";
import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const Hero = () => {
  const {
    connectWallet,
    isMetaMaskInstalled,
    isConnected,
    connectError,
    isPending,
    userWallet,
  } = useWallet();
  const router = useRouter();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dependenciesReady, setDependenciesReady] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Only render on client side to avoid hydration issues
  useEffect(() => {
    setMounted(true);

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoadingTimeout(true);
    }, 10000); // 10 second timeout

    // Check if dependencies are ready
    const checkDependencies = () => {
      try {
        // Check if wallet context is properly initialized
        const walletReady =
          typeof connectWallet === "function" &&
          typeof isMetaMaskInstalled !== "undefined" &&
          typeof router !== "undefined" &&
          typeof toast !== "undefined";

        if (walletReady) {
          setDependenciesReady(true);
          clearTimeout(timeout);
        }
      } catch (error) {
        console.log("Dependencies not ready yet:", error);
      }
    };

    // Check immediately and then periodically
    checkDependencies();
    const interval = setInterval(checkDependencies, 100);

    // Cleanup
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [connectWallet, isMetaMaskInstalled, router, toast]);

  // Watch for connection changes
  useEffect(() => {
    if (isConnected && isConnecting && !hasTimedOut) {
      toast({
        title: "Wallet Connected",
        description: "Successfully connected to MetaMask!",
      });
      // Navigate to dashboard - it will automatically use the connected wallet
      router.push("/dashboard");
      setIsConnecting(false);
      setHasTimedOut(false);
    } else if (isConnected && hasTimedOut) {
      // Connection succeeded after timeout - ignore it
      setIsConnecting(false);
      setHasTimedOut(false);
    }
  }, [isConnected, isConnecting, hasTimedOut, router, toast, userWallet]);

  // Watch for connection errors
  useEffect(() => {
    if (connectError && isConnecting && !hasTimedOut) {
      // Add a small delay to ensure this is a real user rejection, not a stale error
      const timeout = setTimeout(() => {
        toast({
          title: "Connection Failed",
          description:
            connectError.message ||
            "Failed to connect wallet. Please try again.",
          variant: "destructive",
        });
        setIsConnecting(false);
        setHasTimedOut(false);
      }, 100); // Small delay to prevent stale error messages

      return () => clearTimeout(timeout);
    }
  }, [connectError, isConnecting, hasTimedOut, toast]);

  // Safety timeout to prevent button from getting stuck
  useEffect(() => {
    if (isConnecting && !hasTimedOut) {
      const timeout = setTimeout(() => {
        setHasTimedOut(true);
        setIsConnecting(false);
        toast({
          title: "Connection Timeout",
          description: "Connection took too long. Please try again.",
          variant: "destructive",
        });
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isConnecting, hasTimedOut, toast]);

  const handleConnectWallet = async () => {
    if (!isMetaMaskInstalled) {
      toast({
        title: "MetaMask Not Found",
        description: "Please install MetaMask to connect your wallet.",
        variant: "destructive",
      });
      return;
    }

    // Reset timeout state for new connection attempt
    setHasTimedOut(false);
    setIsConnecting(true);
    try {
      await connectWallet();
      // Don't show success toast here - let the useEffect handle it
      // when isConnected becomes true
    } catch (error: any) {
      console.error("Connection error:", error);
      toast({
        title: "Connection Failed",
        description:
          error.message || "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false); // Reset connecting state on error
      setHasTimedOut(false);
    }
    // Note: Don't reset isConnecting here - let useEffect handle it on success
  };

  // Sample data for area chart showing portfolio growth
  const areaData = [
    { month: "Jan", value: 85000 },
    { month: "Feb", value: 92000 },
    { month: "Mar", value: 105000 },
    { month: "Apr", value: 118000 },
    { month: "May", value: 127450 },
  ];

  const barData = [
    { month: "Jan", income: 12500, expenses: 3200 },
    { month: "Feb", income: 18700, expenses: 4100 },
    { month: "Mar", income: 22300, expenses: 3800 },
    { month: "Apr", income: 16900, expenses: 2950 },
  ];

  // Transaction pool for animation
  const transactionPool = [
    { type: "Swap", amount: "$2,450", token: "ETH → USDC", status: "Income" },
    { type: "Stake", amount: "$1,200", token: "MATIC", status: "Income" },
    { type: "DeFi", amount: "$890", token: "Compound", status: "Income" },
    { type: "Gas", amount: "$45", token: "ETH", status: "Expense" },
    { type: "Swap", amount: "$3,200", token: "BTC → USDT", status: "Income" },
    { type: "Liquidity", amount: "$750", token: "Uniswap", status: "Income" },
    { type: "Bridge", amount: "$120", token: "Polygon", status: "Expense" },
    { type: "Yield", amount: "$340", token: "Aave", status: "Income" },
    { type: "NFT", amount: "$2,100", token: "OpenSea", status: "Income" },
    { type: "Gas", amount: "$23", token: "BSC", status: "Expense" },
  ];

  const [visibleTransactions, setVisibleTransactions] = useState(
    transactionPool.slice(0, 4)
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [openSuggest, setOpenSuggest] = useState(false);

  const SUGGESTIONS = [
    {
      label: "vitalik.eth",
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    },
    {
      label: "binance.eth",
      address: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
    },
    {
      label: "1inch.eth",
      address: "0x111111125421ca6dc452d289314280a0f8842a65",
    },
  ];

  const short = (a: string) =>
    a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    // console.log("Hero: Submitting search for address:", address);
    router.push(`/dashboard?address=${encodeURIComponent(address)}`);
  };

  const handlePick = (addr: string) => {
    // console.log("Hero: Picked address from suggestions:", addr);
    setAddress(addr);
    setOpenSuggest(false);
  };

  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      // Get a random transaction from the pool
      const randomTransaction =
        transactionPool[Math.floor(Math.random() * transactionPool.length)];

      setIsAnimating(true);

      setTimeout(() => {
        setVisibleTransactions((prev) => {
          const newTransactions = [randomTransaction, ...prev.slice(0, 3)];
          return newTransactions;
        });
        setIsAnimating(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [mounted]);

  const chartConfig = {
    value: {
      label: "Portfolio Value",
      color: "#10b981",
    },
    income: {
      label: "Income",
    },
    expenses: {
      label: "Expenses",
    },
  };

  // Don't render anything until mounted and dependencies are ready
  if (!mounted || !dependenciesReady) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden pt-20">
        <div className="relative z-10 container mx-auto px-4 py-4">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="text-center lg:text-left mt-[80px]">
              {/* Loading indicator */}
              <div className="mt-8">
                <div className="flex items-center justify-center lg:justify-start space-x-2 text-blue-300">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                  <span>Loading application...</span>
                </div>
              </div>

              {/* Timeout fallback */}
              {loadingTimeout && (
                <div className="mt-4 p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                  <p className="text-orange-200 text-sm">
                    Loading is taking longer than expected. Please refresh the
                    page if this continues.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden pt-20">
      {/* Custom CSS for animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes fadeInDown {
            0% {
              opacity: 0;
              transform: translateY(-10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes fadeOutDown {
            0% {
              opacity: 1;
              transform: translateY(0);
            }
            100% {
              opacity: 0;
              transform: translateY(10px);
            }
          }
          
          .animate-fade-in-down {
            animation: fadeInDown 0.5s ease-out 0.3s forwards;
          }
          
          .animate-fade-out-down {
            animation: fadeOutDown 0.3s ease-out forwards;
          }
        `,
        }}
      />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Main Content - Moved down further */}
          <div className="text-center lg:text-left mt-[80px]">
            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
              Multi-Chain
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {" "}
                Crypto{" "}
              </span>
              Accounting
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl">
              Connect all your wallets. Automatically classify transactions
              across any blockchain. Get audit-ready reports in minutes.
            </p>
            {/* Value Props */}
            <div className="flex flex-wrap gap-4 mb-8 justify-center lg:justify-start">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <span className="text-blue-100 font-medium">
                  Auto Classification
                </span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <PieChart className="w-5 h-5 text-purple-400" />
                <span className="text-blue-100 font-medium">Multi-Wallet</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-blue-100 font-medium">Tax Ready</span>
              </div>
            </div>

            {/* Connexion Button — Option 2: primary + secondary */}
            <div className="max-w-xl w-full space-y-4">
              {/* Primary action */}
              <Button
                size="lg"
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              {/* MetaMask hint (unchanged) */}
              {!isMetaMaskInstalled && (
                <Alert className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    MetaMask is required to connect your wallet.
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline ml-1"
                    >
                      Install MetaMask
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {/* Divider with "or" */}
              <div className="flex items-center gap-3 text-blue-200/80">
                <span className="h-px flex-1 bg-white/20" />
                <span className="text-xs uppercase tracking-wider">or</span>
                <span className="h-px flex-1 bg-white/20" />
              </div>

              {/* Secondary flow: manual address */}
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="relative flex-1 min-w-[260px]">
                  <input
                    type="text"
                    placeholder="Enter an Ethereum address (0x...)"
                    value={address ?? ""}
                    onChange={(e) => setAddress(e.target.value)}
                    onFocus={() => setOpenSuggest(true)}
                    onBlur={() => setTimeout(() => setOpenSuggest(false), 120)}
                    className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {openSuggest && (
                    <ul className="absolute left-0 right-0 mt-2 rounded-xl border border-white/20 bg-white/95 text-gray-900 shadow-lg z-50 overflow-hidden">
                      {SUGGESTIONS.map((s) => (
                        <li key={s.address}>
                          <button
                            type="button"
                            onMouseDown={() => handlePick(s.address)}
                            className="w-full text-left px-4 py-2 hover:bg-black/5"
                          >
                            {short(s.address)}{" "}
                            <span className="text-gray-500">({s.label})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button
                  size="lg"
                  type="submit"
                  className="sm:w-auto w-full bg-white/10 hover:bg-white/15 text-white px-6 py-3 text-lg font-semibold rounded-xl border border-white/20 shadow-sm transition-all"
                >
                  View Wallet
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Column - Accounting Visuals */}
          <div className="space-y-6">
            {/* Portfolio Overview Card with Area Chart */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Portfolio Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-blue-200 text-sm">Total Value</p>
                    <p className="text-2xl font-bold text-blue-400">$127,450</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">This Month</p>
                    <p className="text-2xl font-bold text-green-400">
                      +$18,200
                    </p>
                  </div>
                </div>

                {/* Area Chart showing portfolio growth */}
                <div className="h-40">
                  <ChartContainer
                    config={chartConfig}
                    className="h-full w-full"
                  >
                    <AreaChart data={areaData}>
                      <defs>
                        <linearGradient
                          id="colorValue"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <YAxis hide />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions with Scrolling Animation */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 overflow-hidden">
                  {visibleTransactions.map((tx, index) => (
                    <div
                      key={`${tx.type}-${tx.amount}-${index}`}
                      className={`flex items-center justify-between p-2 bg-white/5 rounded-lg transition-all duration-500 ease-out ${
                        isAnimating
                          ? index === 0
                            ? "opacity-0 -translate-y-2 animate-fade-in-down"
                            : index === 3
                            ? "opacity-100 translate-y-2 animate-fade-out-down"
                            : "translate-y-6 transition-transform duration-500 ease-out"
                          : "opacity-100 translate-y-0"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{tx.type}</p>
                        <p className="text-blue-200 text-sm">{tx.token}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            tx.status === "Income"
                              ? "text-green-400"
                              : "text-orange-400"
                          }`}
                        >
                          {tx.status === "Income" ? "+" : "-"}
                          {tx.amount}
                        </p>
                        <p className="text-blue-200 text-sm">{tx.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Stats */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Monthly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-32">
                  <ChartContainer
                    config={chartConfig}
                    className="h-full w-full"
                  >
                    <BarChart data={barData}>
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <YAxis hide />
                      <Bar
                        dataKey="income"
                        fill="#3b82f6"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="expenses"
                        fill="#f59e0b"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
