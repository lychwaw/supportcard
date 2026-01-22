import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePermissions } from '@/hooks/usePermissions';
import { subscriptionTiers, getTierPriceDisplay, SubscriptionTierId } from '@/lib/subscriptions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

const Subscriptions = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { tier, status, expiryDate, isActive, refreshSubscription } = useSubscription();
  const { canManageSubscription } = usePermissions();
  const [isSubmitting, setIsSubmitting] = useState<SubscriptionTierId | null>(null);

  const expiryLabel = useMemo(() => {
    if (!expiryDate) return 'No expiry set';
    try {
      return format(new Date(expiryDate), 'MMM dd, yyyy');
    } catch {
      return expiryDate;
    }
  }, [expiryDate]);


  useEffect(() => {
    const url = new URL(window.location.href);
    const checkoutStatus = url.searchParams.get('checkout');

    if (checkoutStatus === 'success') {
      toast.success('Payment received. Your subscription will update shortly.');
      refreshSubscription();
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url.toString());
    }

    if (checkoutStatus === 'cancel') {
      toast.error('Payment cancelled.');
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url.toString());
    }
  }, [refreshSubscription]);

  const handleFreePlan = async () => {
    if (!user) return;
    setIsSubmitting('free');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'active',
          expiry_date: null,
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshSubscription();
      toast.success('You are now on the Free plan.');
    } catch (error) {
      console.error('Error selecting free plan:', error);
      toast.error('Unable to update your plan.');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCheckout = async (tierId: SubscriptionTierId) => {
    if (!user) return;
    setIsSubmitting(tierId);

    try {
      const response = await fetch('/api/yoco-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier_id: tierId,
          user_id: user.id,
          currency,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start checkout');
      }

      const data = await response.json();
      if (!data?.checkout_url) {
        throw new Error('Missing checkout URL');
      }

      window.location.href = data.checkout_url;
    } catch (error) {
      console.error('Yoco checkout error:', error);
      toast.error('Unable to start checkout. Please try again.');
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage your plan, renew manually each month, and unlock premium features.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current Plan
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? 'Active' : status || 'Inactive'}
            </Badge>
          </CardTitle>
          <CardDescription>
            {tier ? `Plan: ${tier.replace('_', ' ')}` : 'No plan selected'} · Expires: {expiryLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Payments are processed via Yoco hosted checkout (manual renewal each month).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {subscriptionTiers.map((plan) => {
          const isCurrent = tier === plan.id && isActive;
          const isProcessing = isSubmitting === plan.id;
          const priceLabel = getTierPriceDisplay(plan, currency);

          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary shadow-soft' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {priceLabel}
                  <span className="text-base font-normal text-muted-foreground"> / month</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div>
                  {plan.id === 'free' ? (
                    <Button
                      variant={isCurrent ? 'secondary' : 'outline'}
                      onClick={handleFreePlan}
                      disabled={!canManageSubscription || isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Updating…' : isCurrent ? 'Current Plan' : 'Select Free Plan'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={!canManageSubscription || isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Redirecting…' : 'Pay with Yoco'}
                    </Button>
                  )}
                  {!canManageSubscription && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Only parent accounts can manage subscriptions.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Subscriptions;

