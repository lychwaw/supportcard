import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';

type Child = { id: string; name: string };
type TimelineItemKind = 'expense' | 'event' | 'checkin' | 'document';

interface TimelineItem {
  id: string; kind: TimelineItemKind; title: string;
  subtitle: string; createdAt: string; createdVia?: string | null;
}

const DOT_COLORS: Record<TimelineItemKind, string> = {
  expense: '#F59E0B', event: brand.blue, checkin: brand.teal, document: '#8B5CF6',
};
const KIND_ICON: Record<TimelineItemKind, keyof typeof Ionicons.glyphMap> = {
  expense: 'cash-outline', event: 'calendar-outline', checkin: 'location-outline', document: 'document-outline',
};
const KIND_LABELS: Record<TimelineItemKind, string> = {
  expense: 'Expense', event: 'Event', checkin: 'Check-in', document: 'Document',
};

function monthKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString('default', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function groupByMonth(items: TimelineItem[]): { month: string; items: TimelineItem[] }[] {
  const map = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const key = monthKey(item.createdAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([month, items]) => ({ month, items }));
}

export default function ChildTimelineScreen() {
  const insets = useSafeAreaInsets();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingChildren(false); return; }
      const { data } = await supabase.from('children' as any).select('id, name').or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
      setChildren((data as any) || []);
      setLoadingChildren(false);
    })();
  }, []);

  const loadTimeline = useCallback(async (childId: string | null) => {
    setLoadingFeed(true);
    setTimeline([]);

    let expensesQ = supabase.from('expense_requests' as any).select('id, amount, category, status, created_at, description, created_via').order('created_at', { ascending: false }).limit(30);
    let eventsQ = supabase.from('calendar_events' as any).select('id, event_type, event_date, notes, created_at, created_via').order('created_at', { ascending: false }).limit(30);
    let checkinsQ = supabase.from('custody_checkins' as any).select('id, event_type, notes, created_at, created_via').order('created_at', { ascending: false }).limit(20);
    let docsQ = supabase.from('legal_documents' as any).select('id, document_type, description, file_name, created_at').order('created_at', { ascending: false }).limit(20);

    if (childId) {
      expensesQ = expensesQ.eq('child_id', childId);
      eventsQ = eventsQ.eq('child_id', childId);
      checkinsQ = checkinsQ.eq('child_id', childId);
    }

    const [{ data: expenses }, { data: events }, { data: checkins }, { data: docs }] = await Promise.all([expensesQ, eventsQ, checkinsQ, docsQ]);

    const items: TimelineItem[] = [
      ...((expenses as any[]) || []).map((e: any): TimelineItem => ({ id: `expense-${e.id}`, kind: 'expense', title: e.description || e.category || 'Expense', subtitle: `R${Number(e.amount ?? 0).toFixed(2)} · ${(e.status || 'pending').toUpperCase()}`, createdAt: e.created_at, createdVia: e.created_via })),
      ...((events as any[]) || []).map((e: any): TimelineItem => ({ id: `event-${e.id}`, kind: 'event', title: e.event_type || 'Calendar Event', subtitle: e.notes || e.event_date || '', createdAt: e.created_at, createdVia: e.created_via })),
      ...((checkins as any[]) || []).map((c: any): TimelineItem => ({ id: `checkin-${c.id}`, kind: 'checkin', title: c.event_type || 'Custody Check-in', subtitle: c.notes || '', createdAt: c.created_at, createdVia: c.created_via })),
      ...((docs as any[]) || []).map((d: any): TimelineItem => ({ id: `doc-${d.id}`, kind: 'document', title: d.document_type || d.file_name || 'Document', subtitle: d.description || d.file_name || '', createdAt: d.created_at, createdVia: null })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setTimeline(items);
    setLoadingFeed(false);
  }, []);

  useEffect(() => { loadTimeline(selectedId); }, [selectedId, loadTimeline]);

  const selectedChild = children.find(c => c.id === selectedId);
  const grouped = groupByMonth(timeline);

  return (
    <>
      <Stack.Screen options={{ title: 'Child Timeline', headerTintColor: brand.blue }} />

      {/* Child selector */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
          <Pressable onPress={() => setSelectedId(null)}
            style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: selectedId === null ? brand.blue : 'transparent', borderWidth: selectedId === null ? 0 : 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: selectedId === null ? '#fff' : colors.secondaryLabel }}>All Children</Text>
          </Pressable>
          {!loadingChildren && children.map(child => (
            <Pressable key={child.id} onPress={() => setSelectedId(child.id)}
              style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: selectedId === child.id ? brand.blue : 'transparent', borderWidth: selectedId === child.id ? 0 : 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: selectedId === child.id ? '#fff' : colors.secondaryLabel }}>{child.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}>
        {loadingFeed ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 60 }} />
        ) : timeline.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="calendar-outline" size={32} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.label, textAlign: 'center' }}>
              {selectedChild ? selectedChild.name : 'All Children'}
            </Text>
            <Text style={{ fontSize: 15, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 22 }}>
              {selectedChild
                ? `No activity yet for ${selectedChild.name}.\nStart logging expenses, events or check-ins.`
                : 'No activity logged yet.\nStart by adding an expense or event.'}
            </Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.month}>
              {/* Month header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16, gap: 10 }}>
                <View style={{ flex: 1, height: 0.5, backgroundColor: colors.separator }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel }}>{group.month}</Text>
                <View style={{ flex: 1, height: 0.5, backgroundColor: colors.separator }} />
              </View>
              <View style={{ gap: 0 }}>
                {group.items.map((item, index) => (
                  <TimelineCard key={item.id} item={item} isLast={index === group.items.length - 1} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

function TimelineCard({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const dotColor = DOT_COLORS[item.kind];
  return (
    <View style={{ flexDirection: 'row', minHeight: 80 }}>
      <View style={{ width: 28, alignItems: 'center' }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: dotColor, marginTop: 18, zIndex: 1, boxShadow: `0 0 0 3px ${dotColor}33` }} />
        {!isLast && <View style={{ flex: 1, width: 1.5, backgroundColor: colors.separator, marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingLeft: 12, paddingBottom: 16 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 14, borderWidth: 0.5, borderColor: colors.separator }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel, flex: 1 }}>
              <Ionicons name={KIND_ICON[item.kind]} size={11} color={dotColor} /> {KIND_LABELS[item.kind]}
            </Text>
            {item.createdVia === 'scai' && (
              <View style={{ backgroundColor: brand.teal + '12', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="flash" size={10} color={brand.teal} />
                <Text style={{ fontSize: 10, color: brand.teal, fontWeight: '700' }}>AI</Text>
              </View>
            )}
            <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label, marginBottom: 3 }} numberOfLines={2}>{item.title}</Text>
          {!!item.subtitle && <Text style={{ fontSize: 13, color: colors.secondaryLabel }} numberOfLines={2}>{item.subtitle}</Text>}
        </View>
      </View>
    </View>
  );
}
