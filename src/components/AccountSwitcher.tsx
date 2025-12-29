import { useEffect, useState } from 'react';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircle, Users, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hashString, constantTimeCompare } from '@/lib/security';

export const AccountSwitcher = () => {
  const { user } = useAuth();
  const { role, activeChildId, children, isParent, switchToChild, switchToParent } = useRole();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeLoading, setPasscodeLoading] = useState(false);
  const [passcodeConfig, setPasscodeConfig] = useState({
    requireChildPasscode: false,
    parentPasscodeHash: null as string | null,
    parentPasscodeHint: null as string | null,
    passcodeFailedAttempts: 0,
    passcodeLockedUntil: null as string | null,
  });

  useEffect(() => {
    const fetchPasscodeConfig = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('require_child_passcode, parent_passcode_hash, parent_passcode_hint, passcode_failed_attempts, passcode_locked_until')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        if (data) {
          setPasscodeConfig({
            requireChildPasscode: data.require_child_passcode ?? false,
            parentPasscodeHash: data.parent_passcode_hash,
            parentPasscodeHint: data.parent_passcode_hint,
            passcodeFailedAttempts: data.passcode_failed_attempts ?? 0,
            passcodeLockedUntil: data.passcode_locked_until,
          });
        }
      } catch (error) {
        console.error('Failed to load passcode settings:', error);
      }
    };

    fetchPasscodeConfig();
  }, [user]);

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
    setSelectedChildId(childId || '');
    setShowAuthDialog(true);
  };

  const handleParentSwitch = () => {
    if (
      activeChildId &&
      passcodeConfig.requireChildPasscode &&
      passcodeConfig.parentPasscodeHash
    ) {
      setShowPasscodeDialog(true);
      return;
    }
    handleSwitchRequest();
  };

  const handlePasscodeUnlock = async () => {
    if (!user) return;
    if (!passcodeInput) {
      toast.error('Enter your passcode');
      return;
    }

    if (passcodeConfig.passcodeLockedUntil) {
      const lockedUntil = new Date(passcodeConfig.passcodeLockedUntil);
      if (lockedUntil > new Date()) {
        toast.error('Passcode locked. Try again later.');
        return;
      }
    }

    setPasscodeLoading(true);
    try {
      const hashedInput = await hashString(passcodeInput);
      const isValid =
        passcodeConfig.parentPasscodeHash &&
        constantTimeCompare(hashedInput, passcodeConfig.parentPasscodeHash);

      if (!isValid) {
        const nextAttempts = (passcodeConfig.passcodeFailedAttempts || 0) + 1;
        const shouldLock = nextAttempts >= 5;
        const lockUntil = shouldLock ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;

        await supabase
          .from('profiles')
          .update({
            passcode_failed_attempts: nextAttempts,
            passcode_locked_until: lockUntil,
          })
          .eq('id', user.id);

        setPasscodeConfig((prev) => ({
          ...prev,
          passcodeFailedAttempts: nextAttempts,
          passcodeLockedUntil: lockUntil,
        }));

        toast.error(shouldLock ? 'Too many attempts. Locked for 5 minutes.' : 'Incorrect passcode');
        return;
      }

      await supabase
        .from('profiles')
        .update({
          passcode_failed_attempts: 0,
          passcode_locked_until: null,
        })
        .eq('id', user.id);

      setPasscodeConfig((prev) => ({
        ...prev,
        passcodeFailedAttempts: 0,
        passcodeLockedUntil: null,
      }));

      setShowPasscodeDialog(false);
      setPasscodeInput('');
      switchToParent();
      toast.success('Parent account unlocked');
    } catch (error) {
      console.error('Passcode verification failed:', error);
      toast.error('Unable to verify passcode');
    } finally {
      setPasscodeLoading(false);
    }
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

      <Dialog open={showPasscodeDialog} onOpenChange={setShowPasscodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Parent Passcode
            </DialogTitle>
            <DialogDescription>
              Enter the shared parent passcode to return to the adult account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                disabled={passcodeLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasscodeUnlock();
                  }
                }}
              />
              {passcodeConfig.parentPasscodeHint && (
                <p className="text-xs text-muted-foreground">
                  Hint: {passcodeConfig.parentPasscodeHint}
                </p>
              )}
              {passcodeConfig.passcodeLockedUntil && new Date(passcodeConfig.passcodeLockedUntil) > new Date() && (
                <p className="text-xs text-destructive">
                  Locked until {new Date(passcodeConfig.passcodeLockedUntil).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasscodeDialog(false);
                setPasscodeInput('');
              }}
              disabled={passcodeLoading}
            >
              Cancel
            </Button>
            <Button onClick={handlePasscodeUnlock} disabled={passcodeLoading}>
              {passcodeLoading ? 'Checking...' : 'Unlock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
