/**
 * Has this account already finished the tour, as far as this device knows?
 *
 * The router cannot leave the sign-in screen until it knows whether the signed
 * in account still needs onboarding, because a new account must see its tour
 * before the app. That answer lived only on the server, behind a query to
 * profiles.onboarded_at.
 *
 * The splash hides on a fixed floor, so whenever that query took longer than
 * the floor, the sign-in screen was visible to somebody who was already signed
 * in. It looked like being logged out and logged straight back in.
 *
 * So the answer is remembered here once the server has given it. On the next
 * launch it is available in a few milliseconds off local storage, with no
 * network involved, and routing happens while the splash is still up. The
 * server query still runs and still wins; this only removes it from the path
 * the user can see.
 *
 * Keyed per user, because two accounts on one device have different answers.
 * Only ever caches "finished". Needing onboarding is the transient state and is
 * never worth remembering.
 */

const KEY = (userId: string) => `onboarding.completed.${userId}`;

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

/**
 * True when this device has seen this account complete onboarding.
 * False means "not known here", never "definitely needs onboarding", so a
 * false answer only ever costs the old behaviour of waiting for the server.
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const s = store();
  if (!s) return false;
  try {
    return (await s.getItemAsync(KEY(userId))) === '1';
  } catch {
    return false;
  }
}

export async function rememberOnboardingCompleted(userId: string): Promise<void> {
  const s = store();
  if (!s) return;
  try {
    await s.setItemAsync(KEY(userId), '1');
  } catch {
    // Non-fatal. The next launch simply waits for the server as it used to.
  }
}

/** Cleared when the server says this account needs onboarding after all. */
export async function forgetOnboardingCompleted(userId: string): Promise<void> {
  const s = store();
  if (!s) return;
  try {
    await s.deleteItemAsync(KEY(userId));
  } catch {
    // Non-fatal.
  }
}
