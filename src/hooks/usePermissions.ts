import { useRole } from '@/contexts/RoleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTierId, isTierAtLeast } from '@/lib/subscriptions';

export const usePermissions = () => {
  const { isParent, isChild, role } = useRole();
  const { tier, isActive } = useSubscription();

  const effectiveTier = (isActive ? tier : 'free') as SubscriptionTierId;
  const hasTier = (required: SubscriptionTierId) => isTierAtLeast(effectiveTier, required);

  return {
    // Can manage settings
    canManageSettings: isParent,
    
    // Can change payment methods (parents only)
    canManagePaymentMethods: isParent,
    
    // Can send/transfer money (parents only)
    canSendMoney: isParent,
    
    // Can create/edit budgets (premium+)
    canManageBudgets: isParent && hasTier('premium'),
    
    // Can approve/reject expenses (premium+)
    canApproveExpenses: isParent && hasTier('premium'),
    
    // Can add/edit children (family+)
    canManageChildren: isParent && hasTier('family_plus'),
    
    // Can view transactions (both)
    canViewTransactions: true,
    
    // Can create expense requests (children can request)
    canCreateExpenseRequests: isChild || isParent,
    
    // Can view analytics (premium+)
    canViewAnalytics: isParent && hasTier('premium'),
    
    // Can add emergency contacts (parents only)
    canManageContacts: isParent,
    
    // Can manage calendar events (premium+ for sync-related features)
    canManageCalendar: hasTier('premium'),
    
    // Can send messages (both)
    canSendMessages: true,
    
    // Can upgrade subscription (parents only)
    canManageSubscription: isParent,
    
    // Can view and export reports (premium+)
    canExportReports: isParent && hasTier('premium'),
    
    // Can add new cards (parents only)
    canManageCards: isParent,
    
    // Can top up cards (parents only)
    canTopUpCards: isParent,

    // Wallet visibility (both can view balances)
    canViewWallet: true,

    // Only parents can see sensitive CVV/expiry data
    canViewWalletSensitive: isParent,

    // Only parents can remove cards
    canDeleteCards: isParent,
    
    // Legal & executive gated features
    canViewDocuments: isParent && hasTier('legal'),
    canViewCompliance: isParent && hasTier('legal'),
    canAccessExecutiveTools: isParent && hasTier('executive'),

    // Generic permission check
    hasPermission: (permission: string): boolean => {
      const permissions: Record<string, boolean> = {
        'manage_settings': isParent,
        'manage_payment_methods': isParent,
        'send_money': isParent,
        'manage_budgets': isParent && hasTier('premium'),
        'approve_expenses': isParent && hasTier('premium'),
        'manage_children': isParent && hasTier('family_plus'),
        'view_transactions': true,
        'create_expense_requests': isChild || isParent,
        'view_analytics': isParent && hasTier('premium'),
        'manage_contacts': isParent,
        'manage_calendar': hasTier('premium'),
        'send_messages': true,
        'manage_subscription': isParent,
        'export_reports': isParent && hasTier('premium'),
        'manage_cards': isParent,
        'top_up_cards': isParent,
        'wallet_view': true,
        'wallet_manage': isParent,
        'wallet_top_up': isParent,
        'wallet_delete': isParent,
        'wallet_view_sensitive': isParent,
        'view_documents': isParent && hasTier('legal'),
        'view_compliance': isParent && hasTier('legal'),
        'executive_tools': isParent && hasTier('executive'),
      };
      
      return permissions[permission] || false;
    },
    subscriptionTier: effectiveTier,
    subscriptionActive: isActive,
    
    role,
    isParent,
    isChild,
  };
};
