import { ArrowRight, TrendingUp, DollarSign, PieChart, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Pie, AreaChart, Area } from "recharts";
import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const { connectWallet } = useWallet();
  const navigate = useNavigate();

  const handleConnectWallet = () => {
    connectWallet();
    navigate("/dashboard");
  };

  // Sample data for area chart showing portfolio growth
  const areaData = [
    { month: 'Jan', value: 85000 },
    { month: 'Feb', value: 92000 },
    { month: 'Mar', value: 105000 },
    { month: 'Apr', value: 118000 },
    { month: 'May', value: 127450 },
  ];

  const barData = [
    { month: 'Jan', income: 12500, expenses: 3200 },
    { month: 'Feb', income: 18700, expenses: 4100 },
    { month: 'Mar', income: 22300, expenses: 3800 },
    { month: 'Apr', income: 16900, expenses: 2950 },
  ];

  // Transaction pool for animation
  const transactionPool = [
    { type: 'Swap', amount: '$2,450', token: 'ETH → USDC', status: 'Income' },
    { type: 'Stake', amount: '$1,200', token: 'MATIC', status: 'Income' },
    { type: 'DeFi', amount: '$890', token: 'Compound', status: 'Income' },
    { type: 'Gas', amount: '$45', token: 'ETH', status: 'Expense' },
    { type: 'Swap', amount: '$3,200', token: 'BTC → USDT', status: 'Income' },
    { type: 'Liquidity', amount: '$750', token: 'Uniswap', status: 'Income' },
    { type: 'Bridge', amount: '$120', token: 'Polygon', status: 'Expense' },
    { type: 'Yield', amount: '$340', token: 'Aave', status: 'Income' },
    { type: 'NFT', amount: '$2,100', token: 'OpenSea', status: 'Income' },
    { type: 'Gas', amount: '$23', token: 'BSC', status: 'Expense' },
  ];

  const [visibleTransactions, setVisibleTransactions] = useState(transactionPool.slice(0, 4));
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Get a random transaction from the pool
      const randomTransaction = transactionPool[Math.floor(Math.random() * transactionPool.length)];
      
      setIsAnimating(true);
      
      setTimeout(() => {
        setVisibleTransactions(prev => {
          const newTransactions = [randomTransaction, ...prev.slice(0, 3)];
          return newTransactions;
        });
        setIsAnimating(false);
      }, 300);
      
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden pt-20">
      {/* Custom CSS for animations */}
      <style dangerouslySetInnerHTML={{
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
        `
      }} />
      
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
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent"> Crypto </span>
              Accounting
            </h1>
            
            <p className="text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl">
              Connect all your wallets. Automatically classify transactions across any blockchain. 
              Get audit-ready reports in minutes.
            </p>

            {/* Value Props */}
            <div className="flex flex-wrap gap-4 mb-8 justify-center lg:justify-start">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <span className="text-blue-100 font-medium">Auto Classification</span>
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

            {/* CTA Button */}
            <Button 
              size="lg" 
              onClick={handleConnectWallet}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Connect Wallet
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
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
                    <p className="text-2xl font-bold text-green-400">+$18,200</p>
                  </div>
                </div>
                
                {/* Area Chart showing portfolio growth */}
                <div className="h-40">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={areaData}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 12 }} 
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
                    </ResponsiveContainer>
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
                      key={`${tx.type}-${tx.amount}-${index}-${Date.now()}`}
                      className={`flex items-center justify-between p-2 bg-white/5 rounded-lg transition-all duration-500 ease-out ${
                        isAnimating 
                          ? index === 0 
                            ? 'opacity-0 -translate-y-2 animate-fade-in-down'
                            : index === 3
                            ? 'opacity-100 translate-y-2 animate-fade-out-down'
                            : 'translate-y-6 transition-transform duration-500 ease-out'
                          : 'opacity-100 translate-y-0'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{tx.type}</p>
                        <p className="text-blue-200 text-sm">{tx.token}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.status === 'Income' ? 'text-green-400' : 'text-orange-400'}`}>
                          {tx.status === 'Income' ? '+' : '-'}{tx.amount}
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
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis hide />
                        <Bar dataKey="income" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="expenses" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
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
