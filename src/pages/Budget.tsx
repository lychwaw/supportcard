import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSwitcher } from '@/components/AccountSwitcher';

interface BudgetCategory {
  id: string;
  category: string;
  monthly_limit: number;
  current_spent: number;
}

const Budget = () => {
  const { user } = useAuth();
  const { activeChildId, children, isParent } = useRole();
  const { canManageBudgets } = usePermissions();
  const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const categories = ['Food', 'Clothing', 'School', 'Activities', 'Healthcare', 'Transportation'];

  useEffect(() => {
    fetchBudgets();
  }, [user, activeChildId, children]);

  const fetchBudgets = async () => {
    if (!user) return;

    try {
      // Determine which user_id to query
      const queryUserId = activeChildId 
        ? children.find(c => c.id === activeChildId)?.user_id 
        : user.id;

      if (!queryUserId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('user_id', queryUserId);

      if (error) throw error;
      if (data) setBudgets(data);
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBudget = async () => {
    if (!canManageBudgets) {
      toast.error('Only parents can manage budgets');
      return;
    }

    if (!user || !newCategory || !newLimit) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('budget_categories')
        .insert({
          user_id: user.id,
          category: newCategory,
          monthly_limit: parseFloat(newLimit),
          current_spent: 0,
        });

      if (error) throw error;

      toast.success('Budget category added successfully');
      setIsDialogOpen(false);
      setNewCategory('');
      setNewLimit('');
      fetchBudgets();
    } catch (error) {
      toast.error('Failed to add budget category');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Monthly Budget</h1>
            <p className="text-muted-foreground">Track spending by category</p>
          </div>
        </div>
        {isParent && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Budget Category</DialogTitle>
              <DialogDescription>Set a monthly spending limit for a category</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit">Monthly Limit ($)</Label>
                <Input
                  id="limit"
                  type="number"
                  placeholder="0.00"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                />
              </div>
              <Button onClick={handleAddBudget} className="w-full">
                Add Budget
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <AccountSwitcher />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.length === 0 ? (
          <Card className="col-span-full shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No budget categories yet</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Category
              </Button>
            </CardContent>
          </Card>
        ) : (
          budgets.map((budget) => {
            const percentage = (budget.current_spent / budget.monthly_limit) * 100;
            const isOverBudget = percentage > 100;

            return (
              <Card key={budget.id} className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{budget.category}</span>
                    {isOverBudget && (
                      <span className="text-xs font-normal text-destructive">Over Budget</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    ${budget.current_spent.toFixed(2)} of ${budget.monthly_limit.toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress
                    value={Math.min(percentage, 100)}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {percentage.toFixed(0)}% used
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Budget;
