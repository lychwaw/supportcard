import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmailVerificationProps {
  user: any;
  onVerified?: () => void;
}

export function EmailVerification({ user, onVerified }: EmailVerificationProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    checkVerificationStatus();
  }, [user]);

  const checkVerificationStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      setIsVerified(data.user?.email_confirmed_at ? true : false);
    } catch (error) {
      console.error('Error checking verification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!user?.email) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) throw error;

      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      console.error('Error resending verification:', error);
      toast.error('Failed to send verification email');
    } finally {
      setIsResending(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (isVerified) {
    return (
      <Card className="w-full max-w-md mx-auto border-green-200 bg-green-50">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <CardTitle className="text-green-800">Email Verified!</CardTitle>
          <CardDescription className="text-green-600">
            Your email address has been successfully verified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={onVerified} 
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Continue to App
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Mail className="w-12 h-12 text-blue-600" />
        </div>
        <CardTitle>Verify Your Email</CardTitle>
        <CardDescription>
          We've sent a verification link to <strong>{user?.email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <Badge variant="outline" className="mb-4">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending Verification
          </Badge>
          <p className="text-sm text-muted-foreground">
            Please check your email and click the verification link to continue.
          </p>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={resendVerificationEmail}
            disabled={isResending}
            variant="outline"
            className="w-full"
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Resend Verification Email
              </>
            )}
          </Button>

          <Button 
            onClick={checkVerificationStatus}
            variant="outline"
            className="w-full"
          >
            I've Verified My Email
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          <p>Didn't receive the email? Check your spam folder.</p>
        </div>
      </CardContent>
    </Card>
  );
}

