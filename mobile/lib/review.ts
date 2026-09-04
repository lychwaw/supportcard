import { Linking } from 'react-native';

/**
 * In-app rating prompts.
 *
 * Apple throttles the native prompt to ~3 displays per user per year and
 * decides on its own whether to actually show it — requestReview() is a
 * *request*, not a guarantee, and it silently no-ops the rest of the time.
 * So we never assume it appeared, and we never block anything on it.
 *
 * We add our own gating on top so we only spend those few chances on users
 * who have actually got value out of the app:
 *   - at least MIN_ACTIONS positive moments logged
 *   - at least COOLDOWN_DAYS since we last asked
 *   - at most MAX_ASKS times ever
 *
 * Per Apple's HIG the native prompt must not be wired to a "Rate us" button.
 * For an explicit user-initiated rating use openStoreListing() instead, which
 * deep links to the App Store review composer.
 */

const APP_STORE_ID = '6801612058';

const KEY_ACTIONS   = 'review.actionCount';
const KEY_LAST_ASK  = 'review.lastAskedAt';
const KEY_ASK_COUNT = 'review.askCount';

const MIN_ACTIONS   = 3;
const COOLDOWN_DAYS = 90;
const MAX_ASKS      = 3;

// SecureStore is native-only. Mirrors the guard used in lib/supabase.ts so the
// web bundle never touches the native module.
const isNative = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

async function get(key: string): Promise<string | null> {
  if (!isNative) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function set(key: string, value: string): Promise<void> {
  if (!isNative) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  } catch {
    // non-fatal — a failed write just means we may ask again later
  }
}

const num = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Record that something good happened (expense approved, report generated).
 * Cheap and fire-and-forget — call it freely, it does not prompt on its own.
 */
export async function logPositiveAction(): Promise<void> {
  const count = num(await get(KEY_ACTIONS));
  await set(KEY_ACTIONS, String(count + 1));
}

/**
 * Ask for a rating if the user has earned it and we are inside our own limits.
 * Safe to call from anywhere; resolves quietly when it decides not to ask.
 */
export async function maybeAskForReview(): Promise<void> {
  if (!isNative) return;

  try {
    const [actions, askCount, lastAsk] = await Promise.all([
      get(KEY_ACTIONS),
      get(KEY_ASK_COUNT),
      get(KEY_LAST_ASK),
    ]);

    if (num(actions) < MIN_ACTIONS) return;
    if (num(askCount) >= MAX_ASKS) return;

    if (lastAsk) {
      const days = (Date.now() - num(lastAsk)) / 86_400_000;
      if (days < COOLDOWN_DAYS) return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StoreReview = require('expo-store-review');
    if (!(await StoreReview.hasAction())) return;

    await StoreReview.requestReview();

    // Count the attempt regardless of whether iOS actually rendered it —
    // there is no API to find out, and re-asking is worse than under-asking.
    await set(KEY_ASK_COUNT, String(num(askCount) + 1));
    await set(KEY_LAST_ASK, String(Date.now()));
  } catch {
    // never let a rating prompt break a user flow
  }
}

/**
 * Explicit, user-initiated rating — opens the App Store review composer.
 * Use this for a "Rate SupportCard" row, never the native prompt.
 */
export async function openStoreListing(): Promise<void> {
  const url = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  try {
    await Linking.openURL(url);
  } catch {
    // ignore — nothing useful to show the user if the App Store won't open
  }
}
