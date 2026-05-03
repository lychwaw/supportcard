import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { convertToZar, formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { z } from 'zod';

// Zod schema for expense request validation
const ExpenseRequestSchema = z.object({
  amount: z.number().positive().max(100000),
  category: z.enum(['Food', 'Clothing', 'School', 'Activities', 'Healthcare', 'Transportation']),
  description: z.string().min(1).max(1000),
  child_id: z.string().uuid().nullable(),
});

interface ExpenseRequest {
  id: string;
  requester_id: string;
  child_id: string | null;
  amount: number;
  category: string;
  description: string;
  status: string;
  created_at: string;
  payment_status?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
}

const Expenses = () => {
  const { user } = useAuth();
  const { isChild, isParent, children } = useRole();
  const { canApproveExpenses, canCreateExpenseRequests, canTopUpCards } = usePermissions();
  const { currency } = useCurrency();
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [payingExpenseId, setPayingExpenseId] = useState<string | null>(null);
  const [balanceCategories, setBalanceCategories] = useState<any[]>([]);
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);
  const [sendMoneyAmount, setSendMoneyAmount] = useState('');
  const [sendMoneyCardId, setSendMoneyCardId] = useState<string>('');
  const [isSendingMoney, setIsSendingMoney] = useState(false);

  const categories = ['Food', 'Clothing', 'School', 'Activities', 'Healthcare', 'Transportation'];

  useEffect(() => {
    if (user) {
      fetchChildrenList();
      fetchExpenses();
      fetchBalanceCategories();
    }
  }, [user]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentStatus = url.searchParams.get('payment');
    if (!paymentStatus) return;

    if (paymentStatus === 'success') {
      toast.success('Payment received. Expense approval is being finalized.');
      fetchExpenses();
    } else if (paymentStatus === 'cancel') {
      toast.error('Payment cancelled.');
    }

    url.searchParams.delete('payment');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const fetchChildrenList = async () => {
    if (!user) return;
    
    try {
      // Fetch children where user is parent OR co-parent
      const { data: childrenData, error } = await supabase
        .from('children')
        .select('id, name, parent_id, co_parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching children:', error);
        }
        return;
      }
      
      if (childrenData && childrenData.length > 0) {
        setChildrenList(childrenData);
        // Set first child as default if none selected
        if (!selectedChildId && childrenData.length > 0 && !isParent) {
          setSelectedChildId(childrenData[0].id);
        }
      } else {
        // No children found - set empty list
        setChildrenList([]);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching children:', error);
      }
      setChildrenList([]);
    }
  };

  const fetchBalanceCategories = async () => {
    if (!user || !canTopUpCards) {
      setBalanceCategories([]);
      return;
    }

    try {
      const { data: myChildren } = await supabase
        .from('children')
        .select('id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);

      const childIds = myChildren?.map((c) => c.id) || [];
      if (childIds.length === 0) {
        setBalanceCategories([]);
        return;
      }

      const { data, error } = await supabase
        .from('virtual_cards')
        .select('id, card_type, balance, child_id, children:child_id(name)')
        .in('child_id', childIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const cardsWithChildren = (data || []).map((card: any) => ({
        ...card,
        child: card.children,
      }));
      setBalanceCategories(cardsWithChildren);
      if (!sendMoneyCardId && cardsWithChildren.length > 0) {
        setSendMoneyCardId(cardsWithChildren[0].id);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching balance categories:', error);
      }
      setBalanceCategories([]);
    }
  };

  const fetchExpenses = async () => {
    if (!user) return;

    try {
      if (isParent) {
        // Parents see expense requests for their children ONLY (not all expenses)
        // Get all children where user is parent or co-parent
        const { data: myChildren } = await supabase
          .from('children')
          .select('id')
          .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
        
        const childIds = myChildren?.map(c => c.id) || [];
        
        if (childIds.length === 0) {
          setExpenses([]);
          setAllExpenses([]);
          setLoading(false);
          return;
        }

        // Fetch expenses for these children only, with child and requester info
        const { data, error } = await supabase
          .from('expense_requests')
          .select(`
            *,
            children:child_id(name),
            profiles:requester_id(full_name, email)
          `)
          .in('child_id', childIds)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) {
          const expensesWithDetails = data.map((e: any) => ({
            ...e,
            child: e.children,
            requester: e.profiles,
          }));
          setAllExpenses(expensesWithDetails);
          setExpenses(expensesWithDetails.filter((e: any) => e.status === 'pending'));
        }
      } else {
        // Children see only their own requests
        const { data, error } = await supabase
          .from('expense_requests')
          .select('*')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) {
          setExpenses(data);
          setAllExpenses(data);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching expenses:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!canCreateExpenseRequests) {
      toast.error('You do not have permission to create expense requests');
      return;
    }

    if (!user || !amount || !category || !description) {
      toast.error('Please fill in all fields');
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    const amountZar = convertToZar(amountNum, currency);
    if (amountZar > 100000) {
      toast.error(`Amount is too large. Maximum is ${formatCurrency(100000, currency)}`);
      return;
    }

    // For parents, require child selection
    if (isParent) {
      if (childrenList.length === 0) {
        toast.error('Please add a child first before creating expense requests');
        return;
      }
      if (!selectedChildId) {
        toast.error('Please select a child for this expense');
        return;
      }
    }

    // For children, use their associated child_id if available
    let childId = selectedChildId;
    if (!childId && !isParent && children.length > 0) {
      childId = children[0].id;
    }

    // Validate with Zod schema
    try {
      ExpenseRequestSchema.parse({
        amount: amountZar,
        category,
        description,
        child_id: childId || null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    try {
      const { data: createdExpense, error } = await supabase
        .from('expense_requests')
        .insert({
          requester_id: user.id,
          child_id: childId || null,
          amount: amountZar,
          category,
          description,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      if (createdExpense?.id) {
        fetch('/api/apns-notify-expense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expense_id: createdExpense.id }),
        }).catch(() => undefined);
      }

      toast.success('Expense request submitted');
      setIsDialogOpen(false);
      setAmount('');
      setCategory('');
      setDescription('');
      setSelectedChildId('');
      fetchExpenses();
    } catch (error) {
      toast.error('Failed to submit request');
      if (import.meta.env.DEV) {
        console.error('Error submitting expense request:', error);
      }
    }
  };

  const handleSendMoney = async () => {
    if (!canTopUpCards) {
      toast.error('You do not have permission to send money');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to send money');
      return;
    }

    if (!sendMoneyCardId) {
      toast.error('Select a balance category to send money to');
      return;
    }

    const amountNum = parseFloat(sendMoneyAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Enter a positive amount');
      return;
    }

    setIsSendingMoney(true);
    try {
      const response = await fetch('/api/yoco-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          card_id: sendMoneyCardId,
          amount: amountNum,
          currency,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to start payment');
      }

      const data = await response.json();
      if (!data?.checkout_url) {
        throw new Error('Missing checkout URL');
      }

      window.location.href = data.checkout_url;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error sending money:', error);
      }
      toast.error('Unable to start payment');
    } finally {
      setIsSendingMoney(false);
    }
  };

  const handlePayAndApproveExpense = async (expenseId: string) => {
    if (!canApproveExpenses) {
      toast.error('Only parents can approve expenses');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to approve expenses');
      return;
    }

    const expense = expenses.find(e => e.id === expenseId) || allExpenses.find(e => e.id === expenseId);
    if (!expense) {
      toast.error('Expense request not found');
      return;
    }

    if (expense.requester_id === user.id) {
      toast.error('You cannot approve your own expense request');
      return;
    }

    const canApprove = await canUserApproveExpense(expense);
    if (!canApprove) {
      toast.error('You can only approve expenses for your children');
      return;
    }

    setPayingExpenseId(expenseId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/yoco-expense-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ expense_id: expenseId }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to start approval payment');
      }

      const data = await response.json();
      if (!data?.checkout_url) {
        throw new Error('Missing checkout URL');
      }

      window.location.href = data.checkout_url;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error starting expense approval payment:', error);
      }
      toast.error('Unable to start payment for approval');
      fetchExpenses();
    } finally {
      setPayingExpenseId(null);
    }
  };

  const canUserApproveExpense = async (expense: ExpenseRequest): Promise<boolean> => {
    if (!user || !canApproveExpenses) return false;

    // CRITICAL: Prevent self-approval
    if (expense.requester_id === user.id) {
      return false;
    }

    // User must be parent or co-parent of the child
    if (!expense.child_id) return false;

    try {
      const { data: child } = await supabase
        .from('children')
        .select('parent_id, co_parent_id')
        .eq('id', expense.child_id)
        .single();

      if (!child) return false;

      // Check if user is parent or co-parent
      return child.parent_id === user.id || child.co_parent_id === user.id;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error checking approval permission:', error);
      }
      return false;
    }
  };

  const handleRejectExpense = async (expenseId: string) => {
    if (!canApproveExpenses) {
      toast.error('Only parents can reject expenses');
      return;
    }

    // Get expense to validate
    const expense = expenses.find(e => e.id === expenseId) || allExpenses.find(e => e.id === expenseId);
    if (!expense) {
      toast.error('Expense request not found');
      return;
    }

    // CRITICAL: Prevent self-rejection (though less critical, still good to prevent)
    if (expense.requester_id === user?.id) {
      toast.error('You cannot reject your own expense request');
      return;
    }

    // Verify user can reject (is parent/co-parent of child)
    const canReject = await canUserApproveExpense(expense);
    if (!canReject) {
      toast.error('You can only reject expenses for your children');
      return;
    }

    try {
      // Use secure RPC function instead of direct UPDATE
      const { error } = await (supabase.rpc as any)('reject_expense_request', {
        p_request_id: expenseId,
        p_rejector_id: user?.id,
      });

      if (error) throw error;

      toast.success('Expense request rejected');
      fetchExpenses();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reject request');
      if (import.meta.env.DEV) {
        console.error('Error rejecting expense:', error);
      }
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
        <div className="flex gap-2">
          {canTopUpCards && (
            <Dialog open={isSendMoneyOpen} onOpenChange={setIsSendMoneyOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Send Money</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Money</DialogTitle>
                  <DialogDescription>Pay with Yoco to top up a balance category.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="balance-category">Balance Category</Label>
                    <Select value={sendMoneyCardId} onValueChange={setSendMoneyCardId}>
                      <SelectTrigger id="balance-category">
                        <SelectValue placeholder="Select balance category" />
                      </SelectTrigger>
                      <SelectContent>
                        {balanceCategories.map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            {card.card_type} - {card.child?.name || 'Family Wallet'} ({formatCurrency(card.balance, currency)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="send-amount">Amount ({getCurrencySymbol(currency)})</Label>
                    <Input
                      id="send-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={sendMoneyAmount}
                      onChange={(e) => setSendMoneyAmount(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSendMoney} className="w-full" disabled={isSendingMoney || !sendMoneyCardId}>
                    {isSendingMoney ? 'Processing...' : 'Pay with Yoco'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canCreateExpenseRequests && (
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
              {isParent && (
                <div className="space-y-2">
                  <Label htmlFor="child">Child *</Label>
                  {childrenList.length > 0 ? (
                    <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select child" />
                      </SelectTrigger>
                      <SelectContent>
                        {childrenList.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 rounded-lg border border-dashed bg-muted/50">
                      <p className="text-sm text-muted-foreground text-center">
                        No children added yet. Please add a child first from the Dashboard.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({getCurrencySymbol(currency)})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100000"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Enter a positive amount up to {formatCurrency(100000, currency)}</p>
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
              <Button onClick={handleSubmitRequest} className="w-full" disabled={isParent && !selectedChildId}>
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
          )}
        </div>
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
          expenses.map((expense) => {
            const canApprove =
              isParent &&
              expense.status === 'pending' &&
              expense.requester_id !== user?.id;
            const paymentStatus = expense.payment_status || 'unpaid';
            const isPaymentPending = paymentStatus === 'pending';
            const isPaid = paymentStatus === 'paid';
            return (
              <Card 
                key={expense.id} 
                className="shadow-soft transition-all duration-300 hover:shadow-lg hover:border-primary/20"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl">{formatCurrency(expense.amount, currency)}</CardTitle>
                      <CardDescription className="mt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{expense.category}</Badge>
                          {expense.child?.name && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {expense.child.name}
                            </Badge>
                          )}
                          {expense.status === 'approved' && (
                            <Badge variant="secondary">Approved</Badge>
                          )}
                          {isPaid && (
                            <Badge className="bg-success/10 text-success">Paid</Badge>
                          )}
                          {isPaymentPending && (
                            <Badge className="bg-warning/10 text-warning">Payment pending</Badge>
                          )}
                        </div>
                      </CardDescription>
                      {expense.requester && expense.requester_id !== user?.id && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <span>Requested by:</span>
                          <span className="font-medium">
                            {expense.requester.full_name || expense.requester.email || 'Unknown'}
                          </span>
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusBadge(expense.status)}>
                      {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{expense.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span>Submitted {format(new Date(expense.created_at), 'MMM dd, yyyy')}</span>
                    {expense.status === 'pending' && expense.requester_id === user?.id && (
                      <span className="text-warning">⏳ Waiting for approval</span>
                    )}
                  </div>
                  {canApprove && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        size="sm" 
                        onClick={() => handlePayAndApproveExpense(expense.id)}
                        disabled={isPaymentPending || payingExpenseId === expense.id}
                        className="flex-1"
                      >
                        {payingExpenseId === expense.id ? 'Processing...' : 'Pay & Approve'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleRejectExpense(expense.id)}
                        className="flex-1"
                        disabled={isPaymentPending || payingExpenseId === expense.id}
                      >
                        ✗ Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Expenses;
