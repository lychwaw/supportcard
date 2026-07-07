// Mirrors src/lib/currency.ts in the web app — same exchange rate.
// USD is the canonical price for all subscription tiers; ZAR is derived.

export type Currency = 'ZAR' | 'USD';

export const USD_TO_ZAR = 16.16; // update periodically — matches web app rate

export function formatPrice(usdAmount: number, currency: Currency): string {
  if (usdAmount === 0) return 'Free';
  if (currency === 'USD') {
    return `$${usdAmount.toFixed(2)}`;
  }
  const zarAmount = usdAmount * USD_TO_ZAR;
  // Round to nearest 5 for cleaner ZAR pricing (R161.50 → R160)
  const rounded = Math.round(zarAmount / 5) * 5;
  return `R${rounded}`;
}

export function formatPricePerMonth(usdAmount: number, currency: Currency): {
  amount: string;
  suffix: string;
} {
  if (usdAmount === 0) return { amount: 'Free', suffix: '' };
  return { amount: formatPrice(usdAmount, currency), suffix: '/mo' };
}

export const CURRENCY_OPTIONS: { value: Currency; flag: string; label: string; sublabel: string }[] = [
  { value: 'ZAR', flag: '🇿🇦', label: 'South African Rand', sublabel: 'ZAR (R)' },
  { value: 'USD', flag: '🇺🇸', label: 'US Dollar',          sublabel: 'USD ($)' },
];
