import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, Plus, Lock, Unlock, DollarSign, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface KorapayCard {
  id: string;
  korapay_card_id: string;
  name_on_card: string;
  status: 'active' | 'blocked' | 'terminated';
  masked_pan: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  brand: string | null;
  currency: string;
  balance: number;
  created_at: string;
  child_id: string | null;
  children?: { id: string; name: string } | null;
}

interface CardTransaction {
  id: string;
  korapay_transaction_id: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit' | 'reversal';
  status: 'pending' | 'success' | 'failed';
  merchant_name: string | null;
  narration: string | null;
  transaction_date: string | null;
}

const STATUS_BADGE: Record<KorapayCard['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:     { label: 'Active',      variant: 'default' },
  blocked:    { label: 'Frozen',      variant: 'secondary' },
  terminated: { label: 'Terminated',  variant: 'destructive' },
};

const BRAND_LABEL: Record<string, string> = {
  visa:       'Visa',
  mastercard: 'Mastercard',
};

const authHeader = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
};

const VirtualCards = () => {
  const { user } = useAuth();
  const { children, isParent } = useRole();
  const { canManageCards } = usePermissions();

  const [cards, setCards] = useState<KorapayCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [isTxnOpen, setIsTxnOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KorapayCard | null>(null);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);

  // Create card form state
  const [nameOnCard, setNameOnCard] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [cardCurrency, setCardCurrency] = useState<'USD' | 'NGN'>('USD');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fund card form state
  const [fundAmount, setFundAmount] = useState('');

  useEffect(() => {
    if (user) fetchCards();
  }, [user]);

  const fetchCards = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('korapay_cards')
        .select('*, children:child_id(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCards((data as KorapayCard[]) ?? []);
    } catch (err) {
      console.error('Error fetching KoraPay cards:', err);
      toast.error('Failed to load virtual cards');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (card: KorapayCard) => {
    setSelectedCard(card);
    setTxnLoading(true);
    setIsTxnOpen(true);
    try {
      const { data, error } = await supabase
        .from('korapay_card_transactions')
        .select('*')
        .eq('korapay_card_id', card.korapay_card_id)
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions((data as CardTransaction[]) ?? []);
    } catch {
      toast.error('Failed to load card transactions');
    } finally {
      setTxnLoading(false);
    }
  };

  const handleCreateCard = async () => {
    if (!nameOnCard.trim()) {
      toast.error('Name on card is required');
      return;
    }

    const amount = parseFloat(initialAmount || '0');
    if (isNaN(amount) || amount < 0) {
      toast.error('Enter a valid initial amount (or 0 to skip)');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await authHeader();
      const response = await fetch('/api/korapay-create-card', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name_on_card: nameOnCard.trim(),
          initial_amount: amount,
          currency: cardCurrency,
          child_id: selectedChildId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      toast.success('Virtual card created successfully');
      setIsCreateOpen(false);
      setNameOnCard('');
      setInitialAmount('');
      setSelectedChildId('');
      fetchCards();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create virtual card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFundCard = async () => {
    if (!selectedCard) return;

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await authHeader();
      const response = await fetch('/api/korapay-fund-card', {
        method: 'POST',
        headers,
        body: JSON.stringify({ card_id: selectedCard.id, amount }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      toast.success('Card funded successfully');
      setIsFundOpen(false);
      setFundAmount('');
      fetchCards();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fund card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFreezeToggle = async (card: KorapayCard) => {
    const action = card.status === 'blocked' ? 'unfreeze' : 'freeze';
    try {
      const headers = await authHeader();
      const response = await fetch('/api/korapay-freeze-card', {
        method: 'POST',
        headers,
        body: JSON.stringify({ card_id: card.id, action }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      toast.success(action === 'freeze' ? 'Card frozen' : 'Card unfrozen');
      fetchCards();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} card`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Virtual Cards</h1>
            <p className="text-muted-foreground">Manage KoraPay virtual debit cards for your family</p>
          </div>
        </div>

        {canManageCards && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Card
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Virtual Card</DialogTitle>
                <DialogDescription>
                  Issue a new KoraPay virtual Visa/Mastercard that can be used for online purchases.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {isParent && children.length > 0 && (
                  <div className="space-y-2">
                    <Label>Assign to child (optional)</Label>
                    <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                      <SelectTrigger>
                        <SelectValue placeholder="My card (parent)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">My card (parent)</SelectItem>
                        {children.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="nameOnCard">Name on card *</Label>
                  <Input
                    id="nameOnCard"
                    placeholder="e.g. Jane Smith"
                    value={nameOnCard}
                    onChange={(e) => setNameOnCard(e.target.value)}
                    maxLength={26}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={cardCurrency} onValueChange={(v) => setCardCurrency(v as 'USD' | 'NGN')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="NGN">NGN — Nigerian Naira</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initialAmount">Initial funding amount ({cardCurrency})</Label>
                  <Input
                    id="initialAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00 (optional)"
                    value={initialAmount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = v.split('.');
                      setInitialAmount(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : v);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to create an unfunded card</p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateCard}
                  disabled={isSubmitting || !nameOnCard.trim()}
                >
                  {isSubmitting ? 'Creating…' : 'Create Card'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {cards.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CreditCard className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No virtual cards yet</p>
            {canManageCards && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Card
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const { label: statusLabel, variant: statusVariant } = STATUS_BADGE[card.status];
            const expiry = card.expiry_month && card.expiry_year
              ? `${String(card.expiry_month).padStart(2, '0')}/${String(card.expiry_year).slice(-2)}`
              : '––/––';
            const brandLabel = card.brand ? (BRAND_LABEL[card.brand.toLowerCase()] ?? card.brand) : '';

            return (
              <Card
                key={card.id}
                className={`shadow-soft transition-all duration-300 border-2 ${
                  card.status === 'terminated'
                    ? 'opacity-60 border-muted'
                    : card.status === 'blocked'
                    ? 'border-yellow-400/50'
                    : 'border-primary/20 hover:border-primary/50 hover:shadow-lg'
                }`}
              >
                {/* Card visual */}
                <div className="mx-4 mt-4 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-5 text-primary-foreground shadow">
                  <div className="flex items-start justify-between mb-6">
                    <span className="text-xs opacity-70 font-mono uppercase tracking-widest">
                      {brandLabel || 'Virtual Card'}
                    </span>
                    <Badge variant={statusVariant} className="text-xs">
                      {statusLabel}
                    </Badge>
                  </div>
                  <p className="font-mono text-lg tracking-widest mb-4">
                    {card.masked_pan ?? '**** **** **** ****'}
                  </p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs opacity-60 uppercase tracking-wide">Card Holder</p>
                      <p className="text-sm font-semibold">{card.name_on_card}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-60 uppercase tracking-wide">Expires</p>
                      <p className="text-sm font-mono">{expiry}</p>
                    </div>
                  </div>
                </div>

                <CardHeader className="pt-3 pb-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {card.currency} {Number(card.balance).toFixed(2)}
                    </CardTitle>
                    {card.children && (
                      <Badge variant="outline" className="text-xs">{card.children.name}</Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    Created {format(new Date(card.created_at), 'MMM d, yyyy')}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-2">
                  {card.status !== 'terminated' && (
                    <div className="grid grid-cols-2 gap-2">
                      {canManageCards && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCard(card);
                              setFundAmount('');
                              setIsFundOpen(true);
                            }}
                          >
                            <DollarSign className="w-3.5 h-3.5 mr-1" />
                            Fund
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFreezeToggle(card)}
                          >
                            {card.status === 'blocked' ? (
                              <><Unlock className="w-3.5 h-3.5 mr-1" />Unfreeze</>
                            ) : (
                              <><Lock className="w-3.5 h-3.5 mr-1" />Freeze</>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={() => fetchTransactions(card)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    View Transactions
                  </Button>

                  {card.status === 'terminated' && (
                    <p className="text-xs text-muted-foreground text-center">
                      This card has been terminated and cannot be used.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Fund Card Dialog */}
      <Dialog open={isFundOpen} onOpenChange={setIsFundOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fund Card</DialogTitle>
            <DialogDescription>
              Add funds to {selectedCard?.masked_pan ?? 'this card'} ({selectedCard?.currency})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fundAmount">Amount ({selectedCard?.currency})</Label>
              <Input
                id="fundAmount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={fundAmount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = v.split('.');
                  setFundAmount(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : v);
                }}
              />
            </div>
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Funds are deducted from your KoraPay merchant balance, not from your app wallet.</span>
            </div>
            <Button
              className="w-full"
              onClick={handleFundCard}
              disabled={isSubmitting || !fundAmount || parseFloat(fundAmount) <= 0}
            >
              {isSubmitting ? 'Processing…' : 'Fund Card'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={isTxnOpen} onOpenChange={setIsTxnOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Card Transactions</DialogTitle>
            <DialogDescription>
              {selectedCard?.masked_pan ?? 'Virtual card'} — last 50 transactions
            </DialogDescription>
          </DialogHeader>
          {txnLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.merchant_name || txn.narration || 'Transaction'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {txn.transaction_date
                        ? format(new Date(txn.transaction_date), 'MMM d, yyyy HH:mm')
                        : '–'}
                      {' · '}
                      <Badge variant="outline" className="text-xs py-0">
                        {txn.type}
                      </Badge>
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ml-3 ${
                      txn.type === 'debit' ? 'text-destructive' : 'text-green-600'
                    }`}
                  >
                    {txn.type === 'debit' ? '-' : '+'}
                    {txn.currency} {Number(txn.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VirtualCards;
