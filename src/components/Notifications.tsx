import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle, XCircle, DollarSign, MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Notification {
  id: string;
  type: 'transaction' | 'expense_request' | 'invite' | 'message';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

export const Notifications = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up real-time subscriptions
      const transactionChannel = supabase
        .channel('transaction-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        }, () => {
          fetchNotifications();
        })
        .subscribe();

      const expenseChannel = supabase
        .channel('expense-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'expense_requests',
        }, () => {
          fetchNotifications();
        })
        .subscribe();

      const messageChannel = supabase
        .channel('message-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(transactionChannel);
        supabase.removeChannel(expenseChannel);
        supabase.removeChannel(messageChannel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      // Fetch recent transactions for this user or their children
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, amount, merchant_name, category, transaction_date')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(5);

      // Fetch pending expense requests
      const { data: expenseRequests } = await supabase
        .from('expense_requests')
        .select('id, amount, category, description, status, created_at')
        .or(`requester_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch unread messages
      const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, read')
        .eq('receiver_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch pending invites
      const { data: invites } = await (supabase as any)
        .from('parent_invites')
        .select('id, invited_email, child_id, created_at')
        .eq('invited_email', user.email || '')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      // Combine into notifications
      const allNotifications: Notification[] = [];

      // Transaction notifications
      transactions?.forEach(t => {
        allNotifications.push({
          id: `txn_${t.id}`,
          type: 'transaction',
          title: 'New Transaction',
          message: `${formatCurrency(Number(t.amount), currency)} at ${t.merchant_name || 'Merchant'}`,
          read: false,
          created_at: t.transaction_date,
          data: t,
        });
      });

      // Expense request notifications
      expenseRequests?.forEach(e => {
        allNotifications.push({
          id: `expense_${e.id}`,
          type: 'expense_request',
          title: e.requester_id === user.id ? 'Expense Request Submitted' : 'New Expense Request',
          message: `${formatCurrency(Number(e.amount), currency)} for ${e.category}`,
          read: false,
          created_at: e.created_at || '',
          data: e,
        });
      });

      // Message notifications
      messages?.forEach(m => {
        allNotifications.push({
          id: `msg_${m.id}`,
          type: 'message',
          title: 'New Message',
          message: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : ''),
          read: m.read,
          created_at: m.created_at,
          data: m,
        });
      });

      // Invite notifications
      invites?.forEach(i => {
        allNotifications.push({
          id: `invite_${i.id}`,
          type: 'invite',
          title: 'Co-Parent Invitation',
          message: `You've been invited to manage a child profile`,
          read: false,
          created_at: i.created_at || '',
          data: i,
        });
      });

      // Sort by date and limit to 10 most recent
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications.slice(0, 10));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    // Update notification read status (if we had a notifications table)
    // For now, just remove from unread list
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'transaction':
        return <DollarSign className="w-4 h-4" />;
      case 'expense_request':
        return <CheckCircle className="w-4 h-4" />;
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'invite':
        return <Users className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
            <CardDescription>Stay updated on transactions and requests</CardDescription>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} new</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border transition-colors ${
                  notification.read 
                    ? 'bg-muted/50' 
                    : 'bg-background border-primary/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${notification.read ? 'text-muted-foreground' : 'text-primary'}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${notification.read ? 'text-muted-foreground' : ''}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      {!notification.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsRead(notification.id)}
                          className="h-6 w-6 p-0"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
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

