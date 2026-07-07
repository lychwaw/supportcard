import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/use-permissions';

type FeedType = 'event' | 'expense' | 'document' | 'checkin' | 'message';
type TabFilter = 'All' | 'Events' | 'Expenses' | 'Updates';

interface FeedItem {
  id: string;
  type: FeedType;
  title: string;
  subtitle: string;
  time: string;
  badge?: string;
  badgeColor?: string;
  section: 'today' | 'earlier';
}

const ICON_MAP: Record<FeedType, { bg: string; emoji: string }> = {
  event:   { bg: brand.blue,    emoji: '📅' },
  expense: { bg: '#F59E0B',     emoji: '💰' },
  document:{ bg: '#8B5CF6',     emoji: '📄' },
  checkin: { bg: brand.teal,    emoji: '📍' },
  message: { bg: '#22C55E',     emoji: '💬' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', approved: '#22C55E', rejected: brand.error,
};

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { permissions } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabFilter>('All');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarHeight = Platform.OS === 'ios' ? 84 : 64;

  const loadFeed = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Parallel fetch of all recent activity
      const [expenses, events, checkins, messages] = await Promise.all([
        permissions.isParent
          ? supabase.from('expense_requests' as any).select('id, amount, category, status, created_at, description').eq('requester_id', user.id).order('created_at', { ascending: false }).limit(20)
          : { data: [] },
        supabase.from('calendar_events' as any).select('id, event_type, event_date, notes, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('custody_checkins' as any).select('id, event_type, notes, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('messages' as any).select('id, content, created_at').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(10),
      ]);

      const feed: FeedItem[] = [];

      for (const e of (expenses.data || []) as any[]) {
        feed.push({
          id: `exp-${e.id}`, type: 'expense',
          title: `${e.category} Expense`,
          subtitle: `R${Number(e.amount).toFixed(2)}${e.description ? ` — ${e.description}` : ''}`,
          time: formatTime(e.created_at),
          badge: e.status.charAt(0).toUpperCase() + e.status.slice(1),
          badgeColor: STATUS_COLORS[e.status] || brand.body,
          section: isToday(e.created_at) ? 'today' : 'earlier',
        });
      }

      for (const ev of (events.data || []) as any[]) {
        feed.push({
          id: `cal-${ev.id}`, type: 'event',
          title: ev.event_type || 'Calendar Event',
          subtitle: ev.event_date + (ev.notes ? ` — ${ev.notes}` : ''),
          time: formatTime(ev.created_at),
          section: isToday(ev.created_at) ? 'today' : 'earlier',
        });
      }

      for (const c of (checkins.data || []) as any[]) {
        feed.push({
          id: `ci-${c.id}`, type: 'checkin',
          title: c.event_type === 'enter' ? 'Pickup Logged' : c.event_type === 'exit' ? 'Drop-off Logged' : 'Check-in Logged',
          subtitle: c.notes || 'Manual custody log',
          time: formatTime(c.created_at),
          section: isToday(c.created_at) ? 'today' : 'earlier',
        });
      }

      for (const m of (messages.data || []) as any[]) {
        feed.push({
          id: `msg-${m.id}`, type: 'message',
          title: 'Message Sent',
          subtitle: (m.content as string).slice(0, 80),
          time: formatTime(m.created_at),
          section: isToday(m.created_at) ? 'today' : 'earlier',
        });
      }

      // Sort by created_at descending — all items together
      feed.sort((a, b) => b.time.localeCompare(a.time));
      setItems(feed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [permissions.isParent]);

  useFocusEffect(useCallback(() => { loadFeed(); }, [loadFeed]));

  const filtered = items.filter(item => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Events') return item.type === 'event' || item.type === 'checkin';
    if (activeTab === 'Expenses') return item.type === 'expense';
    if (activeTab === 'Updates') return item.type === 'message' || item.type === 'document';
    return true;
  });

  const todayItems = filtered.filter(i => i.section === 'today');
  const earlierItems = filtered.filter(i => i.section === 'earlier');

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, backgroundColor: brand.lightBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>♥</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: brand.blue, marginLeft: 8, flex: 1 }}>SupportCard</Text>
          <Pressable hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
          </Pressable>
        </View>

        {/* Greeting */}
        <Text style={{ fontSize: 28, fontWeight: '800', color: brand.dark, marginBottom: 4 }}>Activity Feed</Text>
        {permissions.tier !== 'preview' && (
          <Text style={{ fontSize: 13, color: brand.body, marginBottom: 12 }}>
            {permissions.tier.charAt(0).toUpperCase() + permissions.tier.slice(1)} plan
          </Text>
        )}

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }} style={{ marginBottom: 4 }}>
          {(['All','Events','Expenses','Updates'] as TabFilter[]).map(tab => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: tab === activeTab ? brand.blue : 'transparent', marginRight: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: tab === activeTab ? brand.blue : brand.body }}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ height: 1, backgroundColor: brand.separator }} />
      </View>

      {/* Feed */}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeed(); }} tintColor={brand.blue} />}
      >
        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Preview tier nudge */}
            {permissions.tier === 'preview' && (
              <Pressable onPress={() => router.push('/pricing')}
                style={{ margin: 16, backgroundColor: brand.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, borderLeftColor: brand.blue, boxShadow: '0 1px 8px rgba(43,116,214,0.08)' }}>
                <Text style={{ fontSize: 24 }}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: brand.dark }}>You're on Preview</Text>
                  <Text style={{ fontSize: 12, color: brand.body, marginTop: 2 }}>Upgrade to unlock unlimited features</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.blue }}>Upgrade →</Text>
              </Pressable>
            )}

            {todayItems.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginHorizontal: 16, marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.6 }}>Today</Text>
                  <Text style={{ fontSize: 12, color: brand.body }}>{new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                </View>
                {todayItems.map(item => <FeedCard key={item.id} item={item} />)}
                {permissions.canUseMyScai && <ProactiveCard />}
              </>
            )}

            {earlierItems.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginHorizontal: 16, marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.6 }}>Earlier</Text>
                </View>
                {earlierItems.map(item => <FeedCard key={item.id} item={item} />)}
              </>
            )}

            {filtered.length === 0 && !loading && (
              <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
                <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>No activity yet</Text>
                <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>Log a custody check-in, add a calendar event, or send a message to get started</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* SCAI floating banner */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: tabBarHeight + insets.bottom + 8,
        backgroundColor: brand.card, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: brand.teal,
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        boxShadow: '0 2px 16px rgba(43,116,214,0.12)', gap: 12 }}>
        <Text style={{ fontSize: 24 }}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>Chat with My SCAI</Text>
          <Text style={{ fontSize: 12, color: brand.body, marginTop: 2 }}>Schedule, request, log — just ask</Text>
        </View>
        <Pressable onPress={() => router.push('/my-scai')}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: brand.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 })}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Chat →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const { bg, emoji } = ICON_MAP[item.type];
  const dest = item.type === 'expense' ? '/(tabs)/expenses'
    : item.type === 'event' ? '/(tabs)/calendar'
    : item.type === 'checkin' ? '/custody-clock'
    : item.type === 'message' ? '/messages' : undefined;

  return (
    <Pressable onPress={() => dest && router.push(dest as any)}
      style={({ pressed }) => ({
        backgroundColor: brand.card, borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        marginHorizontal: 16, marginBottom: 10,
        boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
        opacity: pressed ? 0.92 : 1,
      })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }} numberOfLines={2}>{item.subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 12, color: brand.body }}>{item.time}</Text>
        {item.badge && item.badgeColor && (
          <View style={{ backgroundColor: item.badgeColor + '1A', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: item.badgeColor }}>{item.badge}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ProactiveCard() {
  return (
    <Pressable onPress={() => router.push('/my-scai')}
      style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 10,
        borderLeftWidth: 4, borderLeftColor: brand.blue, boxShadow: '0 1px 8px rgba(43,116,214,0.07)', gap: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: brand.blue, textTransform: 'uppercase', letterSpacing: 0.5 }}>⚡ Proactive Insight</Text>
      <Text style={{ fontSize: 15, color: brand.dark, lineHeight: 22 }}>My SCAI can help you schedule, log expenses and track custody time. Try asking it something.</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: brand.blue }}>Open My SCAI →</Text>
    </Pressable>
  );
}
