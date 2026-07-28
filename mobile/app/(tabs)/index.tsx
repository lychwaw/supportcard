import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/use-permissions';

type FeedType = 'event' | 'expense' | 'document' | 'checkin' | 'message';

interface FeedItem {
  id: string;
  type: FeedType;
  title: string;
  subtitle: string;
  time: string;
  amount?: string;
  badge?: string;
  badgeColor?: string;
  section: 'today' | 'earlier';
}

const ICON_MAP: Record<FeedType, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  event:    { bg: brand.blue,  icon: 'calendar-outline' },
  expense:  { bg: '#F59E0B',   icon: 'receipt-outline' },
  document: { bg: brand.body,  icon: 'document-outline' },
  checkin:  { bg: brand.teal,  icon: 'location-outline' },
  message:  { bg: brand.blue,  icon: 'chatbubble-outline' },
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { permissions } = usePermissions();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [childrenCount, setChildrenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ date: string; type: string } | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);

      const [profileRes, childrenRes, expenses, events, checkins, messages, pendingRes, upcomingRes] = await Promise.all([
        supabase.from('profiles' as any).select('full_name').eq('id', user.id).single(),
        supabase.from('children' as any).select('id', { count: 'exact' }).or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`),
        permissions.isParent
          ? supabase.from('expense_requests' as any).select('id, amount, category, status, created_at, description').eq('requester_id', user.id).order('created_at', { ascending: false }).limit(20)
          : { data: [] },
        supabase.from('calendar_events' as any).select('id, event_type, event_date, notes, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('custody_checkins' as any).select('id, event_type, notes, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('messages' as any).select('id, content, created_at').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('expense_requests' as any).select('id', { count: 'exact' }).eq('requester_id', user.id).eq('status', 'pending'),
        supabase.from('calendar_events' as any).select('event_type, event_date').gte('event_date' as any, today).order('event_date' as any).limit(1),
      ]);

      const profile = (profileRes as any).data;
      setUserName(profile?.full_name ? profile.full_name.split(' ')[0] : '');
      setChildrenCount((childrenRes as any).count ?? 0);
      setPendingCount((pendingRes as any).count ?? 0);

      const upcoming = ((upcomingRes.data as any[]) ?? []);
      setNextEvent(upcoming.length > 0 ? { date: upcoming[0].event_date, type: upcoming[0].event_type ?? 'Event' } : null);

      const feed: FeedItem[] = [];

      for (const e of (expenses.data || []) as any[]) {
        feed.push({
          id: `exp-${e.id}`, type: 'expense',
          title: e.category,
          subtitle: e.description ?? e.category,
          amount: `R${Number(e.amount).toFixed(2)}`,
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

  const todayItems = items.filter(i => i.section === 'today');
  const earlierItems = items.filter(i => i.section === 'earlier');

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeed(); }} tintColor={brand.blue} />}
      >
        {/* ── Greeting header ── */}
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: brand.body, marginBottom: 2 }}>
                {getGreeting()},
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: brand.dark }}>
                {userName || 'Co-Parent'}
              </Text>
            </View>
            <Pressable hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="notifications-outline" size={26} color={brand.dark} />
            </Pressable>
          </View>
        </View>

        {/* ── Children card ── */}
        <Pressable onPress={() => router.push('/family')}
          style={({ pressed }) => ({
            marginHorizontal: 20, marginBottom: 16,
            backgroundColor: brand.card, borderRadius: 18, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 14,
            boxShadow: '0 2px 12px rgba(43,116,214,0.08)',
            opacity: pressed ? 0.9 : 1,
          })}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: brand.blue + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people-outline" size={22} color={brand.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body }}>Children</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark, marginTop: 1 }}>
              {childrenCount === 0 ? 'Add your children' : `${childrenCount} child${childrenCount !== 1 ? 'ren' : ''} linked`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={brand.body} style={{ opacity: 0.5 }} />
        </Pressable>

        {/* ── Today's overview ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark, flex: 1 }}>Today's overview</Text>
            <Pressable onPress={() => router.push('/(tabs)/calendar')} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: brand.blue }}>View calendar</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => router.push('/(tabs)/calendar')}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: brand.card, borderRadius: 16, padding: 16, gap: 10,
                boxShadow: '0 2px 12px rgba(43,116,214,0.08)', borderCurve: 'continuous',
                opacity: pressed ? 0.9 : 1,
              })}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: brand.blue + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-outline" size={19} color={brand.blue} />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.5 }}>Next Event</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: brand.dark, marginTop: 4 }} numberOfLines={1}>
                  {nextEvent ? nextEvent.type : 'Nothing scheduled'}
                </Text>
                {nextEvent && (
                  <Text style={{ fontSize: 12, color: brand.body, marginTop: 2 }}>{nextEvent.date}</Text>
                )}
              </View>
            </Pressable>

            <Pressable onPress={() => router.push('/(tabs)/expenses')}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: brand.card, borderRadius: 16, padding: 16, gap: 10,
                boxShadow: '0 2px 12px rgba(43,116,214,0.08)', borderCurve: 'continuous',
                opacity: pressed ? 0.9 : 1,
              })}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="receipt-outline" size={19} color="#F59E0B" />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: pendingCount > 0 ? '#F59E0B' : brand.dark, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                  {pendingCount}
                </Text>
                <Text style={{ fontSize: 12, color: brand.body, marginTop: 1 }}>expense{pendingCount !== 1 ? 's' : ''}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Recent activity ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: brand.dark, flex: 1 }}>Recent activity</Text>
            <Pressable onPress={() => router.push('/(tabs)/expenses')} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: brand.blue }}>See all</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Feed ── */}
        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : (
          <>
            {permissions.tier === 'preview' && (
              <Pressable onPress={() => router.push('/pricing')}
                style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: brand.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, borderLeftColor: brand.blue, boxShadow: '0 1px 8px rgba(43,116,214,0.08)' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: brand.dark }}>You're on Preview</Text>
                  <Text style={{ fontSize: 12, color: brand.body, marginTop: 2 }}>Upgrade to unlock unlimited features</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.blue }}>Upgrade</Text>
              </Pressable>
            )}

            {todayItems.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.8 }}>Today</Text>
                  <Text style={{ fontSize: 12, color: brand.body }}>
                    {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                {todayItems.map(item => <FeedCard key={item.id} item={item} />)}
                {permissions.canUseMyScai && <ScaiSuggestionCard />}
              </>
            )}

            {earlierItems.length > 0 && (
              <>
                <View style={{ paddingHorizontal: 20, marginTop: todayItems.length > 0 ? 20 : 0, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.8 }}>Earlier</Text>
                </View>
                {earlierItems.map(item => <FeedCard key={item.id} item={item} />)}
              </>
            )}

            {items.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, gap: 12 }}>
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

      {/* SCAI floating banner */}
      <View style={{
        position: 'absolute', left: 16, right: 16,
        bottom: insets.bottom + 8,
        backgroundColor: brand.dark, borderRadius: 16,
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 13,
        boxShadow: '0 6px 24px rgba(13,28,46,0.22)',
        gap: 12,
      }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: brand.teal, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flash" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Chat with My SCAI</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Schedule, request, log — just ask</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/my-scai')}
          style={({ pressed }) => ({
            backgroundColor: brand.blue, borderRadius: 10,
            paddingHorizontal: 14, paddingVertical: 8,
            opacity: pressed ? 0.8 : 1,
          })}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Chat</Text>
        </Pressable>
      </View>
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
        backgroundColor: brand.card, borderRadius: 16, padding: 14,
        flexDirection: 'row', alignItems: 'center', gap: 13,
        marginHorizontal: 16, marginBottom: 8,
        boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
        opacity: pressed ? 0.92 : 1,
      })}>
      {/* Icon */}
      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      {/* Title + subtitle */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      {/* Amount + status */}
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        {item.amount && (
          <Text style={{ fontSize: 14, fontWeight: '700', color: brand.dark }}>{item.amount}</Text>
        )}
        {!item.amount && (
          <Text style={{ fontSize: 12, color: brand.body }}>{item.time}</Text>
        )}
        {item.badge && item.badgeColor && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.badgeColor }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: item.badgeColor }}>{item.badge}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ScaiSuggestionCard() {
  return (
    <Pressable onPress={() => router.push('/(tabs)/my-scai')}
      style={({ pressed }) => ({
        backgroundColor: brand.card, borderRadius: 16, padding: 16,
        marginHorizontal: 16, marginBottom: 8,
        borderLeftWidth: 4, borderLeftColor: brand.blue,
        boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
        gap: 5, opacity: pressed ? 0.85 : 1,
      })}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: brand.blue, textTransform: 'uppercase', letterSpacing: 0.5 }}>My SCAI</Text>
      <Text style={{ fontSize: 14, color: brand.dark, lineHeight: 21 }}>Ask me to schedule, log expenses, or track custody time.</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: brand.blue }}>Open My SCAI →</Text>
    </Pressable>
  );
}
