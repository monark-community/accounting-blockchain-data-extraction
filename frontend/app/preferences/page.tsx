'use client';

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Download, Upload, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { MFASetupDialog } from "@/components/MFASetupDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Preferences = () => {
  const { userPreferences, updatePreferences, exportWallets, importWallets } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const [importData, setImportData] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [loadingMFA, setLoadingMFA] = useState(true);

  const currencies = [
    { value: 'CAD', label: 'Canadian Dollar (CAD)' },
    { value: 'USD', label: 'US Dollar (USD)' }
  ];

  const countries = [
    { value: 'Canada', label: 'Canada' }
  ];

  const states = [
    { value: 'Quebec', label: 'Quebec' },
    { value: 'Ontario', label: 'Ontario' },
    { value: 'British Columbia', label: 'British Columbia' },
    { value: 'Alberta', label: 'Alberta' }
  ];

  const handleSave = () => {
    toast({
      title: "Preferences saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleExport = () => {
    const data = exportWallets();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ledgerlift-wallets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Wallets exported",
      description: "Your wallet data has been downloaded.",
    });
  };

  const handleImport = () => {
    if (!importData.trim()) {
      toast({
        title: "Import failed",
        description: "Please paste valid JSON data.",
        variant: "destructive",
      });
      return;
    }

    const success = importWallets(importData);
    if (success) {
      toast({
        title: "Wallets imported",
        description: "Your wallet data has been imported successfully.",
      });
      setImportData("");
    } else {
      toast({
        title: "Import failed",
        description: "Invalid JSON format or data structure.",
        variant: "destructive",
      });
    }
  };

  // Check MFA status on mount
  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const response = await fetch('/api/mfa/status', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMfaEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Failed to check MFA status:', error);
    } finally {
      setLoadingMFA(false);
    }
  };

  const handleMFASetupComplete = () => {
    setMfaEnabled(true);
    toast({
      title: "2FA Enabled",
      description: "Two-factor authentication has been successfully enabled for your account.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />
      <div className="pt-28 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-slate-800">User Preferences</h1>
          </div>

          <div className="grid gap-6">
            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Two-Factor Authentication (2FA)</h4>
                      <p className="text-sm text-slate-600">
                        Add an extra layer of security to your account with authenticator app codes.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {loadingMFA ? (
                        <div className="text-sm text-slate-500">Loading...</div>
                      ) : mfaEnabled ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm font-medium">Enabled</span>
                        </div>
                      ) : (
                        <Button onClick={() => setShowMFASetup(true)} size="sm">
                          Enable 2FA
                        </Button>
                      )}
                    </div>
                  </div>

                  {mfaEnabled && (
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        Your account is protected with two-factor authentication. You'll need to enter a code from your authenticator app when logging in.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* General Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="currency">Preferred Currency</Label>
                    <Select
                      value={userPreferences.currency}
                      onValueChange={(value) => updatePreferences({ currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={userPreferences.country}
                      onValueChange={(value) => updatePreferences({ country: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="state">Province/State</Label>
                    <Select
                      value={userPreferences.state}
                      onValueChange={(value) => updatePreferences({ state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select province/state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Tax Recommendations</h4>
                  <p className="text-blue-800 text-sm">
                    Based on your location ({userPreferences.country}, {userPreferences.state}), 
                    we recommend using FIFO accounting method and consulting with a local tax professional 
                    for crypto tax obligations.
                  </p>
                </div>

                <Button onClick={handleSave} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>

            {/* Data Management */}
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Export Wallet Data</h4>
                    <p className="text-sm text-slate-600 mb-4">
                      Download your connected wallets and preferences as a JSON file for backup.
                    </p>
                    <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export to JSON
                    </Button>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Import Wallet Data</h4>
                    <p className="text-sm text-slate-600 mb-4">
                      Paste your exported JSON data to restore wallets and preferences.
                    </p>
                    <div className="space-y-2">
                      <Input
                        placeholder="Paste JSON data here..."
                        value={importData}
                        onChange={(e) => setImportData(e.target.value)}
                      />
                      <Button onClick={handleImport} variant="outline" className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Import from JSON
          </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
        </Card>
          </div>
        </div>
      </div>

      {/* MFA Setup Dialog */}
      <MFASetupDialog
        open={showMFASetup}
        onClose={() => setShowMFASetup(false)}
        onComplete={handleMFASetupComplete}
      />
    </div>
  );
};

export default Preferences;