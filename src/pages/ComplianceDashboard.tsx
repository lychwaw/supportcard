import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { z } from 'zod';

// Zod schema for compliance score validation
const ComplianceScoreSchema = z.object({
  score_percentage: z.number().min(0).max(100),
  payment_adherence: z.number().min(0).max(100),
  response_time_score: z.number().min(0).max(100),
});

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
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [currentScore, setCurrentScore] = useState<ComplianceScore | null>(null);
  const [history, setHistory] = useState<ComplianceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    if (user && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [user, children]);

  useEffect(() => {
    if (user && selectedChildId) {
      fetchComplianceData();
    }
  }, [user, selectedChildId]);

  const fetchComplianceData = async () => {
    if (!user || !selectedChildId) return;

    setLoading(true);
    try {
      // Calculate current period (last 30 days)
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30);

      // Call server-side function to calculate score
      const { data: scoreData, error: scoreError } = await (supabase.rpc as any)(
        'calculate_compliance_score',
        {
          p_user_id: user.id,
          p_child_id: selectedChildId,
          p_period_start: periodStart.toISOString().split('T')[0],
          p_period_end: periodEnd.toISOString().split('T')[0],
        }
      );

      if (scoreError) {
        console.error('Error calculating compliance score:', scoreError);
        // Don't throw - allow page to load even if calculation fails
      }

      // Validate with Zod (if data exists)
      if (scoreData && Array.isArray(scoreData) && scoreData.length > 0) {
        const validated = ComplianceScoreSchema.parse(scoreData[0]);
        
        // Store or update compliance score
        const { error: upsertError } = await (supabase.from as any)('compliance_scores')
          .upsert({
            user_id: user.id,
            child_id: selectedChildId,
            score_percentage: validated.score_percentage,
            payment_adherence: validated.payment_adherence,
            response_time_score: validated.response_time_score,
            period_start: periodStart.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
          }, {
            onConflict: 'user_id,child_id,period_start,period_end'
          });

        if (upsertError) throw upsertError;
      }

      // Fetch current score
      const { data: current, error: currentError } = await (supabase.from as any)('compliance_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('child_id', selectedChildId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      if (currentError && currentError.code !== 'PGRST116') throw currentError;
      if (current) setCurrentScore(current as ComplianceScore);

      // Fetch history from compliance_scores
      const { data: historyData, error: historyError } = await (supabase.from as any)('compliance_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('child_id', selectedChildId)
        .order('period_start', { ascending: false })
        .limit(12);

      if (historyError) throw historyError;
      if (historyData) {
        // Fetch unpaid/paid amounts separately for each period
        const historyWithAmounts = await Promise.all(
          historyData.map(async (h: any) => {
            const periodStart = new Date(h.period_start);
            const periodEnd = new Date(h.period_end);
            
            // Get unpaid amount
            const { data: unpaidData } = await supabase
              .from('expense_requests')
              .select('amount')
              .eq('child_id', selectedChildId)
              .eq('status', 'pending')
              .gte('created_at', periodStart.toISOString())
              .lte('created_at', periodEnd.toISOString());
            
            const unpaid_amount = unpaidData?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
            
            // Get paid amount
            const { data: paidData } = await supabase
              .from('expense_requests')
              .select('amount')
              .eq('child_id', selectedChildId)
              .eq('status', 'approved')
              .gte('created_at', periodStart.toISOString())
              .lte('created_at', periodEnd.toISOString());
            
            const paid_amount = paidData?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
            
            return {
              period_start: h.period_start,
              period_end: h.period_end,
              score_percentage: Number(h.score_percentage),
              unpaid_amount,
              paid_amount,
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
  };

  const generatePDF = async () => {
    if (!user || !selectedChildId) return;

    setIsGeneratingPDF(true);
    try {
      // Fetch all expense data for PDF
      const { data: expenses, error: expensesError } = await supabase
        .from('expense_requests')
        .select('*')
        .eq('child_id', selectedChildId)
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;

      // In production, this would call an Edge Function to generate PDF
      // For now, we'll create a simple text-based report
      const report = {
        generated_at: new Date().toISOString(),
        child_id: selectedChildId,
        compliance_score: currentScore?.score_percentage || 0,
        total_expenses: expenses?.length || 0,
        paid_expenses: expenses?.filter(e => e.status === 'approved').length || 0,
        unpaid_expenses: expenses?.filter(e => e.status === 'pending').length || 0,
        expenses: expenses || [],
      };

      // Create downloadable JSON (in production, use PDF library like jsPDF or call Edge Function)
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${selectedChildId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Compliance report generated (JSON format - PDF generation requires Edge Function)');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Compliance Score</h1>
            <p className="text-muted-foreground">Track payment history and response times</p>
          </div>
        </div>
        <div className="flex gap-2">
          {children.length > 0 && (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-[200px]">
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
          <Button onClick={generatePDF} disabled={isGeneratingPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            {isGeneratingPDF ? 'Generating...' : 'Export Report'}
          </Button>
        </div>
      </div>

      {!selectedChildId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Please select a child to view compliance data</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Compliance Score Card */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Compliance Score</CardTitle>
              <CardDescription>
                Payment history and response times for {selectedChild?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentScore ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
                      <div className="flex items-center gap-3">
                        <span className={`text-5xl font-bold ${getScoreColor(currentScore.score_percentage)}`}>
                          {currentScore.score_percentage.toFixed(1)}%
                        </span>
                        <Badge className={getScoreBadge(currentScore.score_percentage)}>
                          {currentScore.score_percentage >= 80 ? 'Excellent' : 
                           currentScore.score_percentage >= 60 ? 'Good' : 'Needs Improvement'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Last Calculated</p>
                      <p className="text-sm font-medium">
                        {new Date(currentScore.calculated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Payment Adherence</p>
                      <p className="text-2xl font-semibold">{currentScore.payment_adherence.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Approved expenses / Total requests
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Response Time Score</p>
                      <p className="text-2xl font-semibold">{currentScore.response_time_score.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on approval speed
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No compliance data available yet</p>
                  <Button onClick={fetchComplianceData} className="mt-4" variant="outline">
                    Calculate Score
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progression Chart */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Track paid and unpaid expenses over time</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period_start" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value, currency)}
                      labelFormatter={(label) => `Period: ${new Date(label).toLocaleDateString()}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="unpaid_amount" 
                      stroke="#ef4444" 
                      name="Unpaid" 
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="paid_amount" 
                      stroke="#22c55e" 
                      name="Paid" 
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score_percentage" 
                      stroke="#3b82f6" 
                      name="Compliance Score %" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No historical data available</p>
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

