import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, UserCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { InviteCoParent } from './InviteCoParent';

interface CoParentInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  parent_role: string | null;
}

interface ChildWithCoParent {
  id: string;
  name: string;
  user_id: string | null;
  co_parent_id: string | null;
  coParent?: CoParentInfo | null;
}

export const ChildManagement = () => {
  const { user } = useAuth();
  const { children, refreshChildren } = useRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [childName, setChildName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [childrenWithCoParents, setChildrenWithCoParents] = useState<ChildWithCoParent[]>([]);

  useEffect(() => {
    if (children.length > 0) {
      fetchCoParentInfo();
    }
  }, [children]);

  const fetchCoParentInfo = async () => {
    try {
      const childrenData = await Promise.all(
        children.map(async (child) => {
          let coParent: CoParentInfo | null = null;
          
          if (child.co_parent_id) {
            const { data } = await supabase
              .from('profiles')
              .select('id, full_name, email, parent_role')
              .eq('id', child.co_parent_id)
              .single();
            
            if (data) {
              coParent = {
                id: data.id,
                full_name: data.full_name,
                email: data.email,
                parent_role: data.parent_role,
              };
            }
          }

          return {
            ...child,
            coParent,
          } as ChildWithCoParent;
        })
      );

      setChildrenWithCoParents(childrenData);
    } catch (error) {
      console.error('Error fetching co-parent info:', error);
    }
  };

  const handleAddChild = async () => {
    if (!user || !childName || !targetAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('children')
        .insert({
          parent_id: user.id,
          name: childName,
          target_amount: parseFloat(targetAmount),
          current_amount: 0,
        });

      if (error) throw error;

      toast.success(`${childName} added successfully`);
      setChildName('');
      setTargetAmount('');
      setIsDialogOpen(false);
      
      // Refresh children list
      await refreshChildren();
      
      // Trigger window event to refresh dashboard
      window.dispatchEvent(new CustomEvent('children-updated'));
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Failed to add child');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Manage Children
            </CardTitle>
            <CardDescription>Add and manage child accounts • Invite co-parents</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Child
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Child</DialogTitle>
                <DialogDescription>
                  Create a new child account with support payment tracking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="child-name">Child's Name</Label>
                  <Input
                    id="child-name"
                    placeholder="Enter name"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-amount">Monthly Support Target</Label>
                  <Input
                    id="target-amount"
                    type="number"
                    placeholder="0.00"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleAddChild} disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Child'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {children.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCircle className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No children added yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Click "Add Child" above to create your first child profile
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {childrenWithCoParents.map((child) => (
              <div
                key={child.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCircle className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{child.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {child.user_id ? 'Account created' : 'Pending account creation'}
                      </p>
                    </div>
                  </div>
                  {!child.coParent && (
                    <InviteCoParent 
                      childId={child.id} 
                      childName={child.name}
                      onInviteSent={fetchCoParentInfo}
                    />
                  )}
                </div>
                
                {child.coParent && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Co-Parent</p>
                      <p className="text-xs text-muted-foreground">
                        {child.coParent.full_name || child.coParent.email || 'Unknown'}
                      </p>
                    </div>
                    {child.coParent.parent_role && (
                      <Badge variant="secondary">
                        {child.coParent.parent_role === 'payer' ? 'Payer' : 
                         child.coParent.parent_role === 'receiver' ? 'Receiver' : 'Both'}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
