import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}

function CheckInModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [eventType, setEventType] = useState<'enter' | 'exit' | 'manual'>('enter');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const META = {
    enter:  { label: 'Pickup',   icon: 'enter-outline' as const,  color: brand.teal },
    exit:   { label: 'Drop-off', icon: 'exit-outline' as const,   color: '#F59E0B' },
    manual: { label: 'Manual',   icon: 'create-outline' as const,  color: brand.blue },
  };

  const handleSave = async () => {
    if (!notes.trim()) { Alert.alert('Notes required'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('custody_checkins').insert({ user_id: user.id, event_type: eventType, notes: notes.trim(), created_via: 'manual' });
      setNotes(''); setEventType('enter');
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Quick Check-in</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Object.entries(META).map(([key, m]) => (
              <Pressable key={key} onPress={() => setEventType(key as any)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: eventType === key ? m.color + '18' : colors.surface, borderWidth: 1, borderColor: eventType === key ? m.color + '40' : colors.separator, alignItems: 'center', gap: 6, borderCurve: 'continuous' }}>
                <Ionicons name={m.icon} size={20} color={eventType === key ? m.color : colors.secondaryLabel} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: eventType === key ? m.color : colors.secondaryLabel }}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 15, color: colors.label, minHeight: 100, textAlignVertical: 'top', borderCurve: 'continuous' }}
            placeholder="Notes about this handoff…" placeholderTextColor={colors.secondaryLabel}
            value={notes} onChangeText={setNotes} multiline autoFocus
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function QuickAddScreen() {
  const insets = useSafeAreaInsets();
  const [showCheckIn, setShowCheckIn] = useState(false);

  const actions: QuickAction[] = [
    {
      icon: 'location-outline',
      label: 'Log Check-in',
      subtitle: 'Pickup or drop-off',
      color: brand.teal,
      onPress: () => setShowCheckIn(true),
    },
    {
      icon: 'receipt-outline',
      label: 'New Expense',
      subtitle: 'Request reimbursement',
      color: '#F59E0B',
      onPress: () => router.push('/(tabs)/expenses'),
    },
    {
      icon: 'calendar-outline',
      label: 'Add Event',
      subtitle: 'Calendar entry',
      color: brand.blue,
      onPress: () => router.push('/(tabs)/calendar'),
    },
    {
      icon: 'chatbubble-outline',
      label: 'Message',
      subtitle: 'Co-parent chat',
      color: brand.blue,
      onPress: () => router.push('/(tabs)/messages'),
    },
    {
      icon: 'flash-outline',
      label: 'Ask SCAI',
      subtitle: 'AI assistant',
      color: brand.teal,
      onPress: () => router.push('/(tabs)/my-scai'),
    },
    {
      icon: 'documents-outline',
      label: 'Upload Doc',
      subtitle: 'Store a file',
      color: '#8B5CF6',
      onPress: () => router.push('/(tabs)/documents'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ paddingTop: insets.top + 20, paddingBottom: 24, paddingHorizontal: 24, backgroundColor: colors.background }}>
          <Text style={{ fontSize: 32, fontWeight: '700', color: colors.label, letterSpacing: -0.6 }}>Quick Add</Text>
          <Text style={{ fontSize: 15, color: colors.secondaryLabel, marginTop: 4 }}>
            Log, request, or message in seconds
          </Text>
        </View>

        {/* ── Action grid ── */}
        <View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
          {actions.map(action => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => ({
                width: '47%', flexGrow: 1,
                backgroundColor: colors.surface, borderRadius: 20, padding: 20,
                gap: 14, alignItems: 'flex-start',
                borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous',
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: action.color + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <View style={{ gap: 3 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>{action.label}</Text>
                <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{action.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Log streak ── */}
        <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="flash" size={24} color={brand.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>Use My SCAI</Text>
            <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>
              Say it naturally — "log a pickup for Amara"
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/my-scai')}
            style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Open</Text>
          </Pressable>
        </View>
      </ScrollView>

      <CheckInModal
        visible={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        onSaved={() => {
          setShowCheckIn(false);
          Alert.alert('Check-in logged', 'Your custody check-in has been saved.');
        }}
      />
    </View>
  );
}
