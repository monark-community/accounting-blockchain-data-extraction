
import { Link } from "react-router-dom";
import { BarChart3, Github, Twitter, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white">LedgerLift</span>
            </div>
            <p className="text-blue-200 text-sm leading-relaxed">
              Transform your crypto transactions into audit-ready financial reports with ease.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <div className="space-y-2">
              <Link to="/demo" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Demo
              </Link>
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Features
              </Link>
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Pricing
              </Link>
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <div className="space-y-2">
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                About
              </Link>
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Blog
              </Link>
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Careers
              </Link>
            </div>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <div className="space-y-2">
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Help Center
              </Link>
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Contact Us
              </Link>
              <Link to="#" className="block text-blue-200 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-blue-200 text-sm">
            © 2024 LedgerLift. All rights reserved.
          </p>
          
          {/* Social Links */}
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <a href="#" className="text-blue-200 hover:text-white transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-blue-200 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="#" className="text-blue-200 hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
