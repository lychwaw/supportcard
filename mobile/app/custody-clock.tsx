import { useState, useEffect, useCallback } from 'react';
import { router, Stack } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Child {
  id: string;
  name: string;
}

interface CheckIn {
  id: string;
  event_type: 'enter' | 'exit' | 'manual';
  notes: string | null;
  created_at: string;
  created_via: string | null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function eventIcon(type: 'enter' | 'exit' | 'manual') {
  if (type === 'enter') return '📥';
  if (type === 'exit') return '📤';
  return '📝';
}

function eventLabel(type: 'enter' | 'exit' | 'manual') {
  if (type === 'enter') return 'Enter (Pickup)';
  if (type === 'exit') return 'Exit (Drop-off)';
  return 'Manual';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScaiBadge() {
  return (
    <View
      style={{
        backgroundColor: brand.lightBg,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: '#C3DAFB',
        alignSelf: 'flex-start',
        marginTop: 4,
      }}
    >
      <Text style={{ fontSize: 11, color: brand.blue, fontWeight: '600' }}>🤖 My SCAI</Text>
    </View>
  );
}

function CheckInCard({ item }: { item: CheckIn }) {
  return (
    <View
      style={{
        backgroundColor: brand.card,
        borderRadius: 14,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        borderCurve: 'continuous',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: brand.lightBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>{eventIcon(item.event_type)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '600', fontSize: 15, color: brand.dark }}>
            {eventLabel(item.event_type)}
            {item.child ? ` — ${item.child.name}` : ''}
          </Text>
          {item.notes ? (
            <Text
              style={{ color: brand.body, fontSize: 13, lineHeight: 18 }}
              numberOfLines={2}
            >
              {item.notes}
            </Text>
          ) : null}
          {item.created_via === 'scai' ? <ScaiBadge /> : null}
          {item.lat != null && item.lng != null && (
            <Pressable
              onPress={() => Linking.openURL(
                `maps://?q=Custody+Check-in&ll=${item.lat},${item.lng}`
              )}
              style={{ marginTop: 4 }}
            >
              <Text style={{ fontSize: 12, color: brand.blue, fontWeight: '600' }}>
                📍 View in Maps ({item.lat?.toFixed(4)}, {item.lng?.toFixed(4)})
              </Text>
            </Pressable>
          )}
        </View>
        <Text style={{ color: brand.body, fontSize: 12, marginTop: 2 }}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    </View>
  );
}

function ZoneCard({ zone }: { zone: Zone }) {
  const hasCoords = zone.lat != null && zone.lng != null;
  const desc = hasCoords
    ? `${zone.lat!.toFixed(4)}, ${zone.lng!.toFixed(4)}`
    : 'No coordinates set';

  return (
    <View
      style={{
        backgroundColor: brand.card,
        borderRadius: 14,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        borderCurve: 'continuous',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#E6F9F1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>📍</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '600', fontSize: 15, color: brand.dark }}>{zone.name}</Text>
          <Text style={{ color: brand.body, fontSize: 13 }}>{zone.zone_type}</Text>
          <Text style={{ color: brand.body, fontSize: 12 }}>{desc}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Add Check-in Modal ───────────────────────────────────────────────────────

interface AddCheckInModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  children: Child[];
}

function AddCheckInModal({ visible, onClose, onSaved, children }: AddCheckInModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<'enter' | 'manual' | 'exit'>('enter');
  const [notes, setNotes] = useState('');
  const [useGps, setUseGps] = useState(false);
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'captured' | 'failed'>(
    'idle'
  );
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGpsToggle = useCallback(async (val: boolean) => {
    setUseGps(val);
    if (!val) {
      setLat(null);
      setLng(null);
      setLocationState('idle');
      return;
    }

    setLocationState('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationState('failed');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setLocationState('captured');
    } catch {
      setLocationState('failed');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!notes.trim()) {
      Alert.alert('Notes required', 'Please enter notes for this check-in.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('custody_checkins').insert({
        user_id: user.id,
        child_id: selectedChildId ?? null,
        event_type: eventType,
        notes: notes.trim(),
        lat,
        lng,
        created_via: 'manual',
      });

      // Reset
      setNotes('');
      setSelectedChildId(null);
      setEventType('enter');
      setUseGps(false);
      setLat(null);
      setLng(null);
      setLocationState('idle');
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save check-in.');
    } finally {
      setSaving(false);
    }
  }, [notes, selectedChildId, eventType, lat, lng, onSaved]);

  const EVENT_TYPES: Array<{ key: 'enter' | 'manual' | 'exit'; label: string }> = [
    { key: 'enter', label: 'Enter (Pickup)' },
    { key: 'manual', label: 'Manual' },
    { key: 'exit', label: 'Exit (Drop-off)' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#F7FAFF' }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: brand.card,
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17, color: brand.dark }}>
            Log Check-in
          </Text>
          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => ({ opacity: pressed || saving ? 0.5 : 1 })}>
            {saving ? (
              <ActivityIndicator size="small" color={brand.blue} />
            ) : (
              <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 20, padding: 16 }}>
          {/* Child selector */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Child (optional)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setSelectedChildId(null)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedChildId === null ? brand.blue : brand.card,
                    borderWidth: 1,
                    borderColor: selectedChildId === null ? brand.blue : brand.separator,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: selectedChildId === null ? '#fff' : brand.body, fontWeight: '500', fontSize: 14 }}>
                    General
                  </Text>
                </Pressable>
                {children.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedChildId(c.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: selectedChildId === c.id ? brand.blue : brand.card,
                      borderWidth: 1,
                      borderColor: selectedChildId === c.id ? brand.blue : brand.separator,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: selectedChildId === c.id ? '#fff' : brand.body, fontWeight: '500', fontSize: 14 }}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Event type */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Event Type
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {EVENT_TYPES.map((et) => (
                <Pressable
                  key={et.key}
                  onPress={() => setEventType(et.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: eventType === et.key ? brand.blue : brand.card,
                    borderWidth: 1,
                    borderColor: eventType === et.key ? brand.blue : brand.separator,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                    borderCurve: 'continuous',
                  })}
                >
                  <Text
                    style={{
                      color: eventType === et.key ? '#fff' : brand.body,
                      fontWeight: '600',
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    {et.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Notes *
            </Text>
            <TextInput
              style={{
                backgroundColor: brand.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: brand.separator,
                padding: 14,
                fontSize: 15,
                color: brand.dark,
                minHeight: 96,
                textAlignVertical: 'top',
                borderCurve: 'continuous',
              }}
              placeholder="Add notes about this check-in…"
              placeholderTextColor={brand.body}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* GPS Location */}
          <View
            style={{
              backgroundColor: brand.card,
              borderRadius: 14,
              padding: 14,
              gap: 10,
              borderCurve: 'continuous',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontWeight: '600', fontSize: 15, color: brand.dark }}>
                Use GPS Location
              </Text>
              <Switch
                value={useGps}
                onValueChange={handleGpsToggle}
                trackColor={{ true: brand.blue, false: brand.separator }}
              />
            </View>

            {useGps && locationState === 'loading' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={brand.blue} />
                <Text style={{ color: brand.body, fontSize: 13 }}>Acquiring location…</Text>
              </View>
            )}
            {useGps && locationState === 'captured' && (
              <Text style={{ color: brand.teal, fontSize: 13, fontWeight: '500' }}>
                📍 Location captured ({lat?.toFixed(5)}, {lng?.toFixed(5)})
              </Text>
            )}
            {useGps && locationState === 'failed' && (
              <Text style={{ color: brand.error, fontSize: 13 }}>
                Location unavailable — permission denied or GPS off.
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Add Zone Modal ───────────────────────────────────────────────────────────

const ZONE_TYPES = ["Home (Mom's)", "Home (Dad's)", 'School', 'Other'];

interface AddZoneModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function AddZoneModal({ visible, onClose, onSaved }: AddZoneModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState(ZONE_TYPES[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for this zone.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('custody_zones').insert({
        user_id: user.id,
        name: name.trim(),
        zone_type: zoneType,
      });

      setName('');
      setZoneType(ZONE_TYPES[0]);
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save zone.');
    } finally {
      setSaving(false);
    }
  }, [name, zoneType, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#F7FAFF' }}>
        <View
          style={{
            backgroundColor: brand.card,
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17, color: brand.dark }}>
            Add Zone
          </Text>
          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => ({ opacity: pressed || saving ? 0.5 : 1 })}>
            {saving ? (
              <ActivityIndicator size="small" color={brand.blue} />
            ) : (
              <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 20, padding: 16 }}>
          {/* Name */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Zone Name *
            </Text>
            <TextInput
              style={{
                backgroundColor: brand.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: brand.separator,
                padding: 14,
                fontSize: 15,
                color: brand.dark,
                borderCurve: 'continuous',
              }}
              placeholder="e.g. Mom's House"
              placeholderTextColor={brand.body}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* Zone type */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Zone Type
            </Text>
            <View style={{ gap: 8 }}>
              {ZONE_TYPES.map((zt) => (
                <Pressable
                  key={zt}
                  onPress={() => setZoneType(zt)}
                  style={({ pressed }) => ({
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: zoneType === zt ? brand.lightBg : brand.card,
                    borderWidth: 1,
                    borderColor: zoneType === zt ? brand.blue : brand.separator,
                    flexDirection: 'row',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                    borderCurve: 'continuous',
                  })}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: zoneType === zt ? brand.blue : brand.separator,
                      backgroundColor: zoneType === zt ? brand.blue : 'transparent',
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {zoneType === zt && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 15, color: brand.dark, fontWeight: zoneType === zt ? '600' : '400' }}>
                    {zt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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
      const [checkInRes, zoneRes, childRes] = await Promise.all([
        supabase
          .from('custody_checkins')
          .select('*, child:child_id(name)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('custody_zones').select('*').order('created_at'),
        supabase.from('children' as any).select('id, name').order('name'),
      ]);

      if (checkInRes.data) setCheckIns(checkInRes.data as unknown as CheckIn[]);
      if (zoneRes.data) setZones(zoneRes.data as unknown as Zone[]);
      if (childRes.data) setChildren(childRes.data as unknown as Child[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckInSaved = useCallback(() => {
    setShowCheckInModal(false);
    loadData();
  }, [loadData]);

  const handleZoneSaved = useCallback(() => {
    setShowZoneModal(false);
    loadData();
  }, [loadData]);

  return (
    <>
      <Stack.Screen options={{ title: 'Custody Clock', headerTintColor: brand.blue }} />

      <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
        {/* Tab row */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: brand.card,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          {(['checkins', 'zones'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab ? brand.blue : 'transparent',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: activeTab === tab ? '600' : '400',
                  color: activeTab === tab ? brand.blue : brand.body,
                }}
              >
                {tab === 'checkins' ? 'Check-ins' : 'Zones'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Action button */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={() => (activeTab === 'checkins' ? setShowCheckInModal(true) : setShowZoneModal(true))}
            style={({ pressed }) => ({
              backgroundColor: brand.blue,
              borderRadius: 20,
              paddingHorizontal: 18,
              paddingVertical: 9,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
              {activeTab === 'checkins' ? '+ Log Check-in' : '+ Add Zone'}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={brand.blue} />
          </View>
        ) : activeTab === 'checkins' ? (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            {checkIns.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>📋</Text>
                <Text style={{ fontWeight: '700', fontSize: 17, color: brand.dark }}>No check-ins yet</Text>
                <Text style={{ color: brand.body, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }}>
                  Log a custody check-in to start tracking handoffs.
                </Text>
              </View>
            ) : (
              checkIns.map((item) => <CheckInCard key={item.id} item={item} />)
            )}
          </ScrollView>
        ) : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            {zones.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>📍</Text>
                <Text style={{ fontWeight: '700', fontSize: 17, color: brand.dark }}>No zones set up yet</Text>
                <Text style={{ color: brand.body, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }}>
                  Add zones like home addresses and schools to organise your custody check-ins.
                </Text>
              </View>
            ) : (
              zones.map((zone) => <ZoneCard key={zone.id} zone={zone} />)
            )}
          </ScrollView>
        )}
      </View>

      <AddCheckInModal
        visible={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        onSaved={handleCheckInSaved}
        children={children}
      />
      <AddZoneModal
        visible={showZoneModal}
        onClose={() => setShowZoneModal(false)}
        onSaved={handleZoneSaved}
      />
    </>
  );
}
