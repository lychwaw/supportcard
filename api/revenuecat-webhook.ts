import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';
import { referralSubscriptionActive, referralSubscriptionEnded } from './_referrals.js';

// RevenueCat entitlement IDs → our subscription_tier values
const ENTITLEMENT_TO_TIER: Record<string, string> = {
  essential: 'essential',
  plus:      'plus',
  premium:   'premium',
};

// Events that mean the subscription is active
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
]);

// Not every "bad" event ends access, and treating them as if they did took
// away days a customer had already paid for.
//
//   CANCELLATION   Usually just auto-renew switched off. The customer keeps access
//                  until the period ends, and EXPIRATION arrives then. Only a
//                  refund (cancel_reason CUSTOMER_SUPPORT), or an expiry already in
//                  the past, ends access now.
//   BILLING_ISSUE  A payment failed and Apple is retrying. Access continues; if the
//                  retries fail, EXPIRATION follows.
//   EXPIRATION     Access has ended.
//
// Previously all three downgraded the customer to free on the spot and voided
// their partner referral, even if they switched auto-renew back on.
function accessHasEnded(event: any): boolean {
  if (event.type === 'EXPIRATION') return true;
  if (event.type !== 'CANCELLATION') return false;
  if (event.cancel_reason === 'CUSTOMER_SUPPORT') return true;
  return typeof event.expiration_at_ms === 'number' && event.expiration_at_ms <= Date.now();
}

const getSupabase = () => createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify the shared secret RevenueCat sends as the Authorization header
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] ?? '';
    const incoming = auth.replace(/^Bearer\s+/i, '');
    if (incoming !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    const event = req.body?.event;
    if (!event) {
      res.status(400).json({ error: 'Missing event body' });
      return;
    }

    const { type: eventType, app_user_id: userId, entitlement_ids } = event;
    if (!userId) {
      res.status(400).json({ error: 'Missing app_user_id' });
      return;
    }

    const supabase = getSupabase();

    if (ACTIVE_EVENTS.has(eventType)) {
      const tier = (entitlement_ids ?? [])
        .map((e: string) => ENTITLEMENT_TO_TIER[e])
        .find(Boolean) ?? null;

      if (tier) {
        await supabase.from('profiles').update({
          subscription_tier:   tier,
          subscription_status: 'active',
        }).eq('id', userId);

        await referralSubscriptionActive(supabase, userId, tier, `revenuecat:${eventType}`);
      }
    } else if (accessHasEnded(event)) {
      await supabase.from('profiles').update({
        subscription_tier:   'preview',
        subscription_status: 'cancelled',
      }).eq('id', userId);

      await referralSubscriptionEnded(supabase, userId, eventType, 'revenuecat');
    } else if (eventType === 'BILLING_ISSUE') {
      // Flag it, keep the plan. EXPIRATION removes access if Apple gives up.
      await supabase.from('profiles').update({
        subscription_status: 'past_due',
      }).eq('id', userId);
    }
    // CANCELLATION with access remaining: nothing changes until EXPIRATION.

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('revenuecat-webhook error:', err?.message);
    res.status(500).json({ error: 'Internal error' });
  }
}
