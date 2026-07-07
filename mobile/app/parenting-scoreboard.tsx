import { useState, useEffect } from 'react';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Metrics {
  expenses: number;
  events: number;
  checkins: number;
  messages: number;
  streakDays: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeScore(m: Metrics): number {
  const raw = m.checkins * 10 + m.events * 5 + m.expenses * 8 + m.messages * 2;
  return Math.min(100, raw);
}

function startOfCurrentMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function buildInsight(m: Metrics): string {
  if (m.events >= 5) return "You've been consistent with calendar events this month — keep it up!";
  if (m.checkins >= 3) return 'Great work logging custody check-ins. A strong record helps everyone.';
  if (m.expenses === 0) return 'Tip: Log expense requests to keep finances transparent for both parents.';
  if (m.messages === 0) return 'Tip: Messaging through the app creates a neutral, timestamped record.';
  return 'Tip: Log custody check-ins regularly to build a stronger co-parenting record.';
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ParentingScoreboardScreen() {
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const monthStart = startOfCurrentMonth();
      const past30 = thirtyDaysAgo();

      const [
        { count: expenses },
        { count: events },
        { count: checkins },
        { count: messages },
        { data: recentActivity },
      ] = await Promise.all([
        supabase
          .from('expense_requests' as any)
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .gte('created_at', monthStart),

        supabase
          .from('calendar_events' as any)
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .gte('created_at', monthStart),

        supabase
          .from('custody_checkins' as any)
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .gte('created_at', monthStart),

        supabase
          .from('messages' as any)
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', user.id)
          .gte('created_at', monthStart),

        // Fetch dates of any activity in last 30 days to compute streak
        supabase.rpc('get_activity_dates_last_30' as any, { uid: user.id }).select('activity_date'),
      ]);

      // Compute streak: days in last 30 with any activity
      // Fallback: use a simple approximation if RPC not available
      let streakDays = 0;
      if (recentActivity && Array.isArray(recentActivity)) {
        const uniqueDays = new Set(
          recentActivity.map((r: any) => (r.activity_date ?? '').slice(0, 10))
        );
        streakDays = uniqueDays.size;
      } else {
        // Approximate: sum all activity / 4 (rough proxy for days with activity)
        streakDays = Math.min(
          30,
          Math.ceil(((expenses ?? 0) + (events ?? 0) + (checkins ?? 0) + (messages ?? 0)) / 4)
        );
      }

      setMetrics({
        expenses: expenses ?? 0,
        events:   events   ?? 0,
        checkins: checkins ?? 0,
        messages: messages ?? 0,
        streakDays,
      });
      setLoading(false);
    };

    load();
  }, []);

  if (loading || !metrics) {
    return (
      <>
        <Stack.Screen options={{ title: 'Parenting Scoreboard', headerTintColor: brand.blue }} />
        <View style={{ flex: 1, backgroundColor: brand.lightBg, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={brand.blue} size="large" />
        </View>
      </>
    );
  }

  const score = computeScore(metrics);
  const insight = buildInsight(metrics);
  const total = metrics.expenses + metrics.events + metrics.checkins + metrics.messages || 1;

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <>
      <Stack.Screen options={{ title: 'Parenting Scoreboard', headerTintColor: brand.blue }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.lightBg }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 + insets.bottom }}
      >
        {/* ── Hero card ── */}
        <HeroCard score={score} />

        {/* ── 2x2 Stat grid ── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatCard label="Expense Requests" value={metrics.expenses} emoji="💰" color="#F59E0B" />
          <StatCard label="Calendar Events"  value={metrics.events}   emoji="📅" color={brand.blue} />
          <StatCard label="Check-ins"        value={metrics.checkins} emoji="📍" color={brand.teal} />
          <StatCard label="Messages"         value={metrics.messages} emoji="💬" color={brand.success} />
        </View>

        {/* ── Contribution breakdown ── */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark, marginBottom: 16 }}>
            What's Logged
          </Text>
          <View style={{ gap: 14 }}>
            <BreakdownRow emoji="💰" label="Expense Requests" count={metrics.expenses} percentage={pct(metrics.expenses)} color="#F59E0B" />
            <BreakdownRow emoji="📅" label="Calendar Events"  count={metrics.events}   percentage={pct(metrics.events)}   color={brand.blue} />
            <BreakdownRow emoji="📍" label="Check-ins"        count={metrics.checkins} percentage={pct(metrics.checkins)} color={brand.teal} />
            <BreakdownRow emoji="💬" label="Messages"         count={metrics.messages} percentage={pct(metrics.messages)} color={brand.success} />
          </View>
        </View>

        {/* ── Streak card ── */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 16,
            padding: 20,
            borderLeftWidth: 4,
            borderLeftColor: brand.teal,
            boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark, marginBottom: 4 }}>
            🔥 Coordination Streak
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: brand.teal, marginBottom: 4 }}>
            {metrics.streakDays}
          </Text>
          <Text style={{ fontSize: 13, color: brand.body }}>
            days of logging activity in the last 30 days
          </Text>
        </View>

        {/* ── Insight card ── */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 16,
            padding: 20,
            borderLeftWidth: 4,
            borderLeftColor: brand.blue,
            boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: brand.blue,
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            💡 INSIGHT
          </Text>
          <Text style={{ fontSize: 14, color: brand.dark, lineHeight: 21 }}>{insight}</Text>
        </View>
      </ScrollView>
    </>
  );
}

// ─── HeroCard ────────────────────────────────────────────────────────────────

function HeroCard({ score }: { score: number }) {
  // Approximate circular progress ring with two nested Views
  const ringSize = 120;
  const innerSize = 96;

  return (
    <View
      style={{
        backgroundColor: brand.card,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        boxShadow: '0 2px 12px rgba(43,116,214,0.10)',
      }}
    >
      <Text style={{ fontSize: 12, color: brand.body, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 }}>
        THIS MONTH
      </Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: brand.dark, marginBottom: 20 }}>
        Co-Parenting Score
      </Text>

      {/* Circular ring */}
      <View
        style={{
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          backgroundColor: brand.teal,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 4px 16px rgba(14,169,104,0.25)',
        }}
      >
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: brand.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 32,
              fontWeight: '800',
              color: brand.teal,
              fontVariant: ['tabular-nums'],
            }}
          >
            {score}
          </Text>
          <Text style={{ fontSize: 11, color: brand.body, fontWeight: '600' }}>/ 100</Text>
        </View>
      </View>

      <Text style={{ fontSize: 13, color: brand.body, textAlign: 'center' }}>
        Your coordination score this month
      </Text>
    </View>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  emoji,
  color,
}: {
  label: string;
  value: number;
  emoji: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        backgroundColor: brand.card,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        boxShadow: '0 1px 6px rgba(43,116,214,0.07)',
      }}
    >
      <Text style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 28,
          fontWeight: '800',
          color,
          fontVariant: ['tabular-nums'],
          marginBottom: 4,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: brand.body, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ─── BreakdownRow ─────────────────────────────────────────────────────────────

function BreakdownRow({
  emoji,
  label,
  count,
  percentage,
  color,
}: {
  emoji: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <Text style={{ fontSize: 14, marginRight: 8 }}>{emoji}</Text>
        <Text style={{ fontSize: 13, color: brand.dark, flex: 1 }}>{label}</Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: brand.dark,
            fontVariant: ['tabular-nums'],
            marginRight: 6,
          }}
        >
          {count}
        </Text>
        <Text style={{ fontSize: 12, color: brand.body, minWidth: 34, textAlign: 'right' }}>
          {percentage}%
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 5,
          backgroundColor: brand.lightBg,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}
