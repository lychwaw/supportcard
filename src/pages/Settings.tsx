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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { User, Mail, Phone, DollarSign, Check, Info, Upload, FileCheck, Shield, X, Image as ImageIcon, AlertCircle, Lock, RefreshCcw } from 'lucide-react';
import { hashString, constantTimeCompare } from '@/lib/security';

interface Profile {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  preferred_currency?: string | null;
  id_verified?: boolean | null;
  subscription_tier?: string | null;
  id_verification_url?: string | null;
  bio?: string | null;
  require_child_passcode?: boolean | null;
  parent_passcode_hint?: string | null;
  parent_passcode_hash?: string | null;
  passcode_failed_attempts?: number | null;
  passcode_locked_until?: string | null;
}

const Settings = () => {
  const { user } = useAuth();
  const { canManageSettings } = usePermissions();
  const { refreshCurrency, setCurrency: setAppCurrency } = useCurrency();
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
  const [requireChildPasscode, setRequireChildPasscode] = useState(false);
  const [passcodeHint, setPasscodeHint] = useState('');
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);

  const callbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
  const recoveryRedirectUrl = callbackUrl ? `${callbackUrl}?type=recovery` : '';

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          // If profile doesn't exist, create a default one
          if (error.code === 'PGRST116') {
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || '',
              })
              .select()
              .single();

            if (createError) throw createError;
            if (newProfile) {
              const typedProfile = newProfile as Profile;
              setProfile(typedProfile);
              setFullName(typedProfile.full_name || '');
              setPhone(typedProfile.phone || '');
              setCurrency(typedProfile.preferred_currency || 'USD');
              setRequireChildPasscode(typedProfile.require_child_passcode ?? false);
              setPasscodeHint(typedProfile.parent_passcode_hint || '');
            }
          } else {
            throw error;
          }
        } else if (data) {
          const typedProfile = data as Profile;
          setProfile(typedProfile);
          setFullName(typedProfile.full_name || '');
          setPhone(typedProfile.phone || '');
          setCurrency(typedProfile.preferred_currency || 'USD');
          setRequireChildPasscode(typedProfile.require_child_passcode ?? false);
          setPasscodeHint(typedProfile.parent_passcode_hint || '');
          
          // If there's an existing ID verification URL, set it as preview
          if (typedProfile.id_verification_url && !typedProfile.id_verified) {
            setIdPreview(typedProfile.id_verification_url);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile. Please refresh the page.');
        // Set a default empty profile so UI doesn't break
        setProfile({
          full_name: '',
          email: user.email || '',
          phone: '',
          avatar_url: '',
          preferred_currency: 'USD',
          id_verified: false,
          subscription_tier: 'Free',
          require_child_passcode: false,
          parent_passcode_hint: '',
          parent_passcode_hash: null,
        } as Profile);
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

  const handlePasscodeUpdate = async () => {
    if (!user) return;

    if (requireChildPasscode && !(newPasscode || profile?.parent_passcode_hash)) {
      toast.error('Set a passcode before requiring it for child accounts');
      return;
    }

    if (newPasscode && newPasscode.length < 4) {
      toast.error('Passcode must be at least 4 characters');
      return;
    }

    if (newPasscode && newPasscode !== confirmPasscode) {
      toast.error('Passcodes do not match');
      return;
    }

    setIsUpdatingPasscode(true);
    try {
      let nextHash = profile?.parent_passcode_hash || null;

      if (profile?.parent_passcode_hash) {
        if (!currentPasscode) {
          toast.error('Enter your current passcode to update it');
          setIsUpdatingPasscode(false);
          return;
        }
        const currentHash = await hashString(currentPasscode);
        const isValid = constantTimeCompare(currentHash, profile.parent_passcode_hash);
        if (!isValid) {
          toast.error('Current passcode is incorrect');
          setIsUpdatingPasscode(false);
          return;
        }
      }

      if (newPasscode) {
        nextHash = await hashString(newPasscode);
      } else if (!requireChildPasscode) {
        nextHash = nextHash;
      }

      const updatePayload: Record<string, any> = {
        require_child_passcode: requireChildPasscode,
        parent_passcode_hint: passcodeHint || null,
      };

      if (newPasscode) {
        updatePayload.parent_passcode_hash = nextHash;
        updatePayload.passcode_updated_at = new Date().toISOString();
        updatePayload.passcode_failed_attempts = 0;
        updatePayload.passcode_locked_until = null;
      } else if (!requireChildPasscode && !nextHash) {
        updatePayload.parent_passcode_hash = null;
        updatePayload.parent_passcode_hint = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Passcode preferences updated');
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              require_child_passcode: requireChildPasscode,
              parent_passcode_hint: passcodeHint,
              parent_passcode_hash: nextHash,
            }
          : prev
      );
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
    } catch (error) {
      console.error('Passcode update error:', error);
      toast.error('Unable to update passcode');
    } finally {
      setIsUpdatingPasscode(false);
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
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (uploadError.message.includes('Bucket not found')) {
          toast.error('Storage bucket not configured. Please contact support.');
        } else if (uploadError.message.includes('new row violates row-level security')) {
          toast.error('Permission denied. Please check your account permissions.');
        } else {
          toast.error(`Upload failed: ${uploadError.message}`);
        }
        return null;
      }

      const { data } = supabase.storage
        .from('id-verifications')
        .getPublicUrl(filePath);

      if (!data?.publicUrl) {
        toast.error('Failed to get file URL after upload');
        return null;
      }

      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(
        error instanceof Error 
          ? `Upload failed: ${error.message}` 
          : 'Failed to upload ID verification. Please try again.'
      );
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

  const handleRegisterWebhook = async () => {
    setIsRegisteringWebhook(true);
    setWebhookMessage(null);
    setWebhookSecret(null);

    try {
      const response = await fetch('/api/yoco-register-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to register webhook');
      }

      const data = await response.json();
      if (data?.secret) {
        setWebhookSecret(data.secret);
        setWebhookMessage('Webhook registered. Save the secret in Vercel as YOCO_WEBHOOK_SECRET.');
      } else {
        setWebhookMessage('Webhook registered. No secret was returned (it is shown only once).');
      }
    } catch (error) {
      console.error('Webhook registration error:', error);
      setWebhookMessage('Unable to register webhook. Check your Yoco key and try again.');
    } finally {
      setIsRegisteringWebhook(false);
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
        <p className="text-muted-foreground">Manage your account preferences and security settings</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
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
                  onChange={(e) => {
                    const nextCurrency = e.target.value;
                    setCurrency(nextCurrency);
                    setAppCurrency(nextCurrency);
                  }}
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

        <TabsContent value="verification" className="space-y-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    ID Verification Status
                  </CardTitle>
                  <CardDescription>Verify your identity with a government-issued ID</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!user) return;
                    setIsLoading(true);
                    try {
                      const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    if (error) throw error;
                    if (data) {
                      const refreshedProfile = data as Profile;
                      setProfile(refreshedProfile);
                      if (refreshedProfile.id_verification_url && !refreshedProfile.id_verified) {
                        setIdPreview(refreshedProfile.id_verification_url);
                      }
                    }
                    } catch (error) {
                      console.error('Error refreshing profile:', error);
                      toast.error('Failed to refresh status');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Loading State */}
              {isLoading && !profile ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
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
                </>
              )}
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
                <Shield className="w-5 h-5" />
                Yoco Webhook Registration
              </CardTitle>
              <CardDescription>
                Register the webhook endpoint to activate automatic subscription updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleRegisterWebhook} disabled={isRegisteringWebhook}>
                {isRegisteringWebhook ? 'Registering...' : 'Register Webhook'}
              </Button>
              <p className="text-xs text-muted-foreground">
                This uses your server-side `YOCO_SECRET_KEY` and returns the webhook secret once.
                Copy it and save it in Vercel as `YOCO_WEBHOOK_SECRET`.
              </p>
              {webhookMessage && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">{webhookMessage}</AlertDescription>
                </Alert>
              )}
              {webhookSecret && (
                <div className="rounded-lg border bg-muted p-3 text-xs font-mono break-all">
                  {webhookSecret}
                </div>
              )}
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Parent Passcode
              </CardTitle>
              <CardDescription>
                Require a short passcode before a child can switch back to the parent account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium">Require passcode</p>
                  <p className="text-sm text-muted-foreground">
                    Toggle to enforce passcode entry on child devices.
                  </p>
                </div>
                <Switch
                  checked={requireChildPasscode}
                  onCheckedChange={setRequireChildPasscode}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="passcode-hint">Passcode hint</Label>
                  <Input
                    id="passcode-hint"
                    placeholder="e.g. Favorite place"
                    value={passcodeHint}
                    onChange={(e) => setPasscodeHint(e.target.value)}
                  />
                </div>
                {profile?.parent_passcode_hint && (
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Current hint</p>
                    <p>{profile.parent_passcode_hint}</p>
                  </div>
                )}
              </div>

              {profile?.parent_passcode_hash && (
                <div className="space-y-2">
                  <Label htmlFor="current-passcode">Current passcode</Label>
                  <Input
                    id="current-passcode"
                    type="password"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-passcode">New passcode</Label>
                  <Input
                    id="new-passcode"
                    type="password"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-passcode">Confirm passcode</Label>
                  <Input
                    id="confirm-passcode"
                    type="password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <Button onClick={handlePasscodeUpdate} disabled={isUpdatingPasscode}>
                {isUpdatingPasscode ? 'Saving...' : 'Save Passcode Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
