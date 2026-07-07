import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Receipt, Plus, Edit, Trash2, User, Calendar, FileText, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  amount: number;
  merchant_name: string | null;
  category: string | null;
  transaction_date: string;
  location: string | null;
  notes: string | null;
  logged_by: string | null;
  transaction_type: 'past' | 'future' | 'planned';
  is_parent_logged: boolean;
  child_id: string | null;
  card_id: string | null;
  user_id: string;
  children?: {
    id: string;
    name: string;
  };
  profiles?: {
    id: string;
    full_name: string;
  };
}

const Transactions = () => {
  const { user } = useAuth();
  const { activeChildId, children, isParent, isChild } = useRole();
  const { currency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'parent' | 'child'>('all');
  const [childrenList, setChildrenList] = useState<any[]>([]);

  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'past' | 'future' | 'planned'>('past');

  const categoryOptions = ['Food', 'Clothing', 'School', 'Activities', 'Transportation', 'Healthcare', 'Entertainment', 'Other'];

  useEffect(() => {
    if (!user) return;

    fetchTransactions();
    fetchChildrenList();

    // Real-time: refresh whenever any transaction for this user is inserted/updated/deleted
    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => fetchTransactions()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeChildId]);

  const fetchChildrenList = async () => {
    if (!user) return;
    try {
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name, parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
      if (childrenData) {
        setChildrenList(childrenData);
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Fetch all transactions for this user and their children
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          children:child_id(id, name),
          profiles:logged_by(id, full_name)
        `)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        // Don't show error toast - empty results are not errors
        setTransactions([]);
        return;
      }
      
      // Set transactions (empty array if no data, which is fine - no error)
      setTransactions((data || []) as Transaction[]);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      // Only show error for real database/network errors
      // Empty results or "no rows" are not errors - they're just empty state
      const isRealError = error?.code && 
        error.code !== 'PGRST116' && 
        !error.message?.includes('multiple') &&
        !error.message?.includes('no rows');
      
      if (isRealError) {
        toast.error('Failed to load transactions');
      }
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!user || !merchantName || !amount || !transactionDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          logged_by: user.id,
          merchant_name: merchantName,
          amount: amountNum,
          category: category || null,
          transaction_date: transactionDate,
          location: location || null,
          notes: notes || null,
          transaction_type: transactionType,
          is_parent_logged: isParent,
          child_id: selectedChildId || activeChildId || null,
        });

      if (error) throw error;

      toast.success('Transaction logged successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchTransactions();
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      toast.error(error?.message || 'Failed to log transaction');
    }
  };

  const handleEditTransaction = async () => {
    if (!editingTransaction || !merchantName || !amount || !transactionDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Children cannot edit parent-logged transactions
    if (isChild && editingTransaction.is_parent_logged && editingTransaction.logged_by !== user?.id) {
      toast.error('You cannot edit transactions logged by parents');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          merchant_name: merchantName,
          amount: amountNum,
          category: category || null,
          transaction_date: transactionDate,
          location: location || null,
          notes: notes || null,
          transaction_type: transactionType,
          child_id: selectedChildId || null,
        })
        .eq('id', editingTransaction.id);

      if (error) throw error;

      toast.success('Transaction updated successfully');
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      resetForm();
      fetchTransactions();
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast.error(error?.message || 'Failed to update transaction');
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deletingTransaction) return;

    // Children cannot delete parent-logged transactions
    if (isChild && deletingTransaction.is_parent_logged && deletingTransaction.logged_by !== user?.id) {
      toast.error('You cannot delete transactions logged by parents');
      setIsDeleteDialogOpen(false);
      setDeletingTransaction(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', deletingTransaction.id);

      if (error) throw error;

      toast.success('Transaction deleted successfully');
      setIsDeleteDialogOpen(false);
      setDeletingTransaction(null);
      fetchTransactions();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error(error?.message || 'Failed to delete transaction');
    }
  };

  const resetForm = () => {
    setMerchantName('');
    setAmount('');
    setCategory('');
    setTransactionDate('');
    setLocation('');
    setNotes('');
    setSelectedChildId('');
    setTransactionType('past');
  };

  const openEditDialog = (transaction: Transaction) => {
    // Check if child can edit
    if (isChild && transaction.is_parent_logged && transaction.logged_by !== user?.id) {
      toast.error('You cannot edit transactions logged by parents');
      return;
    }

    setEditingTransaction(transaction);
    setMerchantName(transaction.merchant_name || '');
    setAmount(transaction.amount.toString());
    setCategory(transaction.category || '');
    setTransactionDate(transaction.transaction_date.split('T')[0]);
    setLocation(transaction.location || '');
    setNotes(transaction.notes || '');
    setSelectedChildId(transaction.child_id || '');
    setTransactionType(transaction.transaction_type);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  const getCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      Food: 'bg-success/10 text-success',
      Clothing: 'bg-primary/10 text-primary',
      School: 'bg-accent/10 text-accent',
      Activities: 'bg-warning/10 text-warning',
      Transportation: 'bg-info/10 text-info',
      Healthcare: 'bg-destructive/10 text-destructive',
      Entertainment: 'bg-purple-500/10 text-purple-500',
      Other: 'bg-muted text-muted-foreground',
    };
    return colors[category || 'Other'] || 'bg-muted text-muted-foreground';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      past: 'bg-muted text-muted-foreground',
      future: 'bg-warning/10 text-warning',
      planned: 'bg-info/10 text-info',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  // Filter transactions based on active tab
  const filteredTransactions = useMemo(() => {
    let scoped = transactions;

    if (activeChildId) {
      scoped = scoped.filter(t => t.child_id === activeChildId);
    }

    if (activeTab === 'all') return scoped;
    if (activeTab === 'parent') return scoped.filter(t => t.is_parent_logged);
    if (activeTab === 'child') return scoped.filter(t => !t.is_parent_logged);
    return scoped;
  }, [transactions, activeTab, activeChildId]);

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
          <Receipt className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Transaction Log</h1>
            <p className="text-muted-foreground">Document all transactions for legal records and communication</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={() => { resetForm(); setTransactionDate(new Date().toISOString().split('T')[0]); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Log Transaction
          </Button>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Transaction</DialogTitle>
              <DialogDescription>
                {isChild 
                  ? 'Log a transaction when you used your card'
                  : 'Log a past, future, or planned transaction'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {isParent && (
                <div className="space-y-2">
                  <Label htmlFor="transactionType">Transaction Type *</Label>
                  <Select value={transactionType} onValueChange={(v: 'past' | 'future' | 'planned') => setTransactionType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="past">Past (Completed)</SelectItem>
                      <SelectItem value="future">Future (Scheduled)</SelectItem>
                      <SelectItem value="planned">Planned (Proposed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isParent && childrenList.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="child">Child (Optional)</Label>
                  <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select child (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Family Transaction</SelectItem>
                      {childrenList.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant/Description *</Label>
                <Input
                  id="merchant"
                  placeholder="e.g., Walmart, School Lunch, Gas Station"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ({currency}) *</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = value.split('.');
                      const normalized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                      setAmount(normalized);
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (Optional)</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Store Address, City"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional details for legal documentation..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleAddTransaction} className="w-full" disabled={!merchantName || !amount || !transactionDate}>
                Log Transaction
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AccountSwitcher />

      {/* Tabs for filtering */}
      {isParent && (
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="parent">Parent Logged</TabsTrigger>
            <TabsTrigger value="child">Child Logged</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {isParent 
              ? 'Complete record of all transactions for legal documentation'
              : 'Your logged transactions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No transactions found</p>
              <Button onClick={() => { resetForm(); setTransactionDate(new Date().toISOString().split('T')[0]); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Log Your First Transaction
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Logged By</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const canEdit = !isChild || (transaction.logged_by === user?.id);
                  return (
                    <TableRow key={transaction.id} className="transition-colors hover:bg-muted/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(transaction.transaction_date), 'h:mm a')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.merchant_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(transaction.category)}>
                          {transaction.category || 'Uncategorized'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isParent && (
                          <Badge className={getTypeColor(transaction.transaction_type)}>
                            {transaction.transaction_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {transaction.is_parent_logged ? (
                            <>
                              <User className="w-4 h-4 text-primary" />
                              <span className="text-sm">Parent</span>
                            </>
                          ) : (
                            <>
                              <User className="w-4 h-4 text-success" />
                              <span className="text-sm">Child</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {transaction.location || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-destructive">
                          -{formatCurrency(transaction.amount, currency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!canEdit && (
                            <Lock className="w-4 h-4 text-muted-foreground" title="Cannot edit parent transactions" />
                          )}
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(transaction)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(transaction)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Update transaction details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isParent && (
              <div className="space-y-2">
                <Label htmlFor="editTransactionType">Transaction Type *</Label>
                <Select value={transactionType} onValueChange={(v: 'past' | 'future' | 'planned') => setTransactionType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="past">Past (Completed)</SelectItem>
                    <SelectItem value="future">Future (Scheduled)</SelectItem>
                    <SelectItem value="planned">Planned (Proposed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isParent && childrenList.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="editChild">Child (Optional)</Label>
                <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select child (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Family Transaction</SelectItem>
                    {childrenList.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="editMerchant">Merchant/Description *</Label>
              <Input
                id="editMerchant"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editAmount">Amount ({currency}) *</Label>
                <Input
                  id="editAmount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = value.split('.');
                    const normalized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                    setAmount(normalized);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCategory">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDate">Date *</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLocation">Location (Optional)</Label>
                <Input
                  id="editLocation"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes (Optional)</Label>
              <Textarea
                id="editNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={handleEditTransaction} className="w-full" disabled={!merchantName || !amount || !transactionDate}>
              Update Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone and will remove it from legal records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Transactions;
