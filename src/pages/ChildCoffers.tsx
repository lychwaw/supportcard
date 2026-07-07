import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Plus, CheckCircle2, Target, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WishlistItem {
  id: string;
  child_id: string;
  name: string;
  price_estimate: number | null;
  notes: string | null;
  fulfilled: boolean;
  created_at: string;
}

interface Contribution {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
  contributor?: { full_name: string | null } | null;
}

interface Goal {
  id: string;
  child_id: string;
  name: string;
  target_amount: number;
  notes: string | null;
  created_at: string;
  contributions: Contribution[];
}

interface Child {
  id: string;
  name: string;
}

// Goals are an append-only contribution LOG, not a balance. Progress is
// always SUM(contributions) computed at read time — SupportCard never
// holds or moves the money itself.
const ChildCoffers = () => {
  const { user } = useAuth();
  const { isParent, isChild, activeChildId } = useRole();
  const { currency } = useCurrency();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [addWishOpen, setAddWishOpen] = useState(false);
  const [wishName, setWishName] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [wishNotes, setWishNotes] = useState('');

  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalNotes, setGoalNotes] = useState('');

  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributeNote, setContributeNote] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) loadChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChildId) {
      loadWishlist();
      loadGoals();
    }
  }, [selectedChildId]);

  useEffect(() => {
    if (isChild && activeChildId) setSelectedChildId(activeChildId);
  }, [isChild, activeChildId]);

  const loadChildren = async () => {
    const { data } = await supabase
      .from('children')
      .select('id, name')
      .or(`parent_id.eq.${user!.id},co_parent_id.eq.${user!.id}`);
    if (data && data.length > 0) {
      setChildren(data);
      if (!selectedChildId) setSelectedChildId(data[0].id);
    }
    setLoading(false);
  };

  const loadWishlist = async () => {
    const { data } = await (supabase as any)
      .from('wishlist_items')
      .select('*')
      .eq('child_id', selectedChildId)
      .order('created_at', { ascending: false });
    setWishlist(data || []);
  };

  const loadGoals = async () => {
    const { data: goalRows } = await (supabase as any)
      .from('child_goals')
      .select('*')
      .eq('child_id', selectedChildId)
      .order('created_at', { ascending: false });

    if (!goalRows || goalRows.length === 0) {
      setGoals([]);
      return;
    }

    const goalIds = goalRows.map((g: any) => g.id);
    const { data: contributionRows } = await (supabase as any)
      .from('goal_contributions')
      .select('id, goal_id, amount, note, created_at, contributor:contributor_id(full_name)')
      .in('goal_id', goalIds)
      .order('created_at', { ascending: false });

    setGoals(
      goalRows.map((g: any) => ({
        ...g,
        contributions: (contributionRows || []).filter((c: any) => c.goal_id === g.id),
      }))
    );
  };

  const handleAddWishItem = async () => {
    if (!wishName.trim()) { toast.error('Enter item name'); return; }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('wishlist_items')
        .insert({
          child_id: selectedChildId,
          name: wishName.trim(),
          price_estimate: wishPrice ? parseFloat(wishPrice) : null,
          notes: wishNotes || null,
          fulfilled: false,
        });

      if (error) throw error;
      toast.success('Added to wishlist');
      setAddWishOpen(false);
      setWishName('');
      setWishPrice('');
      setWishNotes('');
      loadWishlist();
    } catch {
      toast.error('Failed to add wishlist item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFulfillWish = async (id: string) => {
    await (supabase as any).from('wishlist_items').update({ fulfilled: true }).eq('id', id);
    loadWishlist();
    toast.success('Wish fulfilled!');
  };

  const handleAddGoal = async () => {
    const target = parseFloat(goalTarget);
    if (!goalName.trim()) { toast.error('Enter a goal name'); return; }
    if (!target || target <= 0) { toast.error('Enter a target amount'); return; }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('child_goals')
        .insert({
          child_id: selectedChildId,
          name: goalName.trim(),
          target_amount: target,
          notes: goalNotes || null,
          created_by: user!.id,
        });

      if (error) throw error;
      toast.success('Goal created');
      setAddGoalOpen(false);
      setGoalName('');
      setGoalTarget('');
      setGoalNotes('');
      loadGoals();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogContribution = async () => {
    const amt = parseFloat(contributeAmount);
    if (!contributeGoal) return;
    if (!amt || amt <= 0) { toast.error('Enter a positive amount'); return; }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('goal_contributions')
        .insert({
          goal_id: contributeGoal.id,
          contributor_id: user!.id,
          amount: amt,
          note: contributeNote || null,
        });

      if (error) throw error;
      toast.success(`Logged ${formatCurrency(amt, currency)} towards ${contributeGoal.name}`);
      setContributeGoal(null);
      setContributeAmount('');
      setContributeNote('');
      loadGoals();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to log contribution');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading goals and wishlist…</span>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Star aria-hidden="true" className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No children yet</h2>
        <p className="text-muted-foreground">Add a child from the Family page first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Star aria-hidden="true" className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-balance">Goals & Wishlist</h1>
            <p className="text-muted-foreground">Savings goals and things they're hoping for</p>
          </div>
        </div>
        {isParent && children.length > 1 && (
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isParent && (
        <div className="flex gap-2 flex-wrap">
          <Dialog open={addGoalOpen} onOpenChange={setAddGoalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Target aria-hidden="true" className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Goal for {selectedChild?.name}</DialogTitle>
                <DialogDescription>
                  e.g. "Laptop Fund" — parents log pledges toward it. SupportCard never holds the money.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-name">Goal Name *</Label>
                  <Input id="goal-name" placeholder="e.g. Laptop Fund" value={goalName} onChange={e => setGoalName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-target">Target Amount ({getCurrencySymbol(currency)}) *</Label>
                  <Input id="goal-target" type="number" step="0.01" placeholder="0.00" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-notes">Notes</Label>
                  <Textarea id="goal-notes" placeholder="Any details..." value={goalNotes} onChange={e => setGoalNotes(e.target.value)} rows={2} />
                </div>
                <Button className="w-full" onClick={handleAddGoal} disabled={submitting || !goalName.trim() || !goalTarget}>
                  {submitting ? 'Creating...' : 'Create Goal'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addWishOpen} onOpenChange={setAddWishOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
                Add Wishlist Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to {selectedChild?.name}'s Wishlist</DialogTitle>
                <DialogDescription>Add something they're saving for or dreaming about</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wish-name">Item Name *</Label>
                  <Input id="wish-name" placeholder="e.g. New bicycle" value={wishName} onChange={e => setWishName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wish-price">Estimated Price ({getCurrencySymbol(currency)})</Label>
                  <Input id="wish-price" type="number" step="0.01" placeholder="0.00" value={wishPrice} onChange={e => setWishPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wish-notes">Notes</Label>
                  <Textarea id="wish-notes" placeholder="Any details..." value={wishNotes} onChange={e => setWishNotes(e.target.value)} rows={2} />
                </div>
                <Button className="w-full" onClick={handleAddWishItem} disabled={submitting || !wishName.trim()}>
                  {submitting ? 'Adding...' : 'Add to Wishlist'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Goals */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target aria-hidden="true" className="w-5 h-5 text-primary" />
            {selectedChild?.name}'s Goals
          </CardTitle>
          <CardDescription>Logged pledges toward a target — no funds held by SupportCard</CardDescription>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No goals yet</p>
          ) : (
            <div className="space-y-4">
              {goals.map(goal => {
                const total = goal.contributions.reduce((s, c) => s + Number(c.amount), 0);
                const pct = Math.min(100, (total / Number(goal.target_amount)) * 100);
                return (
                  <div key={goal.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{goal.name}</p>
                      <span className="text-xs font-medium tabular-nums">
                        {formatCurrency(total, currency)} / {formatCurrency(Number(goal.target_amount), currency)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    {goal.notes && <p className="text-xs text-muted-foreground">{goal.notes}</p>}
                    {goal.contributions.length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {goal.contributions.slice(0, 3).map(c => (
                          <p key={c.id}>
                            {c.contributor?.full_name || 'A parent'} logged{' '}
                            <span className="tabular-nums">{formatCurrency(Number(c.amount), currency)}</span>
                            {' '}on {format(new Date(c.created_at), 'dd MMM')}
                            {c.note ? ` — ${c.note}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                    {isParent && (
                      <Button size="sm" variant="outline" onClick={() => setContributeGoal(goal)}>
                        <HandCoins aria-hidden="true" className="w-3 h-3 mr-1" />
                        Log Contribution
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wishlist */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star aria-hidden="true" className="w-5 h-5 text-yellow-500" />
            {selectedChild?.name}'s Wishlist
          </CardTitle>
          <CardDescription>Things they're saving for or hoping for</CardDescription>
        </CardHeader>
        <CardContent>
          {wishlist.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">Wishlist is empty</p>
              {isParent && (
                <Button size="sm" onClick={() => setAddWishOpen(true)}>
                  <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
                  Add the first item
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {wishlist.map(item => (
                <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${item.fulfilled ? 'bg-muted/50 opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <p className={`font-medium text-sm ${item.fulfilled ? 'line-through' : ''}`}>{item.name}</p>
                    {item.price_estimate && (
                      <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.price_estimate, currency)}</p>
                    )}
                    {item.notes && <p className="text-xs text-muted-foreground truncate">{item.notes}</p>}
                  </div>
                  {!item.fulfilled && isParent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleFulfillWish(item.id)}
                      aria-label={`Mark "${item.name}" as fulfilled`}
                    >
                      <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-green-500" />
                    </Button>
                  )}
                  {item.fulfilled && <Badge variant="secondary">Fulfilled</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Contribution dialog */}
      <Dialog open={!!contributeGoal} onOpenChange={open => !open && setContributeGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Contribution — {contributeGoal?.name}</DialogTitle>
            <DialogDescription>
              Record that you've put money toward this goal off-platform. This is a log entry only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contribution-amount">Amount ({getCurrencySymbol(currency)}) *</Label>
              <Input
                id="contribution-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={contributeAmount}
                onChange={e => setContributeAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contribution-note">Note</Label>
              <Input id="contribution-note" placeholder="Optional note..." value={contributeNote} onChange={e => setContributeNote(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleLogContribution} disabled={submitting || !contributeAmount}>
              {submitting ? 'Logging...' : 'Log Contribution'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChildCoffers;
