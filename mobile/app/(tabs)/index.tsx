import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
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
  document: { bg: '#8B5CF6',   icon: 'document-outline' },
  checkin:  { bg: brand.teal,  icon: 'location-outline' },
  message:  { bg: brand.blue,  icon: 'chatbubble-outline' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', approved: '#22C55E', rejected: brand.error,
};

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
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
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const [items, setItems]             = useState<FeedItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [userName, setUserName]       = useState('');
  const [custodyDays, setCustodyDays] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);
  const [nextEvent, setNextEvent]     = useState<{ date: string; type: string } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = now.toISOString().slice(0, 10);

      const [
        profileRes, childrenRes, expenses, events, checkins,
        messages, pendingRes, upcomingRes, custodyRes,
      ] = await Promise.all([
        supabase.from('profiles' as any).select('full_name').eq('id', user.id).single(),
        supabase.from('children' as any).select('id', { count: 'exact' }).or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`),
        permissions.isParent
          ? supabase.from('expense_requests' as any).select('id,amount,category,status,created_at,description').eq('requester_id', user.id).order('created_at', { ascending: false }).limit(10)
          : { data: [] },
        supabase.from('calendar_events' as any).select('id,event_type,event_date,notes,created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('custody_checkins' as any).select('id,event_type,notes,created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('messages' as any).select('id,content,created_at').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('expense_requests' as any).select('id', { count: 'exact' }).eq('requester_id', user.id).eq('status', 'pending'),
        supabase.from('calendar_events' as any).select('event_type,event_date').gte('event_date' as any, today).order('event_date' as any).limit(1),
        supabase.from('calendar_events' as any).select('id', { count: 'exact' }).gte('event_date', monthStart).lte('event_date', monthEnd).ilike('event_type' as any, '%custody%'),
      ]);

      setUserName((profileRes as any).data?.full_name?.split(' ')[0] ?? '');
      setChildrenCount((childrenRes as any).count ?? 0);
      setPendingCount((pendingRes as any).count ?? 0);
      setCustodyDays((custodyRes as any).count ?? 0);

      const upcoming = ((upcomingRes.data as any[]) ?? []);
      setNextEvent(upcoming[0] ? { date: upcoming[0].event_date, type: upcoming[0].event_type ?? 'Event' } : null);

      const feed: FeedItem[] = [];

      for (const e of (expenses.data || []) as any[]) {
        feed.push({
          id: `exp-${e.id}`, type: 'expense',
          title: e.category, subtitle: e.description ?? e.category,
          amount: `R${Number(e.amount).toFixed(2)}`, time: formatTime(e.created_at),
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
          subtitle: c.notes || 'Custody log', time: formatTime(c.created_at),
          section: isToday(c.created_at) ? 'today' : 'earlier',
        });
      }
      for (const m of (messages.data || []) as any[]) {
        feed.push({
          id: `msg-${m.id}`, type: 'message', title: 'Message',
          subtitle: (m.content as string).slice(0, 80), time: formatTime(m.created_at),
          section: isToday(m.created_at) ? 'today' : 'earlier',
        });
      }

      feed.sort((a, b) => b.time.localeCompare(a.time));
      setItems(feed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [permissions.isParent, monthStart, monthEnd]);

  useFocusEffect(useCallback(() => { loadFeed(); }, [loadFeed]));

  const todayItems   = items.filter(i => i.section === 'today');
  const earlierItems = items.filter(i => i.section === 'earlier');
  const progress     = daysInMonth > 0 ? Math.min(custodyDays / daysInMonth, 1) : 0;
  const monthName    = now.toLocaleDateString('en-ZA', { month: 'long' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeed(); }} tintColor={brand.blue} />}
      >
        {/* ── Header ── */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, marginBottom: 22 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.secondaryLabel }}>
            {now.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ fontSize: 34, fontWeight: '700', color: colors.label, letterSpacing: -1, lineHeight: 40 }}>
              {getGreeting()},{'\n'}
              <Text style={{ color: brand.blue }}>{userName || 'Co-Parent'}</Text>
            </Text>
            <Pressable hitSlop={12} onPress={() => setShowNotifications(true)} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4, marginTop: 4 })}>
              <View>
                <Ionicons name="notifications-outline" size={24} color={colors.label} />
                {pendingCount > 0 && (
                  <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: brand.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Custody hero card ── */}
        <Pressable onPress={() => router.push('/(tabs)/calendar')}
          style={({ pressed }) => ({ marginHorizontal: 20, marginBottom: 14, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <View style={{ borderRadius: 24, padding: 28, backgroundColor: '#1C3252', borderCurve: 'continuous' }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' }}>
              Custody this month
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, gap: 6 }}>
              <Text style={{ color: '#fff', fontSize: 72, fontWeight: '700', letterSpacing: -3, lineHeight: 76, fontVariant: ['tabular-nums'] }}>
                {custodyDays}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 28, fontWeight: '600', marginBottom: 8 }}>
                /{daysInMonth}
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 2 }}>days logged</Text>

            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, marginTop: 22 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.75)', width: `${Math.round(progress * 100)}%` }} />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, marginTop: 6 }}>
              {Math.round(progress * 100)}% of {monthName}
            </Text>
          </View>
        </Pressable>

        {/* ── 3 stat tiles ── */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 36 }}>
          <Pressable onPress={() => router.push('/(tabs)/calendar')}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 8,
              borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="calendar" size={17} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label, letterSpacing: -0.5 }} numberOfLines={1}>
              {nextEvent ? nextEvent.type.split(' ')[0] : '—'}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel }}>Next up</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(tabs)/expenses')}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 8,
              borderWidth: 0.5, borderColor: pendingCount > 0 ? '#F59E0B50' : colors.separator, borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="receipt" size={17} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '700', color: pendingCount > 0 ? '#F59E0B' : colors.label, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
              {pendingCount}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel }}>Pending</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/family')}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 8,
              borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="people" size={17} color={brand.teal} />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '700', color: colors.label, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
              {childrenCount}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel }}>Children</Text>
          </Pressable>
        </View>

        {/* ── Loading ── */}
        {loading && <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />}

        {/* ── Upgrade banner ── */}
        {!loading && permissions.tier === 'preview' && (
          <Pressable onPress={() => router.push('/pricing')}
            style={({ pressed }) => ({
              marginHorizontal: 20, marginBottom: 20,
              backgroundColor: brand.blue + '10', borderRadius: 16, padding: 16,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              borderWidth: 1, borderColor: brand.blue + '30', borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-up-circle" size={20} color={brand.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.label }}>You're on Preview</Text>
              <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 1 }}>Upgrade to unlock unlimited features</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: brand.blue }}>Upgrade</Text>
          </Pressable>
        )}

        {/* ── Today ── */}
        {!loading && todayItems.length > 0 && (
          <View style={{ marginBottom: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.label, letterSpacing: -0.4 }}>Today</Text>
              <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>
                {now.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </View>
            {todayItems.map(item => <FeedCard key={item.id} item={item} />)}
            {permissions.canUseMyScai && <ScaiSuggestionCard />}
          </View>
        )}

        {/* ── Recent ── */}
        {!loading && earlierItems.length > 0 && (
          <View style={{ marginBottom: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.label, letterSpacing: -0.4 }}>Recent</Text>
            </View>
            {earlierItems.slice(0, 6).map(item => <FeedCard key={item.id} item={item} />)}
          </View>
        )}

        {/* ── Empty ── */}
        {!loading && items.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 32, paddingHorizontal: 32, gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="time-outline" size={28} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Nothing yet</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 21 }}>
              Log a custody check-in, add a calendar event, or send a message to get started
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Notifications modal ── */}
      <Modal visible={showNotifications} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowNotifications(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setShowNotifications(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Done</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Notifications</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {pendingCount > 0 && (
              <Pressable onPress={() => { setShowNotifications(false); router.push('/(tabs)/expenses' as any); }}
                style={({ pressed }) => ({ backgroundColor: '#F59E0B18', borderRadius: 16, borderCurve: 'continuous', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 0.5, borderColor: '#F59E0B40', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="receipt-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>
                    {pendingCount} pending expense{pendingCount !== 1 ? 's' : ''}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>Awaiting approval</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.secondaryLabel} style={{ opacity: 0.5 }} />
              </Pressable>
            )}
            {nextEvent && (
              <Pressable onPress={() => { setShowNotifications(false); router.push('/(tabs)/calendar' as any); }}
                style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="calendar-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>Upcoming: {nextEvent.type}</Text>
                  <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>{nextEvent.date}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.secondaryLabel} style={{ opacity: 0.5 }} />
              </Pressable>
            )}
            {todayItems.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel, marginTop: 4 }}>Today</Text>
                {todayItems.slice(0, 5).map(item => {
                  const { bg, icon } = ICON_MAP[item.type];
                  return (
                    <View key={item.id} style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: colors.separator }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                        <Ionicons name={icon} size={17} color={bg} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.label }}>{item.title}</Text>
                        <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 1 }} numberOfLines={1}>{item.subtitle}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.secondaryLabel }}>{item.time}</Text>
                    </View>
                  );
                })}
              </>
            )}
            {pendingCount === 0 && !nextEvent && todayItems.length === 0 && (
              <View style={{ paddingTop: 60, alignItems: 'center', gap: 14 }}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={brand.blue} />
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>All caught up</Text>
                <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>No pending notifications right now</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── SCAI banner ── */}
      <View style={{
        position: 'absolute', left: 16, right: 16,
        bottom: insets.bottom + 8,
        backgroundColor: brand.dark, borderRadius: 20,
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        boxShadow: '0 8px 32px rgba(13,28,46,0.30)',
        gap: 12,
      }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: brand.teal + '28', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
          <Ionicons name="flash" size={18} color={brand.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Chat with My SCAI</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 1 }}>Schedule, request, log — just ask</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/my-scai')}
          style={({ pressed }) => ({
            backgroundColor: brand.blue, borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 9,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Open</Text>
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
    : item.type === 'message' ? '/(tabs)/messages' : undefined;

  return (
    <Pressable onPress={() => dest && router.push(dest as any)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface, borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        marginHorizontal: 20, marginBottom: 10,
        borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: bg + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
        <Ionicons name={icon} size={21} color={bg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.label }}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 3 }} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {item.amount && <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>{item.amount}</Text>}
        {!item.amount && <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{item.time}</Text>}
        {item.badge && item.badgeColor && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.badgeColor }} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: item.badgeColor }}>{item.badge}</Text>
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
        backgroundColor: brand.teal + '10', borderRadius: 16, padding: 16,
        marginHorizontal: 20, marginTop: 4, marginBottom: 4,
        borderWidth: 1, borderColor: brand.teal + '28', borderCurve: 'continuous',
        flexDirection: 'row', alignItems: 'center', gap: 14,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: brand.teal + '20', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
        <Ionicons name="flash" size={18} color={brand.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.label }}>Ask My SCAI</Text>
        <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>Schedule, request, or log anything hands-free</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.secondaryLabel} style={{ opacity: 0.4 }} />
    </Pressable>
  );
}
