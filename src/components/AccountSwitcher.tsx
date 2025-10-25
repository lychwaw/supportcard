import { useState } from 'react';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircle, Users, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const AccountSwitcher = () => {
  const { role, activeChildId, children, isParent, switchToChild, switchToParent } = useRole();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!role) return null;

  const handlePasswordAuth = async () => {
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      // Get current user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Re-authenticate the user with their password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: password,
      });

      if (error) {
        throw new Error('Incorrect password');
      }

      // If switching to child, pass the child ID
      if (selectedChildId) {
        switchToChild(selectedChildId);
      } else {
        switchToParent();
      }

      setShowAuthDialog(false);
      setPassword('');
      setSelectedChildId('');
      toast.success('Successfully authenticated');
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchRequest = (childId?: string) => {
    if (childId) {
      setSelectedChildId(childId);
    }
    setShowAuthDialog(true);
  };

  const handleParentSwitch = () => {
    handleSwitchRequest();
  };

  return (
    <>
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
              <Button variant="outline" size="sm" onClick={handleParentSwitch}>
                Switch to Parent
              </Button>
            ) : (
              <Select onValueChange={handleSwitchRequest}>
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

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Secure Account Switch
            </DialogTitle>
            <DialogDescription>
              Please enter your password to verify this account switch
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Your Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordAuth();
                  }
                }}
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This prevents unauthorized access to different account types
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handlePasswordAuth} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Switch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
