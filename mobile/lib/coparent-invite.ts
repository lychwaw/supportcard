/**
 * The co-parent a user said they'd invite during onboarding.
 *
 * SupportCard is worth very little to one parent on their own: the calendar,
 * the expense approvals and the message record all assume two people. So the
 * step right after the tour asks who the other parent is and hands off to the
 * share sheet.
 *
 * They can't be linked yet. Linking requires a child to exist and requires the
 * co-parent to already have an account, neither of which is true 30 seconds
 * into a first session. So we keep the name and email here and let the Family
 * screen pick them up, which turns "link your co-parent" from a blank form
 * into a one-tap confirmation once the invite is accepted.
 *
 * Stored on-device only. Nothing here is sent anywhere.
 */

const KEY_NAME = 'coparent.invitedName';
const KEY_EMAIL = 'coparent.invitedEmail';

// SecureStore is native-only. Mirrors the guard in lib/review.ts so the web
// bundle never touches the native module.
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
    // non-fatal. A failed write just means Family shows an empty form.
  }
}

export interface InvitedCoParent {
  name: string;
  email: string;
}

export async function rememberInvitedCoParent(name: string, email: string): Promise<void> {
  await set(KEY_NAME, name.trim());
  await set(KEY_EMAIL, email.trim().toLowerCase());
}

export async function getInvitedCoParent(): Promise<InvitedCoParent | null> {
  const [name, email] = await Promise.all([get(KEY_NAME), get(KEY_EMAIL)]);
  if (!name && !email) return null;
  return { name: name ?? '', email: email ?? '' };
}

/** Called once the co-parent is actually linked, so Family stops prompting. */
export async function clearInvitedCoParent(): Promise<void> {
  await set(KEY_NAME, '');
  await set(KEY_EMAIL, '');
}

// The App Store listing, not the marketing site. An invite has one job, which
// is getting the other parent installed, and every extra hop loses people.
// No country code, so Apple sends each person to their own storefront.
//
// This becomes wrong the day Android ships, because it is a dead end on a
// Pixel. Add the Play link here as a second line when that happens.
const SIGNUP_URL = 'https://apps.apple.com/app/id6801612058';

/** The message that goes into the share sheet. Functional, not salesy. */
export function inviteMessage(coParentName: string): string {
  const who = coParentName.trim();
  const greeting = who ? `Hi ${who}. ` : '';
  return (
    `${greeting}I've set us up on SupportCard for our co-parenting. ` +
    `Once you join, our calendar, expenses and messages stay in sync, ` +
    `and there's a clear record of everything.\n\n` +
    `Get it here: ${SIGNUP_URL}`
  );
}
