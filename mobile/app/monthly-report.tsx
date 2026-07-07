import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthOption {
  label: string;
  year: number;
  month: number; // 0-indexed
}

function buildMonthOptions(): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return options;
}

function endOfMonth(year: number, month: number): string {
  const last = new Date(year, month + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function startOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `R${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R${(val / 1_000).toFixed(1)}k`;
  return `R${val.toFixed(2)}`;
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: `${color}18`,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        gap: 4,
        borderCurve: 'continuous',
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: brand.body, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MonthlyReportScreen() {
  const insets = useSafeAreaInsets();
  const monthOptions = buildMonthOptions();

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalAmount: number;
    eventsCount: number;
    checkinsCount: number;
  } | null>(null);

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
        supabase
          .from('expense_requests')
          .select('amount, category, status')
          .gte('created_at', start)
          .lte('created_at', end),
        supabase
          .from('calendar_events' as any)
          .select('event_type, event_date')
          .gte('created_at' as any, start)
          .lte('created_at' as any, end),
        supabase
          .from('custody_checkins')
          .select('event_type, notes')
          .gte('created_at', start)
          .lte('created_at', end),
      ]);

      const expenses = (expensesRes.data as Array<{ amount: number; category: string; status: string }>) ?? [];
      const events = eventsRes.data ?? [];
      const checkins = checkinsRes.data ?? [];

      const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const expensesCount = expenses.length;
      const eventsCount = events.length;
      const checkinsCount = checkins.length;

      setStats({ totalAmount, eventsCount, checkinsCount });

      const prompt = `Generate a concise, neutral monthly co-parenting summary for ${monthName} ${year}. Data: ${JSON.stringify({
        expenses_count: expensesCount,
        total_requested: totalAmount.toFixed(2),
        events_count: eventsCount,
        checkins_count: checkinsCount,
      })}. Include: spending summary, activity summary, and 1-2 constructive suggestions for next month. Keep it under 200 words. Positive, neutral tone.`;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'scai-chat',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`AI request failed: ${response.status} ${errText}`);
      }

      const json = await response.json();
      const text: string =
        json?.reply ??
        json?.content ??
        json?.message?.content ??
        json?.choices?.[0]?.message?.content ??
        'Report generated successfully.';

      setReportText(text);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedOption]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Monthly Report',
          headerTintColor: brand.blue,
          headerStyle: { backgroundColor: brand.card },
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.lightBg }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }}
      >
        {/* Month selector */}
        <View
          style={{
            backgroundColor: brand.card,
            paddingTop: 12,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: brand.body,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 10,
              paddingHorizontal: 20,
            }}
          >
            Select Month
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {monthOptions.map((opt, idx) => (
              <Pressable
                key={opt.label}
                onPress={() => {
                  setSelectedIdx(idx);
                  setReportText(null);
                  setStats(null);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: selectedIdx === idx ? brand.blue : brand.lightBg,
                  borderWidth: 1.5,
                  borderColor: selectedIdx === idx ? brand.blue : brand.separator,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: selectedIdx === idx ? '#fff' : brand.body,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ padding: 20, gap: 20 }}>
          {/* Generate CTA */}
          <Pressable
            onPress={handleGenerate}
            disabled={isGenerating}
            style={({ pressed }) => ({
              backgroundColor: brand.blue,
              borderRadius: 18,
              padding: 20,
              alignItems: 'center',
              gap: 6,
              opacity: pressed || isGenerating ? 0.75 : 1,
              boxShadow: '0 6px 20px rgba(43,116,214,0.35)',
              borderCurve: 'continuous',
            })}
          >
            <Text style={{ fontSize: 22 }}>📊</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>
              {isGenerating ? 'Generating…' : `Generate ${selectedOption.label} Report`}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              AI-powered summary of the month
            </Text>
          </Pressable>

          {/* Loading state */}
          {isGenerating && (
            <View
              style={{
                backgroundColor: brand.card,
                borderRadius: 20,
                padding: 40,
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 2px 12px rgba(43,116,214,0.08)',
                borderCurve: 'continuous',
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: brand.lightBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 40 }}>🤖</Text>
              </View>
              <ActivityIndicator color={brand.blue} size="large" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark }}>
                Generating your report…
              </Text>
              <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
                Analysing expenses, events, and check-ins for {selectedOption.label}
              </Text>
            </View>
          )}

          {/* Report card */}
          {!isGenerating && reportText && stats && (
            <View
              style={{
                backgroundColor: brand.card,
                borderRadius: 20,
                padding: 20,
                borderLeftWidth: 4,
                borderLeftColor: brand.blue,
                boxShadow: '0 2px 16px rgba(43,116,214,0.10)',
                gap: 16,
                borderCurve: 'continuous',
              }}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: brand.dark }}>
                    Monthly Summary
                  </Text>
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: brand.lightBg,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: brand.blue }}>
                      {MONTH_NAMES[selectedOption.month]} {selectedOption.year}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Report body */}
              <Text
                style={{
                  fontSize: 15,
                  color: brand.dark,
                  lineHeight: 23,
                }}
                selectable
              >
                {reportText}
              </Text>

              {/* Stat chips */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatChip
                  value={formatCurrency(stats.totalAmount)}
                  label="Total Expenses"
                  color="#F59E0B"
                />
                <StatChip
                  value={String(stats.eventsCount)}
                  label="Events Logged"
                  color={brand.blue}
                />
                <StatChip
                  value={String(stats.checkinsCount)}
                  label="Check-ins"
                  color={brand.teal}
                />
              </View>

              {/* Action buttons */}
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() =>
                    Alert.alert('Coming Soon', 'Share via PDF is a Premium feature coming soon.')
                  }
                  style={({ pressed }) => ({
                    backgroundColor: brand.blue,
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                    opacity: pressed ? 0.8 : 1,
                    boxShadow: '0 3px 10px rgba(43,116,214,0.25)',
                    borderCurve: 'continuous',
                  })}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Share Report</Text>
                </Pressable>
                <Pressable
                  onPress={handleGenerate}
                  style={({ pressed }) => ({
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: brand.separator,
                    backgroundColor: brand.card,
                    opacity: pressed ? 0.7 : 1,
                    borderCurve: 'continuous',
                  })}
                >
                  <Text style={{ color: brand.body, fontWeight: '600', fontSize: 15 }}>Regenerate</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Empty / no report state */}
          {!isGenerating && !reportText && (
            <View
              style={{
                backgroundColor: brand.card,
                borderRadius: 20,
                padding: 48,
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 2px 12px rgba(43,116,214,0.07)',
                borderCurve: 'continuous',
              }}
            >
              <Text style={{ fontSize: 48 }}>📅</Text>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '800',
                  color: brand.dark,
                  textAlign: 'center',
                }}
              >
                Select a month and generate your report
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: brand.body,
                  textAlign: 'center',
                  lineHeight: 20,
                }}
              >
                Your AI co-parenting assistant will summarise expenses, events, and custody check-ins, then suggest ways to improve next month.
              </Text>
              <View
                style={{
                  backgroundColor: brand.lightBg,
                  borderRadius: 12,
                  padding: 14,
                  gap: 6,
                  width: '100%',
                }}
              >
                <Text style={{ fontSize: 13, color: brand.body, lineHeight: 18 }}>
                  Reports cover:
                </Text>
                {[
                  '💰  Expense requests and totals',
                  '📅  Calendar events logged',
                  '📋  Custody check-ins',
                  '💡  Suggestions for next month',
                ].map((line) => (
                  <Text key={line} style={{ fontSize: 13, color: brand.dark, lineHeight: 18 }}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Privacy note */}
          <View
            style={{
              backgroundColor: brand.lightBg,
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16 }}>🔒</Text>
            <Text style={{ fontSize: 12, color: brand.body, flex: 1, lineHeight: 17 }}>
              Reports use anonymised counts and totals only — no personal names, messages, or notes are sent to the AI.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
