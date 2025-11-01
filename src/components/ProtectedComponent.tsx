import { ReactNode } from 'react';
import { usePermissionContext } from '@/components/PermissionProvider';

interface ProtectedComponentProps {
  children: ReactNode;
  resource: string;
  action: string;
  fallback?: ReactNode;
  requireAll?: boolean; // If true, requires all permissions; if false, requires any
  permissions?: Array<{ resource: string; action: string }>;
}

export const ProtectedComponent = ({ 
  children, 
  resource, 
  action, 
  fallback = null,
  requireAll = false,
  permissions = []
}: ProtectedComponentProps) => {
  const { hasPermission } = usePermissionContext();

  // Single permission check
  if (!permissions.length) {
    return hasPermission(resource, action) ? <>{children}</> : <>{fallback}</>;
  }

  // Multiple permissions check
  const permissionResults = permissions.map(p => hasPermission(p.resource, p.action));
  
  const hasRequiredPermissions = requireAll 
    ? permissionResults.every(result => result)
    : permissionResults.some(result => result);

  return hasRequiredPermissions ? <>{children}</> : <>{fallback}</>;
};

// Convenience components for common permission patterns
export const ParentOnly = ({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) => {
  const { isParent } = usePermissionContext();
  return isParent ? <>{children}</> : <>{fallback}</>;
};

export const ChildOnly = ({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) => {
  const { isChild } = usePermissionContext();
  return isChild ? <>{children}</> : <>{fallback}</>;
};

export const CanCreate = ({ resource, children, fallback = null }: { resource: string; children: ReactNode; fallback?: ReactNode }) => {
  return (
    <ProtectedComponent resource={resource} action="create" fallback={fallback}>
      {children}
    </ProtectedComponent>
  );
};

export const CanUpdate = ({ resource, children, fallback = null }: { resource: string; children: ReactNode; fallback?: ReactNode }) => {
  return (
    <ProtectedComponent resource={resource} action="update" fallback={fallback}>
      {children}
    </ProtectedComponent>
  );
};

export const CanDelete = ({ resource, children, fallback = null }: { resource: string; children: ReactNode; fallback?: ReactNode }) => {
  return (
    <ProtectedComponent resource={resource} action="delete" fallback={fallback}>
      {children}
    </ProtectedComponent>
  );
};
