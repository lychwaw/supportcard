import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet } from 'lucide-react';
import { ChildManagement } from '@/components/ChildManagement';
import { AccountSwitcher } from '@/components/AccountSwitcher';

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

const Index = () => {
  const { user } = useAuth();
  const { activeChildId, isParent, children: roleChildren } = useRole();
  const [children, setChildren] = useState<Child[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlySpending, setMonthlySpending] = useState(0);
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
          const { data: childrenData } = await supabase
            .from('children')
            .select('*')
            .eq('parent_id', user.id);
          
          if (childrenData) setChildren(childrenData);
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
          .select('amount')
          .eq('user_id', queryUserId)
          .gte('transaction_date', startOfMonth.toISOString());
        
        if (monthlyData) {
          const spending = monthlyData.reduce((sum, t) => sum + Number(t.amount), 0);
          setMonthlySpending(spending);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
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
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Across all cards</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlySpending.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Children</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{children.length}</div>
            <p className="text-xs text-muted-foreground">Managed accounts</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
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

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest payment activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{transaction.merchant_name || 'Transaction'}</p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.category || 'Uncategorized'}
                      </p>
                    </div>
                    <span className="font-semibold text-destructive">
                      -${transaction.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
