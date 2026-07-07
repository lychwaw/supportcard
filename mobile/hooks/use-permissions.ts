import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AppRole = 'parent' | 'co_parent' | 'child' | 'professional';
export type SubscriptionTier = 'preview' | 'essential' | 'plus' | 'premium';

const TIER_RANK: Record<SubscriptionTier, number> = {
  preview: 0, essential: 1, plus: 2, premium: 3,
};

function normaliseTier(raw: string | null | undefined): SubscriptionTier {
  if (raw === 'family_plus') return 'plus';
  if (raw === 'legal' || raw === 'executive') return 'premium';
  if (raw === 'free') return 'preview';
  if (raw === 'basic') return 'essential';
  if (raw && raw in TIER_RANK) return raw as SubscriptionTier;
  return 'preview';
}

export interface Permissions {
  role: AppRole;
  tier: SubscriptionTier;
  isParent: boolean;
  isChild: boolean;
  isProfessional: boolean;
  // Feature gates
  canSendMessages: boolean;
  canViewExpenses: boolean;
  canManageCalendar: boolean;
  canUseMyScai: boolean;
  canUseAIToneCheck: boolean;
  canExportCourtRecord: boolean;
  canUseVerifiedHandoffs: boolean;
  canViewDocuments: boolean;
  canAccessProfessionalPortal: boolean;
  canInviteProfessional: boolean;
  // Limits
  expenseRequestsPerMonth: number | 'unlimited';
  childProfileLimit: number | 'unlimited';
}

const TIER_LIMITS: Record<SubscriptionTier, Pick<Permissions, 'expenseRequestsPerMonth' | 'childProfileLimit'>> = {
  preview:   { expenseRequestsPerMonth: 3,   childProfileLimit: 1 },
  essential: { expenseRequestsPerMonth: 20,  childProfileLimit: 1 },
  plus:      { expenseRequestsPerMonth: 100, childProfileLimit: 3 },
  premium:   { expenseRequestsPerMonth: 'unlimited', childProfileLimit: 'unlimited' },
};

const DEFAULT_PERMISSIONS: Permissions = {
  role: 'parent', tier: 'preview',
  isParent: true, isChild: false, isProfessional: false,
  canSendMessages: true, canViewExpenses: true,
  canManageCalendar: true, canUseMyScai: false, canUseAIToneCheck: false,
  canExportCourtRecord: false, canUseVerifiedHandoffs: false,
  canViewDocuments: false, canAccessProfessionalPortal: false,
  canInviteProfessional: false,
  ...TIER_LIMITS.preview,
};

export function usePermissions(): { permissions: Permissions; loading: boolean } {
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles' as any)
          .select('role, subscription_tier, subscription_status')
          .eq('id', user.id)
          .maybeSingle();

        const role: AppRole = (profile as any)?.role ?? 'parent';
        const tier = normaliseTier((profile as any)?.subscription_tier);
        const rank = TIER_RANK[tier];
        const atLeast = (r: SubscriptionTier) => rank >= TIER_RANK[r];

        const isParent = role === 'parent' || role === 'co_parent';
        const isChild = role === 'child';
        const isProfessional = role === 'professional';

        setPermissions({
          role, tier,
          isParent, isChild, isProfessional,
          canSendMessages: isParent || isChild,
          canViewExpenses: isParent,
          canManageCalendar: isParent && atLeast('essential'),
          canUseMyScai: atLeast('plus'),
          canUseAIToneCheck: atLeast('plus'),
          canExportCourtRecord: isParent && atLeast('premium'),
          canUseVerifiedHandoffs: isParent && atLeast('premium'),
          canViewDocuments: isParent && atLeast('essential'),
          canAccessProfessionalPortal: isProfessional,
          canInviteProfessional: isParent && atLeast('premium'),
          ...TIER_LIMITS[tier],
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { permissions, loading };
}
