
import { ArrowRight, Shield, FileText, BarChart3, Wallet, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 container mx-auto px-4 py-16 flex flex-col items-center text-center">
        {/* Main Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
          Multi-Chain
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent"> Crypto </span>
          Accounting
        </h1>
        
        <p className="text-xl text-blue-100 mb-8 max-w-4xl leading-relaxed">
          Connect multiple wallets across different blockchains and automatically classify your transactions. 
          Transform complex crypto activity into clear financial reports for taxes, audits, and business accounting.
        </p>

        {/* Key Features */}
        <div className="flex flex-wrap justify-center gap-6 mb-12">
          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <Wallet className="w-5 h-5 text-blue-400" />
            <span className="text-blue-100 font-medium">Multi-Wallet Support</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <Globe className="w-5 h-5 text-purple-400" />
            <span className="text-blue-100 font-medium">Cross-Chain Compatible</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <BarChart3 className="w-5 h-5 text-green-400" />
            <span className="text-blue-100 font-medium">Auto Classification</span>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mb-16">
          <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
            Start Tracking Now
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <Shield className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Audit-Ready Reports</h3>
            <p className="text-blue-200">Generate comprehensive financial reports that meet professional audit standards and tax requirements.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <BarChart3 className="w-12 h-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Smart Classification</h3>
            <p className="text-blue-200">Automatically categorize transactions as income, expenses, swaps, DeFi activity, and more across all chains.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <FileText className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Multi-Format Export</h3>
            <p className="text-blue-200">Export consolidated reports in CSV, PDF, and other formats for seamless integration with accounting software.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
