import { createContext, useContext, ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface PermissionContextType {
  hasPermission: (resource: string, action: string) => boolean;
  canCreate: (resource: string) => boolean;
  canRead: (resource: string) => boolean;
  canUpdate: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  isParent: boolean;
  isChild: boolean;
  userRole: string | null;
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissionContext = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionContext must be used within PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const permissions = usePermissions();

  return (
    <PermissionContext.Provider value={permissions}>
      {children}
    </PermissionContext.Provider>
  );
};
