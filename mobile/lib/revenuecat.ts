import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

/**
 * Subscriptions on the two app stores.
 *
 * Android was previously excluded here, and pricing.tsx treated anything that
 * was not iOS as "web", which sent an Android user to a Dodo Payments page.
 * Google requires Play Billing for digital subscriptions and refuses an app
 * that links out to another processor, so that path was a rejection waiting to
 * happen. Android now goes through RevenueCat exactly as iOS does, and
 * RevenueCat talks to Play Billing underneath.
 *
 * storeAvailable() is the guard for the gap in between. Until the Android key
 * and the Play products exist, it answers false, and the pricing screen hides
 * the paid plans rather than offering a button that cannot work. Preview stays
 * available, so the app is complete without them.
 */

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

const apiKey = () => (Platform.OS === 'ios' ? IOS_KEY : Platform.OS === 'android' ? ANDROID_KEY : '');

// Must match the package identifiers created in the RevenueCat dashboard.
// RevenueCat maps one package to the App Store and Play products behind it,
// so these identifiers stay the same on both platforms.
const TIER_TO_PACKAGE: Record<string, string> = {
  essential: 'supportcard_essential_monthly',
  plus:      'supportcard_plus_monthly',
  premium:   'supportcard_premium_monthly',
};

let configured = false;

/** Whether this build can actually sell a subscription. */
export function storeAvailable(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !!apiKey();
}

export function initRevenueCat(userId: string) {
  if (!storeAvailable()) return;
  try {
    if (!configured) {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: apiKey(), appUserID: userId });
      configured = true;
    } else {
      Purchases.logIn(userId).catch(() => {});
    }
  } catch (e) {
    console.warn('RevenueCat init failed:', e);
  }
}

export async function purchaseWithRevenueCat(tier: string): Promise<void> {
  if (!configured) throw new Error('Subscription service not ready. Please restart the app and try again.');

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) throw new Error('No subscription plans are available right now.');

  const pkg: PurchasesPackage | undefined = current.availablePackages.find(
    p => p.identifier === TIER_TO_PACKAGE[tier],
  );
  if (!pkg) throw new Error(`Product not found for "${tier}". Check RevenueCat offerings.`);

  await Purchases.purchasePackage(pkg);
}

export async function restoreRevenueCatPurchases(): Promise<void> {
  await Purchases.restorePurchases();
}

export async function getRevenueCatPrices(): Promise<Record<string, string>> {
  if (!storeAvailable() || !configured) return {};
  try {
    const offerings = await Purchases.getOfferings();
    const prices: Record<string, string> = {};
    for (const pkg of offerings.current?.availablePackages ?? []) {
      prices[pkg.identifier] = pkg.product.priceString;
    }
    return prices;
  } catch {
    return {};
  }
}
