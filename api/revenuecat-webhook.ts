import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';

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

// Events that mean the subscription ended
const LAPSED_EVENTS = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
]);

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

        // Write subscription_started_at on the first active event (INITIAL_PURCHASE)
        // so the 90-day qualification window starts from the right moment.
        if (eventType === 'INITIAL_PURCHASE') {
          const { data: referral } = await supabase
            .from('referrals')
            .select('id, status')
            .eq('user_id', userId)
            .maybeSingle();

          if (referral && referral.status === 'pending') {
            await supabase.from('referrals').update({
              tier,
              subscription_started_at: new Date().toISOString(),
            }).eq('id', referral.id);

            await supabase.from('referral_events').insert({
              referral_id: referral.id,
              event_type:  'subscription_started',
              old_status:  'pending',
              new_status:  'pending',
              meta:        { tier, rc_event: eventType },
            });
          }
        }
      }
    } else if (LAPSED_EVENTS.has(eventType)) {
      await supabase.from('profiles').update({
        subscription_tier:   'preview',
        subscription_status: 'cancelled',
      }).eq('id', userId);

      // Void any pending referral if the subscription lapses before 90 days
      const { data: referral } = await supabase
        .from('referrals')
        .select('id, status')
        .eq('user_id', userId)
        .maybeSingle();

      if (referral && referral.status === 'pending') {
        await supabase.from('referrals').update({
          status:      'void',
          void_reason: `subscription_lapsed:${eventType}`,
        }).eq('id', referral.id);

        await supabase.from('referral_events').insert({
          referral_id: referral.id,
          event_type:  'voided',
          old_status:  'pending',
          new_status:  'void',
          meta:        { reason: eventType },
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('revenuecat-webhook error:', err?.message);
    res.status(500).json({ error: 'Internal error' });
  }
}
