import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

// Must match the package identifiers you create in the RevenueCat dashboard
const TIER_TO_PACKAGE: Record<string, string> = {
  essential: 'supportcard_essential_monthly',
  plus:      'supportcard_plus_monthly',
  premium:   'supportcard_premium_monthly',
};

let configured = false;

export function initRevenueCat(userId: string) {
  if (Platform.OS !== 'ios') return;
  if (!IOS_KEY) return;
  if (configured) return;
  try {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey: IOS_KEY, appUserID: userId });
    configured = true;
  } catch (e) {
    console.warn('RevenueCat init failed:', e);
  }
}

export async function purchaseWithRevenueCat(tier: string): Promise<void> {
  if (!configured) throw new Error('Subscription service not ready. Please restart the app and try again.');

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) throw new Error('No offerings available from App Store.');

  const pkg: PurchasesPackage | undefined = current.availablePackages.find(
    p => p.identifier === TIER_TO_PACKAGE[tier],
  );
  if (!pkg) throw new Error(`Product not found for "${tier}". Check RevenueCat offerings.`);

  await Purchases.purchasePackage(pkg);
}

export async function restoreRevenueCatPurchases(): Promise<void> {
  await Purchases.restorePurchases();
}
