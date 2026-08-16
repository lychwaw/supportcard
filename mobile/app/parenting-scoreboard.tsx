import { useState, useEffect } from 'react';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';

interface Metrics {
  expenses: number; events: number; checkins: number; messages: number; streakDays: number;
}

function computeScore(m: Metrics): number {
  return Math.min(100, m.checkins * 10 + m.events * 5 + m.expenses * 8 + m.messages * 2);
}
function startOfCurrentMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function buildInsight(m: Metrics): string {
  if (m.events >= 5) return "You've been consistent with calendar events this month — keep it up!";
  if (m.checkins >= 3) return 'Great work logging custody check-ins. A strong record helps everyone.';
  if (m.expenses === 0) return 'Tip: Log expense requests to keep finances transparent for both parents.';
  if (m.messages === 0) return 'Tip: Messaging through the app creates a neutral, timestamped record.';
  return 'Tip: Log custody check-ins regularly to build a stronger co-parenting record.';
}

export default function ParentingScoreboardScreen() {
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const monthStart = startOfCurrentMonth();

      const [{ count: expenses }, { count: events }, { count: checkins }, { count: messages }, { data: recentActivity }] = await Promise.all([
        supabase.from('expense_requests' as any).select('id', { count: 'exact', head: true }).eq('requester_id', user.id).gte('created_at', monthStart),
        supabase.from('calendar_events' as any).select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', monthStart),
        supabase.from('custody_checkins' as any).select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', monthStart),
        supabase.from('messages' as any).select('id', { count: 'exact', head: true }).eq('sender_id', user.id).gte('created_at', monthStart),
        supabase.rpc('get_activity_dates_last_30' as any, { uid: user.id }),
      ]);

      let streakDays = 0;
      if (recentActivity && Array.isArray(recentActivity)) {
        const uniqueDays = new Set(recentActivity.map((r: any) => (r.activity_date ?? '').slice(0, 10)));
        streakDays = uniqueDays.size;
      } else {
        streakDays = Math.min(30, Math.ceil(((expenses ?? 0) + (events ?? 0) + (checkins ?? 0) + (messages ?? 0)) / 4));
      }

      setMetrics({ expenses: expenses ?? 0, events: events ?? 0, checkins: checkins ?? 0, messages: messages ?? 0, streakDays });
      setLoading(false);
    })();
  }, []);

  if (loading || !metrics) {
    return (
      <>
        <Stack.Screen options={{ title: 'Parenting Scoreboard', headerTintColor: brand.blue }} />
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={brand.blue} size="large" />
        </View>
      </>
    );
  }

  const score = computeScore(metrics);
  const insight = buildInsight(metrics);
  const total = metrics.expenses + metrics.events + metrics.checkins + metrics.messages || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  const scoreColor = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : brand.blue;

  return (
    <>
      <Stack.Screen options={{ title: 'Parenting Scoreboard', headerTintColor: brand.blue }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>

        {/* Hero score card */}
        <View style={{ borderRadius: 22, borderCurve: 'continuous', padding: 24, alignItems: 'center', backgroundColor: '#1C3252' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
            This month
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 22 }}>Co-Parenting Score</Text>
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' }}>
            <Text style={{ fontSize: 36, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] }}>{score}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600' }}>/ 100</Text>
          </View>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
            Your coordination score this month
          </Text>
        </View>

        {/* 2x2 Stat grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[
            { label: 'Expense Requests', value: metrics.expenses, icon: 'cash-outline' as const, color: '#F59E0B' },
            { label: 'Calendar Events',  value: metrics.events,   icon: 'calendar-outline' as const, color: brand.blue },
            { label: 'Check-ins',        value: metrics.checkins, icon: 'location-outline' as const, color: brand.teal },
            { label: 'Messages',         value: metrics.messages, icon: 'chatbubbles-outline' as const, color: '#22C55E' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', padding: 18, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator, gap: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: s.color + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name={s.icon} size={22} color={s.color} />
              </View>
              <Text style={{ fontSize: 28, fontWeight: '700', color: s.color, fontVariant: ['tabular-nums'] }}>{s.value}</Text>
              <Text style={{ fontSize: 12, color: colors.secondaryLabel, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Breakdown */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 20, borderWidth: 0.5, borderColor: colors.separator, gap: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>What's Logged</Text>
          {[
            { icon: 'cash-outline' as const,        label: 'Expense Requests', count: metrics.expenses, color: '#F59E0B' },
            { icon: 'calendar-outline' as const,    label: 'Calendar Events',  count: metrics.events,   color: brand.blue },
            { icon: 'location-outline' as const,    label: 'Check-ins',        count: metrics.checkins, color: brand.teal },
            { icon: 'chatbubbles-outline' as const, label: 'Messages',         count: metrics.messages, color: '#22C55E' },
          ].map(r => (
            <View key={r.label}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                <Ionicons name={r.icon} size={14} color={r.color} />
                <Text style={{ fontSize: 13, color: colors.label, flex: 1 }}>{r.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.label, fontVariant: ['tabular-nums'], marginRight: 4 }}>{r.count}</Text>
                <Text style={{ fontSize: 12, color: colors.secondaryLabel, minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{pct(r.count)}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${pct(r.count)}%`, height: '100%', backgroundColor: r.color, borderRadius: 3 }} />
              </View>
            </View>
          ))}
        </View>

        {/* Streak */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 20, borderLeftWidth: 3, borderLeftColor: brand.teal, borderWidth: 0.5, borderColor: colors.separator }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="flame-outline" size={17} color={brand.teal} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>Coordination Streak</Text>
          </View>
          <Text style={{ fontSize: 36, fontWeight: '700', color: brand.teal, fontVariant: ['tabular-nums'] }}>{metrics.streakDays}</Text>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>days of logging activity in the last 30 days</Text>
        </View>

        {/* Insight */}
        <View style={{ backgroundColor: brand.blue + '08', borderRadius: 20, borderCurve: 'continuous', padding: 20, borderLeftWidth: 3, borderLeftColor: brand.blue, borderWidth: 0.5, borderColor: brand.blue + '20' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="bulb-outline" size={14} color={brand.blue} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: brand.blue }}>Insight</Text>
          </View>
          <Text style={{ fontSize: 14, color: colors.label, lineHeight: 21 }}>{insight}</Text>
        </View>
      </ScrollView>
    </>
  );
}
