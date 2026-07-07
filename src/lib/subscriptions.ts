import { formatCurrencyFromUsd } from '@/lib/currency';

export type SubscriptionTierId = 'preview' | 'essential' | 'plus' | 'premium';

export const TIER_RANK: Record<SubscriptionTierId, number> = {
  preview:   0,
  essential: 1,
  plus:      2,
  premium:   3,
};

export interface TierLimits {
  childProfiles: number | 'unlimited';
  calendarEvents: number | 'unlimited'; // total for preview, per-month for paid tiers
  expenseRequestsPerMonth: number | 'unlimited';
  parentMessagesPerMonth: number | 'unlimited';
  storedDocuments: number | 'unlimited';
  documentStorageGB?: number;
  pdfExportsPerMonth: number;
  coParentingCircles?: number;
  /** Can this tier's holder invite a Professional (lawyer/mediator) into their family? */
  professionalAccess: boolean;
}

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  description: string;
  priceUsd: number; // canonical price — ZAR (or any other currency) is derived via formatCurrencyFromUsd
  billingCycle: 'month' | 'year';
  limits: TierLimits;
  myScai: boolean;
  advancedMyScai?: boolean;
  aiToneCheck: boolean;
  features: string[];
}

export const subscriptionTiers: SubscriptionTier[] = [
  {
    id: 'preview',
    name: 'Preview',
    tagline: 'Tiny trial access',
    description: 'For testing the basics.',
    priceUsd: 0,
    billingCycle: 'month',
    limits: {
      childProfiles: 1,
      calendarEvents: 5,
      expenseRequestsPerMonth: 3,
      parentMessagesPerMonth: 30,
      storedDocuments: 3,
      pdfExportsPerMonth: 0,
      professionalAccess: false,
    },
    myScai: false,
    aiToneCheck: false,
    features: [
      '1 child profile',
      '5 calendar events to try',
      'Basic expense log (3 requests)',
      'Drop-off & pickup logs',
    ],
  },
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'Basic capped use',
    description: 'For simple structure without AI.',
    priceUsd: 4.99,
    billingCycle: 'month',
    limits: {
      childProfiles: 1,
      calendarEvents: 40,
      expenseRequestsPerMonth: 20,
      parentMessagesPerMonth: 500,
      storedDocuments: 25,
      pdfExportsPerMonth: 0,
      professionalAccess: false,
    },
    myScai: false,
    aiToneCheck: false,
    features: [
      'All Preview features',
      '40 calendar events / month',
      '20 expense requests / month',
      '25 stored documents',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Advanced features',
    description: 'The smart co-parenting system.',
    priceUsd: 9.99,
    billingCycle: 'month',
    limits: {
      childProfiles: 3,
      calendarEvents: 150,
      expenseRequestsPerMonth: 100,
      parentMessagesPerMonth: 2500,
      storedDocuments: 'unlimited',
      pdfExportsPerMonth: 5,
      professionalAccess: false,
    },
    myScai: true,
    aiToneCheck: true,
    features: [
      'All Essential features',
      'Up to 3 children',
      'My SCAI assistant',
      'AI Tone-Check on messages',
      '5 PDF exports / month',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Advanced records',
    description: 'For stronger proof and reports.',
    priceUsd: 14.99,
    billingCycle: 'month',
    limits: {
      childProfiles: 'unlimited',
      calendarEvents: 'unlimited',
      expenseRequestsPerMonth: 'unlimited',
      parentMessagesPerMonth: 'unlimited',
      storedDocuments: 'unlimited',
      documentStorageGB: 25,
      pdfExportsPerMonth: 25,
      coParentingCircles: 2,
      professionalAccess: true,
    },
    myScai: true,
    advancedMyScai: true,
    aiToneCheck: true,
    features: [
      'All Plus features',
      'Unlimited children, events & expenses',
      'Court-admissible record exports (25/month)',
      'Verified Handoffs (GPS required)',
      'Invite a Professional (lawyer/mediator) — read-only access',
      'Priority support',
    ],
  },
];

export const FOUNDER_OFFER = {
  applicableTier: 'plus' as SubscriptionTierId,
  priceUsd: 6.99,
  slotLimit: 5000,
  lockMonths: 12,
  label: 'Founder Offer',
  description: 'SupportCard Plus for $6.99/month for the first 5,000 families — locked for 12 months.',
};

export const getTierPriceDisplay = (tier: SubscriptionTier, currency: string, useFounderPrice = false) => {
  if (tier.priceUsd === 0) return 'Free';
  const price = useFounderPrice && tier.id === FOUNDER_OFFER.applicableTier ? FOUNDER_OFFER.priceUsd : tier.priceUsd;
  return formatCurrencyFromUsd(price, currency);
};

export const isTierAtLeast = (current: SubscriptionTierId, required: SubscriptionTierId) =>
  TIER_RANK[current] >= TIER_RANK[required];

export const canUseMyScai = (tier: SubscriptionTierId): boolean =>
  subscriptionTiers.find(t => t.id === tier)?.myScai ?? false;

export const canUseToneCheck = (tier: SubscriptionTierId): boolean =>
  subscriptionTiers.find(t => t.id === tier)?.aiToneCheck ?? false;

// Normalise a raw DB value to a valid tier ID, mapping any legacy/retired tier to its successor.
export const normaliseTierId = (raw: string | null | undefined): SubscriptionTierId => {
  if (raw === 'executive' || raw === 'legal') return 'premium';
  if (raw === 'family_plus') return 'plus';
  if (raw === 'free') return 'preview';
  if (raw === 'basic') return 'essential';
  if (raw === 'professional') return 'premium'; // retired standalone tier — folded into Premium
  if (raw && raw in TIER_RANK) return raw as SubscriptionTierId;
  return 'preview';
};
