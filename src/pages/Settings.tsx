import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { User, Mail, Phone, DollarSign, Crown, Scale, Users, Check } from 'lucide-react';

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('USD');

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
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpgradeSubscription = async (tier: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(`Upgraded to ${tier} plan!`);
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
          <Card>
            <CardHeader>
              <CardTitle>ID Verification Status</CardTitle>
              <CardDescription>Your identity verification status</CardDescription>
            </CardHeader>
            <CardContent>
              {profile?.id_verified ? (
                <div className="flex items-center gap-3 text-green-600">
                  <Check className="w-6 h-6" />
                  <div>
                    <p className="font-semibold">Verified</p>
                    <p className="text-sm text-muted-foreground">Your identity has been verified</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-yellow-600">
                    <div className="w-6 h-6 rounded-full border-2 border-yellow-600 border-t-transparent animate-spin" />
                    <div>
                      <p className="font-semibold">Pending Verification</p>
                      <p className="text-sm text-muted-foreground">Your ID verification is under review</p>
                    </div>
                  </div>
                  {profile?.id_verification_url && (
                    <Button variant="outline" asChild>
                      <a href={profile.id_verification_url} target="_blank" rel="noopener noreferrer">
                        View Uploaded ID
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
