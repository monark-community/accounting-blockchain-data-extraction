
import { Building2, User, Briefcase } from "lucide-react";

const UseCases = () => {
  const useCases = [
    {
      icon: Building2,
      title: "DAO Treasury Management",
      description: "Track multi-signature wallets, governance tokens, and treasury operations with complete transparency.",
      benefits: ["Multi-wallet consolidation", "Governance token tracking", "Treasury balance reports", "Member contribution analysis"]
    },
    {
      icon: User,
      title: "Freelancer Income Tracking",
      description: "Perfect for contractors receiving crypto payments who need clear records for tax reporting.",
      benefits: ["Income categorization", "Client payment tracking", "Tax-ready documentation", "Multi-currency support"]
    },
    {
      icon: Briefcase,
      title: "Business Audit Preparation",
      description: "Comprehensive financial records for crypto-native businesses preparing for audits or tax season.",
      benefits: ["Audit trail generation", "Expense categorization", "Regulatory compliance", "Financial statement prep"]
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-r from-blue-900 to-indigo-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Built for Every
            <span className="bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent"> Use Case</span>
          </h2>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Whether you're a DAO, freelancer, or business, LedgerLift adapts to your specific blockchain analytics needs.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {useCases.map((useCase, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center mb-6">
                <useCase.icon className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">{useCase.title}</h3>
              <p className="text-blue-100 mb-6 leading-relaxed">{useCase.description}</p>
              
              <ul className="space-y-3">
                {useCase.benefits.map((benefit, benefitIndex) => (
                  <li key={benefitIndex} className="flex items-center text-blue-200">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UseCases;
