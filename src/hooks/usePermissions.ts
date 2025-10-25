import { useRole } from '@/contexts/RoleContext';

export const usePermissions = () => {
  const { isParent, isChild, role } = useRole();

  return {
    // Can manage settings
    canManageSettings: isParent,
    
    // Can change payment methods (parents only)
    canManagePaymentMethods: isParent,
    
    // Can send/transfer money (parents only)
    canSendMoney: isParent,
    
    // Can create/edit budgets (parents only)
    canManageBudgets: isParent,
    
    // Can approve/reject expenses (parents only)
    canApproveExpenses: isParent,
    
    // Can add/edit children (parents only)
    canManageChildren: isParent,
    
    // Can view transactions (both)
    canViewTransactions: true,
    
    // Can create expense requests (children can request)
    canCreateExpenseRequests: isChild || isParent,
    
    // Can view analytics (parents only)
    canViewAnalytics: isParent,
    
    // Can add emergency contacts (parents only)
    canManageContacts: isParent,
    
    // Can manage calendar events (both)
    canManageCalendar: true,
    
    // Can send messages (both)
    canSendMessages: true,
    
    // Can upgrade subscription (parents only)
    canManageSubscription: isParent,
    
    // Can view and export reports (parents only)
    canExportReports: isParent,
    
    // Can add new cards (parents only)
    canManageCards: isParent,
    
    // Can top up cards (parents only)
    canTopUpCards: isParent,
    
    // Generic permission check
    hasPermission: (permission: string): boolean => {
      const permissions: Record<string, boolean> = {
        'manage_settings': isParent,
        'manage_payment_methods': isParent,
        'send_money': isParent,
        'manage_budgets': isParent,
        'approve_expenses': isParent,
        'manage_children': isParent,
        'view_transactions': true,
        'create_expense_requests': isChild || isParent,
        'view_analytics': isParent,
        'manage_contacts': isParent,
        'manage_calendar': true,
        'send_messages': true,
        'manage_subscription': isParent,
        'export_reports': isParent,
        'manage_cards': isParent,
        'top_up_cards': isParent,
      };
      
      return permissions[permission] || false;
    },
    
    role,
    isParent,
    isChild,
  };
};
