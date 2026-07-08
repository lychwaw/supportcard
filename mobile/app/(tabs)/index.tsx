import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const ICON_MAP: Record<FeedType, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  event:    { bg: brand.blue,    icon: 'calendar-outline' },
  expense:  { bg: '#F59E0B',     icon: 'receipt-outline' },
  document: { bg: '#8B5CF6',     icon: 'document-outline' },
  checkin:  { bg: brand.teal,    icon: 'location-outline' },
  message:  { bg: '#22C55E',     icon: 'chatbubble-outline' },
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
          title: `${e.category}`,
          subtitle: `R${Number(e.amount).toFixed(2)}${e.description ? ` · ${e.description}` : ''}`,
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
          subtitle: ev.event_date + (ev.notes ? ` · ${ev.notes}` : ''),
          time: formatTime(ev.created_at),
          section: isToday(ev.created_at) ? 'today' : 'earlier',
        });
      }

      for (const c of (checkins.data || []) as any[]) {
        feed.push({
          id: `ci-${c.id}`, type: 'checkin',
          title: c.event_type === 'enter' ? 'Pickup' : c.event_type === 'exit' ? 'Drop-off' : 'Check-in',
          subtitle: c.notes || 'Custody log',
          time: formatTime(c.created_at),
          section: isToday(c.created_at) ? 'today' : 'earlier',
        });
      }

      for (const m of (messages.data || []) as any[]) {
        feed.push({
          id: `msg-${m.id}`, type: 'message',
          title: 'Message',
          subtitle: (m.content as string).slice(0, 80),
          time: formatTime(m.created_at),
          section: isToday(m.created_at) ? 'today' : 'earlier',
        });
      }

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
          {/* Wordmark */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: -0.5 }}>SC</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark, letterSpacing: -0.3 }}>SupportCard</Text>
          </View>
          <Pressable hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name="notifications-outline" size={22} color={brand.dark} />
          </Pressable>
        </View>

        <Text style={{ fontSize: 26, fontWeight: '700', color: brand.dark, letterSpacing: -0.5, marginBottom: 4 }}>
          Activity
        </Text>
        {permissions.tier !== 'preview' && (
          <Text style={{ fontSize: 13, color: brand.body, marginBottom: 12 }}>
            {permissions.tier.charAt(0).toUpperCase() + permissions.tier.slice(1)}
          </Text>
        )}

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }} style={{ marginBottom: 0 }}>
          {(['All', 'Events', 'Expenses', 'Updates'] as TabFilter[]).map(tab => (
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
                style={{ margin: 16, backgroundColor: brand.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 3, borderLeftColor: brand.blue }}>
                <Ionicons name="arrow-up-circle-outline" size={24} color={brand.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: brand.dark }}>Preview plan</Text>
                  <Text style={{ fontSize: 12, color: brand.body, marginTop: 2 }}>Upgrade to unlock all features</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={brand.body} />
              </Pressable>
            )}

            {todayItems.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginHorizontal: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.8 }}>Today</Text>
                  <Text style={{ fontSize: 12, color: brand.body }}>{new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                </View>
                {todayItems.map(item => <FeedCard key={item.id} item={item} />)}
                {permissions.canUseMyScai && <ScaiSuggestionCard />}
              </>
            )}

            {earlierItems.length > 0 && (
              <>
                <View style={{ marginTop: 24, marginHorizontal: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.8 }}>Earlier</Text>
                </View>
                {earlierItems.map(item => <FeedCard key={item.id} item={item} />)}
              </>
            )}

            {filtered.length === 0 && !loading && (
              <View style={{ alignItems: 'center', paddingTop: 64, paddingHorizontal: 32, gap: 12 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: brand.separator, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="time-outline" size={28} color={brand.body} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: brand.dark }}>No activity yet</Text>
                <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center', lineHeight: 20 }}>
                  Log a custody check-in, add a calendar event, or send a message to get started
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* SCAI floating action */}
      <Pressable
        onPress={() => router.push('/my-scai')}
        style={({ pressed }) => ({
          position: 'absolute', left: 16, right: 16,
          bottom: tabBarHeight + insets.bottom + 8,
          backgroundColor: brand.dark, borderRadius: 14,
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          gap: 12, opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: brand.teal, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flash" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>My SCAI</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Schedule, request, log — just ask</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
      </Pressable>
    </View>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const { bg, icon } = ICON_MAP[item.type];
  const dest = item.type === 'expense' ? '/(tabs)/expenses'
    : item.type === 'event' ? '/(tabs)/calendar'
    : item.type === 'checkin' ? '/custody-clock'
    : item.type === 'message' ? '/messages' : undefined;

  return (
    <Pressable onPress={() => dest && router.push(dest as any)}
      style={({ pressed }) => ({
        backgroundColor: brand.card, borderRadius: 12, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginHorizontal: 16, marginBottom: 8,
        opacity: pressed ? 0.9 : 1,
      })}>
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: bg + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={bg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontSize: 12, color: brand.body }}>{item.time}</Text>
        {item.badge && item.badgeColor && (
          <View style={{ backgroundColor: item.badgeColor + '18', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: item.badgeColor }}>{item.badge}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ScaiSuggestionCard() {
  return (
    <Pressable onPress={() => router.push('/my-scai')}
      style={({ pressed }) => ({
        backgroundColor: brand.card, borderRadius: 12, padding: 16,
        marginHorizontal: 16, marginBottom: 8,
        borderLeftWidth: 3, borderLeftColor: brand.teal,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        opacity: pressed ? 0.85 : 1,
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="flash-outline" size={18} color={brand.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: brand.dark }}>My SCAI is ready to help</Text>
        <Text style={{ fontSize: 13, color: brand.body, marginTop: 1 }}>Ask about your schedule, expenses, or custody</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={brand.body} />
    </Pressable>
  );
}
