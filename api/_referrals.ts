/**
 * How a referral follows its customer's subscription.
 *
 * A referral pays a partner once the customer has been subscribed for 90 days.
 * qualify_referrals() only looks at the referral row: status 'pending' and a
 * subscription_started_at at least 90 days old. So these two transitions are the
 * whole of the logic that decides whether a partner is paid, and they must be
 * identical wherever a subscription can change: the App Store webhook, the website
 * webhook, and the moment a code is entered.
 *
 *   started  The 90-day clock starts the first time the customer is seen on a paid
 *            plan with this referral attached. Previously only an App Store
 *            INITIAL_PURCHASE started it, so a website purchase, or a code entered
 *            after buying, left the clock unset and the referral could never qualify.
 *   ended    Access has actually ended. The referral is voided, because a voided
 *            referral is the only thing that stops a partner being paid for a
 *            customer who stopped paying.
 *
 * Files prefixed with _ are shared modules, not deployed as endpoints.
 */

const PAID_TIERS = new Set(['essential', 'plus', 'premium']);

/** The paid plan a raw tier value means, or null for free and unrecognised tiers. */
export function paidTier(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toLowerCase();
  const tier = raw === 'family_plus' ? 'plus' : raw === 'legal' ? 'premium' : raw;
  return PAID_TIERS.has(tier) ? tier : null;
}

// The old App Store handling voided a referral when auto-renew was switched off
// or a payment briefly failed. Neither ends access, so those customers never
// actually stopped paying and their referral deserves its original clock back.
const WRONGLY_VOIDED = /^subscription_lapsed:(CANCELLATION|BILLING_ISSUE)$/;

interface ReferralRow {
  id: string;
  status: 'pending' | 'qualified' | 'paid' | 'void';
  tier: string | null;
  subscription_started_at: string | null;
  void_reason: string | null;
}

async function findReferral(supabase: any, userId: string): Promise<ReferralRow | null> {
  const { data } = await supabase
    .from('referrals')
    .select('id, status, tier, subscription_started_at, void_reason')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as ReferralRow) ?? null;
}

async function logEvent(
  supabase: any, referralId: string, eventType: string,
  oldStatus: string, newStatus: string, meta: Record<string, unknown>,
) {
  await supabase.from('referral_events').insert({
    referral_id: referralId, event_type: eventType,
    old_status: oldStatus, new_status: newStatus, meta,
  });
}

/**
 * The customer is on a paid plan right now. Starts the clock if it has not
 * started, keeps the referral's plan in step with upgrades and downgrades while
 * it is pending, and restores a referral voided by a lapse.
 */
export async function referralSubscriptionActive(
  supabase: any, userId: string, rawTier: string | null | undefined, source: string,
): Promise<void> {
  const tier = paidTier(rawTier);
  if (!tier) return;
  const referral = await findReferral(supabase, userId);
  if (!referral) return;
  const now = new Date().toISOString();

  if (referral.status === 'pending') {
    if (!referral.subscription_started_at) {
      await supabase.from('referrals')
        .update({ tier, subscription_started_at: now })
        .eq('id', referral.id);
      await logEvent(supabase, referral.id, 'subscription_started', 'pending', 'pending', { tier, source });
    } else if (referral.tier !== tier) {
      // Commission is calculated from this at qualification, so it should
      // reflect the plan the customer is actually paying for.
      await supabase.from('referrals').update({ tier }).eq('id', referral.id);
      await logEvent(supabase, referral.id, 'tier_changed', 'pending', 'pending',
        { from: referral.tier, to: tier, source });
    }
    return;
  }

  if (referral.status === 'void' && referral.void_reason?.startsWith('subscription_lapsed:')) {
    const neverLapsed = WRONGLY_VOIDED.test(referral.void_reason);
    // A customer who genuinely left and came back starts a fresh 90 days, so a
    // month of paying, a gap, and a return does not qualify straight away.
    const startedAt = neverLapsed && referral.subscription_started_at
      ? referral.subscription_started_at
      : now;
    await supabase.from('referrals')
      .update({ status: 'pending', void_reason: null, tier, subscription_started_at: startedAt })
      .eq('id', referral.id);
    await logEvent(supabase, referral.id, 'restored', 'void', 'pending', {
      tier, source, previous_void_reason: referral.void_reason,
      clock: neverLapsed ? 'kept' : 'restarted',
    });
  }
}

/** The customer's paid access has ended. Voids a pending referral. */
export async function referralSubscriptionEnded(
  supabase: any, userId: string, reason: string, source: string,
): Promise<void> {
  const referral = await findReferral(supabase, userId);
  if (!referral) return;
  const voidReason = `subscription_lapsed:${reason}`;

  if (referral.status === 'pending') {
    await supabase.from('referrals')
      .update({ status: 'void', void_reason: voidReason })
      .eq('id', referral.id);
    await logEvent(supabase, referral.id, 'voided', 'pending', 'void', { reason, source });
    return;
  }

  // Already voided by the old cancellation handling, and now it really has
  // ended. Record the real reason, so a later return restarts the clock
  // instead of being treated as never having lapsed.
  if (referral.status === 'void' && referral.void_reason && WRONGLY_VOIDED.test(referral.void_reason)) {
    await supabase.from('referrals').update({ void_reason: voidReason }).eq('id', referral.id);
    await logEvent(supabase, referral.id, 'void_reason_corrected', 'void', 'void',
      { from: referral.void_reason, to: voidReason, source });
  }
}
