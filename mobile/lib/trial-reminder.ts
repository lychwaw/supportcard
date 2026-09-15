/**
 * Telling someone their free month is about to end.
 *
 * A referred client is granted Premium for a month. expire_referral_trials()
 * takes it away again on the day, silently: no warning before, no message
 * after. So the client opens the app on day 31, finds child profiles over the
 * limit and features missing, and is given no reason and no way to keep them.
 *
 * That is both the worst moment of the experience and the best moment to ask
 * for the sale, since it is the one point where the value has been felt. This
 * warns at a week, three days, the day before, and on the last day.
 *
 * Each milestone is shown once, keyed by the trial's end date so a different
 * trial later starts fresh. Nothing is shown to anyone who is not on a
 * referral trial, which is almost everybody.
 */

import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

const KEY = (endsAt: string, milestone: number) => `trial.warned.${endsAt}.${milestone}`;

// Days remaining at which to speak up. Descending, so the nearest deadline wins
// when more than one is newly due (a client who did not open the app for a week).
const MILESTONES = [7, 3, 1, 0];

const isNative = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

function store(): any | null {
  if (!isNative) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store');
  } catch {
    return null;
  }
}

async function alreadyWarned(endsAt: string, milestone: number): Promise<boolean> {
  const s = store();
  if (!s) return true;   // Cannot remember, so do not risk nagging on every launch.
  try {
    return (await s.getItemAsync(KEY(endsAt, milestone))) === '1';
  } catch {
    return true;
  }
}

async function markWarned(endsAt: string, milestone: number): Promise<void> {
  const s = store();
  if (!s) return;
  try {
    await s.setItemAsync(KEY(endsAt, milestone), '1');
  } catch {
    // Non-fatal. Worst case the same milestone is mentioned twice.
  }
}

function daysLeft(endsAt: string): number {
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function wording(days: number): { title: string; body: string } {
  if (days <= 0) {
    return {
      title: 'Your free month ends today',
      body: 'After today your account moves to the free Preview version. Choosing a plan keeps your calendar, expenses and records exactly as they are.',
    };
  }
  if (days === 1) {
    return {
      title: 'Your free month ends tomorrow',
      body: 'After tomorrow your account moves to the free Preview version. Choosing a plan keeps everything as it is.',
    };
  }
  return {
    title: `Your free month ends in ${days} days`,
    body: 'After that your account moves to the free Preview version, which has lower limits. Choosing a plan keeps your calendar, expenses and records exactly as they are.',
  };
}

/**
 * Checks whether the signed-in account is on a referral trial that is ending,
 * and if so says so once per milestone. Silent for everyone else.
 *
 * @param onSeePlans Opens the pricing screen. Kept as a callback so this file
 *                   does not depend on the router.
 */
export async function maybeWarnTrialEnding(userId: string, onSeePlans: () => void): Promise<void> {
  let endsAt: string | null = null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_status, referral_trial_ends_at')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return;
    const row = data as { subscription_status?: string | null; referral_trial_ends_at?: string | null };
    if ((row.subscription_status ?? '').toLowerCase() !== 'trialing') return;
    endsAt = row.referral_trial_ends_at ?? null;
  } catch {
    return;
  }
  if (!endsAt) return;

  const left = daysLeft(endsAt);
  const due = MILESTONES.find(m => left <= m);
  if (due === undefined) return;               // More than a week out. Nothing to say.
  if (await alreadyWarned(endsAt, due)) return;
  await markWarned(endsAt, due);

  const { title, body } = wording(left);
  Alert.alert(title, body, [
    { text: 'Not now', style: 'cancel' },
    { text: 'See plans', onPress: onSeePlans },
  ]);
}
