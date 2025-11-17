import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { CreditCard, Shield, Upload, FileCheck, UserCheck, Wallet } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupAge, setSignupAge] = useState<number | ''>('');
  const [parentRole, setParentRole] = useState<'payer' | 'receiver' | 'both'>('payer');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idFileName, setIdFileName] = useState('');
  const [resetRequesting, setResetRequesting] = useState(false);

  const callbackUrl = `${window.location.origin}/auth/callback`;
  const recoveryRedirectUrl = `${callbackUrl}?type=recovery`;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // Use the full URL for redirect to ensure proper callback handling
      const redirectUrl = callbackUrl;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        toast.error(error.message || 'Failed to sign in with Google');
        setIsLoading(false);
      }
      // Note: Don't set loading to false here - the redirect will happen
      // Loading will be reset when component unmounts or user returns
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setIdFile(file);
      setIdFileName(file.name);
    }
  };

  const uploadIdVerification = async (userId: string, file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `id-verifications/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('id-verifications')
        .upload(filePath, file);

      if (uploadError) {
        toast.error('Failed to upload ID verification');
        return null;
      }

      const { data } = supabase.storage
        .from('id-verifications')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      toast.error('Failed to upload ID verification');
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupEmail || !signupPassword || !signupFullName || !signupAge) {
      toast.error('Please fill in all fields');
      return;
    }

    if (typeof signupAge !== 'number' || signupAge < 13 || signupAge > 120) {
      toast.error('Please enter a valid age (13-120)');
      return;
    }

    if (!idFile) {
      toast.error('Please upload a government-issued ID for verification');
      return;
    }

    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      // Check for invitation token in URL
      const urlParams = new URLSearchParams(window.location.search);
      const inviteToken = urlParams.get('token');

      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            full_name: signupFullName,
          },
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        toast.error(error.message);
      } else if (data.user) {
        // Upload ID verification
        const idUrl = await uploadIdVerification(data.user.id, idFile);
        
        // Generate family_id (unique for new families, or use existing from invite)
        let familyId = `family_${data.user.id}_${Date.now()}`;
        let childId: string | null = null;

        // If accepting an invite, get family_id and child_id from invite
        if (inviteToken) {
          const { data: inviteData } = await supabase
            .from('parent_invites')
            .select('*')
            .eq('token', inviteToken)
            .eq('status', 'pending')
            .single();

          if (inviteData) {
            // Get family_id from the inviter's profile
            const { data: inviterProfile } = await supabase
              .from('profiles')
              .select('family_id')
              .eq('id', inviteData.inviter_id)
              .single();

            if (inviterProfile?.family_id) {
              familyId = inviterProfile.family_id;
            }
            childId = inviteData.child_id;

            // Update invite status
            await supabase
              .from('parent_invites')
              .update({ 
                status: 'accepted',
                accepted_at: new Date().toISOString()
              })
              .eq('id', inviteData.id);
          }
        }
        
        // Update profile with ID verification, parent_role, family_id, and age
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            id_verification_url: idUrl || null,
            id_verified: false,
            parent_role: parentRole,
            family_id: familyId,
            email: signupEmail,
            full_name: signupFullName,
            age: signupAge
          } as any)
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        }

        // If accepting invite, link child to this co-parent
        if (childId) {
          await supabase
            .from('children')
            .update({ co_parent_id: data.user.id })
            .eq('id', childId);
        }

        // Assign parent role to new user
        const { error: roleError } = await supabase
          .from('user_roles' as any)
          .insert({
            user_id: data.user.id,
            role: 'parent',
          } as any);

        if (roleError) {
          console.error('Error assigning role:', roleError);
        }
        
        toast.success(inviteToken 
          ? 'Account created! You are now connected to the child profile.' 
          : 'Account created successfully! Please check your email to verify your account.');
        navigate('/');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (email: string) => {
    if (!email) {
      toast.error('Enter your email address first');
      return;
    }

    setResetRequesting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirectUrl,
      });
      if (error) {
        throw error;
      }

      toast.success('Password reset email sent. Check your inbox.');
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Unable to send reset email',
      );
    } finally {
      setResetRequesting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4 shadow-medium">
            <CreditCard className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            SupportCard
          </h1>
          <p className="text-muted-foreground">Powered by SouthSphere.co</p>
        </div>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to manage your child support payments</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm font-normal"
                      onClick={() => handlePasswordReset(loginEmail)}
                      disabled={isLoading || resetRequesting}
                    >
                      {resetRequesting ? 'Sending link…' : 'Forgot password?'}
                    </Button>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAppleLogin}
                      disabled={isLoading}
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      Apple
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min. 6 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm font-normal"
                      onClick={() => handlePasswordReset(signupEmail)}
                      disabled={isLoading || resetRequesting}
                    >
                      {resetRequesting ? 'Sending link…' : 'Need to reset an existing account?'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-age">Age</Label>
                    <Input
                      id="signup-age"
                      type="number"
                      min="13"
                      max="120"
                      placeholder="Enter your age"
                      value={signupAge}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSignupAge(value === '' ? '' : parseInt(value, 10));
                      }}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for role assignment. Age under 18 will be assigned child role.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">Your Role</Label>
                    <RadioGroup
                      value={parentRole}
                      onValueChange={(value) => setParentRole(value as 'payer' | 'receiver' | 'both')}
                      disabled={isLoading}
                      className="grid grid-cols-3 gap-3"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                        <RadioGroupItem value="payer" id="payer" className="mt-0" />
                        <Label htmlFor="payer" className="cursor-pointer flex-1 flex flex-col">
                          <span className="font-medium flex items-center gap-1">
                            <Wallet className="w-4 h-4" />
                            Payer
                          </span>
                          <span className="text-xs text-muted-foreground">Send money</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                        <RadioGroupItem value="receiver" id="receiver" className="mt-0" />
                        <Label htmlFor="receiver" className="cursor-pointer flex-1 flex flex-col">
                          <span className="font-medium flex items-center gap-1">
                            <UserCheck className="w-4 h-4" />
                            Receiver
                          </span>
                          <span className="text-xs text-muted-foreground">Manage spending</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                        <RadioGroupItem value="both" id="both" className="mt-0" />
                        <Label htmlFor="both" className="cursor-pointer flex-1 flex flex-col">
                          <span className="font-medium flex items-center gap-1">
                            <CreditCard className="w-4 h-4" />
                            Both
                          </span>
                          <span className="text-xs text-muted-foreground">Send & receive</span>
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      Select your role: Payer sends money, Receiver manages spending
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="id-verification" className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4" />
                      Government ID Verification (Required)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="id-verification"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('id-verification')?.click()}
                        disabled={isLoading}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {idFileName || 'Upload ID Document'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload a clear photo or scan of your government-issued ID (passport, driver's license, or ID card)
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAppleLogin}
                      disabled={isLoading}
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      Apple
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>Secure child support payment management</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
