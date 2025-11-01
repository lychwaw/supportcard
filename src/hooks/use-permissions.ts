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

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        setUserRole('parent'); // Default to parent
      } else {
        setUserRole(roleData?.role || 'parent');
      }

      const currentRole = roleData?.role || 'parent';

      // Get permissions for the user's role
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .eq('role', currentRole);

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
      // Default permissions for parent role if not loaded yet
      return userRole === 'parent' || userRole === null;
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
