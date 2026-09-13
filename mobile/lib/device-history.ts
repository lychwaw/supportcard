/**
 * Has anyone ever signed in on this device?
 *
 * Decides where a signed-out app opens. A brand new install belongs to someone
 * who, in all likelihood, has no account yet, so "Welcome back, sign in" is the
 * wrong first screen for them. A device that has had a session before belongs to
 * someone who does.
 *
 * Stored in the keychain, which on iOS survives the app being deleted. So a
 * reinstall opens on sign-in rather than sign-up, which is correct: that person
 * almost certainly has an account.
 *
 * Note this only affects the very first launch on a fresh install, and that launch
 * always runs the JavaScript embedded in the build. A change here reaches new
 * users from the next build, not from an over-the-air update.
 */

const KEY = 'auth.signedInOnThisDevice';

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

/** True when a session has existed here before. Unknown or unreadable counts as true, so nobody is wrongly sent to sign-up. */
export async function hasSignedInOnThisDevice(): Promise<boolean> {
  const s = store();
  if (!s) return true;
  try {
    return (await s.getItemAsync(KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markSignedInOnThisDevice(): Promise<void> {
  const s = store();
  if (!s) return;
  try {
    await s.setItemAsync(KEY, '1');
  } catch {
    // Non-fatal. Worst case a later signed-out launch opens on sign-up, which
    // links straight to sign-in.
  }
}
