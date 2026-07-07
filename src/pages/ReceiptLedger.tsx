import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { subscriptionTiers } from '@/lib/subscriptions';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Upload, Calculator, CheckCircle2, Clock, AlertCircle, Camera, AlertTriangle, ExternalLink, XCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const CATEGORIES = ['School', 'Food', 'Clothing', 'Activities', 'Healthcare', 'Transportation', 'Other'];
const STORAGE_BUCKET = 'receipts';
const SETTLE_DISCLAIMER = 'Settle this amount manually via EFT or bank transfer. SupportCard does not process payments.';

interface Receipt {
  id: string;
  requester_id: string;
  child_id: string | null;
  amount: number;
  category: string;
  description: string | null;
  status: string | null;
  receipt_url: string | null; // stores storage path, not public URL
  created_at: string | null;
  child?: { name: string } | null;
  requester?: { full_name: string | null; email: string | null } | null;
}

interface Child {
  id: string;
  name: string;
}

// Returns the cap warning level given a request count and the tier's monthly
// limit (null = no warning needed, e.g. unlimited tiers or under 80% used).
const getCapLevel = (count: number, limit: number): 'warn' | 'over' | 'hard' | null => {
  if (count >= limit * 1.5) return 'hard';
  if (count >= limit) return 'over';
  if (count >= limit * 0.8) return 'warn';
  return null;
};

const ReceiptLedger = () => {
  const { user } = useAuth();
  const { isParent, isChild } = useRole();
  const { currency } = useCurrency();
  const { tier } = useSubscription();
  const tierConfig = subscriptionTiers.find(t => t.id === tier);
  const monthlyRequestLimit = tierConfig?.limits.expenseRequestsPerMonth ?? 'unlimited';

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState<Receipt | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  // Monthly spend + request count for the current user's own submissions
  const [myMonthlyTotal, setMyMonthlyTotal] = useState(0);
  const [myMonthlyCount, setMyMonthlyCount] = useState(0);

  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [childId, setChildId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Inline field errors — shown next to the field they belong to, not as toasts
  const [amountError, setAmountError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [childError, setChildError] = useState('');

  useEffect(() => {
    if (user) {
      loadChildren();
      loadReceipts();
    }
  }, [user]);

  const loadChildren = async () => {
    const { data } = await supabase
      .from('children')
      .select('id, name')
      .or(`parent_id.eq.${user!.id},co_parent_id.eq.${user!.id}`);
    if (data) setChildren(data);
  };

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const { data: myChildren } = await supabase
        .from('children')
        .select('id')
        .or(`parent_id.eq.${user!.id},co_parent_id.eq.${user!.id}`);

      const childIds = myChildren?.map(c => c.id) || [];

      let q = supabase
        .from('expense_requests')
        .select('*, children:child_id(name), profiles:requester_id(full_name, email)')
        .order('created_at', { ascending: false });

      if (childIds.length > 0) {
        q = q.in('child_id', childIds);
      } else {
        q = q.eq('requester_id', user!.id);
      }

      // Child role: only ever sees approved records — never pending or disputed
      if (isChild) {
        q = q.eq('status', 'approved');
      }

      const { data, error } = await q;
      if (error) throw error;

      const mapped = (data || []).map((r: any) => ({
        ...r,
        child: r.children,
        requester: r.profiles,
      }));

      setReceipts(mapped);

      // Calculate this user's own spending + request count this month
      // (approved + pending; rejected receipts don't count toward the cap)
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const myReceiptsThisMonth = mapped.filter(r =>
        r.requester_id === user!.id &&
        r.status !== 'rejected' &&
        r.created_at &&
        new Date(r.created_at) >= start &&
        new Date(r.created_at) <= end
      );
      const myTotal = myReceiptsThisMonth.reduce((s: number, r: Receipt) => s + Number(r.amount), 0);

      setMyMonthlyTotal(myTotal);
      setMyMonthlyCount(myReceiptsThisMonth.length);
    } catch {
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  // Stores the file and returns the storage PATH (not a public URL).
  // The bucket must be private — signed URLs are generated on demand at display time.
  const uploadReceiptFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }
    return path;
  };

  // Opens a receipt in a new tab via a 1-hour signed URL so the private bucket
  // is never exposed as a permanent public link.
  const viewReceipt = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Could not load receipt image');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async () => {
    setAmountError('');
    setCategoryError('');
    setChildError('');

    const amountNum = parseFloat(amount);
    let hasError = false;
    if (!amountNum || amountNum <= 0) { setAmountError('Enter a valid amount'); hasError = true; }
    if (!category) { setCategoryError('Select a category'); hasError = true; }
    if (children.length > 0 && !childId) { setChildError('Select a child'); hasError = true; }
    if (hasError) return;

    // Hard stop at 150% of this tier's monthly request cap
    if (monthlyRequestLimit !== 'unlimited' && myMonthlyCount >= monthlyRequestLimit * 1.5) {
      toast.error('Monthly request limit reached. Upgrade your plan to continue logging expenses.');
      return;
    }

    setUploading(true);
    try {
      let storagePath: string | null = null;
      if (receiptFile) {
        storagePath = await uploadReceiptFile(receiptFile);
        if (!storagePath) {
          toast.error('Failed to upload receipt image');
          return;
        }
      }

      const { error } = await supabase.from('expense_requests').insert({
        requester_id: user!.id,
        child_id: childId || null,
        amount: amountNum,
        category,
        description: description || null,
        receipt_url: storagePath, // store path, not URL
        status: 'pending',
      });

      if (error) throw error;

      // Soft warning after submission (not blocking) at/over this tier's cap
      if (monthlyRequestLimit !== 'unlimited' && myMonthlyCount + 1 >= monthlyRequestLimit) {
        toast.warning(`You've reached your ${tierConfig?.name ?? 'plan'} monthly request limit. Upgrade to keep logging.`);
      } else {
        toast.success('Receipt submitted for approval');
      }

      setDialogOpen(false);
      setAmount('');
      setCategory('');
      setDescription('');
      setChildId('');
      setReceiptFile(null);
      loadReceipts();
    } catch {
      toast.error('Failed to submit receipt');
    } finally {
      setUploading(false);
    }
  };

  // Plain status-only actions — no payment is ever involved in approving or
  // disputing a receipt. These call DB-level RPCs directly with no
  // payment-processor checkout step in front of them.
  const handleApprove = async (receipt: Receipt) => {
    setActingOnId(receipt.id);
    try {
      const { error } = await (supabase.rpc as any)('approve_expense_request', {
        p_request_id: receipt.id,
        p_approver_id: user!.id,
      });
      if (error) throw error;
      toast.success('Receipt approved');
      loadReceipts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve receipt');
    } finally {
      setActingOnId(null);
    }
  };

  const handleDispute = async (receipt: Receipt) => {
    setActingOnId(receipt.id);
    try {
      const { error } = await (supabase.rpc as any)('reject_expense_request', {
        p_request_id: receipt.id,
        p_rejector_id: user!.id,
      });
      if (error) throw error;
      toast.success('Receipt disputed');
      setDisputeTarget(null);
      loadReceipts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to dispute receipt');
    } finally {
      setActingOnId(null);
    }
  };

  // Settlement uses APPROVED expenses only — pending expenses are unverified and
  // including them could inflate a debt figure that was never agreed upon.
  const calcSettlement = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const monthly = receipts.filter(r => {
      const d = r.created_at ? new Date(r.created_at) : null;
      return d && d >= start && d <= end && r.status === 'approved'; // approved only
    });

    const byPayer: Record<string, number> = {};
    const names: Record<string, string> = {};
    for (const r of monthly) {
      byPayer[r.requester_id] = (byPayer[r.requester_id] || 0) + Number(r.amount);
      if (r.requester?.full_name) names[r.requester_id] = r.requester.full_name;
    }

    const total = Object.values(byPayer).reduce((s, v) => s + v, 0);
    const payers = Object.entries(byPayer);

    if (payers.length < 2) {
      return { totalSpent: total, settlement: null };
    }

    payers.sort((a, b) => b[1] - a[1]);
    const [bigId, bigAmt] = payers[0];
    const [smallId] = payers[1];
    const owes = bigAmt - total / 2;

    return {
      totalSpent: total,
      settlement: {
        fromName: names[smallId] || 'Parent B',
        toName: names[bigId] || 'Parent A',
        amount: owes,
      },
    };
  };

  const statusIcon = (status: string | null) => {
    if (status === 'approved') return <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-green-500" />;
    if (status === 'rejected') return <AlertCircle aria-hidden="true" className="w-4 h-4 text-red-500" />;
    return <Clock aria-hidden="true" className="w-4 h-4 text-yellow-500" />;
  };

  const statusLabel = (r: Receipt) =>
    r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Disputed' : 'Pending';

  const { totalSpent, settlement } = calcSettlement();
  const capLevel = monthlyRequestLimit !== 'unlimited' ? getCapLevel(myMonthlyCount, monthlyRequestLimit) : null;

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading receipts…</span>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly request cap warning banner */}
      {capLevel === 'warn' && monthlyRequestLimit !== 'unlimited' && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800">
          <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <p className="text-sm">
            You've used <strong className="tabular-nums">{myMonthlyCount}</strong> of your{' '}
            <strong className="tabular-nums">{monthlyRequestLimit}</strong> {tierConfig?.name ?? 'plan'} monthly requests.{' '}
            <a href="/subscriptions" className="underline font-medium">Upgrade</a> for a higher limit.
          </p>
        </div>
      )}
      {capLevel === 'over' && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-orange-300 bg-orange-50 text-orange-800">
          <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <p className="text-sm">
            You've reached your monthly request limit. Your last receipt was still saved.{' '}
            <a href="/subscriptions" className="underline font-medium">Upgrade now</a> to keep logging.
          </p>
        </div>
      )}
      {capLevel === 'hard' && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-red-300 bg-red-50 text-red-800">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <p className="text-sm">
            Monthly limit exceeded. New receipts are blocked until you{' '}
            <a href="/subscriptions" className="underline font-medium">upgrade your plan</a>.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText aria-hidden="true" className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-balance">Receipt Ledger</h1>
            <p className="text-muted-foreground">
              {isChild
                ? 'Approved expenses for your care'
                : 'Upload receipts, approve or dispute, and check the 50/50 split'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isParent && (
            <Button variant="outline" onClick={() => setSettleDialogOpen(true)}>
              <Calculator aria-hidden="true" className="w-4 h-4 mr-2" />
              50/50 Settle
            </Button>
          )}
          {isParent && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={capLevel === 'hard'}>
                  <Upload aria-hidden="true" className="w-4 h-4 mr-2" />
                  Upload Receipt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Submit Receipt</DialogTitle>
                  <DialogDescription>Upload a receipt and request approval for the 50/50 split</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={receiptFile ? `Receipt photo selected: ${receiptFile.name}. Tap to change.` : 'Upload receipt photo'}
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileRef.current?.click();
                      }
                    }}
                  >
                    {receiptFile ? (
                      <p className="text-sm font-medium text-primary">{receiptFile.name}</p>
                    ) : (
                      <>
                        <Camera aria-hidden="true" className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Tap to upload receipt photo</p>
                        <p className="text-xs text-muted-foreground mt-1">On mobile, this opens your camera</p>
                      </>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receipt-amount">Amount ({getCurrencySymbol(currency)}) *</Label>
                    <Input
                      id="receipt-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => { setAmount(e.target.value); setAmountError(''); }}
                      aria-invalid={!!amountError}
                      aria-describedby={amountError ? 'receipt-amount-error' : undefined}
                    />
                    {amountError && <p id="receipt-amount-error" className="text-xs text-destructive">{amountError}</p>}
                  </div>

                  {children.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="receipt-child">Child *</Label>
                      <Select value={childId} onValueChange={v => { setChildId(v); setChildError(''); }}>
                        <SelectTrigger
                          id="receipt-child"
                          aria-invalid={!!childError}
                          aria-describedby={childError ? 'receipt-child-error' : undefined}
                        >
                          <SelectValue placeholder="Select child" />
                        </SelectTrigger>
                        <SelectContent>
                          {children.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {childError && <p id="receipt-child-error" className="text-xs text-destructive">{childError}</p>}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="receipt-category">Category *</Label>
                    <Select value={category} onValueChange={v => { setCategory(v); setCategoryError(''); }}>
                      <SelectTrigger
                        id="receipt-category"
                        aria-invalid={!!categoryError}
                        aria-describedby={categoryError ? 'receipt-category-error' : undefined}
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoryError && <p id="receipt-category-error" className="text-xs text-destructive">{categoryError}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receipt-notes">Notes</Label>
                    <Textarea
                      id="receipt-notes"
                      placeholder="What was this for?"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Submit for Approval'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Monthly summary — parents only; never show children the settlement figure */}
      {isParent && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{formatCurrency(totalSpent, currency)}</div>
              <p className="text-xs text-muted-foreground">Combined co-parent spending (approved)</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Each Parent's Share</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{formatCurrency(totalSpent / 2, currency)}</div>
              <p className="text-xs text-muted-foreground">50/50 split of approved expenses</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">My Usage This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{formatCurrency(myMonthlyTotal, currency)}</div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {myMonthlyCount} request{myMonthlyCount === 1 ? '' : 's'}
                {monthlyRequestLimit !== 'unlimited' ? ` of ${monthlyRequestLimit} this month` : ' this month'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt list */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>
            {isChild ? 'Approved Expenses' : 'All Receipts'}
          </CardTitle>
          <CardDescription>
            {isChild
              ? 'Confirmed expenses for your care'
              : 'Your co-parenting expense history'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText aria-hidden="true" className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {isChild ? 'No approved expenses yet' : 'No receipts yet'}
              </p>
              {isParent && capLevel !== 'hard' && (
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Upload aria-hidden="true" className="w-4 h-4 mr-2" />
                  Upload Your First Receipt
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {receipts.map(r => {
                const canAct = isParent && r.status === 'pending' && r.requester_id !== user?.id;
                return (
                  <div key={r.id} className="py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {statusIcon(r.status)}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {r.category}{r.child ? ` · ${r.child.name}` : ''}
                          </p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : ''}
                            {/* Never show who paid to the child view */}
                            {isParent && r.requester?.full_name ? ` · by ${r.requester.full_name}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-sm tabular-nums">{formatCurrency(Number(r.amount), currency)}</span>
                        {isParent && (
                          <Badge variant={
                            r.status === 'approved' ? 'default'
                            : r.status === 'rejected' ? 'destructive'
                            : 'secondary'
                          }>
                            {statusLabel(r)}
                          </Badge>
                        )}
                        {r.receipt_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => viewReceipt(r.receipt_url!)}
                            aria-label="View receipt"
                            title="View receipt"
                          >
                            <ExternalLink aria-hidden="true" className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {canAct && (
                      <div className="flex gap-2 pl-7">
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleApprove(r)}
                          disabled={actingOnId === r.id}
                        >
                          <CheckCircle2 aria-hidden="true" className="w-4 h-4 mr-1" />
                          {actingOnId === r.id ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 sm:flex-none"
                          onClick={() => setDisputeTarget(r)}
                          disabled={actingOnId === r.id}
                        >
                          <XCircle aria-hidden="true" className="w-4 h-4 mr-1" />
                          Dispute
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 50/50 Settlement Dialog — parents only */}
      {isParent && (
        <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>50/50 Settlement</DialogTitle>
              <DialogDescription>
                {format(new Date(), 'MMMM yyyy')} · Approved expenses only
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Total approved this month</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(totalSpent, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Each parent's 50% share</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(totalSpent / 2, currency)}</span>
                </div>
              </div>
              {settlement ? (
                <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-3">
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      Net balance: {settlement.fromName} owes {settlement.toName}
                    </p>
                    <p className="text-3xl font-bold text-primary mt-1 tabular-nums">
                      {formatCurrency(settlement.amount, currency)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs h-auto py-2 whitespace-normal text-left justify-start"
                    onClick={() => toast.info(SETTLE_DISCLAIMER, { duration: 6000 })}
                  >
                    <Info aria-hidden="true" className="w-4 h-4 mr-2 shrink-0" />
                    {SETTLE_DISCLAIMER}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Both co-parents need approved receipts this month for a settlement calculation.
                </p>
              )}
              <p className="text-xs text-muted-foreground text-center border-t pt-3">
                This figure is for informational purposes only. SupportCard does not initiate
                or process any transfer of funds. Settlement occurs off-platform at your discretion.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dispute confirmation */}
      <AlertDialog open={!!disputeTarget} onOpenChange={open => !open && setDisputeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispute this receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              {disputeTarget && (
                <>
                  This will dispute the {disputeTarget.category} receipt for{' '}
                  <span className="tabular-nums font-medium">{formatCurrency(disputeTarget.amount, currency)}</span>.
                  Disputed receipts cannot be re-opened — the requester would need to submit a new receipt.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => disputeTarget && handleDispute(disputeTarget)}
            >
              Dispute Receipt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReceiptLedger;
