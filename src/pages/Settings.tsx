import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { User, Mail, Phone, DollarSign, Crown, Scale, Users, Check, Info, Upload, FileCheck, Shield, X, Image as ImageIcon, AlertCircle, Lock, RefreshCcw } from 'lucide-react';

interface Profile {
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  preferred_currency: string;
  id_verified: boolean;
  subscription_tier: string;
}

const Settings = () => {
  const { user } = useAuth();
  const { canManageSettings, canManageSubscription } = usePermissions();
  const { refreshCurrency } = useCurrency();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setConfirmNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [settingsResetting, setSettingsResetting] = useState(false);

  const callbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
  const recoveryRedirectUrl = callbackUrl ? `${callbackUrl}?type=recovery` : '';

  const subscriptionTiers = [
    {
      tier: 'Free',
      price: 'R0',
      features: [
        'Basic wallet',
        'Transactions',
        'Shared expenses',
        'Basic notifications'
      ],
      icon: User,
      color: 'bg-muted'
    },
    {
      tier: 'Premium',
      price: 'R99-R149',
      features: [
        'Advanced expense analytics & AI insights',
        'Court-ready exportable reports',
        'Smart notifications & category tracking',
        'Goal-based saving pockets',
        'Priority support & calendar sync',
        'Custom virtual card designs'
      ],
      icon: Crown,
      color: 'bg-yellow-500'
    },
    {
      tier: 'Legal',
      price: 'R299-R499',
      features: [
        'Multi-client dashboard',
        'Exportable client reports',
        'Secure document storage',
        'Legal portal integration',
        'Digital signing of agreements',
        'All Premium features'
      ],
      icon: Scale,
      color: 'bg-purple-500'
    },
    {
      tier: 'Family+',
      price: 'R199',
      features: [
        'Multiple child wallets',
        'Guardian viewing access',
        'International transfer discounts',
        'Individual child insights',
        'Advanced spending analytics',
        'All Premium features'
      ],
      icon: Users,
      color: 'bg-blue-500'
    }
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setProfile(data);
          setFullName(data.full_name || '');
          setPhone(data.phone || '');
          setCurrency(data.preferred_currency || 'USD');
          
          // If there's an existing ID verification URL, set it as preview
          if (data.id_verification_url && !data.id_verified) {
            setIdPreview(data.id_verification_url);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
          preferred_currency: currency,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      if (profile) {
        setProfile({ ...profile, full_name: fullName, phone: phone, preferred_currency: currency });
      }
      // Refresh currency context so it updates across the app
      await refreshCurrency();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const reauthenticate = async (password: string) => {
    if (!user?.email) {
      throw new Error('No email associated with this account');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) {
      throw error;
    }
  };

  const handleEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newEmail || !confirmNewEmail) {
      toast.error('Enter and confirm your new email');
      return;
    }
    if (newEmail !== confirmNewEmail) {
      toast.error('Email addresses do not match');
      return;
    }
    if (!emailPassword) {
      toast.error('Enter your current password to continue');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      await reauthenticate(emailPassword);
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        callbackUrl ? { emailRedirectTo: callbackUrl } : undefined,
      );
      if (error) {
        throw error;
      }

      toast.success('Confirm the change using the link sent to your new email.');
      setNewEmail('');
      setConfirmNewEmail('');
      setEmailPassword('');
    } catch (error) {
      console.error('Email change error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Unable to update email',
      );
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPasswordInput || !newPasswordInput || !confirmNewPasswordInput) {
      toast.error('Fill in all password fields');
      return;
    }
    if (newPasswordInput.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      toast.error('New passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await reauthenticate(currentPasswordInput);
      const { error } = await supabase.auth.updateUser({ password: newPasswordInput });
      if (error) {
        throw error;
      }

      toast.success('Password updated successfully');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Unable to update password',
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSettingsPasswordReset = async () => {
    if (!user?.email) {
      toast.error('No email on file for this account');
      return;
    }

    setSettingsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: recoveryRedirectUrl || undefined,
      });
      if (error) {
        throw error;
      }

      toast.success('Password reset email sent');
    } catch (error) {
      console.error('Settings reset password error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Unable to send reset email',
      );
    } finally {
      setSettingsResetting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPEG, PNG, and PDF files are allowed');
        return;
      }
      
      setIdFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setIdPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setIdPreview(null);
      }
    }
  };

  const uploadIdVerification = async (userId: string, file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `id-verifications/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('id-verifications')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        // If file exists, try to overwrite
        if (uploadError.message.includes('already exists')) {
          const { error: deleteError } = await supabase.storage
            .from('id-verifications')
            .remove([filePath]);
          
          if (!deleteError) {
            const { error: retryError } = await supabase.storage
              .from('id-verifications')
              .upload(filePath, file);
            
            if (retryError) {
              toast.error('Failed to upload ID verification');
              return null;
            }
          }
        } else {
          toast.error('Failed to upload ID verification');
          return null;
        }
      }

      const { data } = supabase.storage
        .from('id-verifications')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload ID verification');
      return null;
    }
  };

  const handleUploadId = async () => {
    if (!user || !idFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploadingId(true);
    try {
      const idUrl = await uploadIdVerification(user.id, idFile);
      
      if (!idUrl) {
        setIsUploadingId(false);
        return;
      }

      // Update profile with verification URL and reset verification status
      const { error } = await supabase
        .from('profiles')
        .update({
          id_verification_url: idUrl,
          id_verified: false, // Reset to false so admin can review
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('ID verification uploaded successfully! Your verification is pending review.');
      
      // Refresh profile
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (updatedProfile) {
        setProfile(updatedProfile as Profile);
        setIdPreview(idUrl);
        setIdFile(null);
      }
    } catch (error) {
      console.error('Error uploading ID:', error);
      toast.error('Failed to upload ID verification');
    } finally {
      setIsUploadingId(false);
    }
  };

  const removeIdFile = () => {
    setIdFile(null);
    setIdPreview(null);
  };

  const handleUpgradeSubscription = async (tier: string) => {
    if (!canManageSubscription) {
      toast.error('Only parents can manage subscriptions');
      return;
    }

    if (!user) return;

    // Placeholder implementation - will integrate with payment system
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(`Successfully updated to ${tier} tier!`);
      if (profile) {
        setProfile({ ...profile, subscription_tier: tier } as Profile);
      }
    } catch (error) {
      toast.error('Failed to update subscription');
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!canManageSettings) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Alert className="max-w-md">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Settings are only available for parent accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and subscription preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback>
                    {profile?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{profile?.full_name || 'User'}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Preferred Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ZAR">ZAR (South African Rand)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                </select>
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Management</CardTitle>
              <CardDescription>Choose the plan that best fits your needs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {subscriptionTiers.map((plan) => {
                  const Icon = plan.icon;
                  const isCurrentPlan = profile?.subscription_tier?.toLowerCase() === plan.tier.toLowerCase();
                  
                  return (
                    <Card key={plan.tier} className={isCurrentPlan ? 'border-primary' : ''}>
                      <CardHeader>
                        <div className={`${plan.color} w-12 h-12 rounded-lg flex items-center justify-center mb-2`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <CardTitle className="text-xl">{plan.tier}</CardTitle>
                        <div className="text-2xl font-bold">{plan.price}</div>
                        <p className="text-sm text-muted-foreground">per month</p>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 mb-4">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {isCurrentPlan ? (
                          <Badge variant="outline" className="w-full justify-center">Current Plan</Badge>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleUpgradeSubscription(plan.tier)}
                          >
                            {plan.tier === 'Free' ? 'Downgrade' : 'Upgrade'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verification" className="space-y-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                ID Verification Status
              </CardTitle>
              <CardDescription>Verify your identity with a government-issued ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Display */}
              {profile?.id_verified ? (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/40">
                      <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 dark:text-green-100">Verified</p>
                      <p className="text-sm text-green-700 dark:text-green-300">Your identity has been verified</p>
                    </div>
                  </div>
                  {profile?.id_verification_url && (
                    <div className="mt-4">
                      <Button variant="outline" size="sm" asChild>
                        <a href={profile.id_verification_url} target="_blank" rel="noopener noreferrer">
                          <FileCheck className="w-4 h-4 mr-2" />
                          View Verified ID
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              ) : profile?.id_verification_url ? (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/40">
                      <div className="w-5 h-5 rounded-full border-2 border-yellow-600 dark:border-yellow-400 border-t-transparent animate-spin" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-yellow-900 dark:text-yellow-100">Pending Verification</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Your ID verification is under review. This usually takes 24-48 hours.
                      </p>
                    </div>
                  </div>
                  {idPreview && (
                    <div className="mt-4">
                      <Button variant="outline" size="sm" asChild>
                        <a href={profile.id_verification_url} target="_blank" rel="noopener noreferrer">
                          <FileCheck className="w-4 h-4 mr-2" />
                          View Uploaded ID
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900 dark:text-blue-100">Verification Required</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Upload a government-issued ID to verify your identity
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Section */}
              <div className="space-y-4 border-t pt-6">
                <div className="space-y-2">
                  <Label htmlFor="id-upload" className="text-base font-semibold">
                    {profile?.id_verification_url ? 'Update ID Verification' : 'Upload ID Document'}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Accepted formats: JPEG, PNG, or PDF (max 10MB)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Acceptable IDs: National ID, Passport, Driver's License
                  </p>
                </div>

                {/* File Input */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Input
                      id="id-upload"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileChange}
                      className="flex-1"
                      disabled={isUploadingId || profile?.id_verified}
                    />
                    {idFile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeIdFile}
                        disabled={isUploadingId}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Preview */}
                  {(idPreview || profile?.id_verification_url) && (
                    <div className="relative border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-start gap-4">
                        {idPreview && idPreview.startsWith('data:image') ? (
                          <img
                            src={idPreview}
                            alt="ID Preview"
                            className="w-32 h-20 object-cover rounded border"
                          />
                        ) : profile?.id_verification_url ? (
                          <div className="w-32 h-20 bg-muted rounded border flex items-center justify-center">
                            <FileCheck className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-32 h-20 bg-muted rounded border flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {idFile ? idFile.name : 'Previously uploaded ID'}
                          </p>
                          {idFile && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {(idFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upload Button */}
                  {idFile && !profile?.id_verified && (
                    <Button
                      onClick={handleUploadId}
                      disabled={isUploadingId}
                      className="w-full"
                    >
                      {isUploadingId ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload ID for Verification
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Info Alert */}
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Security:</strong> Your ID document is stored securely and encrypted. 
                    Verification is reviewed by our team within 24-48 hours. Once verified, 
                    you'll gain full access to all platform features.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Login Email
              </CardTitle>
              <CardDescription>
                Update the email you use to sign in. For safety, we’ll ask you to confirm with your current password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleEmailChange}>
                <div className="space-y-2">
                  <Label htmlFor="new-email">New email address</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="you@newdomain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-email">Confirm email</Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={confirmNewEmail}
                    onChange={(e) => setConfirmNewEmail(e.target.value)}
                    placeholder="Repeat new email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-password">Current password</Label>
                  <Input
                    id="email-password"
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Enter password to confirm"
                  />
                </div>
                <Button type="submit" disabled={isUpdatingEmail}>
                  {isUpdatingEmail ? 'Sending confirmation...' : 'Send confirmation email'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  We’ll send a confirmation link to your new address. Your email will update once you click the link.
                </p>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Password & Recovery
              </CardTitle>
              <CardDescription>
                Change your password or send yourself a reset link. Re-entering your current password keeps your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePasswordChange}>
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm new password</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmNewPasswordInput}
                    onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="submit" disabled={isUpdatingPassword}>
                    {isUpdatingPassword ? 'Updating...' : 'Update password'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start sm:justify-center"
                    onClick={handleSettingsPasswordReset}
                    disabled={settingsResetting}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {settingsResetting ? 'Sending link…' : 'Send reset email'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reset links use the same secure callback flow as sign-in, so you can finish the process without leaving the app.
                </p>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
