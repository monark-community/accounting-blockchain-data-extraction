'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { Loader2, CheckCircle2, Shield, Download } from "lucide-react";

interface MFASetupDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function MFASetupDialog({ open, onClose, onComplete }: MFASetupDialogProps) {
  const [step, setStep] = useState<'loading' | 'qr' | 'verify' | 'backup' | 'complete'>('loading');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Step 1: Fetch QR code and secret
  useEffect(() => {
    if (open && step === 'loading') {
      fetchMFASetup();
    }
  }, [open, step]);

  const fetchMFASetup = async () => {
    try {
      const response = await fetch('/api/mfa/setup', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to setup MFA');
      }

      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep('qr');
    } catch (error: any) {
      toast.error('Failed to setup MFA: ' + error.message);
      onClose();
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      // Verify the code
      const verifyResponse = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Invalid verification code');
      }

      // Enable MFA
      const enableResponse = await fetch('/api/mfa/enable', {
        method: 'POST',
        credentials: 'include',
      });

      if (!enableResponse.ok) {
        throw new Error('Failed to enable MFA');
      }

      setStep('backup');
      toast.success('MFA enabled successfully!');
    } catch (error: any) {
      toast.error('Verification failed: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ledgerlift-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup codes downloaded');
  };

  const handleComplete = () => {
    setStep('complete');
    toast.success('2FA setup complete!');
    setTimeout(() => {
      onComplete();
      onClose();
      // Reset state
      setStep('loading');
      setVerificationCode('');
      setShowBackupCodes(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Enable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            {step === 'loading' && 'Setting up 2FA...'}
            {step === 'qr' && 'Scan the QR code with your authenticator app'}
            {step === 'verify' && 'Enter the 6-digit code from your app'}
            {step === 'backup' && 'Save your backup codes'}
            {step === 'complete' && '2FA is now enabled!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
            <p className="mt-4 text-sm text-muted-foreground">Preparing your 2FA setup...</p>
          </div>
        )}

        {/* Step 2: QR Code */}
        {step === 'qr' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              
              <div className="w-full space-y-2">
                <Label>Or enter this code manually:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={secret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(secret);
                      toast.success('Secret copied to clipboard');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  Install an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator on your phone.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => setStep('verify')} className="flex-1">
                I've scanned the code
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Verify */}
        {step === 'verify' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Enter 6-digit code</Label>
              <Input
                id="code"
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-widest"
                autoFocus
              />
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Open your authenticator app and enter the 6-digit code shown.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('qr')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleVerify} 
                disabled={isVerifying || verificationCode.length !== 6}
                className="flex-1"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Enable'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Backup Codes */}
        {step === 'backup' && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription className="text-sm">
                Save these backup codes in a safe place. You can use them to access your account if you lose your device.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Your Backup Codes</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadBackupCodes}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="p-2 bg-background rounded">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleComplete} className="w-full">
              I've saved my backup codes
            </Button>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <p className="text-lg font-semibold">2FA Enabled Successfully!</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your account is now protected with two-factor authentication.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

