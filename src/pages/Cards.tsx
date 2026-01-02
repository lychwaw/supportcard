import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CreditCard, Plus, Wallet, User, Copy, Check, Eye, EyeOff, Trash2, ArrowUpCircle, Loader2, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AccountSwitcher } from '@/components/AccountSwitcher';

interface VirtualCard {
  id: string;
  card_number: string;
  card_type: string;
  balance: number;
  is_primary: boolean;
  child_id: string | null;
  cardholder_name: string | null;
  cvv: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  last_four: string | null;
  child?: {
    id: string;
    name: string;
  };
}

const Cards = () => {
  const { user } = useAuth();
  const { activeChildId, children, isParent } = useRole();
  const { canManageCards, canTopUpCards, canViewWalletSensitive, canDeleteCards } = usePermissions();
  const { currency } = useCurrency();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cardType, setCardType] = useState('VISA');
  const [initialBalance, setInitialBalance] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [copiedCardNumber, setCopiedCardNumber] = useState<string | null>(null);
  const [cardOwnerId, setCardOwnerId] = useState<string | null>(null);
  const [topUpTargetId, setTopUpTargetId] = useState<string>('');
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<VirtualCard | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);

  const topUpCard = useMemo(
    () => cards.find((card) => card.id === topUpTargetId) || null,
    [cards, topUpTargetId]
  );

  const walletStats = useMemo(() => {
    const total = cards.reduce((sum, card) => sum + Number(card.balance || 0), 0);
    const assigned = cards.filter((card) => !!card.child).length;
    return {
      total,
      assigned,
      unassigned: cards.length - assigned,
    };
  }, [cards]);

  useEffect(() => {
    if (isTopUpDialogOpen && !topUpTargetId && cards.length > 0) {
      setTopUpTargetId(cards[0].id);
    }
  }, [isTopUpDialogOpen, cards, topUpTargetId]);


  useEffect(() => {
    if (user) {
      fetchChildrenList();
      fetchCards();
    }
  }, [user, activeChildId, children]);

  const fetchChildrenList = async () => {
    if (!user) return;
    
    try {
      // Fetch children where user is parent or co-parent
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name, parent_id, co_parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
      
      if (childrenData) {
        setChildrenList(childrenData);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching children:', error);
      }
    }
  };

  const fetchCards = async () => {
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

      setCardOwnerId(queryUserId);

      // Fetch cards with child information
      const { data, error } = await supabase
        .from('virtual_cards')
        .select(`
          *,
          children:child_id(id, name)
        `)
        .eq('user_id', queryUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const cardsWithChildren = data.map((card: any) => ({
          ...card,
          child: card.children,
        }));
        setCards(cardsWithChildren);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching cards:', error);
      }
    } finally {
      setLoading(false);
    }
  };


  const handleAddCard = async () => {
    if (!canManageCards) {
      toast.error('Only parents can create balance categories');
      return;
    }

    if (!user || !initialBalance) {
      toast.error('Please enter an initial balance');
      return;
    }

    // Validate amount
    const balanceNum = parseFloat(initialBalance);
    if (isNaN(balanceNum) || balanceNum <= 0) {
      toast.error('Balance must be a positive number');
      return;
    }

    // CRITICAL: Balance categories must be associated with a child
    if (!selectedChildId && childrenList.length > 0) {
      toast.error('Please select a child for this card');
      return;
    }

    // If no children exist, card can be for parent (but ideally should have a child)
    if (!selectedChildId && childrenList.length === 0) {
      toast.error('Please add a child first before creating a card');
      return;
    }

    try {
      // Generate a simple identifier (not a real card number)
      const balanceId = `BAL-${Date.now().toString().slice(-6)}`;
      const childForCard = selectedChildId
        ? childrenList.find((c) => c.id === selectedChildId)
        : null;
      const cardholderName = childForCard?.name || user.user_metadata?.full_name || user.email || 'Family Wallet';
      
      // Determine user_id: if child selected and has user_id, use child's user_id, else use parent's user_id
      let cardUserId = user.id;
      if (selectedChildId) {
        const selectedChild = childrenList.find(c => c.id === selectedChildId);
        // For now, balances are linked to parent's user_id but associated with child_id
      }

      const { error } = await supabase
        .from('virtual_cards')
        .insert({
          user_id: cardUserId,
          child_id: selectedChildId || null,
          card_number: balanceId, // Using as identifier, not a real card number
          card_type: cardType, // This is now the category
          balance: balanceNum,
          is_primary: cards.length === 0,
          cardholder_name: cardholderName,
          cvv: null, // No CVV needed
          expiry_month: null, // No expiry needed
          expiry_year: null, // No expiry needed
          last_four: balanceId.slice(-4), // Last 4 of identifier
        });

      if (error) throw error;

      toast.success('Balance category created successfully');
      setIsDialogOpen(false);
      setInitialBalance('');
      setSelectedChildId('');
      fetchCards();
    } catch (error) {
      toast.error('Failed to add card');
      if (import.meta.env.DEV) {
        console.error('Error adding card:', error);
      }
    }
  };

  const handleOpenTopUpDialog = (card?: VirtualCard) => {
    if (card) {
      setTopUpTargetId(card.id);
    } else if (cards.length > 0) {
      setTopUpTargetId(cards[0].id);
    }
    setIsTopUpDialogOpen(true);
  };

  const handleTopUpSubmit = async () => {
    if (!canTopUpCards) {
      toast.error('You do not have permission to add money to balances');
      return;
    }

    if (!topUpCard) {
      toast.error('Select a balance category to add money to');
      return;
    }

    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }

    setIsProcessingTopUp(true);
    try {
      const newBalance = Number(topUpCard.balance || 0) + amount;
      const { error } = await supabase
        .from('virtual_cards')
        .update({ balance: newBalance })
        .eq('id', topUpCard.id);

      if (error) throw error;

      toast.success('Allowance topped up successfully');
      setIsTopUpDialogOpen(false);
      setTopUpAmount('');
      fetchCards();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error topping up card:', error);
      }
      toast.error('Unable to add money to this balance right now');
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const handleDeleteRequest = (card: VirtualCard) => {
    setCardToDelete(card);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCard = async () => {
    if (!cardToDelete) return;
    if (!canDeleteCards) {
      toast.error('You do not have permission to delete cards');
      return;
    }

    setIsDeletingCard(true);
    try {
      const { error } = await supabase
        .from('virtual_cards')
        .delete()
        .eq('id', cardToDelete.id);

      if (error) throw error;

      toast.success('Card removed successfully');
      setIsDeleteDialogOpen(false);
      setCardToDelete(null);
      if (selectedCard?.id === cardToDelete.id) {
        setSelectedCard(null);
        setIsCardDialogOpen(false);
      }
      fetchCards();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting card:', error);
      }
      toast.error('Failed to remove this card');
    } finally {
      setIsDeletingCard(false);
    }
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Balance Tracker</h1>
            <p className="text-muted-foreground">Track balances by category - like an imaginary bank account</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canTopUpCards && cards.length > 0 && (
            <Button variant="outline" onClick={() => handleOpenTopUpDialog()}>
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Add Money
            </Button>
          )}
          {canManageCards && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Balance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Balance Category</DialogTitle>
                  <DialogDescription>Create a new balance category (e.g., School Money, Allowance)</DialogDescription>
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
                      <p className="text-xs text-muted-foreground">Balance categories must be associated with a child</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="cardType">Category</Label>
                    <Select value={cardType} onValueChange={setCardType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="School Money">School Money</SelectItem>
                        <SelectItem value="Allowance">Allowance</SelectItem>
                        <SelectItem value="Lunch Money">Lunch Money</SelectItem>
                        <SelectItem value="Activities">Activities</SelectItem>
                        <SelectItem value="General">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Choose a category for this balance</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balance">Initial Balance ({getCurrencySymbol(currency)})</Label>
                    <Input
                      id="balance"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Enter a positive amount</p>
                  </div>
                  <Button 
                    onClick={handleAddCard} 
                    className="w-full"
                    disabled={childrenList.length > 0 && !selectedChildId}
                  >
                    Create Balance
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <AccountSwitcher />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-soft border border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Total Wallet Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(walletStats.total, currency)}</div>
            <p className="text-xs text-muted-foreground">Across {cards.length} balance category{cards.length !== 1 ? 'ies' : ''}</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft border border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Balance Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cards.length}</div>
            <p className="text-xs text-muted-foreground">{walletStats.assigned} linked to children</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft border border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Child Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{walletStats.assigned}</div>
            <p className="text-xs text-muted-foreground">
              {isParent ? 'Managed by you' : 'Assigned to you'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft border border-muted">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Security
            </CardTitle>
            <Badge variant="outline" className="capitalize">
              {isParent ? 'Parent' : 'Child'}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {isParent
                ? 'You can manage all balances'
                : 'View-only access to balances'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.length === 0 ? (
          <Card className="col-span-full shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No balance categories yet</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Balance
              </Button>
            </CardContent>
          </Card>
        ) : (
          cards.map((card) => (
            <Card
              key={card.id}
              className="shadow-medium bg-gradient-primary text-primary-foreground cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group"
              onClick={() => {
                setSelectedCard(card);
                setIsCardDialogOpen(true);
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-primary-foreground">{card.card_type}</CardTitle>
                  <div className="flex items-center gap-2">
                    {card.is_primary && (
                      <span className="text-xs bg-white/20 px-2 py-1 rounded">Primary</span>
                    )}
                    {card.child && (
                      <Badge variant="secondary" className="bg-white/20 text-primary-foreground">
                        <User className="w-3 h-3 mr-1" />
                        {card.child.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="text-primary-foreground/80">
                  {card.child ? `${card.child.name}'s Balance` : 'Family Balance'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Available</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {formatCurrency(card.balance, currency)}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/20">
                  <p className="text-xs text-primary-foreground/60 group-hover:text-primary-foreground/80 transition-colors">
                    Click to manage balance
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Card Details Dialog */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Balance Details
            </DialogTitle>
            <DialogDescription>
              {selectedCard?.card_type} Balance Information
            </DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-gradient-primary text-primary-foreground">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs opacity-80 mb-1">Category</p>
                    <p className="text-lg font-semibold">{selectedCard.card_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-80 mb-1">Balance</p>
                    <p className="text-2xl font-bold">{formatCurrency(selectedCard.balance, currency)}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/20">
                  <p className="text-xs opacity-80 mb-1">Assigned To</p>
                  <p className="font-semibold">{selectedCard.child ? selectedCard.child.name : 'Family Wallet'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canTopUpCards && (
                  <Button
                    onClick={() => {
                      handleOpenTopUpDialog(selectedCard);
                      setIsCardDialogOpen(false);
                    }}
                  >
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    Add Money
                  </Button>
                )}
                {canDeleteCards && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDeleteRequest(selectedCard);
                      setIsCardDialogOpen(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Balance
                  </Button>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                {selectedCard.child ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <User className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Assigned To</p>
                      <p className="text-xs text-muted-foreground">{selectedCard.child.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Assigned To</p>
                      <p className="text-xs text-muted-foreground">No child assigned</p>
                    </div>
                  </div>
                )}

                {selectedCard.is_primary && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10">
                    <Badge variant="default" className="w-fit">Primary Balance</Badge>
                    <p className="text-xs text-muted-foreground">This is your default balance category</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Top Up Dialog */}
      <Dialog
        open={isTopUpDialogOpen}
        onOpenChange={(open) => {
          setIsTopUpDialogOpen(open);
          if (!open) {
            setTopUpAmount('');
          } else if (!topUpTargetId && cards.length > 0) {
            setTopUpTargetId(cards[0].id);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Money to Balance</DialogTitle>
            <DialogDescription>Increase a child card balance instantly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Card</Label>
              <Select value={topUpTargetId} onValueChange={setTopUpTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select balance category" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.card_type} - {card.child?.name || 'Family Wallet'} ({formatCurrency(card.balance, currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({getCurrencySymbol(currency)})</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button className="w-full" onClick={handleTopUpSubmit} disabled={isProcessingTopUp}>
              {isProcessingTopUp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Add Money
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Balance Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The balance category and its history will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCard}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCard} disabled={isDeletingCard}>
              {isDeletingCard ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Balance
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Cards;
