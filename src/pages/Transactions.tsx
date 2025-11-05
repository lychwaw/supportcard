import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { AccountSwitcher } from '@/components/AccountSwitcher';

interface Transaction {
  id: string;
  amount: number;
  merchant_name: string;
  category: string;
  transaction_date: string;
  location: string;
}

const Transactions = () => {
  const { user } = useAuth();
  const { activeChildId, children } = useRole();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
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
          .from('transactions')
          .select('*')
          .eq('user_id', queryUserId)
          .order('transaction_date', { ascending: false });

        if (error) throw error;
        if (data) setTransactions(data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user, activeChildId, children]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Food: 'bg-success/10 text-success',
      Clothing: 'bg-primary/10 text-primary',
      School: 'bg-accent/10 text-accent',
      Activities: 'bg-warning/10 text-warning',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
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
      <div className="flex items-center gap-2">
        <Receipt className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">View all your payment activity</p>
        </div>
      </div>

      <AccountSwitcher />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Complete history of payments and expenses</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow 
                    key={transaction.id}
                    className="transition-colors hover:bg-muted/50 cursor-pointer"
                  >
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
                    <TableCell className="text-muted-foreground">
                      {transaction.location || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-destructive">
                        -${transaction.amount.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Transactions;
