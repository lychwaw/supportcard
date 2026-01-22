import { formatCurrency } from '@/lib/currency';

export type SubscriptionTierId = 'free' | 'premium' | 'family_plus' | 'legal' | 'executive';

export const TIER_RANK: Record<SubscriptionTierId, number> = {
  free: 0,
  premium: 1,
  family_plus: 2,
  legal: 3,
  executive: 4,
};

export const ZAR_PER_USD = 16.16;

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  description: string;
  priceZar: number;
  priceUsd: number;
  features: string[];
}

export const subscriptionTiers: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Basic access for essential tracking.',
    priceZar: 0,
    priceUsd: 0,
    features: ['Basic wallet', 'Transactions', 'Shared expenses', 'Basic notifications'],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Advanced insights and smart support tools.',
    priceZar: 100,
    priceUsd: 0,
    features: [
      'Advanced expense analytics & AI insights',
      'Court-ready exportable reports',
      'Smart notifications & category tracking',
      'Goal-based saving pockets',
      'Priority support & calendar sync',
      'Custom virtual card designs',
    ],
  },
  {
    id: 'family_plus',
    name: 'Family+',
    description: 'Multi-child wallets and guardian visibility.',
    priceZar: 150,
    priceUsd: 0,
    features: [
      'Multiple child wallets',
      'Guardian viewing access',
      'International transfer discounts',
      'Individual child insights',
      'Advanced spending analytics',
      'All Premium features',
    ],
  },
  {
    id: 'legal',
    name: 'SupportCard Legal',
    description: 'Built for legal workflows and documentation.',
    priceZar: 500,
    priceUsd: 0,
    features: [
      'Multi-client dashboard',
      'Exportable client reports',
      'Secure document storage',
      'Legal portal integration',
      'Digital signing of agreements',
      'All Premium features',
    ],
  },
  {
    id: 'executive',
    name: 'SupportCard Executive',
    description: 'Global-grade compliance and dispute handling.',
    priceZar: 1616,
    priceUsd: 100,
    features: [
      'All Premium/Family+/Legal features',
      'Court-ready audit trails',
      'Monthly legal reports',
      'Priority dispute flagging',
      'Secure lawyer access',
      'Cross-border payments',
      'Emergency freeze',
      'Advanced spend controls',
      'Dedicated priority support',
    ],
  },
];

export const getTierPriceDisplay = (tier: SubscriptionTier, currency: string) => {
  if (tier.id === 'free') {
    return 'Free';
  }

  if (currency === 'USD') {
    if (tier.id === 'executive') {
      return formatCurrency(tier.priceUsd, 'USD');
    }
    const usdAmount = tier.priceZar / ZAR_PER_USD;
    return `${formatCurrency(usdAmount, 'USD')} (est.)`;
  }

  if (tier.id === 'executive') {
    const zarAmount = tier.priceUsd * ZAR_PER_USD;
    return `${formatCurrency(zarAmount, 'ZAR')} (est.)`;
  }

  return formatCurrency(tier.priceZar, 'ZAR');
};

export const isTierAtLeast = (current: SubscriptionTierId, required: SubscriptionTierId) =>
  TIER_RANK[current] >= TIER_RANK[required];

