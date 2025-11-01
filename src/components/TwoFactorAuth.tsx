import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Shield, Smartphone, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TwoFactorAuthProps {
  user: any;
  onVerified?: () => void;
}

export function TwoFactorAuth({ user, onVerified }: TwoFactorAuthProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'email'>('sms');
  const [phoneNumber, setPhoneNumber] = useState('');

  const enable2FA = async () => {
    setIsLoading(true);
    try {
      // For demo purposes, we'll simulate 2FA setup
      // In production, this would integrate with a real 2FA service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('2FA setup initiated! Check your phone for verification code.');
      setIsEnabled(true);
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      toast.error('Failed to enable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!verificationCode) {
      toast.error('Please enter the verification code');
      return;
    }

    setIsVerifying(true);
    try {
      // For demo purposes, accept any 6-digit code
      if (verificationCode.length === 6) {
        toast.success('2FA verified successfully!');
        onVerified?.();
      } else {
        toast.error('Invalid verification code');
      }
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      toast.error('Failed to verify 2FA');
    } finally {
      setIsVerifying(false);
    }
  };

  const disable2FA = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsEnabled(false);
      toast.success('2FA disabled');
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      toast.error('Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Shield className="w-12 h-12 text-blue-600" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 2FA Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">2FA Protection</p>
              <p className="text-sm text-muted-foreground">
                {isEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
          <Badge variant={isEnabled ? "default" : "secondary"}>
            {isEnabled ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Verification Method Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Verification Method</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={verificationMethod === 'sms' ? 'default' : 'outline'}
              onClick={() => setVerificationMethod('sms')}
              className="flex items-center space-x-2"
            >
              <Smartphone className="w-4 h-4" />
              <span>SMS</span>
            </Button>
            <Button
              variant={verificationMethod === 'email' ? 'default' : 'outline'}
              onClick={() => setVerificationMethod('email')}
              className="flex items-center space-x-2"
            >
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </Button>
          </div>
        </div>

        {/* Phone Number Input (for SMS) */}
        {verificationMethod === 'sms' && (
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+27 82 123 4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
        )}

        {/* Verification Code Input */}
        {isEnabled && (
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
            />
            <Button 
              onClick={verify2FA}
              disabled={isVerifying || verificationCode.length !== 6}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {!isEnabled ? (
            <Button 
              onClick={enable2FA}
              disabled={isLoading || (verificationMethod === 'sms' && !phoneNumber)}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Enable 2FA
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={disable2FA}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable 2FA'
              )}
            </Button>
          )}
        </div>

        {/* Security Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 2FA adds an extra security layer to your account</p>
          <p>• You'll need to verify your identity when signing in</p>
          <p>• Keep your phone secure and accessible</p>
        </div>
      </CardContent>
    </Card>
  );
}

