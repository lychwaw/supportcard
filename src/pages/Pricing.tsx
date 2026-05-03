import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, Star, Shield, FileText, CreditCard,
  Globe, Lock, Bell, Target, BarChart3, Download,
  Calendar, Palette, Headphones, Wallet, TrendingUp, Users,
} from 'lucide-react';
import { subscriptionTiers, SubscriptionTier } from '@/lib/subscriptions';

const getFeatureIcon = (feature: string) => {
  const f = feature.toLowerCase();
  if (f.includes('analytic') || f.includes('insight')) return <BarChart3 className="h-4 w-4" />;
  if (f.includes('report') || f.includes('export')) return <Download className="h-4 w-4" />;
  if (f.includes('notif') || f.includes('alert')) return <Bell className="h-4 w-4" />;
  if (f.includes('security') || f.includes('audit') || f.includes('court') || f.includes('legal')) return <Shield className="h-4 w-4" />;
  if (f.includes('support') || f.includes('manager')) return <Headphones className="h-4 w-4" />;
  if (f.includes('calendar') || f.includes('sync')) return <Calendar className="h-4 w-4" />;
  if (f.includes('design') || f.includes('theme') || f.includes('custom')) return <Palette className="h-4 w-4" />;
  if (f.includes('guardian') || f.includes('wallet') || f.includes('child')) return <Users className="h-4 w-4" />;
  if (f.includes('transfer') || f.includes('cap') || f.includes('payment')) return <Wallet className="h-4 w-4" />;
  if (f.includes('goal') || f.includes('saving')) return <Target className="h-4 w-4" />;
  if (f.includes('document') || f.includes('signing') || f.includes('agreement')) return <FileText className="h-4 w-4" />;
  return <Check className="h-4 w-4" />;
};

const TIER_STYLE: Record<string, { color: string; popular: boolean; buttonVariant: string }> = {
  free:        { color: 'bg-gray-50 dark:bg-gray-900/30',     popular: false, buttonVariant: 'outline' },
  premium:     { color: 'bg-blue-50 dark:bg-blue-900/20',     popular: true,  buttonVariant: 'default' },
  family_plus: { color: 'bg-green-50 dark:bg-green-900/20',   popular: false, buttonVariant: 'default' },
  legal:       { color: 'bg-purple-50 dark:bg-purple-900/20', popular: false, buttonVariant: 'default' },
};

const TIER_BUTTON_LABEL: Record<string, string> = {
  free:        'Get Started Free',
  premium:     'Upgrade to Premium',
  family_plus: 'Choose Family+',
  legal:       'Start Legal Plan',
};

const formatPrice = (tier: SubscriptionTier) => {
  if (tier.id === 'free') return 'R0';
  return `R${tier.priceZar.toLocaleString()}`;
};

const FEATURE_MATRIX = [
  { label: 'Virtual Card',              free: true,  premium: true,  family_plus: true,  legal: true  },
  { label: 'Expense Logging',           free: true,  premium: true,  family_plus: true,  legal: true  },
  { label: 'In-App Messaging',          free: true,  premium: true,  family_plus: true,  legal: true  },
  { label: 'Custom Card Designs',       free: false, premium: true,  family_plus: true,  legal: true  },
  { label: 'AI Spending Insights',      free: false, premium: true,  family_plus: true,  legal: true  },
  { label: 'Goal-Based Saving',         free: false, premium: true,  family_plus: true,  legal: true  },
  { label: 'Shared Calendar',           free: false, premium: true,  family_plus: true,  legal: true  },
  { label: 'Smart Notifications',       free: false, premium: true,  family_plus: true,  legal: true  },
  { label: 'Multiple Child Wallets',    free: false, premium: false, family_plus: true,  legal: true  },
  { label: 'Guardian Viewing Access',   free: false, premium: false, family_plus: true,  legal: true  },
  { label: 'Per-Child Insights',        free: false, premium: false, family_plus: true,  legal: true  },
  { label: 'Emergency Wallet Freeze',   free: false, premium: false, family_plus: true,  legal: true  },
  { label: 'Court-Ready Reports',       free: false, premium: false, family_plus: false, legal: true  },
  { label: 'Audit Trails',             free: false, premium: false, family_plus: false, legal: true  },
  { label: 'Secure Document Storage',   free: false, premium: false, family_plus: false, legal: true  },
  { label: 'Digital Agreement Signing', free: false, premium: false, family_plus: false, legal: true  },
  { label: 'Cross-Border Payments',     free: false, premium: false, family_plus: false, legal: true  },
  { label: 'Priority Dispute Flagging', free: false, premium: false, family_plus: false, legal: true  },
  { label: 'Dedicated Account Manager', free: false, premium: false, family_plus: false, legal: true  },
];

const TRANSFER_CAPS: Record<string, string> = {
  free:        'R5,000 / month',
  premium:     'R25,000 / month',
  family_plus: 'R75,000 / month',
  legal:       'Unlimited',
};

const Pricing = () => {
  const navigate = useNavigate();

  const handleSelectPlan = () => navigate('/subscriptions');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-6 shadow-medium">
            <CreditCard className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            SupportCard Plans
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            From basic tracking to full legal documentation — pick the plan that fits your family.
          </p>
          <Badge className="bg-gradient-primary text-primary-foreground px-4 py-2 text-sm">
            South African Rand (ZAR) · Cancel any month
          </Badge>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {subscriptionTiers.map((tier) => {
            const style = TIER_STYLE[tier.id] ?? TIER_STYLE.free;
            return (
              <Card
                key={tier.id}
                className={`relative transition-all duration-300 hover:shadow-xl ${
                  style.popular
                    ? 'ring-2 ring-primary shadow-xl scale-105'
                    : 'hover:scale-105'
                } ${style.color}`}
              >
                {style.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-primary text-primary-foreground px-4 py-1">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl font-bold">{tier.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1 mt-2">
                    <span className="text-3xl font-bold text-primary">{formatPrice(tier)}</span>
                    {tier.id !== 'free' && (
                      <span className="text-muted-foreground text-sm">/{tier.billingCycle}</span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-primary/80 mt-1">
                    {TRANSFER_CAPS[tier.id]} transfer cap
                  </div>
                  <CardDescription className="text-xs mt-2 leading-snug">
                    {tier.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5 shrink-0">
                          {getFeatureIcon(feature)}
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={style.buttonVariant as any}
                    onClick={handleSelectPlan}
                  >
                    {TIER_BUTTON_LABEL[tier.id] ?? 'Choose Plan'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <Card className="mb-16 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-center">Full Feature Comparison</CardTitle>
            <CardDescription className="text-center">
              Higher tiers include all features from lower tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold w-1/3">Feature</th>
                    {subscriptionTiers.map(t => (
                      <th key={t.id} className="text-center p-3 font-semibold">{t.name}</th>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground font-medium">Monthly transfer cap</td>
                    {subscriptionTiers.map(t => (
                      <td key={t.id} className="text-center p-3 text-xs font-medium text-primary">
                        {TRANSFER_CAPS[t.id]}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_MATRIX.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{row.label}</td>
                      {subscriptionTiers.map(t => {
                        const has = row[t.id as keyof typeof row] as boolean;
                        return (
                          <td key={t.id} className="text-center p-3">
                            {has
                              ? <Check className="h-4 w-4 text-green-500 mx-auto" />
                              : <span className="text-muted-foreground">—</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Trust signals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: <TrendingUp className="h-6 w-6 text-primary-foreground" />, title: 'Transparent Pricing', body: 'One price, every feature listed. No hidden fees or odd-cent conversions.' },
            { icon: <Globe className="h-6 w-6 text-primary-foreground" />, title: 'Global Trust', body: 'Built for co-parents worldwide — starting in South Africa.' },
            { icon: <Lock className="h-6 w-6 text-primary-foreground" />, title: 'Court-Grade Security', body: 'Encrypted records and audit trails accepted in legal proceedings.' },
          ].map(({ icon, title, body }) => (
            <Card key={title} className="text-center p-6">
              <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                {icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm">{body}</p>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <Card className="text-center p-8 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Sign up free — upgrade any time. Cancel any month. No long-term commitment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-primary" onClick={() => navigate('/auth')}>
              Create Free Account
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/subscriptions')}>
              View My Plan
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Pricing;
