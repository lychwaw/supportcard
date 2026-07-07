import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/colors';
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
        '⚡ Schedule Conflict',
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
        await supabase.from('calendar_events' as any).delete().eq('id', eventId);
        loadEvents();
      }},
    ]);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 36, height: 36, backgroundColor: brand.blue, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Text style={{ color: '#fff', fontSize: 20 }}>♥</Text>
            </View>
            <Text style={{ color: brand.blue, fontWeight: '700', fontSize: 18, flex: 1 }}>SupportCard</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: brand.dark }}>Calendar</Text>
            {permissions.canManageCalendar ? (
              <Pressable onPress={openAdd}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(43,116,214,0.30)' }}>
                <Text style={{ color: '#fff', fontSize: 24, lineHeight: 28 }}>+</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/pricing')}
                style={{ backgroundColor: brand.lightBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: brand.blue }}>
                <Text style={{ color: brand.blue, fontSize: 12, fontWeight: '600' }}>Upgrade to add</Text>
              </Pressable>
            )}
          </View>

          {/* Calendar card */}
          <View style={{ backgroundColor: brand.card, borderRadius: 20, padding: 20, boxShadow: '0 2px 12px rgba(43,116,214,0.08)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable onPress={prevMonth} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, color: brand.blue }}>‹</Text>
              </Pressable>
              <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>{MONTHS[month]} {year}</Text>
              <Pressable onPress={nextMonth} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, color: brand.blue }}>›</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {DAYS.map(d => (
                <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: brand.body }}>{d}</Text>
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
                      backgroundColor: isSel ? brand.blue : isToday ? brand.lightBg : 'transparent' }}>
                      <Text style={{ fontSize: 15, fontWeight: isToday || isSel ? '700' : '400',
                        color: isSel ? '#fff' : isToday ? brand.blue : brand.dark }}>{day}</Text>
                    </View>
                    {hasEvent && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? '#fff' : brand.blue, marginTop: 2 }} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Selected day */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>
              {SHORT_MONTHS[month]} {selected} — {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
            </Text>
            {permissions.canManageCalendar && (
              <Pressable onPress={openAdd} hitSlop={12}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: brand.blue }}>+ Add</Text>
              </Pressable>
            )}
          </View>

          {loading ? <ActivityIndicator color={brand.blue} /> : selectedEvents.length === 0 ? (
            <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 32, alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.06)' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
              <Text style={{ color: brand.body, fontSize: 15 }}>No events on this day</Text>
              {permissions.canManageCalendar && (
                <Pressable onPress={openAdd} style={{ marginTop: 12 }}>
                  <Text style={{ color: brand.blue, fontSize: 14, fontWeight: '600' }}>+ Add an event</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {selectedEvents.map(event => (
                <Pressable key={event.id} onLongPress={() => deleteEvent(event.id)}
                  style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.06)' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 22 }}>📅</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>{event.event_type || 'Event'}</Text>
                    {event.notes && <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>{event.notes}</Text>}
                    {event.created_via === 'scai' && (
                      <View style={{ flexDirection: 'row', marginTop: 4 }}>
                        <View style={{ backgroundColor: brand.lightBg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 11, color: brand.blue }}>🤖 My SCAI</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: brand.body }}>Hold to delete</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Event Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: brand.lightBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20,
            borderBottomWidth: 1, borderBottomColor: brand.separator, backgroundColor: brand.card }}>
            <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Add Event</Text>
            <Pressable onPress={saveEvent} disabled={saving}>
              <Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>DATE</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 16, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
                placeholder="YYYY-MM-DD" placeholderTextColor={brand.body}
                value={addDate} onChangeText={setAddDate}
              />
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>EVENT TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {EVENT_TYPES.map(type => (
                    <Pressable key={type} onPress={() => setEventType(type)}
                      style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5,
                        borderColor: eventType === type ? brand.blue : brand.separator,
                        backgroundColor: eventType === type ? brand.lightBg : brand.card }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: eventType === type ? brand.blue : brand.body }}>{type}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 15, color: brand.dark,
                  borderWidth: 1.5, borderColor: brand.separator, height: 100, textAlignVertical: 'top' }}
                placeholder="Any notes about this event..." placeholderTextColor={brand.body}
                multiline value={notes} onChangeText={setNotes}
              />
            </View>

            <View style={{ backgroundColor: brand.lightBg, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 12, color: brand.body }}>
                💡 You can also say "My SCAI, add a custody day on Friday" to create events hands-free.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
