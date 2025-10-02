import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

export const ChildManagement = () => {
  const { user } = useAuth();
  const { children, refreshChildren } = useRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [childName, setChildName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      await refreshChildren();
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Failed to add child');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Manage Children</CardTitle>
            <CardDescription>Add and manage child accounts</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
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
          <div className="text-center py-6">
            <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No children added yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Add Child" to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <UserCircle className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{child.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {child.user_id ? 'Account created' : 'Pending account creation'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
