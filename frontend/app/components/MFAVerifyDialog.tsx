'use client';

import { useState } from 'react';
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
import { Loader2, Shield } from "lucide-react";

interface MFAVerifyDialogProps {
  open: boolean;
  onVerify: (code: string) => Promise<void>;
}

export function MFAVerifyDialog({ open, onVerify }: MFAVerifyDialogProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setError('');
    setIsVerifying(true);

    try {
      await onVerify(code);
      // Reset on success
      setCode('');
    } catch (error: any) {
      setError(error.message || 'Invalid code. Please try again.');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6 && !isVerifying) {
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[400px]" closeButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setCode(value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder="000000"
              className="text-center text-2xl font-mono tracking-widest"
              autoFocus
              disabled={isVerifying}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertDescription className="text-sm">
              Open your authenticator app (Google Authenticator, Authy, etc.) and enter the code shown.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleSubmit} 
            disabled={isVerifying || code.length !== 6}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Lost access to your authenticator? Contact support for account recovery.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

