import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AppRole = 'parent' | 'child';

interface Child {
  id: string;
  name: string;
  user_id: string | null;
}

interface RoleContextType {
  role: AppRole | null;
  activeChildId: string | null;
  children: Child[];
  isParent: boolean;
  isChild: boolean;
  switchToChild: (childId: string) => void;
  switchToParent: () => void;
  refreshChildren: () => Promise<void>;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within RoleProvider');
  }
  return context;
};

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async () => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setRole((data as any)?.role as AppRole);
    } catch (error) {
      console.error('Error fetching role:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('children' as any)
        .select('id, name, user_id')
        .eq('parent_id', user.id);

      if (error) throw error;
      setChildrenList((data as unknown as Child[]) || []);
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  useEffect(() => {
    fetchUserRole();
    fetchChildren();
  }, [user]);

  const switchToChild = (childId: string) => {
    const child = childrenList.find(c => c.id === childId);
    if (child) {
      setActiveChildId(childId);
      setRole('child');
      toast.success(`Switched to ${child.name}'s account`);
    }
  };

  const switchToParent = () => {
    setActiveChildId(null);
    fetchUserRole();
    toast.success('Switched to parent account');
  };

  const refreshChildren = async () => {
    await fetchChildren();
  };

  const value: RoleContextType = {
    role,
    activeChildId,
    children: childrenList,
    isParent: role === 'parent' && !activeChildId,
    isChild: role === 'child' || (role === 'parent' && !!activeChildId),
    switchToChild,
    switchToParent,
    refreshChildren,
    loading,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};
