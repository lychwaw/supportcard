import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

export interface Permission {
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRoleAndPermissions();
    } else {
      setPermissions([]);
      setUserRole(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRoleAndPermissions = async () => {
    if (!user) return;

    try {
      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      // Determine the safe role BEFORE branching so the permissions query always
      // uses the same value that state is being set to (prevents the race where
      // setUserRole('child') fires but currentRole still resolves to 'parent').
      const safeRole = roleError ? 'child' : (roleData?.role || 'parent');

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        setUserRole('child'); // Fail closed — deny elevated access on error
      } else {
        setUserRole(safeRole);
      }

      // Get permissions for the user's role
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .eq('role', safeRole);

      if (permissionsError) {
        console.error('Error fetching permissions:', permissionsError);
      } else {
        setPermissions(permissionsData || []);
      }
    } catch (error) {
      console.error('Error in fetchUserRoleAndPermissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!userRole || permissions.length === 0) {
      // Deny all while role is loading or on error — never grant access to an unconfirmed role
      return userRole === 'parent';
    }

    const permission = permissions.find(
      p => p.resource === resource && p.action === action
    );

    return permission?.allowed ?? false;
  };

  const canCreate = (resource: string) => hasPermission(resource, 'create');
  const canRead = (resource: string) => hasPermission(resource, 'read');
  const canUpdate = (resource: string) => hasPermission(resource, 'update');
  const canDelete = (resource: string) => hasPermission(resource, 'delete');

  const isParent = userRole === 'parent';
  const isChild = userRole === 'child';

  return {
    permissions,
    userRole,
    loading,
    hasPermission,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    isParent,
    isChild,
    refreshPermissions: fetchUserRoleAndPermissions,
  };
};
