import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AccountSwitcher } from '@/components/AccountSwitcher';

interface ExpenseRequest {
  id: string;
  amount: number;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

const Expenses = () => {
  const { user } = useAuth();
  const { isChild } = useRole();
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const categories = ['Food', 'Clothing', 'School', 'Activities', 'Healthcare', 'Transportation'];

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  const fetchExpenses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('expense_requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!user || !amount || !category || !description) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('expense_requests')
        .insert({
          requester_id: user.id,
          amount: parseFloat(amount),
          category,
          description,
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Expense request submitted');
      setIsDialogOpen(false);
      setAmount('');
      setCategory('');
      setDescription('');
      fetchExpenses();
    } catch (error) {
      toast.error('Failed to submit request');
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-warning/10 text-warning',
      approved: 'bg-success/10 text-success',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return variants[status] || 'bg-muted text-muted-foreground';
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
          <FileText className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Expense Requests</h1>
            <p className="text-muted-foreground">Submit and track expense approvals</p>
          </div>
        </div>
        {isChild && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Expense Request</DialogTitle>
              <DialogDescription>Request approval for a child-related expense</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the expense..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={handleSubmitRequest} className="w-full">
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <AccountSwitcher />

      <div className="grid gap-4">
        {expenses.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No expense requests yet</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Submit Your First Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id} className="shadow-soft">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>${expense.amount.toFixed(2)}</CardTitle>
                    <CardDescription>{expense.category}</CardDescription>
                  </div>
                  <Badge className={getStatusBadge(expense.status)}>
                    {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{expense.description}</p>
                <p className="text-xs text-muted-foreground">
                  Submitted {format(new Date(expense.created_at), 'MMM dd, yyyy')}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Expenses;
