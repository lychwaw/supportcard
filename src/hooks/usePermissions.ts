import { useRole } from '@/contexts/RoleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTierId, isTierAtLeast } from '@/lib/subscriptions';

export const usePermissions = () => {
  const { isParent, isChild, isGuardian, role } = useRole();
  const { tier, isActive } = useSubscription();

  const effectiveTier = (isActive ? tier : 'free') as SubscriptionTierId;
  const hasTier = (required: SubscriptionTierId) => isTierAtLeast(effectiveTier, required);

  return {
    // Can manage settings
    canManageSettings: isGuardian,
    
    // Can change payment methods (parents only)
    canManagePaymentMethods: isGuardian,
    
    // Can send/transfer money (parents only)
    canSendMoney: isGuardian,
    
    // Can create/edit budgets (premium+)
    canManageBudgets: isGuardian && hasTier('premium'),
    
    // Can approve/reject expenses (premium+)
    canApproveExpenses: isGuardian && hasTier('premium'),
    
    // Can add/edit children (family+)
    canManageChildren: isGuardian && hasTier('family_plus'),
    
    // Can view transactions (both)
    canViewTransactions: true,
    
    // Can create expense requests (children can request)
    canCreateExpenseRequests: isChild || isGuardian,
    
    // Can view analytics (premium+)
    canViewAnalytics: isGuardian && hasTier('premium'),
    
    // Can add emergency contacts (parents only)
    canManageContacts: isGuardian,
    
    // Can manage calendar events (premium+ for sync-related features)
    canManageCalendar: hasTier('premium'),
    
    // Can send messages (both)
    canSendMessages: true,
    
    // Can upgrade subscription (parents only)
    canManageSubscription: isGuardian,
    
    // Can view and export reports (premium+)
    canExportReports: isGuardian && hasTier('premium'),
    
    // Can add new cards (parents only)
    canManageCards: isGuardian,
    
    // Can top up cards (parents only)
    canTopUpCards: isGuardian,

    // Wallet visibility (both can view balances)
    canViewWallet: true,

    // Only parents can see sensitive CVV/expiry data
    canViewWalletSensitive: isGuardian,

    // Only parents can remove cards
    canDeleteCards: isGuardian,
    
    // Legal & executive gated features
    canViewDocuments: isGuardian && hasTier('legal'),
    canViewCompliance: isGuardian && hasTier('legal'),
    canAccessExecutiveTools: isGuardian && hasTier('executive'),
    
    // Generic permission check
    hasPermission: (permission: string): boolean => {
      const permissions: Record<string, boolean> = {
        'manage_settings': isGuardian,
        'manage_payment_methods': isGuardian,
        'send_money': isGuardian,
        'manage_budgets': isGuardian && hasTier('premium'),
        'approve_expenses': isGuardian && hasTier('premium'),
        'manage_children': isGuardian && hasTier('family_plus'),
        'view_transactions': true,
        'create_expense_requests': isChild || isGuardian,
        'view_analytics': isGuardian && hasTier('premium'),
        'manage_contacts': isGuardian,
        'manage_calendar': hasTier('premium'),
        'send_messages': true,
        'manage_subscription': isGuardian,
        'export_reports': isGuardian && hasTier('premium'),
        'manage_cards': isGuardian,
        'top_up_cards': isGuardian,
        'wallet_view': true,
        'wallet_manage': isGuardian,
        'wallet_top_up': isGuardian,
        'wallet_delete': isGuardian,
        'wallet_view_sensitive': isGuardian,
        'view_documents': isGuardian && hasTier('legal'),
        'view_compliance': isGuardian && hasTier('legal'),
        'executive_tools': isGuardian && hasTier('executive'),
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
