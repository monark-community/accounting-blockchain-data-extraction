
import { ArrowRight, Github, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-slate-900 to-blue-900">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Lift Your
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> Ledger?</span>
          </h2>
          
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Join the future of blockchain financial reporting. Get audit-ready reports, 
            transparent analytics, and export-ready data in minutes, not hours.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
              Start Analyzing
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            
            <Button size="lg" variant="outline" className="border-2 border-blue-300 text-blue-100 bg-slate-900/50 hover:bg-blue-800/70 hover:border-blue-200 px-8 py-4 text-lg font-semibold rounded-xl backdrop-blur-sm transition-all duration-300">
              <Github className="mr-2 w-5 h-5" />
              View on GitHub
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
