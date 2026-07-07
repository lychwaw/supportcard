import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/currency';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import SubscriptionGate from '@/components/SubscriptionGate';
import { Scale, Users, FileText, MessageSquare, MapPin, Download, Lock, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { generateCourtRecordPdf } from '@/lib/courtExport';

interface LinkedFamily {
  id: string;
  parent_id: string;
  parent: { full_name: string | null; email: string | null } | null;
}

interface ChildRow {
  id: string;
  name: string;
}

interface Receipt {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  status: string | null;
  created_at: string | null;
  requester?: { full_name: string | null } | null;
  child?: { name: string } | null;
}

interface MessageRow {
  id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string | null } | null;
}

interface LogRow {
  id: string;
  created_at: string;
  notes: string | null;
  kind: 'checkin' | 'exchange';
  detail: string;
}

const ProfessionalPortal = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { canAccessProfessionalPortal } = usePermissions();

  const [families, setFamilies] = useState<LinkedFamily[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user) loadFamilies();
  }, [user]);

  useEffect(() => {
    if (selectedParentId) loadFamilyData(selectedParentId);
  }, [selectedParentId]);

  const loadFamilies = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('professional_links')
        .select('id, parent_id, parent:parent_id(full_name, email)')
        .eq('professional_id', user!.id)
        .eq('status', 'active');

      if (error) throw error;
      setFamilies(data || []);
      if (data && data.length > 0 && !selectedParentId) {
        setSelectedParentId(data[0].parent_id);
      }
    } catch (error) {
      console.error('Error loading linked families:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFamilyData = async (parentId: string) => {
    setLoadingFamily(true);
    try {
      const { data: childrenData } = await (supabase as any)
        .from('children')
        .select('id, name')
        .eq('parent_id', parentId);
      setChildren(childrenData || []);

      const childIds = (childrenData || []).map((c: any) => c.id);

      if (childIds.length > 0) {
        const { data: receiptData } = await supabase
          .from('expense_requests')
          .select('id, amount, category, description, status, created_at, children:child_id(name), profiles:requester_id(full_name)')
          .in('child_id', childIds)
          .order('created_at', { ascending: false })
          .limit(50);

        setReceipts(
          (receiptData || []).map((r: any) => ({
            ...r,
            requester: r.profiles,
            child: r.children,
          }))
        );

        const { data: checkins } = await (supabase as any)
          .from('custody_checkins')
          .select('id, created_at, notes, event_type')
          .in('child_id', childIds)
          .order('created_at', { ascending: false })
          .limit(25);

        const { data: exchanges } = await (supabase as any)
          .from('exchange_logs')
          .select('id, created_at, notes, handoff_from, handoff_to')
          .in('child_id', childIds)
          .order('created_at', { ascending: false })
          .limit(25);

        const combinedLogs: LogRow[] = [
          ...(checkins || []).map((c: any) => ({
            id: c.id,
            created_at: c.created_at,
            notes: c.notes,
            kind: 'checkin' as const,
            detail: `Check-in (${c.event_type})`,
          })),
          ...(exchanges || []).map((e: any) => ({
            id: e.id,
            created_at: e.created_at,
            notes: e.notes,
            kind: 'exchange' as const,
            detail: `Exchange: ${e.handoff_from || '?'} → ${e.handoff_to || '?'}`,
          })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setLogs(combinedLogs);
      } else {
        setReceipts([]);
        setLogs([]);
      }

      const { data: messageData } = await supabase
        .from('messages')
        .select('id, content, created_at, profiles:sender_id(full_name)')
        .or(`sender_id.eq.${parentId},receiver_id.eq.${parentId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      setMessages(
        (messageData || []).map((m: any) => ({ ...m, sender: m.profiles }))
      );
    } catch (error) {
      console.error('Error loading family data:', error);
      toast.error('Failed to load family records');
    } finally {
      setLoadingFamily(false);
    }
  };

  const handleClaimInvite = async () => {
    if (!claimToken.trim()) {
      toast.error('Enter an invite code');
      return;
    }

    setClaiming(true);
    try {
      const { error } = await (supabase as any)
        .from('professional_links')
        .update({
          professional_id: user!.id,
          status: 'active',
          accepted_at: new Date().toISOString(),
        })
        .eq('token', claimToken.trim())
        .eq('status', 'pending');

      if (error) throw error;
      toast.success('Family linked successfully');
      setClaimToken('');
      loadFamilies();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to claim invite — check the code and try again');
    } finally {
      setClaiming(false);
    }
  };

  const handleExport = async () => {
    if (!selectedParentId) return;
    setExporting(true);
    try {
      const familyName = families.find(f => f.parent_id === selectedParentId)?.parent?.full_name || 'Family';
      await generateCourtRecordPdf({
        title: `Court Record — ${familyName}`,
        receipts,
        messages,
        logs,
      });
      toast.success('Court record exported');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export court record');
    } finally {
      setExporting(false);
    }
  };

  const statusIcon = (status: string | null) => {
    if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" aria-hidden="true" />;
    return <Clock className="w-4 h-4 text-yellow-500" aria-hidden="true" />;
  };

  if (!canAccessProfessionalPortal) {
    return (
      <SubscriptionGate
        title="Professional Portal requires the Professional plan"
        description="Upgrade to access multi-family read-only dashboards and bulk exports."
        ctaText="View Plans"
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading professional portal…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  const selectedFamily = families.find(f => f.parent_id === selectedParentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Scale aria-hidden="true" className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-balance">Professional Portal</h1>
            <p className="text-muted-foreground">Read-only access to your linked families</p>
          </div>
        </div>
        {families.length > 1 && (
          <Select value={selectedParentId} onValueChange={setSelectedParentId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select family" />
            </SelectTrigger>
            <SelectContent>
              {families.map(f => (
                <SelectItem key={f.parent_id} value={f.parent_id}>
                  {f.parent?.full_name || f.parent?.email || 'Family'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Claim an invite already sent to this email */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Have an invite code?</CardTitle>
          <CardDescription>Paste the code from a parent's invite link to link a new family</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="claim-token" className="sr-only">Invite code</Label>
            <Input
              id="claim-token"
              placeholder="prof_..."
              value={claimToken}
              onChange={e => setClaimToken(e.target.value)}
            />
          </div>
          <Button onClick={handleClaimInvite} disabled={claiming || !claimToken.trim()}>
            {claiming ? 'Linking...' : 'Link Family'}
          </Button>
        </CardContent>
      </Card>

      {families.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users aria-hidden="true" className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No families linked yet</p>
            <p className="text-xs text-muted-foreground mt-1">Ask a parent to invite you from their Family page</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" aria-hidden="true" />
              Viewing {selectedFamily?.parent?.full_name || selectedFamily?.parent?.email || 'family'} — read-only
            </div>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || loadingFamily}>
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              {exporting ? 'Exporting...' : 'Export Court Record'}
            </Button>
          </div>

          {loadingFamily ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
                    Receipts
                  </CardTitle>
                  <CardDescription>{children.map(c => c.name).join(', ') || 'No children'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {receipts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No receipts logged</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {receipts.map(r => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            {statusIcon(r.status)}
                            <span className="truncate">{r.description || r.category}{r.child ? ` · ${r.child.name}` : ''}</span>
                          </div>
                          <span className="font-medium tabular-nums shrink-0 ml-2">{formatCurrency(r.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" aria-hidden="true" />
                    Messages
                  </CardTitle>
                  <CardDescription>Private co-parent chat history</CardDescription>
                </CardHeader>
                <CardContent>
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No messages</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {messages.map(m => (
                        <div key={m.id} className="p-2 rounded-lg border text-sm">
                          <p className="font-medium text-xs text-muted-foreground">
                            {m.sender?.full_name || 'Unknown'} · {format(new Date(m.created_at), 'dd MMM HH:mm')}
                          </p>
                          <p className="truncate">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-soft lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" aria-hidden="true" />
                    Custody Logs
                  </CardTitle>
                  <CardDescription>Check-ins and exchanges</CardDescription>
                </CardHeader>
                <CardContent>
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No custody logs</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {logs.map(l => (
                        <div key={l.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                          <span>{l.detail}{l.notes ? ` — ${l.notes}` : ''}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {format(new Date(l.created_at), 'dd MMM HH:mm')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProfessionalPortal;
