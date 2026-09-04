import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Share } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';
import { useCurrency } from '@/hooks/use-currency';
import { convertAmount, CURRENCY_SYMBOL, type Currency } from '@/lib/currency';
import { logPositiveAction, maybeAskForReview } from '@/lib/review';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface MonthOption { label: string; year: number; month: number }

function buildMonthOptions(): MonthOption[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { label: `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() };
  });
}

function endOfMonth(year: number, month: number): string {
  const last = new Date(year, month + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}
function startOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
function formatCurrency(val: number, sym: string): string {
  if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(1)}k`;
  return `${sym}${val.toFixed(2)}`;
}

export default function MonthlyReportScreen() {
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();
  const sym = CURRENCY_SYMBOL[currency];
  const monthOptions = buildMonthOptions();

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalAmount: number; eventsCount: number; checkinsCount: number } | null>(null);

  const selectedOption = monthOptions[selectedIdx];

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setReportText(null);
    setStats(null);

    try {
      const { year, month } = selectedOption;
      const start = startOfMonth(year, month);
      const end = endOfMonth(year, month);
      const monthName = MONTH_NAMES[month];

      const [expensesRes, eventsRes, checkinsRes] = await Promise.all([
        supabase.from('expense_requests').select('amount, currency, category, status').gte('created_at', start).lte('created_at', end),
        supabase.from('calendar_events' as any).select('event_type, event_date').gte('created_at' as any, start).lte('created_at' as any, end),
        supabase.from('custody_checkins').select('event_type, notes').gte('created_at', start).lte('created_at', end),
      ]);

      const expenses = (expensesRes.data as Array<{ amount: number; currency: Currency; category: string; status: string }>) ?? [];
      const events = eventsRes.data ?? [];
      const checkins = checkinsRes.data ?? [];
      const totalAmount = expenses.reduce((s, e) => s + convertAmount(Number(e.amount) || 0, e.currency ?? 'ZAR', currency), 0);

      setStats({ totalAmount, eventsCount: events.length, checkinsCount: checkins.length });

      const prompt = `Generate a concise, neutral monthly co-parenting summary for ${monthName} ${year}. Data: ${JSON.stringify({ expenses_count: expenses.length, total_requested: totalAmount.toFixed(2), events_count: events.length, checkins_count: checkins.length })}. Include: spending summary, activity summary, and 1-2 constructive suggestions for next month. Keep it under 200 words. Positive, neutral tone.`;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ action: 'scai-chat', messages: [{ role: 'user', content: prompt }] }),
        });

        if (response.status === 403) {
          setReportText('__upgrade__');
        } else if (!response.ok) {
          setReportText('__error__');
        } else {
          const json = await response.json();
          setReportText(json?.reply ?? json?.content ?? json?.choices?.[0]?.message?.content ?? '');
          logPositiveAction(); // got a real report out — counts toward a rating ask
        }
      } catch {
        setReportText('__error__');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not load report data. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedOption]);

  return (
    <>
      <Stack.Screen options={{ title: 'Monthly Report', headerTintColor: brand.blue }} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }} showsVerticalScrollIndicator={false}>

        {/* Month selector */}
        <View style={{ backgroundColor: colors.surface, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 10, paddingHorizontal: 20 }}>
            Select Month
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {monthOptions.map((opt, idx) => (
              <Pressable key={opt.label} onPress={() => { setSelectedIdx(idx); setReportText(null); setStats(null); }}
                style={({ pressed }) => ({
                  paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: selectedIdx === idx ? brand.blue : colors.background,
                  borderWidth: selectedIdx === idx ? 0 : 0.5, borderColor: colors.separator,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: selectedIdx === idx ? '#fff' : colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ padding: 20, gap: 20 }}>
          {/* Generate CTA */}
          <Pressable onPress={handleGenerate} disabled={isGenerating}
            style={({ pressed }) => ({ borderRadius: 18, borderCurve: 'continuous', backgroundColor: brand.blue, padding: 20, alignItems: 'center', gap: 6, opacity: pressed || isGenerating ? 0.8 : 1 })}>
            <Ionicons name="bar-chart-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
              {isGenerating ? 'Generating…' : `Generate ${selectedOption.label} Report`}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>AI-powered summary of the month</Text>
          </Pressable>

          {/* Loading */}
          {isGenerating && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 40, alignItems: 'center', gap: 16, borderWidth: 0.5, borderColor: colors.separator }}>
              <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name="hardware-chip-outline" size={36} color={brand.blue} />
              </View>
              <ActivityIndicator color={brand.blue} size="large" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>Generating your report…</Text>
              <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>
                Analysing expenses, events, and check-ins for {selectedOption.label}
              </Text>
            </View>
          )}

          {/* Report card — shows whenever stats are available */}
          {!isGenerating && stats && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 20, borderLeftWidth: 3, borderLeftColor: brand.blue, borderWidth: 0.5, borderColor: colors.separator, gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: brand.blue + '15', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="bar-chart-outline" size={22} color={brand.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label }}>Monthly Summary</Text>
                  <View style={{ alignSelf: 'flex-start', backgroundColor: brand.blue + '12', borderRadius: 8, borderCurve: 'continuous', paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: brand.blue }}>{MONTH_NAMES[selectedOption.month]} {selectedOption.year}</Text>
                  </View>
                </View>
              </View>

              {/* AI summary text — only when available */}
              {reportText && reportText !== '__upgrade__' && reportText !== '__error__' && (
                <Text style={{ fontSize: 15, color: colors.label, lineHeight: 23 }} selectable>{reportText}</Text>
              )}

              {/* Upgrade prompt when user lacks Plus */}
              {reportText === '__upgrade__' && (
                <View style={{ backgroundColor: brand.teal + '12', borderRadius: 12, borderCurve: 'continuous', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="flash" size={18} color={brand.teal} />
                  <Text style={{ fontSize: 14, color: colors.label, flex: 1, lineHeight: 20 }}>
                    Upgrade to <Text style={{ fontWeight: '700', color: brand.teal }}>Plus</Text> to unlock the AI-powered narrative summary.
                  </Text>
                </View>
              )}

              {/* Stat chips */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { value: formatCurrency(stats.totalAmount, sym), label: 'Total Expenses', color: '#F59E0B' },
                  { value: String(stats.eventsCount), label: 'Events', color: brand.blue },
                  { value: String(stats.checkinsCount), label: 'Check-ins', color: brand.teal },
                ].map(chip => (
                  <View key={chip.label} style={{ flex: 1, backgroundColor: chip.color + '12', borderRadius: 12, borderCurve: 'continuous', padding: 12, alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: chip.color, fontVariant: ['tabular-nums'] }}>{chip.value}</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryLabel, fontWeight: '600', textAlign: 'center' }}>{chip.label}</Text>
                  </View>
                ))}
              </View>

              <View style={{ gap: 10 }}>
                {reportText && reportText !== '__upgrade__' && reportText !== '__error__' && (
                  <Pressable onPress={async () => {
                    await Share.share({ message: reportText, title: `SupportCard Report — ${monthOptions[selectedIdx].label}` });
                    // Sharing a report is the strongest "this was useful" signal we get.
                    await logPositiveAction();
                    setTimeout(() => { maybeAskForReview(); }, 800);
                  }}
                    style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', padding: 16, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Share Report</Text>
                  </Pressable>
                )}
                <Pressable onPress={handleGenerate}
                  style={({ pressed }) => ({ borderRadius: 14, borderCurve: 'continuous', padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator, backgroundColor: colors.background, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <Text style={{ color: colors.secondaryLabel, fontWeight: '600', fontSize: 15 }}>Regenerate</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Empty state — only shown before first generation */}
          {!isGenerating && !stats && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 48, alignItems: 'center', gap: 14, borderWidth: 0.5, borderColor: colors.separator }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name="calendar-outline" size={32} color={brand.blue} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label, textAlign: 'center' }}>Select a month and generate your report</Text>
              <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 20 }}>
                Your AI co-parenting assistant will summarise expenses, events, and custody check-ins, then suggest ways to improve next month.
              </Text>
              <View style={{ backgroundColor: brand.blue + '08', borderRadius: 14, borderCurve: 'continuous', padding: 14, gap: 6, width: '100%', borderWidth: 0.5, borderColor: brand.blue + '20' }}>
                {['Expense requests and totals', 'Calendar events logged', 'Custody check-ins', 'Suggestions for next month'].map(line => (
                  <Text key={line} style={{ fontSize: 13, color: colors.label, lineHeight: 20 }}>· {line}</Text>
                ))}
              </View>
            </View>
          )}

          {/* Privacy note */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 0.5, borderColor: colors.separator }}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.secondaryLabel} />
            <Text style={{ fontSize: 12, color: colors.secondaryLabel, flex: 1, lineHeight: 18 }}>
              Reports use anonymised counts and totals only — no personal names, messages, or notes are sent to the AI.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
