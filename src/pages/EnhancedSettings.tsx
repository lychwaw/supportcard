import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { usePermissionContext } from '@/components/PermissionProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings as SettingsIcon, 
  CreditCard, 
  Plus, 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Camera,
  Mail,
  Phone,
  DollarSign,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  method_type: string;
  last_four: string;
  is_default: boolean;
}

const EnhancedSettings = () => {
  const { user } = useAuth();
  const { isParent, userRole } = usePermissionContext();
  const [loading, setLoading] = useState(true);
  
  // Profile data
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('ZAR');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [expenseAlerts, setExpenseAlerts] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  
  // Privacy settings
  const [profileVisibility, setProfileVisibility] = useState('private');
  const [dataSharing, setDataSharing] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  
  // Appearance preferences
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('en');
  const [fontSize, setFontSize] = useState('medium');

  useEffect(() => {
    fetchProfile();
    fetchPaymentMethods();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFullName(data.full_name || '');
        setEmail(data.email || user.email || '');
        setPhone(data.phone || '');
        setCurrency(data.preferred_currency || 'ZAR');
        setAvatarUrl(data.avatar_url || '');
        setBio(data.bio || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      if (data) setPaymentMethods(data);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
          preferred_currency: currency,
          avatar_url: avatarUrl,
          bio: bio,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!user) return;

    try {
      const lastFour = Math.floor(1000 + Math.random() * 9000).toString();
      const { error } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user.id,
          method_type: 'Credit Card',
          last_four: lastFour,
          is_default: paymentMethods.length === 0,
        });

      if (error) throw error;
      toast.success('Payment method added');
      fetchPaymentMethods();
    } catch (error) {
      toast.error('Failed to add payment method');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Settings
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">Manage your account and preferences</p>
              <Badge variant={isParent ? "default" : "secondary"} className="capitalize">
                {userRole}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-12">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy & Security
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Profile Information */}
            <Card className="shadow-sm border-0 bg-gradient-to-br from-card to-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal details and avatar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                    <AvatarImage src={avatarUrl} alt={fullName} />
                    <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                      {fullName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="avatarUrl" className="flex items-center gap-2 text-sm font-medium">
                      <Camera className="h-4 w-4" />
                      Avatar URL
                    </Label>
                    <Input
                      id="avatarUrl"
                      placeholder="https://example.com/avatar.jpg"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                
                {/* Personal Details */}
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                      className="opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+27 123 456 7890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell us a bit about yourself..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Preferred Currency
                    </Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ZAR">🇿🇦 ZAR (R) - South African Rand</SelectItem>
                        <SelectItem value="USD">🇺🇸 USD ($) - US Dollar</SelectItem>
                        <SelectItem value="EUR">🇪🇺 EUR (€) - Euro</SelectItem>
                        <SelectItem value="GBP">🇬🇧 GBP (£) - British Pound</SelectItem>
                        <SelectItem value="CAD">🇨🇦 CAD ($) - Canadian Dollar</SelectItem>
                        <SelectItem value="AUD">🇦🇺 AUD ($) - Australian Dollar</SelectItem>
                        <SelectItem value="JPY">🇯🇵 JPY (¥) - Japanese Yen</SelectItem>
                        <SelectItem value="CHF">🇨🇭 CHF (Fr) - Swiss Franc</SelectItem>
                        <SelectItem value="CNY">🇨🇳 CNY (¥) - Chinese Yuan</SelectItem>
                        <SelectItem value="INR">🇮🇳 INR (₹) - Indian Rupee</SelectItem>
                        <SelectItem value="BRL">🇧🇷 BRL (R$) - Brazilian Real</SelectItem>
                        <SelectItem value="MXN">🇲🇽 MXN ($) - Mexican Peso</SelectItem>
                        <SelectItem value="BWP">🇧🇼 BWP (P) - Botswana Pula</SelectItem>
                        <SelectItem value="NAD">🇳🇦 NAD ($) - Namibian Dollar</SelectItem>
                        <SelectItem value="ZWL">🇿🇼 ZWL ($) - Zimbabwean Dollar</SelectItem>
                        <SelectItem value="KES">🇰🇪 KES (KSh) - Kenyan Shilling</SelectItem>
                        <SelectItem value="NGN">🇳🇬 NGN (₦) - Nigerian Naira</SelectItem>
                        <SelectItem value="EGP">🇪🇬 EGP (E£) - Egyptian Pound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button onClick={handleUpdateProfile} className="w-full">
                  Save Profile Changes
                </Button>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            {isParent && (
              <Card className="shadow-sm border-0 bg-gradient-to-br from-card to-card/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Payment Methods
                      </CardTitle>
                      <CardDescription>Manage your payment options</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleAddPaymentMethod}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Card
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-8">
                      <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground mb-4">No payment methods added</p>
                      <Button onClick={handleAddPaymentMethod} variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Card
                      </Button>
                    </div>
                  ) : (
                    paymentMethods.map((method) => (
                      <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{method.method_type}</p>
                            <p className="text-sm text-muted-foreground">
                              •••• {method.last_four}
                            </p>
                          </div>
                        </div>
                        {method.is_default && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="shadow-sm border-0 bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={setEmailNotifications} 
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="font-medium">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get instant notifications</p>
                  </div>
                  <Switch 
                    checked={pushNotifications} 
                    onCheckedChange={setPushNotifications} 
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="font-medium">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive text messages</p>
                  </div>
                  <Switch 
                    checked={smsNotifications} 
                    onCheckedChange={setSmsNotifications} 
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="font-medium">Expense Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified about new expenses</p>
                  </div>
                  <Switch 
                    checked={expenseAlerts} 
                    onCheckedChange={setExpenseAlerts} 
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="font-medium">Budget Alerts</Label>
                    <p className="text-sm text-muted-foreground">Warnings when approaching limits</p>
                  </div>
                  <Switch 
                    checked={budgetAlerts} 
                    onCheckedChange={setBudgetAlerts} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="shadow-sm border-0 bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Privacy & Security
              </CardTitle>
              <CardDescription>Control your privacy and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Profile Visibility</Label>
                  <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="family">Family Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="font-medium">Data Sharing</Label>
                    <p className="text-sm text-muted-foreground">Share anonymized data for improvements</p>
                  </div>
                  <Switch 
                    checked={dataSharing} 
                    onCheckedChange={setDataSharing} 
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="font-medium">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add extra security to your account</p>
                  </div>
                  <Switch 
                    checked={twoFactorAuth} 
                    onCheckedChange={setTwoFactorAuth} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card className="shadow-sm border-0 bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Appearance & Language
              </CardTitle>
              <CardDescription>Customize how the app looks and feels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Language
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="af">🇿🇦 Afrikaans</SelectItem>
                      <SelectItem value="zu">🇿🇦 isiZulu</SelectItem>
                      <SelectItem value="xh">🇿🇦 isiXhosa</SelectItem>
                      <SelectItem value="st">🇿🇦 Sesotho</SelectItem>
                      <SelectItem value="tn">🇿🇦 Setswana</SelectItem>
                      <SelectItem value="ve">🇿🇦 Tshivenda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select value={fontSize} onValueChange={setFontSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedSettings;
