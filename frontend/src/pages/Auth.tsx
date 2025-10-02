import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { useWeb3Auth } from '@web3auth/no-modal-react-hooks';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowRight } from "lucide-react";

export default function Auth() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const web3auth = useWeb3Auth();

  async function handleSocialLogin(provider: string) {
    setIsLoading(provider);
    try {
      // Map UI provider names to Web3Auth login types
      const providerMap: { [key: string]: string } = {
        Google: 'google',
        Facebook: 'facebook', 
        X: 'twitter',
        Discord: 'discord'
      };

      const loginProvider = providerMap[provider];
      if (!loginProvider) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Call Web3Auth login - access the web3auth instance
      const web3AuthInstance = web3auth.web3Auth;
      if (!web3AuthInstance) {
        throw new Error('Web3Auth not initialized');
      }
      
      // Use the correct Web3Auth v9 login method
      await web3AuthInstance.connectTo('openlogin', {
        loginProvider: loginProvider as any,
      });
      
      toast?.success?.(`Successfully logged in with ${provider}!`);
      
      // Redirect to dashboard after successful login
      window.location.href = '/dashboard';
      
    } catch (err: any) {
      console.error(`${provider} login error:`, err);
      toast?.error?.(`${provider} login failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to LedgerLift
          </h1>
          <p className="text-blue-100">
            Connect your wallet to start tracking blockchain transactions
          </p>
        </div>

        {/* Social Login Card */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl text-white">
              Sign in to continue
            </CardTitle>
            <CardDescription className="text-blue-100">
              Choose your preferred login method
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Google */}
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("Google")}
              disabled={isLoading === "Google"}
              className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300 transition-all duration-200"
            >
              {isLoading === "Google" ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
              {isLoading !== "Google" && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>

            {/* Facebook */}
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("Facebook")}
              disabled={isLoading === "Facebook"}
              className="w-full h-12 bg-[#1877F2] hover:bg-[#166FE5] text-white border-[#1877F2] hover:border-[#166FE5] transition-all duration-200"
            >
              {isLoading === "Facebook" ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              )}
              Continue with Facebook
              {isLoading !== "Facebook" && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>

            {/* X (Twitter) */}
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("X")}
              disabled={isLoading === "X"}
              className="w-full h-12 bg-black hover:bg-gray-900 text-white border-gray-800 hover:border-gray-700 transition-all duration-200"
            >
              {isLoading === "X" ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              )}
              Continue with X
              {isLoading !== "X" && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>

            {/* Discord */}
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("Discord")}
              disabled={isLoading === "Discord"}
              className="w-full h-12 bg-[#5865F2] hover:bg-[#4752C4] text-white border-[#5865F2] hover:border-[#4752C4] transition-all duration-200"
            >
              {isLoading === "Discord" ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              )}
              Continue with Discord
              {isLoading !== "Discord" && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </CardContent>

          <CardFooter className="justify-center text-xs text-blue-200/80 pt-6">
            <p className="text-center">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="underline hover:text-white transition-colors">
                Terms
              </Link>
              {" and "}
              <Link to="/privacy" className="underline hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-blue-200 hover:text-white transition-colors text-sm underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}