'use client';

import { DollarSign, BarChart3, PieChart, TrendingUp } from "lucide-react";

const HeroSkeleton = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Main Content */}
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

            {/* Loading buttons */}
            <div className="max-w-xl w-full space-y-4">
              <div className="w-full h-14 bg-white/10 rounded-xl animate-pulse"></div>
              <div className="flex items-center gap-3 text-blue-200/80">
                <span className="h-px flex-1 bg-white/20" />
                <span className="text-xs uppercase tracking-wider">or</span>
                <span className="h-px flex-1 bg-white/20" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 h-12 bg-white/10 rounded-xl animate-pulse"></div>
                <div className="sm:w-auto w-full h-12 bg-white/10 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Right Column - Loading Cards */}
          <div className="space-y-6">
            {/* Portfolio Overview Card Skeleton */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 text-white rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-green-400" />
                <div className="h-5 w-32 bg-white/20 rounded animate-pulse"></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="h-4 w-20 bg-white/20 rounded mb-2 animate-pulse"></div>
                  <div className="h-8 w-24 bg-white/20 rounded animate-pulse"></div>
                </div>
                <div>
                  <div className="h-4 w-24 bg-white/20 rounded mb-2 animate-pulse"></div>
                  <div className="h-8 w-20 bg-white/20 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="h-40 w-full bg-white/10 rounded animate-pulse"></div>
            </div>

            {/* Recent Transactions Card Skeleton */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 text-white rounded-lg p-6">
              <div className="h-5 w-40 bg-white/20 rounded mb-4 animate-pulse"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <div>
                      <div className="h-4 w-16 bg-white/20 rounded mb-1 animate-pulse"></div>
                      <div className="h-3 w-20 bg-white/20 rounded animate-pulse"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-4 w-20 bg-white/20 rounded mb-1 animate-pulse"></div>
                      <div className="h-3 w-16 bg-white/20 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Performance Card Skeleton */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 text-white rounded-lg p-6">
              <div className="h-5 w-36 bg-white/20 rounded mb-4 animate-pulse"></div>
              <div className="h-32 w-full bg-white/10 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSkeleton;
