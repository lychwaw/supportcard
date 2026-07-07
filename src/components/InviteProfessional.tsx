import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Scale, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteProfessionalProps {
  onInviteSent?: () => void;
}

export const InviteProfessional = ({ onInviteSent }: InviteProfessionalProps) => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateToken = () => `prof_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  const handleInvite = async () => {
    if (!user || !inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      const token = generateToken();
      const inviteUrl = `${window.location.origin}/auth?ptoken=${token}`;

      const { error: inviteError } = await (supabase as any)
        .from('professional_links')
        .insert({
          parent_id: user.id,
          invited_email: inviteEmail,
          token,
          status: 'pending',
        });

      if (inviteError) throw inviteError;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success('Invite link copied to clipboard — share it with your lawyer or mediator');
      } else {
        toast.success('Invitation created — copy this link and share it', { description: inviteUrl, duration: 10000 });
      }

      setInviteEmail('');
      setIsDialogOpen(false);
      onInviteSent?.();
    } catch (error: any) {
      console.error('Error creating professional invitation:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Scale className="h-4 w-4 mr-2" />
          Invite Professional
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a Professional</DialogTitle>
          <DialogDescription>
            Give a lawyer or mediator read-only access to your family's logs, messages, and documents
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prof-invite-email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </Label>
            <Input
              id="prof-invite-email"
              type="email"
              placeholder="lawyer@firm.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">What they'll see</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Receipts, custody logs, and messages — read-only</li>
              <li>They cannot approve, dispute, or edit anything</li>
              <li>You can revoke access at any time from this page</li>
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
