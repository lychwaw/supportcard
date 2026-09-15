/**
 * Applies a referral code held from sign-up, once there is a session.
 *
 * Called by the root layout whenever a session appears. Tells the person what
 * happened either way: a code that silently fails is how a partner ends up
 * never being paid for a client who did everything right.
 */

import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { readPendingReferral, clearPendingReferral } from '@/lib/pending-referral';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';

/** Outcomes that will never change on a retry, so the stored code is dropped. */
const FINAL = new Set([200, 400, 404, 409, 410]);

export async function applyPendingReferral(accessToken: string): Promise<void> {
  const code = await readPendingReferral();
  if (!code) return;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/referral-capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ code }),
    });
  } catch {
    // Offline or the API is down. Keep the code and try again next launch,
    // inside the seven day window.
    return;
  }

  if (res.ok) {
    await clearPendingReferral();
    Alert.alert(
      'Referral code applied',
      `${code} is on your account. Your first month of Premium is active.`,
    );
    return;
  }

  if (FINAL.has(res.status)) {
    await clearPendingReferral();
    // 409 means a referral is already attached, including by a co-parent in the
    // same family. Nothing is wrong and there is nothing to act on, so say
    // nothing rather than alarm someone whose account is correct.
    if (res.status === 409) return;
    let reason = 'That code could not be applied.';
    try {
      const body = await res.json();
      if (body?.error) reason = body.error;
    } catch {
      // Keep the default.
    }
    Alert.alert('Referral code not applied', `${reason}\n\nYou can try again under Settings, Enter Referral Code.`);
  }
  // Anything else (500, 502) is probably temporary. Keep it and retry next launch.
}
