
import { Wallet, TrendingUp, Users, FileCheck, Download, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Features = () => {
  const features = [
    {
      icon: Wallet,
      title: "Multi-Wallet Support",
      description: "Input multiple wallet addresses and get comprehensive analytics across all your blockchain activities.",
      color: "text-blue-500"
    },
    {
      icon: TrendingUp,
      title: "Real-Time Analytics",
      description: "Fetch and process blockchain data using The Graph, public APIs, and custom indexers for up-to-date insights.",
      color: "text-green-500"
    },
    {
      icon: Users,
      title: "DAO Treasury Reporting",
      description: "Perfect for DAOs needing transparent financial reporting and treasury management analytics.",
      color: "text-purple-500"
    },
    {
      icon: FileCheck,
      title: "Tax Compliance",
      description: "Generate tax-ready reports for freelancers, contractors, and businesses tracking crypto income.",
      color: "text-orange-500"
    },
    {
      icon: Download,
      title: "Export Options",
      description: "Export your financial data in multiple formats including CSV, PDF, and custom formats for accounting software.",
      color: "text-indigo-500"
    },
    {
      icon: Clock,
      title: "Historical Data",
      description: "Access comprehensive historical transaction data with precise timestamps for complete audit trails.",
      color: "text-rose-500"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Powerful Features for
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Financial Clarity</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to transform complex blockchain data into clear, actionable financial insights.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
