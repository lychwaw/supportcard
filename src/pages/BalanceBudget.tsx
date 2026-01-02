import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Plus, TrendingUp, ArrowUpCircle, Edit, AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AccountSwitcher } from '@/components/AccountSwitcher';

interface BalanceCategory {
  id: string;
  card_type: string; // Category name (School Money, Allowance, etc.)
  balance: number; // Current available balance
  monthly_limit: number; // Budget limit for the month
  current_spent: number; // Amount spent this month (from budget_categories)
  child_id: string | null;
  child?: {
    id: string;
    name: string;
  };
}

const BalanceBudget = () => {
  const { user } = useAuth();
  const { activeChildId, children, isParent } = useRole();
  const { canManageCards, canTopUpCards } = usePermissions();
  const { currency } = useCurrency();
  const [categories, setCategories] = useState<BalanceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BalanceCategory | null>(null);
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [categoryName, setCategoryName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const categoryOptions = ['School Money', 'Allowance', 'Lunch Money', 'Activities', 'Transportation', 'General'];

  useEffect(() => {
    if (user) {
      fetchChildrenList();
      fetchCategories();
    }
  }, [user, activeChildId, children]);

  const fetchChildrenList = async () => {
    if (!user) return;
    try {
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name, parent_id, co_parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
      if (childrenData) {
        setChildrenList(childrenData);
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;

    try {
      const queryUserId = activeChildId 
        ? children.find(c => c.id === activeChildId)?.user_id 
        : user.id;

      if (!queryUserId) {
        setLoading(false);
        return;
      }

      // Fetch balance categories (virtual_cards)
      const { data: cardsData, error: cardsError } = await supabase
        .from('virtual_cards')
        .select(`
          *,
          children:child_id(id, name)
        `)
        .eq('user_id', queryUserId)
        .order('created_at', { ascending: false });

      // Fetch budget categories
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('user_id', queryUserId);

      if (cardsError) console.error('Error fetching cards:', cardsError);
      if (budgetsError) console.error('Error fetching budgets:', budgetsError);

      // Merge balance and budget data
      const mergedCategories: BalanceCategory[] = [];
      
      // Process balance categories
      if (cardsData) {
        cardsData.forEach((card: any) => {
          const budget = budgetsData?.find(b => 
            b.category === card.card_type && 
            (b.child_id === card.child_id || (!b.child_id && !card.child_id))
          );
          
          mergedCategories.push({
            id: card.id,
            card_type: card.card_type,
            balance: Number(card.balance || 0),
            monthly_limit: budget ? Number(budget.monthly_limit || 0) : 0,
            current_spent: budget ? Number(budget.current_spent || 0) : 0,
            child_id: card.child_id,
            child: card.children,
          });
        });
      }

      // Add budget categories that don't have balance entries
      if (budgetsData) {
        budgetsData.forEach((budget: any) => {
          const exists = mergedCategories.find(c => 
            c.card_type === budget.category && 
            (c.child_id === budget.child_id || (!c.child_id && !budget.child_id))
          );
          
          if (!exists) {
            mergedCategories.push({
              id: budget.id,
              card_type: budget.category,
              balance: 0,
              monthly_limit: Number(budget.monthly_limit || 0),
              current_spent: Number(budget.current_spent || 0),
              child_id: budget.child_id,
            });
          }
        });
      }

      setCategories(mergedCategories);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      const errorMessage = error?.message || 'Failed to load balance and budget data';
      toast.error(`Error loading data: ${errorMessage}. Please refresh the page.`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to normalize and validate numeric input
  const normalizeNumberInput = (value: string, fieldName: string): { valid: boolean; number: number; error?: string } => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      return { valid: false, number: 0, error: `${fieldName} cannot be empty` };
    }

    // Remove leading zeros (but keep at least one zero if input is all zeros)
    const normalized = trimmed.replace(/^0+/, '') || '0';
    const num = parseFloat(normalized);

    if (isNaN(num)) {
      return { valid: false, number: 0, error: `${fieldName} must be a valid number` };
    }

    if (num < 0) {
      return { valid: false, number: 0, error: `${fieldName} cannot be negative` };
    }

    if (num > 1000000) {
      return { valid: false, number: 0, error: `${fieldName} cannot exceed 1,000,000` };
    }

    return { valid: true, number: num };
  };

  const handleCreateCategory = async () => {
    if (!canManageCards) {
      toast.error('Only parents can create balance categories');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to create categories');
      return;
    }

    if (!categoryName) {
      toast.error('Please select a category name');
      return;
    }

    if (!initialBalance || !initialBalance.trim()) {
      toast.error('Please enter an initial balance');
      return;
    }

    // Validate and normalize balance
    const balanceValidation = normalizeNumberInput(initialBalance, 'Balance');
    if (!balanceValidation.valid) {
      toast.error(balanceValidation.error || 'Invalid balance amount');
      return;
    }
    const balanceNum = balanceValidation.number;

    // Validate and normalize monthly limit (optional)
    let limitNum = 0;
    if (monthlyLimit && monthlyLimit.trim()) {
      const limitValidation = normalizeNumberInput(monthlyLimit, 'Monthly limit');
      if (!limitValidation.valid) {
        toast.error(limitValidation.error || 'Invalid monthly limit');
        return;
      }
      limitNum = limitValidation.number;
    }

    if (!selectedChildId && childrenList.length > 0) {
      toast.error('Please select a child for this category');
      return;
    }

    setIsProcessing(true);
    try {
      const balanceId = `BAL-${Date.now().toString().slice(-6)}`;
      const cardUserId = user.id;

      // Create balance category
      const { error: cardError, data: cardData } = await supabase
        .from('virtual_cards')
        .insert({
          user_id: cardUserId,
          child_id: selectedChildId || null,
          card_number: balanceId,
          card_type: categoryName,
          balance: balanceNum,
          is_primary: categories.length === 0,
        })
        .select()
        .single();

      if (cardError) {
        console.error('Card creation error:', cardError);
        let errorMessage = 'Failed to create balance category';
        
        if (cardError.code === '23503') {
          errorMessage = 'Invalid child selected. Please refresh the page and try again.';
        } else if (cardError.code === '23505') {
          errorMessage = 'A balance category with this name already exists for this child.';
        } else if (cardError.code === '23514') {
          errorMessage = 'Invalid balance amount. Please check your input.';
        } else if (cardError.message) {
          errorMessage = `Failed to create category: ${cardError.message}`;
        }
        
        toast.error(errorMessage);
        setIsProcessing(false);
        return;
      }

      // Create budget category if limit is set
      if (limitNum > 0) {
        const { error: budgetError } = await supabase
          .from('budget_categories')
          .insert({
            user_id: cardUserId,
            child_id: selectedChildId || null,
            category: categoryName,
            monthly_limit: limitNum,
            current_spent: 0,
          });

        if (budgetError) {
          console.error('Budget creation error:', budgetError);
          // Warn but don't fail the whole operation if budget creation fails
          toast.warning('Balance category created, but failed to set budget limit. You can set it later.');
        }
      }

      toast.success('Balance category created successfully');
      setIsDialogOpen(false);
      setCategoryName('');
      setInitialBalance('');
      setMonthlyLimit('');
      setSelectedChildId('');
      fetchCategories();
    } catch (error: any) {
      console.error('Error creating category:', error);
      const errorMessage = error?.message || 'Failed to create balance category. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTopUp = async () => {
    if (!canTopUpCards || !selectedCategory) {
      toast.error('You do not have permission to add money');
      return;
    }

    if (!topUpAmount || !topUpAmount.trim()) {
      toast.error('Please enter an amount to add');
      return;
    }

    // Validate and normalize amount
    const amountValidation = normalizeNumberInput(topUpAmount, 'Amount');
    if (!amountValidation.valid || amountValidation.number <= 0) {
      toast.error('Please enter a positive amount');
      return;
    }
    const amount = amountValidation.number;

    setIsProcessing(true);
    try {
      // Use atomic update to prevent race conditions
      const { error } = await supabase.rpc('update_balance', {
        p_card_id: selectedCategory.id,
        p_amount: amount,
      }).catch(async () => {
        // Fallback to direct update if RPC doesn't exist
        const { data: currentCard } = await supabase
          .from('virtual_cards')
          .select('balance')
          .eq('id', selectedCategory.id)
          .single();

        if (!currentCard) throw new Error('Balance category not found');

        const newBalance = Number(currentCard.balance || 0) + amount;

        return await supabase
          .from('virtual_cards')
          .update({ balance: newBalance })
          .eq('id', selectedCategory.id);
      });

      if (error) {
        console.error('Top-up error:', error);
        if (error.code === '23514') {
          throw new Error('Invalid amount. Please enter a valid number.');
        } else if (error.code === 'PGRST116') {
          throw new Error('Balance category not found. Please refresh and try again.');
        } else {
          throw new Error(`Failed to add money: ${error.message || 'Unknown error'}`);
        }
      }

      toast.success(`Added ${formatCurrency(amount, currency)} to ${selectedCategory.card_type}`);
      setIsTopUpDialogOpen(false);
      setTopUpAmount('');
      setSelectedCategory(null);
      
      // Force refresh to ensure UI updates
      await fetchCategories();
    } catch (error: any) {
      console.error('Error topping up:', error);
      const errorMessage = error?.message || 'Failed to add money. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateLimit = async () => {
    if (!canManageCards || !selectedCategory) {
      toast.error('You do not have permission to update budget limits');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to update budget limits');
      return;
    }

    // Normalize and validate input
    const trimmedLimit = editLimit.trim();
    if (!trimmedLimit) {
      toast.error('Please enter a monthly limit');
      return;
    }

    // Remove leading zeros and parse
    const normalizedLimit = trimmedLimit.replace(/^0+/, '') || '0';
    const limitNum = parseFloat(normalizedLimit);

    if (isNaN(limitNum) || limitNum < 0) {
      toast.error('Monthly limit must be a valid number (0 or greater)');
      return;
    }

    // Check for unreasonably large numbers
    if (limitNum > 1000000) {
      toast.error('Monthly limit cannot exceed 1,000,000');
      return;
    }

    setIsProcessing(true);
    try {
      const queryUserId = activeChildId 
        ? children.find(c => c.id === activeChildId)?.user_id 
        : user.id;

      if (!queryUserId) {
        toast.error('Unable to determine user account. Please refresh and try again.');
        setIsProcessing(false);
        return;
      }

      // Build query with proper null handling for child_id
      let budgetQuery = supabase
        .from('budget_categories')
        .select('id')
        .eq('user_id', queryUserId)
        .eq('category', selectedCategory.card_type);

      // Handle null child_id properly - use is() for null comparison
      if (selectedCategory.child_id) {
        budgetQuery = budgetQuery.eq('child_id', selectedCategory.child_id);
      } else {
        budgetQuery = budgetQuery.is('child_id', null);
      }

      const { data: existingBudget, error: queryError } = await budgetQuery.maybeSingle();

      if (queryError) {
        console.error('Error querying budget:', queryError);
        throw new Error(`Failed to check existing budget: ${queryError.message}`);
      }

      if (existingBudget) {
        // Update existing budget
        const { error: updateError } = await supabase
          .from('budget_categories')
          .update({ 
            monthly_limit: limitNum,
            // Reset current_spent if limit is set to 0 (removing budget)
            ...(limitNum === 0 && { current_spent: 0 })
          })
          .eq('id', existingBudget.id);

        if (updateError) {
          console.error('Update error:', updateError);
          if (updateError.code === '23514') {
            throw new Error('Invalid budget limit. Please enter a valid number.');
          } else if (updateError.code === '23503') {
            throw new Error('Budget category reference is invalid. Please refresh and try again.');
          } else {
            throw new Error(`Failed to update budget: ${updateError.message}`);
          }
        }
      } else {
        // Create new budget category only if limit > 0
        if (limitNum > 0) {
          const { error: insertError } = await supabase
            .from('budget_categories')
            .insert({
              user_id: queryUserId,
              child_id: selectedCategory.child_id || null,
              category: selectedCategory.card_type,
              monthly_limit: limitNum,
              current_spent: 0,
            });

          if (insertError) {
            console.error('Insert error:', insertError);
            if (insertError.code === '23505') {
              throw new Error('A budget for this category already exists. Please refresh and try again.');
            } else if (insertError.code === '23503') {
              throw new Error('Invalid child or user reference. Please refresh and try again.');
            } else {
              throw new Error(`Failed to create budget: ${insertError.message}`);
            }
          }
        } else {
          // Limit is 0, nothing to create
          toast.success('Budget limit removed');
          setIsEditDialogOpen(false);
          setEditLimit('');
          setSelectedCategory(null);
          setIsProcessing(false);
          await fetchCategories();
          return;
        }
      }

      toast.success(`Monthly limit ${existingBudget ? 'updated' : 'set'} to ${formatCurrency(limitNum, currency)}`);
      setIsEditDialogOpen(false);
      setEditLimit('');
      setSelectedCategory(null);
      
      // Force refresh to ensure UI updates
      await fetchCategories();
    } catch (error: any) {
      console.error('Error updating limit:', error);
      const errorMessage = error?.message || 'Failed to update monthly limit. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalBalance = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.balance, 0);
  }, [categories]);

  const totalBudget = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.monthly_limit, 0);
  }, [categories]);

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
          <Wallet className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Balance & Budget</h1>
            <p className="text-muted-foreground">Manage balances and monthly budgets by category</p>
          </div>
        </div>
        {isParent && canManageCards && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Balance Category</DialogTitle>
                <DialogDescription>
                  Create a new balance category with optional monthly budget limit
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {childrenList.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="child">Child *</Label>
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
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={categoryName} onValueChange={setCategoryName}>
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
                <div className="space-y-2">
                  <Label htmlFor="balance">Initial Balance ({getCurrencySymbol(currency)}) *</Label>
                  <Input
                    id="balance"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={initialBalance}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = value.split('.');
                      const normalized = parts.length > 2 
                        ? parts[0] + '.' + parts.slice(1).join('')
                        : value;
                      setInitialBalance(normalized);
                    }}
                    onBlur={(e) => {
                      const trimmed = e.target.value.trim();
                      if (trimmed) {
                        const normalized = trimmed.replace(/^0+/, '') || '0';
                        setInitialBalance(normalized);
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">Monthly Budget Limit ({getCurrencySymbol(currency)})</Label>
                  <Input
                    id="limit"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00 (optional)"
                    value={monthlyLimit}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = value.split('.');
                      const normalized = parts.length > 2 
                        ? parts[0] + '.' + parts.slice(1).join('')
                        : value;
                      setMonthlyLimit(normalized);
                    }}
                    onBlur={(e) => {
                      const trimmed = e.target.value.trim();
                      if (trimmed) {
                        const normalized = trimmed.replace(/^0+/, '') || '0';
                        setMonthlyLimit(normalized);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set a monthly spending limit for this category (optional)
                  </p>
                </div>
                <Button 
                  onClick={handleCreateCategory} 
                  className="w-full"
                  disabled={isProcessing || !categoryName || !initialBalance || (childrenList.length > 0 && !selectedChildId)}
                >
                  {isProcessing ? 'Creating...' : 'Create Category'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <AccountSwitcher />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance, currency)}</div>
            <p className="text-xs text-muted-foreground">Available across all categories</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget, currency)}</div>
            <p className="text-xs text-muted-foreground">Monthly budget limits</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">Active categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {categories.length === 0 ? (
          <Card className="col-span-full shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wallet className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No balance categories yet</p>
              {isParent && canManageCards && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Category
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          categories.map((category) => {
            // Budget calculation:
            // - balance = available money (can be topped up)
            // - monthly_limit = total budget for the month
            // - current_spent = amount spent this month (tracked separately)
            // - remaining = monthly_limit - current_spent (budget remaining)
            const spent = category.current_spent || 0;
            const usagePercentage = category.monthly_limit > 0 
              ? Math.min(100, (spent / category.monthly_limit) * 100)
              : 0;
            const remaining = category.monthly_limit > 0 
              ? category.monthly_limit - spent
              : category.balance;
            const isOverBudget = category.monthly_limit > 0 && spent > category.monthly_limit;
            const isNearLimit = category.monthly_limit > 0 && usagePercentage > 80 && !isOverBudget;

            return (
              <Card
                key={category.id}
                className={`shadow-soft hover:shadow-lg transition-all duration-300 border-2 ${
                  isOverBudget ? 'border-destructive/50' : isNearLimit ? 'border-warning/50' : 'border-border'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{category.card_type}</CardTitle>
                    <div className="flex items-center gap-2">
                      {isOverBudget ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Over Budget
                        </Badge>
                      ) : isNearLimit ? (
                        <Badge variant="outline" className="border-warning text-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Warning
                        </Badge>
                      ) : category.monthly_limit > 0 ? (
                        <Badge variant="outline" className="border-success text-success flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          On Track
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {category.child ? `${category.child.name}'s Balance` : 'Family Balance'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Balance Display */}
                  <div className="p-4 rounded-lg bg-gradient-primary text-primary-foreground">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm opacity-80">Available Balance</span>
                    </div>
                    <div className="text-3xl font-bold">
                      {formatCurrency(category.balance, currency)}
                    </div>
                  </div>

                  {/* Budget Progress */}
                  {category.monthly_limit > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Monthly Budget</span>
                        <span className="font-medium">
                          {formatCurrency(spent, currency)} / {formatCurrency(category.monthly_limit, currency)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(Math.max(usagePercentage, 0), 100)}
                        className={`h-3 ${
                          isOverBudget ? 'bg-destructive/20' : isNearLimit ? 'bg-warning/20' : ''
                        }`}
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${isOverBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {isOverBudget 
                            ? `${formatCurrency(Math.abs(remaining), currency)} over budget`
                            : `${formatCurrency(remaining, currency)} remaining`}
                        </span>
                        <span className="text-muted-foreground">
                          {usagePercentage.toFixed(0)}% used
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    {canTopUpCards && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedCategory(category);
                          setIsTopUpDialogOpen(true);
                        }}
                      >
                        <ArrowUpCircle className="w-4 h-4 mr-2" />
                        Add Money
                      </Button>
                    )}
                    {canManageCards && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedCategory(category);
                          // Initialize with current limit, or empty if no limit set
                          setEditLimit(category.monthly_limit > 0 ? category.monthly_limit.toString() : '');
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Set Budget
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Top Up Dialog */}
      <Dialog open={isTopUpDialogOpen} onOpenChange={setIsTopUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Money to Balance</DialogTitle>
            <DialogDescription>
              Add money to {selectedCategory?.card_type} balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topup">Amount ({getCurrencySymbol(currency)})</Label>
              <Input
                id="topup"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={topUpAmount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = value.split('.');
                  const normalized = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : value;
                  setTopUpAmount(normalized);
                }}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (trimmed) {
                    const normalized = trimmed.replace(/^0+/, '') || '0';
                    setTopUpAmount(normalized);
                  }
                }}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleTopUp} 
              disabled={isProcessing || !topUpAmount || parseFloat(topUpAmount) <= 0}
            >
              {isProcessing ? 'Processing...' : 'Add Money'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Budget Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Monthly Budget Limit</DialogTitle>
            <DialogDescription>
              Set monthly spending limit for {selectedCategory?.card_type}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editLimit">Monthly Limit ({getCurrencySymbol(currency)})</Label>
              <Input
                id="editLimit"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={editLimit}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = value.split('.');
                  const normalized = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : value;
                  setEditLimit(normalized);
                }}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (trimmed) {
                    const normalized = trimmed.replace(/^0+/, '') || '0';
                    setEditLimit(normalized);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 to remove budget limit
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={handleUpdateLimit} 
              disabled={isProcessing || !editLimit.trim()}
            >
              {isProcessing 
                ? 'Updating...' 
                : (editLimit === '0' || parseFloat(editLimit || '0') === 0) 
                  ? 'Remove Budget' 
                  : 'Update Limit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BalanceBudget;

