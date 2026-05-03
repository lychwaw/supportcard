import { formatCurrency } from '@/lib/currency';

export type SubscriptionTierId = 'free' | 'premium' | 'family_plus' | 'legal';

export const TIER_RANK: Record<SubscriptionTierId, number> = {
  free:        0,
  premium:     1,
  family_plus: 2,
  legal:       3,
};

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  description: string;
  priceZar: number;
  priceUsd: number;
  billingCycle: 'month' | 'year';
  transferCapZar: number | null; // null = unlimited
  features: string[];
}

export const subscriptionTiers: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Basic',
    description: 'Essential tracking for a single child wallet.',
    priceZar: 0,
    priceUsd: 0,
    billingCycle: 'month',
    transferCapZar: 5000,
    features: [
      '1 child wallet',
      'Virtual card',
      'Expense logging & basic category tracking',
      'In-app co-parent messaging',
      'R5,000 / month transfer cap',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Everyday co-parents — analytics, AI insights, and custom cards.',
    priceZar: 99,
    priceUsd: 5.49,
    billingCycle: 'month',
    transferCapZar: 25000,
    features: [
      'All Basic features',
      'Custom virtual card designs',
      'Advanced analytics & AI spending insights',
      'Goal-based saving pockets',
      'Shared co-parent calendar',
      'Smart notifications',
      'International transfers (standard rate)',
      'Physical card (add-on)',
      'R25,000 / month transfer cap',
    ],
  },
  {
    id: 'family_plus',
    name: 'Family+',
    description: 'Multi-child households — guardian access and higher limits.',
    priceZar: 179,
    priceUsd: 9.99,
    billingCycle: 'month',
    transferCapZar: 75000,
    features: [
      'All Premium features',
      'Up to 5 child wallets',
      'Guardian viewing access',
      'Per-child spending insights',
      'Emergency wallet freeze',
      '1 physical card included',
      'International transfers (discounted rate)',
      'R75,000 / month transfer cap',
    ],
  },
  {
    id: 'legal',
    name: 'SupportCard Legal',
    description: 'Court-grade documentation, audit trails, and legal workflows.',
    priceZar: 549,
    priceUsd: 30.00,
    billingCycle: 'month',
    transferCapZar: null,
    features: [
      'All Family+ features',
      'Unlimited child wallets',
      'Court-ready exportable reports',
      'Full audit trails',
      'Secure document storage',
      'Digital agreement signing',
      'Monthly legal reports',
      'Priority dispute flagging',
      'Cross-border payment routing',
      'Physical cards (unlimited)',
      'International transfers (priority rate)',
      'Dedicated account manager',
      'Unlimited transfers',
    ],
  },
];

export const getTierPriceDisplay = (tier: SubscriptionTier, currency: string) => {
  if (tier.id === 'free') return 'Free';
  return formatCurrency(tier.priceZar, currency);
};

export const isTierAtLeast = (current: SubscriptionTierId, required: SubscriptionTierId) =>
  TIER_RANK[current] >= TIER_RANK[required];

// Normalise a raw DB value to a valid tier ID, mapping any legacy tier to its successor.
export const normaliseTierId = (raw: string | null | undefined): SubscriptionTierId => {
  if (raw === 'executive') return 'legal';
  if (raw && raw in TIER_RANK) return raw as SubscriptionTierId;
  return 'free';
};
