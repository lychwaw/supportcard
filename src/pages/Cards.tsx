import { useEffect, useState } from 'react';
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
import { CreditCard, Plus, Wallet, User, Copy, Check } from 'lucide-react';
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
  child?: {
    id: string;
    name: string;
  };
}

const Cards = () => {
  const { user } = useAuth();
  const { activeChildId, children, isParent } = useRole();
  const { canManageCards } = usePermissions();
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
      console.error('Error fetching children:', error);
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
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCardNumber = () => {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      parts.push(Math.floor(1000 + Math.random() * 9000));
    }
    return parts.join(' ');
  };

  const handleAddCard = async () => {
    if (!canManageCards) {
      toast.error('Only parents can add cards');
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

    // CRITICAL: Virtual cards must be associated with a child
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
      const cardNumber = generateCardNumber();
      
      // Determine user_id: if child selected and has user_id, use child's user_id, else use parent's user_id
      let cardUserId = user.id;
      if (selectedChildId) {
        const selectedChild = childrenList.find(c => c.id === selectedChildId);
        // For now, cards are linked to parent's user_id but associated with child_id
        // In production, you might want cards tied to child's account if they have one
      }

      const { error } = await supabase
        .from('virtual_cards')
        .insert({
          user_id: cardUserId,
          child_id: selectedChildId || null,
          card_number: cardNumber,
          card_type: cardType,
          balance: balanceNum,
          is_primary: cards.length === 0,
        });

      if (error) throw error;

      toast.success('Virtual card added successfully');
      setIsDialogOpen(false);
      setInitialBalance('');
      setSelectedChildId('');
      fetchCards();
    } catch (error) {
      toast.error('Failed to add card');
      console.error(error);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Virtual Cards</h1>
            <p className="text-muted-foreground">Manage your payment cards</p>
          </div>
        </div>
        {canManageCards && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Virtual Card</DialogTitle>
              <DialogDescription>Create a new virtual card for payments</DialogDescription>
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
                  <p className="text-xs text-muted-foreground">Cards must be associated with a child</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="cardType">Card Type</Label>
                <Select value={cardType} onValueChange={setCardType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VISA">VISA</SelectItem>
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                  </SelectContent>
                </Select>
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
                Create Card
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <AccountSwitcher />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.length === 0 ? (
          <Card className="col-span-full shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No virtual cards yet</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Card
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
                  Virtual Card {card.child ? `• ${card.child.name}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="font-mono text-lg tracking-wider group-hover:opacity-80 transition-opacity">
                  {card.card_number}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Balance</span>
                  </div>
                  <span className="text-xl font-bold">
                    {formatCurrency(card.balance, currency)}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/20">
                  <p className="text-xs text-primary-foreground/60 group-hover:text-primary-foreground/80 transition-colors">
                    Click to view details
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
              <CreditCard className="w-5 h-5" />
              Card Details
            </DialogTitle>
            <DialogDescription>
              {selectedCard?.card_type} Virtual Card Information
            </DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-primary text-primary-foreground">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm opacity-80">Card Number</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-primary-foreground hover:bg-white/20"
                    onClick={async () => {
                      await navigator.clipboard.writeText(selectedCard.card_number.replace(/\s/g, ''));
                      setCopiedCardNumber(selectedCard.id);
                      setTimeout(() => setCopiedCardNumber(null), 2000);
                      toast.success('Card number copied!');
                    }}
                  >
                    {copiedCardNumber === selectedCard.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="font-mono text-xl tracking-wider mb-4">
                  {selectedCard.card_number}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-80 mb-1">Balance</p>
                    <p className="text-2xl font-bold">{formatCurrency(selectedCard.balance, currency)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-80 mb-1">Type</p>
                    <p className="font-semibold">{selectedCard.card_type}</p>
                  </div>
                </div>
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
                    <Badge variant="default" className="w-fit">Primary Card</Badge>
                    <p className="text-xs text-muted-foreground">This is your default payment card</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cards;
