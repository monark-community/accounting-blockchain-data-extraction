
import { ArrowRight, TrendingUp, DollarSign, PieChart, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Pie } from "recharts";
import { useState, useEffect } from "react";

const Hero = () => {
  // Sample data for charts
  const pieData = [
    { name: 'DeFi Income', value: 45, fill: '#3b82f6' },
    { name: 'Trading', value: 30, fill: '#8b5cf6' },
    { name: 'Staking', value: 15, fill: '#06d6a0' },
    { name: 'Expenses', value: 10, fill: '#f59e0b' },
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
  const [animatingIn, setAnimatingIn] = useState<number | null>(null);
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Get a random transaction from the pool
      const randomTransaction = transactionPool[Math.floor(Math.random() * transactionPool.length)];
      
      // Start animation sequence
      setAnimatingOut(3); // Bottom transaction fades out
      
      setTimeout(() => {
        setVisibleTransactions(prev => {
          const newTransactions = [randomTransaction, ...prev.slice(0, 3)];
          return newTransactions;
        });
        setAnimatingOut(null);
        setAnimatingIn(0); // Top transaction fades in
        
        setTimeout(() => {
          setAnimatingIn(null);
        }, 500);
      }, 300);
      
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const chartConfig = {
    income: {
      label: "Income",
    },
    expenses: {
      label: "Expenses",
    },
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Main Content - Moved up */}
          <div className="text-center lg:text-left mt-[-150px]">
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
            <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
              Start Tracking Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Right Column - Accounting Visuals */}
          <div className="space-y-6">
            {/* Portfolio Overview Card */}
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
                    <p className="text-2xl font-bold text-green-400">$127,450</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">This Month</p>
                    <p className="text-2xl font-bold text-blue-400">+$18,200</p>
                  </div>
                </div>
                
                {/* Fixed Pie Chart */}
                <div className="h-40">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions with Animation */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {visibleTransactions.map((tx, index) => (
                    <div 
                      key={`${tx.type}-${tx.amount}-${index}`}
                      className={`flex items-center justify-between p-2 bg-white/5 rounded-lg transition-all duration-500 ${
                        animatingIn === index 
                          ? 'animate-[fade-in_0.5s_ease-out,translateY(-10px)_0.5s_ease-out] opacity-0' 
                          : animatingOut === index 
                          ? 'animate-[fade-out_0.3s_ease-out,translateY(10px)_0.3s_ease-out] opacity-100' 
                          : 'opacity-100'
                      }`}
                      style={{
                        animationFillMode: 'forwards'
                      }}
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
                        <ChartTooltip content={<ChartTooltipContent />} />
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
