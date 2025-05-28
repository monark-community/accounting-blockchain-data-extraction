
import { ArrowRight, Shield, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 container mx-auto px-4 py-16 flex flex-col items-center text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center mr-3">
              <BarChart3 className="text-white w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-white">LedgerLift</h1>
          </div>
          <p className="text-blue-200 text-lg">Blockchain Analytics for Audit-Ready Financial Reporting</p>
        </div>

        {/* Main Headline */}
        <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
          Transform Your
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent"> Crypto </span>
          Transactions
        </h2>
        
        <p className="text-xl text-blue-100 mb-8 max-w-3xl leading-relaxed">
          Extract, categorize, and format wallet transactions into human-readable financial reports. 
          Perfect for DAOs, freelancers, and crypto businesses preparing for tax season.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
            Get Started
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button size="lg" variant="outline" className="border-blue-300 text-blue-100 hover:bg-blue-800/50 px-8 py-4 text-lg font-semibold rounded-xl">
            View Demo
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <Shield className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Audit-Ready Reports</h3>
            <p className="text-blue-200">Generate time-stamped, exportable financial reports that meet audit standards.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <BarChart3 className="w-12 h-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Smart Categorization</h3>
            <p className="text-blue-200">Automatically classify transactions into income, expenses, and gas fees.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <FileText className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Multi-Format Export</h3>
            <p className="text-blue-200">Export reports in CSV, PDF, and other formats for easy integration.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
