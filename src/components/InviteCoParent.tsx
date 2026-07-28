import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus, Mail, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteCoParentProps {
  childId: string;
  childName: string;
  onInviteSent?: () => void;
}

export const InviteCoParent = ({ childId, childName, onInviteSent }: InviteCoParentProps) => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateToken = () => {
    return `invite_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  };

  const handleInvite = async () => {
    if (!user || !inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      const token = generateToken();
      const inviteUrl = `${window.location.origin}/auth?token=${token}`;

      // Create invitation in database
      const { error: inviteError } = await (supabase as any)
        .from('parent_invites')
        .insert({
          inviter_id: user.id,
          invited_email: inviteEmail,
          invited_phone: invitePhone || null,
          child_id: childId,
          token: token,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        } as any);

      if (inviteError) throw inviteError;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success('Invite link copied to clipboard — share it with the co-parent');
      } else {
        toast.success('Invitation created — copy this link and share it', { description: inviteUrl, duration: 10000 });
      }

      setInviteEmail('');
      setInvitePhone('');
      setIsDialogOpen(false);
      onInviteSent?.();
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Co-Parent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Co-Parent</DialogTitle>
          <DialogDescription>
            Invite another parent to manage <strong>{childName}</strong>'s profile together
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address (Required)
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="co-parent@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number (Optional)
            </Label>
            <Input
              id="invite-phone"
              type="tel"
              placeholder="+27 82 123 4567"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">What happens next?</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>They'll receive an invitation link via email</li>
              <li>They can sign up and automatically get linked to {childName}'s profile</li>
              <li>Both of you will see all transactions and expenses</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={isLoading || !inviteEmail}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

