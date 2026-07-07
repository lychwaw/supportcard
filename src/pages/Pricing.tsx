import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, Star, Shield, FileText, CreditCard,
  Globe, Lock, Bell, BarChart3, Calendar,
  TrendingUp, Users, Scale, Gift, Sparkles,
} from 'lucide-react';
import { subscriptionTiers, SubscriptionTier, FOUNDER_OFFER, getTierPriceDisplay } from '@/lib/subscriptions';
import { useCurrency } from '@/contexts/CurrencyContext';

const getFeatureIcon = (feature: string) => {
  const f = feature.toLowerCase();
  if (f.includes('insight') || f.includes('scai')) return <Sparkles className="h-4 w-4" />;
  if (f.includes('export') || f.includes('court')) return <FileText className="h-4 w-4" />;
  if (f.includes('notif') || f.includes('alert')) return <Bell className="h-4 w-4" />;
  if (f.includes('security') || f.includes('audit') || f.includes('verified') || f.includes('support')) return <Shield className="h-4 w-4" />;
  if (f.includes('calendar') || f.includes('sync')) return <Calendar className="h-4 w-4" />;
  if (f.includes('child')) return <Users className="h-4 w-4" />;
  if (f.includes('professional') || f.includes('lawyer')) return <Scale className="h-4 w-4" />;
  if (f.includes('document') || f.includes('stored')) return <BarChart3 className="h-4 w-4" />;
  return <Check className="h-4 w-4" />;
};

const TIER_STYLE: Record<string, { color: string; popular: boolean; buttonVariant: string }> = {
  preview:   { color: 'bg-gray-50 dark:bg-gray-900/30',     popular: false, buttonVariant: 'outline' },
  essential: { color: 'bg-blue-50 dark:bg-blue-900/20',     popular: false, buttonVariant: 'default' },
  plus:      { color: 'bg-purple-50 dark:bg-purple-900/20', popular: true,  buttonVariant: 'default' },
  premium:   { color: 'bg-green-50 dark:bg-green-900/20',   popular: false, buttonVariant: 'default' },
};

const TIER_BUTTON_LABEL: Record<string, string> = {
  preview:   'Start Preview',
  essential: 'Get Organised',
  plus:      'Choose Plus',
  premium:   'Protect Records',
};

const FEATURE_MATRIX = [
  { label: 'Calendar',                          preview: true,  essential: true,  plus: true,  premium: true  },
  { label: 'Expense Logging',                   preview: true,  essential: true,  plus: true,  premium: true  },
  { label: 'Drop-off & Pickup Logs',            preview: true,  essential: true,  plus: true,  premium: true  },
  { label: 'Private Co-Parent Messaging',       preview: true,  essential: true,  plus: true,  premium: true  },
  { label: 'My SCAI Assistant',                 preview: false, essential: false, plus: true,  premium: true  },
  { label: 'AI Tone-Check',                     preview: false, essential: false, plus: true,  premium: true  },
  { label: 'PDF Exports',                       preview: false, essential: false, plus: true,  premium: true  },
  { label: 'Unlimited Children',                preview: false, essential: false, plus: false, premium: true  },
  { label: 'Court-Admissible Record Exports',   preview: false, essential: false, plus: false, premium: true  },
  { label: 'Verified Handoffs (GPS Required)',  preview: false, essential: false, plus: false, premium: true  },
  { label: 'Invite a Professional',             preview: false, essential: false, plus: false, premium: true  },
  { label: 'Priority Support',                  preview: false, essential: false, plus: false, premium: true  },
];

const formatLimit = (value: number | 'unlimited') => (value === 'unlimited' ? 'Unlimited' : String(value));

const Pricing = () => {
  const navigate = useNavigate();
  const { currency } = useCurrency();

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
            From quick scheduling to court-ready records — pick the plan that fits your family.
          </p>
          <Badge className="bg-gradient-primary text-primary-foreground px-4 py-2 text-sm">
            Priced in USD · Shown in your local currency · Cancel any month
          </Badge>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {subscriptionTiers.map((tier: SubscriptionTier) => {
            const style = TIER_STYLE[tier.id] ?? TIER_STYLE.preview;
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
                    <span className="text-3xl font-bold text-primary">{getTierPriceDisplay(tier, currency)}</span>
                    {tier.priceUsd > 0 && (
                      <span className="text-muted-foreground text-sm">/{tier.billingCycle}</span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-primary/80 mt-1">
                    {formatLimit(tier.limits.childProfiles)} child profile{tier.limits.childProfiles === 1 ? '' : 's'}
                  </div>
                  <CardDescription className="text-xs mt-2 leading-snug">
                    {tier.tagline} — {tier.description}
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

                  {tier.id === FOUNDER_OFFER.applicableTier && (
                    <p className="text-xs text-center text-primary font-medium">
                      Or lock in the Founder Offer — see below
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Founder Offer banner */}
        <Card className="mb-16 bg-blue-50 dark:bg-blue-900/20 border-primary/30">
          <CardContent className="py-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <Gift className="w-10 h-10 text-primary shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-bold text-lg">{FOUNDER_OFFER.label}</p>
              <p className="text-muted-foreground text-sm">{FOUNDER_OFFER.description}</p>
            </div>
            <Button onClick={handleSelectPlan} className="shrink-0">
              Claim Founder Pricing
            </Button>
          </CardContent>
        </Card>

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
            { icon: <TrendingUp className="h-6 w-6 text-primary-foreground" />, title: 'Transparent Pricing', body: 'One price, every feature listed. No hidden fees.' },
            { icon: <Globe className="h-6 w-6 text-primary-foreground" />, title: 'Global Pricing', body: 'Priced in USD, shown automatically in your local currency.' },
            { icon: <Lock className="h-6 w-6 text-primary-foreground" />, title: 'Court-Grade Security', body: 'Encrypted records and hash-verified exports accepted in legal proceedings.' },
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
            Start free with Preview — upgrade any time. Cancel any month. No long-term commitment.
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
