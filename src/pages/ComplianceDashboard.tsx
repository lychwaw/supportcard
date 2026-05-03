import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/currency';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SubscriptionGate from '@/components/SubscriptionGate';
import { IdVerification } from '@/components/IdVerification';

interface ComplianceScore {
  id: string;
  user_id: string;
  child_id: string | null;
  score_percentage: number;
  payment_adherence: number;
  response_time_score: number;
  calculated_at: string;
  period_start: string;
  period_end: string;
}

interface ComplianceHistory {
  period_start: string;
  period_end: string;
  score_percentage: number;
  unpaid_amount: number;
  paid_amount: number;
}

const ComplianceDashboard = () => {
  const { user } = useAuth();
  const { children } = useRole();
  const { currency } = useCurrency();
  const { canViewCompliance } = usePermissions();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [currentScore, setCurrentScore] = useState<ComplianceScore | null>(null);
  const [history, setHistory] = useState<ComplianceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Must be defined before any early returns so it's always in scope for useEffects.
  const fetchComplianceData = useCallback(async (childId: string) => {
    if (!user || !childId) return;

    setLoading(true);
    try {
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30);

      const { data: scoreData, error: scoreError } = await (supabase.rpc as any)(
        'calculate_compliance_score',
        {
          p_user_id: user.id,
          p_child_id: childId,
          p_period_start: periodStart.toISOString().split('T')[0],
          p_period_end: periodEnd.toISOString().split('T')[0],
        }
      );

      if (!scoreError && scoreData && Array.isArray(scoreData) && scoreData.length > 0) {
        const s = scoreData[0];
        await (supabase.from as any)('compliance_scores').upsert(
          {
            user_id: user.id,
            child_id: childId,
            score_percentage: Number(s.score_percentage) || 0,
            payment_adherence: Number(s.payment_adherence) || 0,
            response_time_score: Number(s.response_time_score) || 0,
            period_start: periodStart.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
          },
          { onConflict: 'user_id,child_id,period_start,period_end' }
        );
      }

      const { data: current, error: currentError } = await (supabase.from as any)('compliance_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('child_id', childId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!currentError && current) setCurrentScore(current as ComplianceScore);

      const { data: historyData } = await (supabase.from as any)('compliance_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('child_id', childId)
        .order('period_start', { ascending: false })
        .limit(12);

      if (historyData && Array.isArray(historyData)) {
        const historyWithAmounts: ComplianceHistory[] = await Promise.all(
          historyData.map(async (h: any) => {
            const ps = new Date(h.period_start);
            const pe = new Date(h.period_end);

            const { data: unpaidData } = await supabase
              .from('expense_requests')
              .select('amount')
              .eq('child_id', childId)
              .eq('status', 'pending')
              .gte('created_at', ps.toISOString())
              .lte('created_at', pe.toISOString());

            const { data: paidData } = await supabase
              .from('expense_requests')
              .select('amount')
              .eq('child_id', childId)
              .eq('status', 'approved')
              .gte('created_at', ps.toISOString())
              .lte('created_at', pe.toISOString());

            return {
              period_start: h.period_start,
              period_end: h.period_end,
              score_percentage: Number(h.score_percentage),
              unpaid_amount: unpaidData?.reduce((s, e) => s + Number(e.amount || 0), 0) ?? 0,
              paid_amount: paidData?.reduce((s, e) => s + Number(e.amount || 0), 0) ?? 0,
            };
          })
        );
        setHistory(historyWithAmounts);
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [user, children, selectedChildId]);

  useEffect(() => {
    if (canViewCompliance && user && selectedChildId) {
      fetchComplianceData(selectedChildId);
    }
  }, [user, selectedChildId, canViewCompliance, fetchComplianceData]);

  // Non-Legal-tier view — show ID verification and upgrade prompt.
  if (!canViewCompliance) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Compliance</h1>
            <p className="text-muted-foreground">Identity verification and compliance analytics</p>
          </div>
        </div>
        <IdVerification />
        <SubscriptionGate
          title="Compliance analytics are a Legal tier feature"
          description="Upgrade to SupportCard Legal to access compliance reporting."
        />
      </div>
    );
  }

  const exportCSV = async () => {
    if (!user || !selectedChildId) return;
    setIsExporting(true);
    try {
      const { data: expenses, error } = await supabase
        .from('expense_requests')
        .select('*')
        .eq('child_id', selectedChildId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = [
        ['Date', 'Category', 'Amount', 'Status', 'Notes'],
        ...(expenses ?? []).map((e: any) => [
          new Date(e.created_at).toLocaleDateString(),
          e.category ?? '',
          Number(e.amount).toFixed(2),
          e.status ?? '',
          (e.notes ?? '').replace(/,/g, ' '),
        ]),
      ];

      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-${selectedChildId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Compliance report exported');
    } catch {
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const getScoreColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';

  const getScoreBadgeClass = (score: number) =>
    score >= 80
      ? 'bg-green-100 text-green-800 border-green-200'
      : score >= 60
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200';

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Compliance Score</h1>
            <p className="text-muted-foreground">Payment history and response times</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {children.length > 0 && (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={exportCSV} disabled={isExporting || !selectedChildId} variant="outline">
            <FileDown className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      <IdVerification />

      {children.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">No children added yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a child in the Family tab to start tracking compliance.
            </p>
          </CardContent>
        </Card>
      ) : !selectedChildId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Select a child to view compliance data</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Compliance Score</CardTitle>
              <CardDescription>
                Last 30 days — {selectedChild?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentScore ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
                      <div className="flex items-center gap-3">
                        <span className={`text-5xl font-bold ${getScoreColor(currentScore.score_percentage)}`}>
                          {currentScore.score_percentage.toFixed(0)}%
                        </span>
                        <Badge className={getScoreBadgeClass(currentScore.score_percentage)}>
                          {currentScore.score_percentage >= 80 ? 'Excellent' :
                           currentScore.score_percentage >= 60 ? 'Good' : 'Needs Improvement'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Last calculated</p>
                      <p className="font-medium">{new Date(currentScore.calculated_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Payment Adherence</p>
                      <p className="text-2xl font-semibold">{currentScore.payment_adherence.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Approved vs total requests</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Response Time</p>
                      <p className="text-2xl font-semibold">{currentScore.response_time_score.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Based on approval speed</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No compliance data yet for this period</p>
                  <Button
                    onClick={() => fetchComplianceData(selectedChildId)}
                    className="mt-4"
                    variant="outline"
                    size="sm"
                  >
                    Calculate now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Paid and unpaid expense amounts over time</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={[...history].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period_start"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'score_percentage' ? `${value.toFixed(0)}%` : formatCurrency(value, currency),
                        name === 'unpaid_amount' ? 'Unpaid' : name === 'paid_amount' ? 'Paid' : 'Score %',
                      ]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="paid_amount"   stroke="#22c55e" name="Paid"    strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="unpaid_amount" stroke="#ef4444" name="Unpaid"  strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="score_percentage" stroke="#3b82f6" name="Score %" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No history available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ComplianceDashboard;
