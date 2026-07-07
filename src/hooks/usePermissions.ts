import { useRole } from '@/contexts/RoleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTierId, isTierAtLeast } from '@/lib/subscriptions';

export const usePermissions = () => {
  const { isParent, isChild, isGuardian, isProfessional, role } = useRole();
  const { tier, isActive } = useSubscription();

  const effectiveTier = (isActive ? tier : 'preview') as SubscriptionTierId;
  const hasTier = (required: SubscriptionTierId) => isTierAtLeast(effectiveTier, required);

  return {
    // Can manage settings
    canManageSettings: isGuardian,

    // Can create/edit budgets
    canManageBudgets: isGuardian,

    // Can approve/reject expenses — core record-keeping, not tier-gated
    canApproveExpenses: isGuardian,

    // Can add/edit children — caps enforced via tier.limits.childProfiles at the point of creation
    canManageChildren: isGuardian,

    // Can view transactions (both)
    canViewTransactions: true,

    // Can create expense requests (children can request)
    canCreateExpenseRequests: isChild || isGuardian,

    // Can view analytics & AI insights (Plus+)
    canViewAnalytics: isGuardian && hasTier('plus'),

    // Can add emergency contacts (parents only)
    canManageContacts: isGuardian,

    // Full calendar sync (Essential+); Preview gets a handful of events client-side
    canManageCalendar: isGuardian && hasTier('essential'),

    // My SCAI assistant + AI Tone-Check on messages (Plus+)
    canUseMyScai: hasTier('plus'),
    canUseAITone: hasTier('plus'),

    // Schedule Assistant — custody conflict detection on calendar (Plus+)
    canUseScheduleAssistant: isGuardian && hasTier('plus'),

    // Can send messages (both)
    canSendMessages: true,

    // Can upgrade subscription (parents only)
    canManageSubscription: isGuardian,

    // Court-admissible record export (Premium only)
    canExportCourtRecord: isGuardian && hasTier('premium'),
    canExportReports: isGuardian && hasTier('premium'),

    // Verified Handoffs — GPS capture is required, not just best-effort (Premium only)
    canUseVerifiedHandoffs: isGuardian && hasTier('premium'),

    // Document storage — available from Essential up (capped; unlimited from Plus)
    canViewDocuments: isGuardian && hasTier('essential'),
    canViewCompliance: isGuardian && hasTier('premium'),
    canAccessLegalTools: isGuardian && hasTier('premium'),

    // Professional (lawyer/mediator) access. There is no separate paid
    // "Professional" tier — a parent on Premium can invite a professional,
    // and once linked the professional's own portal access just needs the
    // role (gating already happened when the parent sent the invite).
    canInviteProfessional: isGuardian && hasTier('premium'),
    isProfessional,
    canAccessProfessionalPortal: isProfessional,
    canBulkExport: isProfessional,

    // Generic permission check
    hasPermission: (permission: string): boolean => {
      const permissions: Record<string, boolean> = {
        manage_settings: isGuardian,
        manage_budgets: isGuardian,
        approve_expenses: isGuardian,
        manage_children: isGuardian,
        view_transactions: true,
        create_expense_requests: isChild || isGuardian,
        view_analytics: isGuardian && hasTier('plus'),
        manage_contacts: isGuardian,
        manage_calendar: isGuardian && hasTier('essential'),
        use_my_scai: hasTier('plus'),
        use_ai_tone: hasTier('plus'),
        use_schedule_assistant: isGuardian && hasTier('plus'),
        send_messages: true,
        manage_subscription: isGuardian,
        export_court_record: isGuardian && hasTier('premium'),
        export_reports: isGuardian && hasTier('premium'),
        use_verified_handoffs: isGuardian && hasTier('premium'),
        view_documents: isGuardian && hasTier('essential'),
        view_compliance: isGuardian && hasTier('premium'),
        legal_tools: isGuardian && hasTier('premium'),
        invite_professional: isGuardian && hasTier('premium'),
        professional_portal: isProfessional,
        bulk_export: isProfessional,
      };

      return permissions[permission] || false;
    },
    subscriptionTier: effectiveTier,
    subscriptionActive: isActive,

    role,
    isParent,
    isChild,
    isGuardian,
  };
};
