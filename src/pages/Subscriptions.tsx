import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePermissions } from '@/hooks/usePermissions';
import { subscriptionTiers, getTierPriceDisplay, SubscriptionTierId, FOUNDER_OFFER } from '@/lib/subscriptions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const Subscriptions = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { tier, status, expiryDate, isActive, refreshSubscription } = useSubscription();
  const { canManageSubscription } = usePermissions();
  const [isSubmitting, setIsSubmitting] = useState<SubscriptionTierId | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
    const paymentStatus = url.searchParams.get('payment');

    if (paymentStatus === 'success') {
      toast.success('Payment received. Your subscription will update shortly.');
      refreshSubscription();
      url.searchParams.delete('payment');
      window.history.replaceState({}, '', url.toString());
    }

    if (paymentStatus === 'cancel') {
      toast.error('Payment cancelled.');
      url.searchParams.delete('payment');
      window.history.replaceState({}, '', url.toString());
    }
  }, [refreshSubscription]);

  const handlePreviewPlan = async () => {
    if (!user) return;
    setIsSubmitting('preview');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'preview',
          subscription_status: 'active',
          expiry_date: null,
        } as any)
        .eq('id', user.id);

      if (error) throw error;
      await refreshSubscription();
      toast.success('You are now on the Preview plan.');
    } catch (error) {
      console.error('Error selecting preview plan:', error);
      toast.error('Unable to update your plan.');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCheckout = async (tierId: SubscriptionTierId, useFounderPrice = false) => {
    if (!user) return;
    setIsSubmitting(tierId);
    setCheckoutError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/dodo-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ tier: tierId, useFounderPrice }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to start checkout';
        try {
          const data = await response.json();
          if (data?.error) errorMessage = `${errorMessage}: ${data.error}`;
        } catch {
          const text = await response.text();
          if (text) errorMessage = `${errorMessage}: ${text}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data?.payment_link) {
        throw new Error('Missing payment link');
      }

      window.location.href = data.payment_link;
    } catch (error) {
      console.error('Dodo checkout error:', error);
      const message = error instanceof Error ? error.message : 'Unable to start checkout.';
      setCheckoutError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage your plan and unlock more of SupportCard.
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
            {tier ? `Plan: ${tier}` : 'No plan selected'} · Expires: {expiryLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Payments are processed via Dodo Payments. Prices shown in your selected currency are USD equivalents.
          </p>
          {checkoutError && (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {checkoutError}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {subscriptionTiers.map((plan) => {
          const isCurrent = tier === plan.id && isActive;
          const isProcessing = isSubmitting === plan.id;
          const priceLabel = getTierPriceDisplay(plan, currency);
          const isFounderEligible = plan.id === FOUNDER_OFFER.applicableTier;

          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary shadow-soft' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>{plan.tagline} — {plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {priceLabel}
                  {plan.priceUsd > 0 && (
                    <span className="text-base font-normal text-muted-foreground">
                      {plan.billingCycle === 'year' ? ' / year' : ' / month'}
                    </span>
                  )}
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  {plan.id === 'preview' ? (
                    <Button
                      variant={isCurrent ? 'secondary' : 'outline'}
                      onClick={handlePreviewPlan}
                      disabled={!canManageSubscription || isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Updating…' : isCurrent ? 'Current Plan' : 'Select Preview Plan'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={!canManageSubscription || isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Redirecting…' : `Subscribe to ${plan.name}`}
                    </Button>
                  )}
                  {isFounderEligible && !isCurrent && (
                    <Button
                      variant="outline"
                      onClick={() => handleCheckout(plan.id, true)}
                      disabled={!canManageSubscription || isProcessing}
                      className="w-full border-primary/40 text-primary"
                    >
                      <Gift className="w-4 h-4 mr-2" aria-hidden="true" />
                      {isProcessing ? 'Redirecting…' : `${FOUNDER_OFFER.label} — ${getTierPriceDisplay(plan, currency, true)}/mo`}
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

      <Card className="border-dashed">
        <CardContent className="pt-6 flex items-start gap-3">
          <Gift className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium text-sm">{FOUNDER_OFFER.label}</p>
            <p className="text-sm text-muted-foreground">{FOUNDER_OFFER.description}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscriptions;
