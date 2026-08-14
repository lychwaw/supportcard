import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/use-permissions';
import { router } from 'expo-router';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EVENT_TYPES = ['Custody Day','School Event','Doctor Appointment','Pickup','Drop-off','Holiday','Other'];

type CalendarEvent = {
  id: string; event_date: string; event_type: string | null;
  notes: string | null; created_via?: string; user_id: string;
};

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { permissions } = usePermissions();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selected, setSelected] = useState(today.getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Add event modal state
  const [showAdd, setShowAdd] = useState(false);
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [addDate, setAddDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const start = toISO(year, month, 1);
    const end = toISO(year, month, getDaysInMonth(year, month));
    const { data } = await supabase.from('calendar_events' as any)
      .select('*').gte('event_date', start).lte('event_date', end).order('event_date');
    setEvents((data as any) || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const prevMonth = () => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1);

  const eventDayMap = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.event_date;
    if (!eventDayMap.has(key)) eventDayMap.set(key, []);
    eventDayMap.get(key)!.push(e);
  }

  const selectedISO = toISO(year, month, selected);
  const selectedEvents = eventDayMap.get(selectedISO) || [];

  const openAdd = () => {
    setAddDate(selectedISO);
    setEventType(EVENT_TYPES[0]);
    setNotes('');
    setShowAdd(true);
  };

  const saveEvent = async () => {
    if (!addDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(addDate)) {
      Alert.alert('Invalid date', 'Please use the format YYYY-MM-DD (e.g. 2026-09-15).');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Conflict detection — check for existing events on the same date
    const { data: existing } = await supabase.from('calendar_events' as any)
      .select('event_type').eq('event_date', addDate).limit(5);

    const hasConflict = existing && existing.length > 0;

    const doSave = async () => {
      const { error } = await supabase.from('calendar_events' as any).insert({
        user_id: user.id, event_date: addDate, event_type: eventType,
        notes: notes.trim() || null, created_via: 'manual',
      });
      setSaving(false);
      if (error) { Alert.alert('Error', error.message); return; }
      setShowAdd(false);
      loadEvents();
    };

    if (hasConflict) {
      setSaving(false);
      const existingTypes = (existing as any[]).map((e: any) => e.event_type).filter(Boolean).join(', ');
      Alert.alert(
        'Schedule Conflict',
        `There ${existing!.length === 1 ? 'is already 1 event' : `are already ${existing!.length} events`} on ${addDate}: ${existingTypes}. Add this event anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: doSave },
        ]
      );
    } else {
      await doSave();
    }
  };

  const deleteEvent = (eventId: string) => {
    Alert.alert('Delete Event', 'Remove this event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('calendar_events' as any).delete().eq('id', eventId);
        if (error) { Alert.alert('Error', error.message); return; }
        loadEvents();
      }},
    ]);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
          {/* Header — hamburger | Calendar (center) | filter */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Pressable onPress={() => router.push('/(tabs)/more')} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="menu-outline" size={26} color={colors.label} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.label }}>Calendar</Text>
            {permissions.canManageCalendar ? (
              <Pressable onPress={openAdd} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="options-outline" size={22} color={brand.blue} />
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/pricing')} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="options-outline" size={22} color={colors.secondaryLabel} />
              </Pressable>
            )}
          </View>

          {/* Calendar card */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable onPress={prevMonth} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-back" size={20} color={brand.blue} />
              </Pressable>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>{MONTHS[month]} {year}</Text>
              <Pressable onPress={nextMonth} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-forward" size={20} color={brand.blue} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {DAYS.map(d => (
                <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>{d}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((day, i) => {
                if (!day) return <View key={`e${i}`} style={{ width: `${100/7}%`, aspectRatio: 1 }} />;
                const iso = toISO(year, month, day);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSel = day === selected;
                const hasEvent = eventDayMap.has(iso);
                return (
                  <Pressable key={day} onPress={() => setSelected(day)}
                    style={{ width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isSel ? brand.blue : isToday ? brand.blue + '14' : 'transparent' }}>
                      <Text style={{ fontSize: 15, fontWeight: isToday || isSel ? '700' : '400',
                        color: isSel ? '#fff' : isToday ? brand.blue : colors.label }}>{day}</Text>
                    </View>
                    {hasEvent && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? '#fff' : brand.blue, marginTop: 2 }} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Selected day header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brand.blue, marginRight: 8 }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.label, flex: 1 }}>
              {selectedISO === toISO(today.getFullYear(), today.getMonth(), today.getDate()) ? 'Today' : new Date(selectedISO + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long' })} • {selected} {SHORT_MONTHS[month]}
            </Text>
            {permissions.canManageCalendar && (
              <Pressable onPress={openAdd} hitSlop={12}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: brand.blue }}>+ Add</Text>
              </Pressable>
            )}
          </View>

          {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 24 }} /> : selectedEvents.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 32, alignItems: 'center', marginTop: 12, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
              <View style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderCurve: 'continuous' }}>
                <Ionicons name="calendar-outline" size={24} color={brand.blue} />
              </View>
              <Text style={{ color: colors.secondaryLabel, fontSize: 15 }}>No events on this day</Text>
              {permissions.canManageCalendar && (
                <Pressable onPress={openAdd} style={{ marginTop: 12 }}>
                  <Text style={{ color: brand.blue, fontSize: 14, fontWeight: '600' }}>+ Add an event</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ gap: 0, marginTop: 8 }}>
              {selectedEvents.map((event, idx) => {
                const barColors = ['#22C55E', brand.blue, '#8B5CF6', '#F59E0B', brand.teal];
                const barColor = barColors[idx % barColors.length];
                return (
                  <Pressable key={event.id} onLongPress={() => deleteEvent(event.id)}
                    style={({ pressed }) => ({
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      marginBottom: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      overflow: 'hidden',
                      borderWidth: 0.5,
                      borderColor: colors.separator,
                      borderCurve: 'continuous',
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}>
                    {/* Left color bar */}
                    <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: barColor }} />
                    {/* Icon */}
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: barColor + '18', alignItems: 'center', justifyContent: 'center', margin: 14 }}>
                      <Ionicons name="people-outline" size={18} color={barColor} />
                    </View>
                    {/* Content */}
                    <View style={{ flex: 1, paddingVertical: 14 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.label }}>{event.event_type || 'Event'}</Text>
                      {event.notes && <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>{event.notes}</Text>}
                      {event.created_via === 'scai' && (
                        <View style={{ flexDirection: 'row', marginTop: 4 }}>
                          <View style={{ backgroundColor: brand.blue + '12', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="hardware-chip-outline" size={10} color={brand.blue} />
                            <Text style={{ fontSize: 11, color: brand.blue }}>My SCAI</Text>
                          </View>
                        </View>
                      )}
                    </View>
                    {/* Delete */}
                    <Pressable onPress={() => deleteEvent(event.id)} hitSlop={8} style={{ padding: 14 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: brand.error + '60', alignItems: 'center', justifyContent: 'center', backgroundColor: brand.error + '08' }}>
                        <Ionicons name="trash-outline" size={13} color={brand.error} />
                      </View>
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Event Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20,
            borderBottomWidth: 0.5, borderBottomColor: colors.separator, backgroundColor: colors.surface }}>
            <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Add Event</Text>
            <Pressable onPress={saveEvent} disabled={saving}>
              <Text style={{ color: saving ? colors.secondaryLabel : brand.blue, fontSize: 16, fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 6 }}>DATE</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, fontSize: 16, color: colors.label, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.secondaryLabel}
                value={addDate} onChangeText={setAddDate}
              />
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 6 }}>EVENT TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {EVENT_TYPES.map(type => (
                    <Pressable key={type} onPress={() => setEventType(type)}
                      style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5,
                        borderColor: eventType === type ? brand.blue : colors.separator,
                        backgroundColor: eventType === type ? brand.blue + '12' : colors.surface }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: eventType === type ? brand.blue : colors.secondaryLabel }}>{type}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 6 }}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, fontSize: 15, color: colors.label,
                  borderWidth: 0.5, borderColor: colors.separator, height: 100, textAlignVertical: 'top', borderCurve: 'continuous' }}
                placeholder="Any notes about this event..." placeholderTextColor={colors.secondaryLabel}
                multiline value={notes} onChangeText={setNotes}
              />
            </View>

            <View style={{ backgroundColor: brand.blue + '12', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Ionicons name="hardware-chip-outline" size={14} color={brand.blue} style={{ marginTop: 1 }} />
              <Text style={{ fontSize: 12, color: colors.secondaryLabel, flex: 1 }}>
                Say "My SCAI, add a custody day on Friday" to create events hands-free.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
