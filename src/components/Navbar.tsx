
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, CircleUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Navbar = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [userWallet, setUserWallet] = useState("");
  const [userAlias, setUserAlias] = useState("");
  const navigate = useNavigate();

  const handleConnectWallet = () => {
    // Simulate wallet connection
    setUserWallet("0x1234567890abcdef");
    setUserAlias("CryptoUser");
    setIsConnected(true);
    navigate("/demo"); // Go to dashboard/demo page
  };

  const handleLogout = () => {
    setIsConnected(false);
    setUserWallet("");
    setUserAlias("");
    navigate("/");
  };

  const handleProfile = () => {
    // Navigate to profile page (to be implemented)
    console.log("Navigate to profile");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-white">LedgerLift</span>
        </Link>

        {/* Navigation Links (placeholder for future) */}
        <div className="hidden md:flex items-center space-x-8">
          {/* Future navigation links will go here */}
        </div>

        {/* Connect Wallet / User Menu */}
        <div className="flex items-center">
          {!isConnected ? (
            <Button
              onClick={handleConnectWallet}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300"
            >
              Connect Wallet
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-3 p-2 hover:bg-slate-800/50 rounded-lg">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-sm">
                      <CircleUser className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <div className="text-white font-medium text-sm">{userAlias}</div>
                    <div className="text-gray-400 text-xs">{userWallet.slice(0, 6)}...</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleProfile} className="cursor-pointer">
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
