import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSwitcher } from '@/components/AccountSwitcher';

interface VirtualCard {
  id: string;
  card_number: string;
  card_type: string;
  balance: number;
  is_primary: boolean;
}

const Cards = () => {
  const { user } = useAuth();
  const { activeChildId, children, isParent } = useRole();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cardType, setCardType] = useState('VISA');
  const [initialBalance, setInitialBalance] = useState('');

  useEffect(() => {
    fetchCards();
  }, [user, activeChildId, children]);

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

      const { data, error } = await supabase
        .from('virtual_cards')
        .select('*')
        .eq('user_id', queryUserId);

      if (error) throw error;
      if (data) setCards(data);
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
    if (!user || !initialBalance) {
      toast.error('Please enter an initial balance');
      return;
    }

    try {
      const cardNumber = generateCardNumber();
      const { error } = await supabase
        .from('virtual_cards')
        .insert({
          user_id: user.id,
          card_number: cardNumber,
          card_type: cardType,
          balance: parseFloat(initialBalance),
          is_primary: cards.length === 0,
        });

      if (error) throw error;

      toast.success('Virtual card added successfully');
      setIsDialogOpen(false);
      setInitialBalance('');
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
        {isParent && (
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
                <Label htmlFor="balance">Initial Balance ($)</Label>
                <Input
                  id="balance"
                  type="number"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                />
              </div>
              <Button onClick={handleAddCard} className="w-full">
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
              className="shadow-medium bg-gradient-primary text-primary-foreground"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-primary-foreground">{card.card_type}</CardTitle>
                  {card.is_primary && (
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">Primary</span>
                  )}
                </div>
                <CardDescription className="text-primary-foreground/80">
                  Virtual Card
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="font-mono text-lg tracking-wider">
                  {card.card_number}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Balance</span>
                  </div>
                  <span className="text-xl font-bold">
                    ${card.balance.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Cards;
