import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCircle, Users } from 'lucide-react';

export const AccountSwitcher = () => {
  const { role, activeChildId, children, isParent, switchToChild, switchToParent } = useRole();

  if (!role) return null;

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
      {isParent ? (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Parent Account</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Child Account</span>
        </div>
      )}

      {role === 'parent' && children.length > 0 && (
        <div className="flex items-center gap-2 ml-auto">
          {activeChildId ? (
            <Button variant="outline" size="sm" onClick={switchToParent}>
              Switch to Parent
            </Button>
          ) : (
            <Select onValueChange={switchToChild}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Switch to child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
};
