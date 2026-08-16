import { useState, useEffect, useCallback } from 'react';
import { router, Stack } from 'expo-router';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Switch, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';

interface Child { id: string; name: string }

interface CheckIn {
  id: string;
  event_type: 'enter' | 'exit' | 'manual';
  notes: string | null;
  created_at: string;
  created_via: string | null;
  lat?: number | null;
  lng?: number | null;
  child: { name: string } | null;
}

interface Zone {
  id: string;
  name: string;
  zone_type: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const EVENT_META = {
  enter:  { icon: 'enter-outline' as const,  color: brand.teal,  label: 'Pickup' },
  exit:   { icon: 'exit-outline' as const,   color: '#F59E0B',   label: 'Drop-off' },
  manual: { icon: 'create-outline' as const, color: brand.blue,  label: 'Manual' },
};

function CheckInCard({ item, onDelete }: { item: CheckIn; onDelete?: () => void }) {
  const meta = EVENT_META[item.event_type] ?? EVENT_META.manual;
  return (
    <Pressable
      onLongPress={onDelete}
      style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginHorizontal: 16, marginBottom: 10, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: meta.color + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
          <Ionicons name={meta.icon} size={21} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label }}>
            {meta.label}{item.child ? ` — ${item.child.name}` : ''}
          </Text>
          {item.notes ? <Text style={{ color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{item.notes}</Text> : null}
          {item.created_via === 'scai' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Ionicons name="flash" size={11} color={brand.teal} />
              <Text style={{ fontSize: 11, color: brand.teal, fontWeight: '600' }}>Via SCAI</Text>
            </View>
          )}
          {item.lat != null && item.lng != null && (
            <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${item.lat},${item.lng}`)} style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="location-outline" size={12} color={brand.blue} />
                <Text style={{ fontSize: 12, color: brand.blue, fontWeight: '600' }}>View location</Text>
              </View>
            </Pressable>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>{formatTime(item.created_at)}</Text>
          {onDelete && (
            <Pressable onPress={onDelete} hitSlop={10}>
              <Ionicons name="trash-outline" size={14} color={colors.secondaryLabel} style={{ opacity: 0.4 }} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ZoneCard({ zone, onDelete }: { zone: Zone; onDelete?: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginHorizontal: 16, marginBottom: 10, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
          <Ionicons name="location-outline" size={21} color={brand.teal} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label }}>{zone.name}</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>{zone.zone_type}</Text>
          {zone.lat != null && zone.lng != null && (
            <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}</Text>
          )}
        </View>
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={16} color={colors.secondaryLabel} style={{ opacity: 0.4 }} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const ZONE_TYPES = ["Home (Mom's)", "Home (Dad's)", 'School', 'Other'];
const EVENT_TYPES: Array<{ key: 'enter' | 'manual' | 'exit'; label: string }> = [
  { key: 'enter', label: 'Pickup' },
  { key: 'manual', label: 'Manual' },
  { key: 'exit', label: 'Drop-off' },
];

function AddCheckInModal({ visible, onClose, onSaved, childList }: { visible: boolean; onClose: () => void; onSaved: () => void; childList: Child[] }) {
  const insets = useSafeAreaInsets();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<'enter' | 'manual' | 'exit'>('enter');
  const [notes, setNotes] = useState('');
  const [useGps, setUseGps] = useState(false);
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'captured' | 'failed'>('idle');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGpsToggle = useCallback(async (val: boolean) => {
    setUseGps(val);
    if (!val) { setLat(null); setLng(null); setLocationState('idle'); return; }
    setLocationState('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationState('failed'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocationState('captured');
    } catch { setLocationState('failed'); }
  }, []);

  const handleSave = useCallback(async () => {
    if (!notes.trim()) { Alert.alert('Notes required', 'Please enter notes for this check-in.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('custody_checkins').insert({ user_id: user.id, child_id: selectedChildId ?? null, event_type: eventType, notes: notes.trim(), lat, lng, created_via: 'manual' });
      setNotes(''); setSelectedChildId(null); setEventType('enter'); setUseGps(false); setLat(null); setLng(null); setLocationState('idle');
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save check-in.');
    } finally {
      setSaving(false);
    }
  }, [notes, selectedChildId, eventType, lat, lng, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Log Check-in</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 20, padding: 16 }}>
          {/* Event type pills */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 12, color: colors.secondaryLabel }}>Event Type</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {EVENT_TYPES.map(et => {
                const meta = EVENT_META[et.key];
                return (
                  <Pressable key={et.key} onPress={() => setEventType(et.key)}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: eventType === et.key ? meta.color + '18' : colors.surface, borderWidth: 1, borderColor: eventType === et.key ? meta.color + '40' : colors.separator, alignItems: 'center', gap: 6, borderCurve: 'continuous' }}>
                    <Ionicons name={meta.icon} size={20} color={eventType === et.key ? meta.color : colors.secondaryLabel} />
                    <Text style={{ color: eventType === et.key ? meta.color : colors.secondaryLabel, fontWeight: '700', fontSize: 12 }}>{et.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Child selector */}
          {childList.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '600', fontSize: 12, color: colors.secondaryLabel }}>Child (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[{ id: null, name: 'General' }, ...childList].map((c: any) => (
                    <Pressable key={c.id ?? 'general'} onPress={() => setSelectedChildId(c.id)}
                      style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: selectedChildId === c.id ? brand.blue : colors.surface, borderWidth: 1, borderColor: selectedChildId === c.id ? brand.blue : colors.separator }}>
                      <Text style={{ color: selectedChildId === c.id ? '#fff' : colors.secondaryLabel, fontWeight: '600', fontSize: 14 }}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Notes */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 12, color: colors.secondaryLabel }}>Notes *</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 15, color: colors.label, minHeight: 96, textAlignVertical: 'top', borderCurve: 'continuous' }}
              placeholder="Add notes about this check-in…" placeholderTextColor={colors.secondaryLabel}
              value={notes} onChangeText={setNotes} multiline
            />
          </View>

          {/* GPS */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="location-outline" size={16} color={brand.teal} />
                </View>
                <Text style={{ fontWeight: '600', fontSize: 15, color: colors.label }}>Use GPS Location</Text>
              </View>
              <Switch value={useGps} onValueChange={handleGpsToggle} trackColor={{ true: brand.blue, false: colors.separator }} thumbColor="#fff" />
            </View>
            {useGps && locationState === 'loading' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={brand.blue} />
                <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>Acquiring location…</Text>
              </View>
            )}
            {useGps && locationState === 'captured' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={14} color={brand.teal} />
                <Text style={{ color: brand.teal, fontSize: 13, fontWeight: '600' }}>Location captured</Text>
              </View>
            )}
            {useGps && locationState === 'failed' && (
              <Text style={{ color: brand.error, fontSize: 13 }}>Location unavailable — permission denied or GPS off.</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function AddZoneModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState(ZONE_TYPES[0]);
  const [saving, setSaving] = useState(false);
  const [useGps, setUseGps] = useState(false);
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'captured' | 'failed'>('idle');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const handleGpsToggle = useCallback(async (val: boolean) => {
    setUseGps(val);
    if (!val) { setLat(null); setLng(null); setLocationState('idle'); return; }
    setLocationState('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationState('failed'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocationState('captured');
    } catch { setLocationState('failed'); }
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a name for this zone.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('custody_zones').insert({ user_id: user.id, name: name.trim(), zone_type: zoneType, lat, lng });
      setName(''); setZoneType(ZONE_TYPES[0]); setUseGps(false); setLat(null); setLng(null); setLocationState('idle');
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save zone.');
    } finally {
      setSaving(false);
    }
  }, [name, zoneType, lat, lng, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Add Zone</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 20, padding: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 12, color: colors.secondaryLabel }}>Zone Name *</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 15, color: colors.label, borderCurve: 'continuous' }}
              placeholder="e.g. Mom's House" placeholderTextColor={colors.secondaryLabel}
              value={name} onChangeText={setName} autoFocus
            />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 12, color: colors.secondaryLabel }}>Zone Type</Text>
            <View style={{ gap: 8 }}>
              {ZONE_TYPES.map(zt => (
                <Pressable key={zt} onPress={() => setZoneType(zt)}
                  style={{ padding: 16, borderRadius: 14, backgroundColor: zoneType === zt ? brand.teal + '12' : colors.surface, borderWidth: 1, borderColor: zoneType === zt ? brand.teal + '40' : colors.separator, flexDirection: 'row', alignItems: 'center', borderCurve: 'continuous' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: zoneType === zt ? brand.teal : colors.separator, backgroundColor: zoneType === zt ? brand.teal : 'transparent', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                    {zoneType === zt && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                  </View>
                  <Text style={{ fontSize: 15, color: zoneType === zt ? brand.teal : colors.label, fontWeight: zoneType === zt ? '600' : '400' }}>{zt}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* GPS pin */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="location-outline" size={16} color={brand.teal} />
                </View>
                <Text style={{ fontWeight: '600', fontSize: 15, color: colors.label }}>Pin Current Location</Text>
              </View>
              <Switch value={useGps} onValueChange={handleGpsToggle} trackColor={{ true: brand.blue, false: colors.separator }} thumbColor="#fff" />
            </View>
            {useGps && locationState === 'loading' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={brand.blue} />
                <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>Acquiring location…</Text>
              </View>
            )}
            {useGps && locationState === 'captured' && lat !== null && lng !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={14} color={brand.teal} />
                <Text style={{ color: brand.teal, fontSize: 13, fontWeight: '600' }} selectable>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
              </View>
            )}
            {useGps && locationState === 'failed' && (
              <Text style={{ color: brand.error, fontSize: 13 }}>Location unavailable — permission denied or GPS off.</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CustodyClockScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'checkins' | 'zones'>('checkins');
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ciRes, zRes, chRes] = await Promise.all([
        supabase.from('custody_checkins').select('*, child:child_id(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('custody_zones').select('*').order('created_at'),
        supabase.from('children' as any).select('id, name').order('name'),
      ]);
      if (ciRes.data) setCheckIns(ciRes.data as unknown as CheckIn[]);
      if (zRes.data) setZones(zRes.data as unknown as Zone[]);
      if (chRes.data) setChildren(chRes.data as unknown as Child[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteCheckIn = useCallback((id: string) => {
    Alert.alert('Delete check-in?', 'This will permanently remove this custody record.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('custody_checkins').delete().eq('id', id); loadData(); } },
    ]);
  }, [loadData]);

  const handleDeleteZone = useCallback((id: string) => {
    Alert.alert('Delete zone?', 'This will permanently remove this location zone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('custody_zones').delete().eq('id', id); loadData(); } },
    ]);
  }, [loadData]);

  const todayCheckIns = checkIns.filter(c => {
    const d = new Date(c.created_at);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Custody Clock', headerTintColor: brand.blue, headerStyle: { backgroundColor: colors.surface as any } }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* ── Hero strip ── */}
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 12, borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: brand.teal }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' }}>Today</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
              <Text style={{ color: '#fff', fontSize: 40, fontWeight: '700', letterSpacing: -1.5, lineHeight: 44, fontVariant: ['tabular-nums'] }}>{todayCheckIns.length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: '600' }}>check-in{todayCheckIns.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <Pressable onPress={() => setShowCheckInModal(true)}
            style={({ pressed }) => ({ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', transform: [{ scale: pressed ? 0.95 : 1 }] })}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ Log</Text>
          </Pressable>
        </View>

        {/* ── Tabs ── */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 4, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
          {(['checkins', 'zones'] as const).map(tab => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11, backgroundColor: activeTab === tab ? brand.blue : 'transparent', borderCurve: 'continuous' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: activeTab === tab ? '#fff' : colors.secondaryLabel }}>
                {tab === 'checkins' ? `Check-ins (${checkIns.length})` : `Zones (${zones.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={brand.blue} />
          </View>
        ) : activeTab === 'checkins' ? (
          <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
            {checkIns.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 14 }}>
                <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="clipboard-outline" size={28} color={brand.teal} />
                </View>
                <Text style={{ fontWeight: '700', fontSize: 17, color: colors.label }}>No check-ins yet</Text>
                <Text style={{ color: colors.secondaryLabel, fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 }}>
                  Log a custody check-in to start tracking handoffs.
                </Text>
              </View>
            ) : checkIns.map(item => (
              <CheckInCard key={item.id} item={item} onDelete={() => handleDeleteCheckIn(item.id)} />
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, marginBottom: 4 }}>
              <Pressable onPress={() => setShowZoneModal(true)}
                style={({ pressed }) => ({ backgroundColor: brand.teal, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ Add Zone</Text>
              </Pressable>
            </View>
            {zones.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40, gap: 14 }}>
                <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="location-outline" size={28} color={brand.teal} />
                </View>
                <Text style={{ fontWeight: '700', fontSize: 17, color: colors.label }}>No zones set up yet</Text>
                <Text style={{ color: colors.secondaryLabel, fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 }}>
                  Add zones like home addresses and schools to organise custody check-ins.
                </Text>
              </View>
            ) : zones.map(zone => (
              <ZoneCard key={zone.id} zone={zone} onDelete={() => handleDeleteZone(zone.id)} />
            ))}
          </ScrollView>
        )}
      </View>

      <AddCheckInModal visible={showCheckInModal} onClose={() => setShowCheckInModal(false)} onSaved={() => { setShowCheckInModal(false); loadData(); }} childList={children} />
      <AddZoneModal visible={showZoneModal} onClose={() => setShowZoneModal(false)} onSaved={() => { setShowZoneModal(false); loadData(); }} />
    </>
  );
}
