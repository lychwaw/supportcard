/**
 * A referral code typed at sign-up, held until there is a session to apply it with.
 *
 * The sign-up screen used to POST the code straight to /api/referral-capture.
 * That endpoint needs a bearer token, and this project requires email
 * confirmation, so supabase.auth.signUp() returns session: null and the call
 * was skipped every single time. The code was typed, accepted by the form, and
 * silently discarded. Nobody saw an error, so a partner's referral simply never
 * existed.
 *
 * So the code is kept here instead, and applied by the root layout the moment a
 * session first appears, which is when the person confirms their email and
 * signs in. capture_referral() still enforces the seven day window from signup,
 * which is ample for confirming an email.
 *
 * Stored in the keychain rather than memory because confirmation happens in a
 * mail app, and the person may well not come back to a running process.
 */

const KEY = 'referral.pendingCode';

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

export async function savePendingReferral(code: string): Promise<void> {
  const value = code.trim().toUpperCase();
  if (!value) return;
  const s = store();
  if (!s) return;
  try {
    await s.setItemAsync(KEY, value);
  } catch {
    // Non-fatal. The code can still be entered under Settings.
  }
}

export async function readPendingReferral(): Promise<string | null> {
  const s = store();
  if (!s) return null;
  try {
    const value = await s.getItemAsync(KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export async function clearPendingReferral(): Promise<void> {
  const s = store();
  if (!s) return;
  try {
    await s.deleteItemAsync(KEY);
  } catch {
    // Non-fatal. A retry is harmless: capture_referral is idempotent per user
    // and answers 'already_referred', which is also treated as final.
  }
}
