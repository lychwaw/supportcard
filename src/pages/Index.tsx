import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ChildManagement } from '@/components/ChildManagement';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { Notifications } from '@/components/Notifications';

interface Child {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
}

interface Transaction {
  id: string;
  amount: number;
  merchant_name: string;
  category: string;
  transaction_date: string;
}

interface CategorySpending {
  category: string;
  amount: number;
}

const Index = () => {
  const { user } = useAuth();
  const { activeChildId, isParent, children: roleChildren } = useRole();
  const [children, setChildren] = useState<Child[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Determine which user_id to query based on role
        const queryUserId = activeChildId ? roleChildren.find(c => c.id === activeChildId)?.user_id : user.id;
        
        if (!queryUserId) {
          setLoading(false);
          return;
        }

        // Fetch children (only for parents)
        if (isParent) {
          // Get user's family_id to find shared children
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('family_id')
            .eq('id', user.id)
            .single();

          // Fetch children where user is parent OR co-parent
          const { data: childrenData, error: childrenError } = await supabase
            .from('children')
            .select('*')
            .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
          
          if (childrenError) {
            console.error('Error fetching children:', childrenError);
          }
          
          // Also fetch children from family members if family_id exists
          if (userProfile?.family_id) {
            const { data: familyChildren } = await supabase
              .from('children')
              .select('*, profiles!parent_id(family_id)')
              .eq('profiles.family_id', userProfile.family_id);
            
            // Merge results (deduplicate by id)
            const allChildren = [...(childrenData || []), ...(familyChildren || [])];
            const uniqueChildren = Array.from(
              new Map(allChildren.map(child => [child.id, child])).values()
            );
            setChildren(uniqueChildren);
          } else {
            if (childrenData) {
              setChildren(childrenData);
            } else {
              setChildren([]);
            }
          }
        } else {
          // For child view, show only the active child
          const child = roleChildren.find(c => c.id === activeChildId);
          if (child) {
            const { data: childData } = await supabase
              .from('children')
              .select('*')
              .eq('id', child.id)
              .single();
            
            if (childData) setChildren([childData]);
          }
        }

        // Fetch recent transactions
        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', queryUserId)
          .order('transaction_date', { ascending: false })
          .limit(5);
        
        if (transactionsData) setRecentTransactions(transactionsData);

        // Fetch virtual cards to calculate total balance
        const { data: cardsData } = await supabase
          .from('virtual_cards')
          .select('balance')
          .eq('user_id', queryUserId);
        
        if (cardsData) {
          const total = cardsData.reduce((sum, card) => sum + Number(card.balance), 0);
          setTotalBalance(total);
        }

        // Calculate monthly spending
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: monthlyData } = await supabase
          .from('transactions')
          .select('amount, category')
          .eq('user_id', queryUserId)
          .gte('transaction_date', startOfMonth.toISOString());
        
        if (monthlyData) {
          const spending = monthlyData.reduce((sum, t) => sum + Number(t.amount), 0);
          setMonthlySpending(spending);

          // Calculate spending by category
          const categoryMap = new Map<string, number>();
          monthlyData.forEach(t => {
            const category = t.category || 'Uncategorized';
            const current = categoryMap.get(category) || 0;
            categoryMap.set(category, current + Number(t.amount));
          });

          const categories = Array.from(categoryMap.entries())
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);
          
          setCategorySpending(categories);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Listen for children updates from ChildManagement component
    const handleChildrenUpdate = () => {
      fetchDashboardData();
    };

    window.addEventListener('children-updated', handleChildrenUpdate);

    return () => {
      window.removeEventListener('children-updated', handleChildrenUpdate);
    };
  }, [user, activeChildId, isParent, roleChildren]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your family's finances at a glance</p>
      </div>

      <AccountSwitcher />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Across all cards</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlySpending.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Children</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{children.length}</div>
            <p className="text-xs text-muted-foreground">Managed accounts</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentTransactions.length}</div>
            <p className="text-xs text-muted-foreground">Recent activity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isParent ? (
          <ChildManagement />
        ) : (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Support Target</CardTitle>
              <CardDescription>Track your support payment progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data available</p>
              ) : (
                children.map((child) => {
                  const progress = (child.current_amount / child.target_amount) * 100;
                  return (
                    <div key={child.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{child.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ${child.current_amount.toFixed(2)} / ${child.target_amount.toFixed(2)}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {progress >= 100 ? 'Target fully paid' : `${progress.toFixed(0)}% complete`}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest payment activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex-1">
                      <p className="font-medium group-hover:text-primary transition-colors">
                        {transaction.merchant_name || 'Transaction'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {transaction.category || 'Uncategorized'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(transaction.transaction_date), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold text-destructive ml-2">
                      -${transaction.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {categorySpending.length > 0 && (
          <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Expense Categories
              </CardTitle>
              <CardDescription>Spending breakdown by category this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categorySpending.map((item) => {
                  const percentage = monthlySpending > 0 
                    ? (item.amount / monthlySpending) * 100 
                    : 0;
                  return (
                    <div 
                      key={item.category} 
                      className="space-y-2 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="group-hover:border-primary transition-colors">
                            {item.category}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold">${item.amount.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2 group-hover:h-2.5 transition-all" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Notifications />
      </div>
    </div>
  );
};

export default Index;
