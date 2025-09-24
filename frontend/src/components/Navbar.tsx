import { Link, useNavigate, useLocation } from "react-router-dom";
import { BarChart3, CircleUser, Settings, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWallet } from "@/contexts/WalletContext";

const Navbar = () => {
  const { isConnected, userWallet, userAlias, disconnectWallet, currentNetwork, connectedWallets } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    disconnectWallet();
    navigate("/");
  };

  const handleManageWallets = () => {
    navigate("/manage-wallets");
  };

  const handlePreferences = () => {
    navigate("/preferences");
  };

  // Show connected state only on dashboard pages
  const showConnectedState =
    location.pathname.includes("/dashboard") ||
    location.pathname.includes("/manage-wallets") ||
    location.pathname.includes("/preferences");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-white">LedgerLift</span>
        </Link>

        <div className="hidden md:flex items-center space-x-8">
          {/* Future navigation links will go here */}
        </div>

        <div className="flex items-center">
          {!isConnected || !showConnectedState ? (
            <Button
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300"
            >
              Get Started
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-3 p-2 hover:bg-slate-800/50 rounded-lg"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-sm">
                      <CircleUser className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <div className="text-white font-medium text-sm">{userAlias}</div>
                    <div className="text-gray-400 text-xs">{userWallet.slice(0, 6)}...{userWallet.slice(-4)}</div>
                    {currentNetwork && (
                      <div className="text-blue-400 text-xs">{currentNetwork}</div>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleManageWallets}
                  className="cursor-pointer"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Manage Wallets
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handlePreferences}
                  className="cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600"
                >
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
