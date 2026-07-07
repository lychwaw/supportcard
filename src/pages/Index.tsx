import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Tag, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ChildManagement } from '@/components/ChildManagement';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { Notifications } from '@/components/Notifications';

interface Child {
  id: string;
  name: string;
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

interface ActivityItem {
  id: string;
  status: string | null;
  category: string;
  description: string | null;
  amount: number;
  created_at: string | null;
  requester?: { full_name: string | null } | null;
}

const Index = () => {
  const { user } = useAuth();
  const { activeChildId, isParent, isChild, children: roleChildren } = useRole();
  const { currency } = useCurrency();
  const [children, setChildren] = useState<Child[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
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

        // Child role: Neutral Activity Feed — what was spent on them and its
        // approval status. Never a balance or wallet figure, just the record.
        if (isChild && activeChildId) {
          const { data: feedData } = await supabase
            .from('expense_requests')
            .select('id, status, category, description, amount, created_at, profiles:requester_id(full_name)')
            .eq('child_id', activeChildId)
            .order('created_at', { ascending: false })
            .limit(8);

          if (feedData) {
            setActivityFeed(
              (feedData as any[]).map(f => ({
                id: f.id,
                status: f.status,
                category: f.category,
                description: f.description,
                amount: f.amount,
                created_at: f.created_at,
                requester: f.profiles,
              }))
            );
          }
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
  }, [user, activeChildId, isParent, isChild, roleChildren]);

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

      {/* Financial summary — parents only. Children never see a spending or balance figure. */}
      {isParent && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Spending</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(monthlySpending, currency)}</div>
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
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isParent ? (
          <ChildManagement />
        ) : (
          <Card className="shadow-soft md:col-span-2">
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>What's been logged for your care</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activityFeed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                activityFeed.map((item) => {
                  const who = item.requester?.full_name || 'A parent';
                  const what = item.description || item.category;
                  const cost = formatCurrency(item.amount, currency);
                  return (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {item.status === 'approved' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" aria-hidden="true" />
                      ) : item.status === 'rejected' ? (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm">
                          {item.status === 'approved' ? (
                            <>{who}'s receipt for <span className="font-medium">{what}</span> — {cost} <span className="text-muted-foreground">was approved</span></>
                          ) : item.status === 'rejected' ? (
                            <>{who}'s receipt for <span className="font-medium">{what}</span> — {cost} <span className="text-muted-foreground">was disputed</span></>
                          ) : (
                            <>{who} submitted a receipt for <span className="font-medium">{what}</span> — {cost} <span className="text-muted-foreground">(pending approval)</span></>
                          )}
                        </p>
                        {item.created_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(item.created_at), 'dd MMM yyyy')}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {isParent && (
          <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest logged activity</CardDescription>
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
                        -{formatCurrency(transaction.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isParent && categorySpending.length > 0 && (
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
                          <span className="text-sm font-semibold">{formatCurrency(item.amount, currency)}</span>
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
