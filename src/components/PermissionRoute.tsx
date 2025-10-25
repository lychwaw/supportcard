import { Navigate } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, Lock } from 'lucide-react';

interface PermissionRouteProps {
  children: React.ReactNode;
  requiresParent?: boolean;
  requiresChild?: boolean;
}

export const PermissionRoute = ({ 
  children, 
  requiresParent = false,
  requiresChild = false 
}: PermissionRouteProps) => {
  const { isParent, isChild, role, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (requiresParent && !isParent) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            This page is only available for parent accounts. Please switch to a parent view.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (requiresChild && !isChild) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Alert className="max-w-md">
          <Lock className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            This page is only available for child accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
