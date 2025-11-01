import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Users, Shield, FileText, CreditCard, Zap, Globe, Lock, Bell, Target, BarChart3, Download, Calendar, Palette, Headphones, Building, Child, Wallet, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const Pricing = () => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 'R0',
      period: 'month',
      description: 'Basic wallet transactions and shared expenses tracking',
      targetUser: 'General co-parents',
      features: [
        'Basic wallet transactions',
        'Shared expenses tracking',
        'Basic notifications',
        'Standard support'
      ],
      limitations: [
        'Limited analytics',
        'Basic reporting',
        'Standard themes'
      ],
      color: 'bg-gray-50',
      buttonText: 'Get Started Free',
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 'R99',
      period: 'month',
      description: 'Advanced analytics, smart alerts, and exportable legal reports',
      targetUser: 'Active parents',
      features: [
        'Advanced expense analytics & AI insights',
        'Court-ready, exportable financial reports',
        'Smart notifications & category tracking',
        'Goal-based saving pockets with co-parent contributions',
        'Priority customer support',
        'Calendar sync',
        'Custom virtual card designs & color themes',
        'Advanced security features'
      ],
      limitations: [],
      color: 'bg-blue-50',
      buttonText: 'Upgrade to Premium',
      popular: true
    },
    {
      id: 'legal',
      name: 'SupportCard+ Legal',
      price: 'R299',
      period: 'month',
      description: 'Multi-client dashboard, legal reports, and digital agreements',
      targetUser: 'Lawyers & Mediators',
      features: [
        'Multi-client dashboard with consent',
        'Exportable client reports for court use',
        'Secure document storage',
        'Legal portal integration',
        'Digital signing of contribution agreements',
        'Advanced analytics for multiple clients',
        'Priority legal support',
        'Compliance reporting',
        'Client management tools'
      ],
      limitations: [],
      color: 'bg-purple-50',
      buttonText: 'Start Legal Plan',
      popular: false
    },
    {
      id: 'family',
      name: 'Family+',
      price: 'R199',
      period: 'month',
      description: 'Multiple child wallets, guardian access, and spending insights',
      targetUser: 'Multi-child households',
      features: [
        'Separate wallets per child with limits',
        'Guardian viewing & contribution access',
        'International transfer fee discounts',
        'Individual child spending insights',
        'Family dashboard overview',
        'Child-specific analytics',
        'Guardian notifications',
        'Multi-child expense tracking',
        'Family budget management'
      ],
      limitations: [],
      color: 'bg-green-50',
      buttonText: 'Choose Family+',
      popular: false
    }
  ];

  const handleSelectPlan = async (planId: string) => {
    setIsLoading(true);
    setSelectedPlan(planId);
    
    try {
      // Simulate plan selection process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(`Selected ${plans.find(p => p.id === planId)?.name} plan!`);
      
      // Here you would integrate with your payment processor
      // For now, we'll just show a success message
      console.log('Selected plan:', planId);
      
    } catch (error) {
      toast.error('Failed to select plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (feature: string) => {
    if (feature.includes('analytics') || feature.includes('insights')) return <BarChart3 className="h-4 w-4" />;
    if (feature.includes('report') || feature.includes('export')) return <Download className="h-4 w-4" />;
    if (feature.includes('notification') || feature.includes('alert')) return <Bell className="h-4 w-4" />;
    if (feature.includes('security') || feature.includes('secure')) return <Shield className="h-4 w-4" />;
    if (feature.includes('support') || feature.includes('customer')) return <Headphones className="h-4 w-4" />;
    if (feature.includes('calendar') || feature.includes('sync')) return <Calendar className="h-4 w-4" />;
    if (feature.includes('design') || feature.includes('theme')) return <Palette className="h-4 w-4" />;
    if (feature.includes('client') || feature.includes('dashboard')) return <Building className="h-4 w-4" />;
    if (feature.includes('child') || feature.includes('family')) return <Child className="h-4 w-4" />;
    if (feature.includes('wallet') || feature.includes('transfer')) return <Wallet className="h-4 w-4" />;
    if (feature.includes('goal') || feature.includes('saving')) return <Target className="h-4 w-4" />;
    if (feature.includes('legal') || feature.includes('court')) return <FileText className="h-4 w-4" />;
    return <Check className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-6 shadow-medium">
            <CreditCard className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            SupportCard Premium Plans
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Choose the plan that works for your family's needs. From basic tracking to complete legal documentation.
          </p>
          <Badge className="bg-gradient-primary text-primary-foreground px-4 py-2 text-sm">
            🌍 Global Edition (🇿🇦 South African Default)
          </Badge>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative transition-all duration-300 hover:shadow-xl ${
                plan.popular ? 'ring-2 ring-primary shadow-xl scale-105' : 'hover:scale-105'
              } ${plan.color}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-primary text-primary-foreground px-4 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-primary">{plan.price}</span>
                  <span className="text-muted-foreground ml-1">/{plan.period}</span>
                </div>
                <CardDescription className="text-sm mt-2">
                  {plan.description}
                </CardDescription>
                <Badge variant="outline" className="mt-2 w-fit mx-auto">
                  <Users className="h-3 w-3 mr-1" />
                  {plan.targetUser}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Key Features
                  </h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm">
                        <div className="text-primary mt-0.5">
                          {getIcon(feature)}
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.limitations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Limitations
                    </h4>
                    <ul className="space-y-2">
                      {plan.limitations.map((limitation, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <div className="text-muted-foreground mt-0.5">
                            <Zap className="h-4 w-4" />
                          </div>
                          <span>{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button 
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-gradient-primary hover:bg-gradient-primary/90' 
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isLoading && selectedPlan === plan.id}
                >
                  {isLoading && selectedPlan === plan.id ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    plan.buttonText
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feature Comparison */}
        <Card className="mb-16">
          <CardHeader>
            <CardTitle className="text-center">Feature Comparison</CardTitle>
            <CardDescription className="text-center">
              Compare all features across our subscription tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">Features</th>
                    <th className="text-center p-4 font-semibold">Free</th>
                    <th className="text-center p-4 font-semibold">Premium</th>
                    <th className="text-center p-4 font-semibold">Legal</th>
                    <th className="text-center p-4 font-semibold">Family+</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Basic Transactions', free: true, premium: true, legal: true, family: true },
                    { feature: 'Advanced Analytics', free: false, premium: true, legal: true, family: true },
                    { feature: 'Legal Reports', free: false, premium: true, legal: true, family: false },
                    { feature: 'Multi-Client Dashboard', free: false, premium: false, legal: true, family: false },
                    { feature: 'Child Wallets', free: false, premium: false, legal: false, family: true },
                    { feature: 'Digital Signatures', free: false, premium: false, legal: true, family: false },
                    { feature: 'Priority Support', free: false, premium: true, legal: true, family: true },
                    { feature: 'Custom Themes', free: false, premium: true, legal: true, family: true },
                    { feature: 'International Transfers', free: false, premium: false, legal: false, family: true },
                    { feature: 'Guardian Access', free: false, premium: false, legal: false, family: true }
                  ].map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-4 font-medium">{row.feature}</td>
                      <td className="text-center p-4">
                        {row.free ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="text-center p-4">
                        {row.premium ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="text-center p-4">
                        {row.legal ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="text-center p-4">
                        {row.family ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Revenue Growth</h3>
            <p className="text-muted-foreground">
              Different plans for different needs. Pick what works for your situation.
            </p>
          </Card>
          
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Global Trust</h3>
            <p className="text-muted-foreground">
              Enhancing SupportCard's role as a trusted global co-parenting fintech solution.
            </p>
          </Card>
          
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Enhanced Security</h3>
            <p className="text-muted-foreground">
              Advanced security features and compliance reporting for all subscription tiers.
            </p>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="text-center p-8 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <h2 className="text-3xl font-bold mb-4">Want to Start?</h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Choose the plan that best fits your needs and start managing child support with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-primary hover:bg-gradient-primary/90">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline">
              Contact Sales
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Pricing;
