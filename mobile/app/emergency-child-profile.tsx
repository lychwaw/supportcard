import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Child {
  id: string;
  name: string;
}

interface EmergencyProfile {
  id: string;
  child_id: string;
  medical_aid_scheme: string | null;
  medical_aid_number: string | null;
  blood_type: string | null;
  allergies: string[] | null;
  medications: string[] | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  dentist_name: string | null;
  dentist_phone: string | null;
  medical_notes: string | null;
  emergency_notes: string | null;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];

// ─── Child Selector ────────────────────────────────────────────────────────────

function ChildSelector({
  children,
  selected,
  onSelect,
}: {
  children: Child[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 4 }}
    >
      {children.map((child) => (
        <Pressable
          key={child.id}
          onPress={() => onSelect(child.id)}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: selected === child.id ? brand.blue : brand.card,
            borderWidth: 1.5,
            borderColor: selected === child.id ? brand.blue : brand.separator,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: selected === child.id ? '#fff' : brand.body,
            }}
          >
            {child.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Profile Row ───────────────────────────────────────────────────────────────

function ProfileRow({ emoji, label, value }: { emoji: string; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: brand.separator,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 18, width: 28 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: brand.body, marginBottom: 2 }}>{label.toUpperCase()}</Text>
        <Text style={{ fontSize: 15, color: brand.dark, lineHeight: 20 }} selectable>{value}</Text>
      </View>
    </View>
  );
}

// ─── Chip (allergy/medication tag) ────────────────────────────────────────────

function Chip({
  label,
  onRemove,
  color = 'blue',
}: {
  label: string;
  onRemove?: () => void;
  color?: 'blue' | 'red';
}) {
  const bg = color === 'red' ? '#FEF2F2' : brand.lightBg;
  const textColor = color === 'red' ? brand.error : brand.blue;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: textColor }}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={{ fontSize: 13, color: textColor, fontWeight: '700' }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Chip Input ────────────────────────────────────────────────────────────────

function ChipInput({
  label,
  items,
  onAdd,
  onRemove,
  color = 'blue',
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (idx: number) => void;
  color?: 'blue' | 'red';
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const handleAdd = () => {
    const v = text.trim();
    if (v) { onAdd(v); setText(''); }
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: brand.card,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: brand.separator,
            padding: 12,
            fontSize: 15,
            color: brand.dark,
            borderCurve: 'continuous',
          }}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
          placeholderTextColor={brand.body}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => ({
            backgroundColor: brand.blue,
            borderRadius: 12,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+</Text>
        </Pressable>
      </View>
      {items.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {items.map((item, idx) => (
            <Chip key={`${item}-${idx}`} label={item} onRemove={() => onRemove(idx)} color={color} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  onClose,
  onSaved,
  childId,
  childName,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  childId: string;
  childName: string;
  initial: Partial<EmergencyProfile> | null;
}) {
  const insets = useSafeAreaInsets();
  const [scheme, setScheme] = useState(initial?.medical_aid_scheme ?? '');
  const [memberNum, setMemberNum] = useState(initial?.medical_aid_number ?? '');
  const [bloodType, setBloodType] = useState(initial?.blood_type ?? '');
  const [allergies, setAllergies] = useState<string[]>(initial?.allergies ?? []);
  const [medications, setMedications] = useState<string[]>(initial?.medications ?? []);
  const [doctorName, setDoctorName] = useState(initial?.doctor_name ?? '');
  const [doctorPhone, setDoctorPhone] = useState(initial?.doctor_phone ?? '');
  const [dentistName, setDentistName] = useState(initial?.dentist_name ?? '');
  const [dentistPhone, setDentistPhone] = useState(initial?.dentist_phone ?? '');
  const [medNotes, setMedNotes] = useState(initial?.medical_notes ?? '');
  const [emergencyNotes, setEmergencyNotes] = useState(initial?.emergency_notes ?? '');
  const [saving, setSaving] = useState(false);

  // Sync when re-opened with new initial data
  useEffect(() => {
    if (visible) {
      setScheme(initial?.medical_aid_scheme ?? '');
      setMemberNum(initial?.medical_aid_number ?? '');
      setBloodType(initial?.blood_type ?? '');
      setAllergies(initial?.allergies ?? []);
      setMedications(initial?.medications ?? []);
      setDoctorName(initial?.doctor_name ?? '');
      setDoctorPhone(initial?.doctor_phone ?? '');
      setDentistName(initial?.dentist_name ?? '');
      setDentistPhone(initial?.dentist_phone ?? '');
      setMedNotes(initial?.medical_notes ?? '');
      setEmergencyNotes(initial?.emergency_notes ?? '');
    }
  }, [visible, initial]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await (supabase.from('child_emergency_profiles' as any) as any).upsert({
        child_id: childId,
        medical_aid_scheme: scheme.trim() || null,
        medical_aid_number: memberNum.trim() || null,
        blood_type: bloodType || null,
        allergies: allergies.length > 0 ? allergies : null,
        medications: medications.length > 0 ? medications : null,
        doctor_name: doctorName.trim() || null,
        doctor_phone: doctorPhone.trim() || null,
        dentist_name: dentistName.trim() || null,
        dentist_phone: dentistPhone.trim() || null,
        medical_notes: medNotes.trim() || null,
        emergency_notes: emergencyNotes.trim() || null,
      }, { onConflict: 'child_id' });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }, [childId, scheme, memberNum, bloodType, allergies, medications, doctorName, doctorPhone, dentistName, dentistPhone, medNotes, emergencyNotes, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: brand.lightBg }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            paddingTop: insets.top + 12,
            backgroundColor: brand.card,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          <Pressable onPress={onClose}>
            <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>
            {initial ? 'Edit Profile' : 'Create Profile'} — {childName}
          </Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 60 }}
        >
          {/* Medical Aid */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>🏥 Medical Aid</Text>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Scheme Name</Text>
                <TextInput
                  style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 15, color: brand.dark, borderCurve: 'continuous' }}
                  placeholder="e.g. Discovery Health"
                  placeholderTextColor={brand.body}
                  value={scheme}
                  onChangeText={setScheme}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Member Number</Text>
                <TextInput
                  style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 15, color: brand.dark, borderCurve: 'continuous' }}
                  placeholder="e.g. 12345678"
                  placeholderTextColor={brand.body}
                  value={memberNum}
                  onChangeText={setMemberNum}
                />
              </View>
            </View>
          </View>

          {/* Blood Type */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>🩸 Blood Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BLOOD_TYPES.map((bt) => (
                <Pressable
                  key={bt}
                  onPress={() => setBloodType(bt === bloodType ? '' : bt)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: bloodType === bt ? brand.blue : brand.card,
                    borderWidth: 1.5,
                    borderColor: bloodType === bt ? brand.blue : brand.separator,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: bloodType === bt ? '#fff' : brand.body }}>{bt}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Allergies */}
          <ChipInput
            label="Allergies"
            items={allergies}
            onAdd={(v) => setAllergies((prev) => [...prev, v])}
            onRemove={(i) => setAllergies((prev) => prev.filter((_, idx) => idx !== i))}
            color="red"
            placeholder="e.g. Peanuts, Penicillin…"
          />

          {/* Medications */}
          <ChipInput
            label="Current Medications"
            items={medications}
            onAdd={(v) => setMedications((prev) => [...prev, v])}
            onRemove={(i) => setMedications((prev) => prev.filter((_, idx) => idx !== i))}
            color="blue"
            placeholder="e.g. Ventolin 100mcg…"
          />

          {/* Doctor */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>🏥 Doctor</Text>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Doctor Name</Text>
                <TextInput
                  style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 15, color: brand.dark, borderCurve: 'continuous' }}
                  placeholder="Dr. Jane Smith"
                  placeholderTextColor={brand.body}
                  value={doctorName}
                  onChangeText={setDoctorName}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Doctor Phone</Text>
                <TextInput
                  style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 15, color: brand.dark, borderCurve: 'continuous' }}
                  placeholder="+27 11 000 0000"
                  placeholderTextColor={brand.body}
                  keyboardType="phone-pad"
                  value={doctorPhone}
                  onChangeText={setDoctorPhone}
                />
              </View>
            </View>
          </View>

          {/* Dentist */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>🦷 Dentist</Text>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Dentist Name</Text>
                <TextInput
                  style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 15, color: brand.dark, borderCurve: 'continuous' }}
                  placeholder="Dr. John Doe"
                  placeholderTextColor={brand.body}
                  value={dentistName}
                  onChangeText={setDentistName}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Dentist Phone</Text>
                <TextInput
                  style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 15, color: brand.dark, borderCurve: 'continuous' }}
                  placeholder="+27 11 000 0001"
                  placeholderTextColor={brand.body}
                  keyboardType="phone-pad"
                  value={dentistPhone}
                  onChangeText={setDentistPhone}
                />
              </View>
            </View>
          </View>

          {/* Medical Notes */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>📋 Medical Notes</Text>
            <TextInput
              style={{
                backgroundColor: brand.card,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: brand.separator,
                padding: 14,
                fontSize: 15,
                color: brand.dark,
                minHeight: 100,
                textAlignVertical: 'top',
                borderCurve: 'continuous',
              }}
              placeholder="Any ongoing conditions, treatment notes, special needs…"
              placeholderTextColor={brand.body}
              multiline
              value={medNotes}
              onChangeText={setMedNotes}
            />
          </View>

          {/* Emergency Notes */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>🆘 Emergency Action</Text>
            <TextInput
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: '#FECACA',
                padding: 14,
                fontSize: 15,
                color: brand.dark,
                minHeight: 100,
                textAlignVertical: 'top',
                borderCurve: 'continuous',
              }}
              placeholder="In emergency, call 10111 first, then… (include any critical instructions)"
              placeholderTextColor={brand.body}
              multiline
              value={emergencyNotes}
              onChangeText={setEmergencyNotes}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({
  profile,
  childName,
  onEdit,
  onShare,
}: {
  profile: EmergencyProfile;
  childName: string;
  onEdit: () => void;
  onShare: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: brand.card,
        borderRadius: 20,
        padding: 24,
        margin: 20,
        borderLeftWidth: 4,
        borderLeftColor: brand.error,
        boxShadow: '0 2px 16px rgba(239,68,68,0.10)',
        borderCurve: 'continuous',
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#FEF2F2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 24 }}>🆘</Text>
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: brand.dark }}>{childName}</Text>
            <Text style={{ fontSize: 12, color: brand.error, fontWeight: '600' }}>Emergency Profile</Text>
          </View>
        </View>
        <Pressable
          onPress={onShare}
          style={({ pressed }) => ({
            backgroundColor: brand.lightBg,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: brand.blue,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: brand.blue }}>Share</Text>
        </Pressable>
      </View>

      {/* Medical Aid */}
      {(profile.medical_aid_scheme || profile.medical_aid_number) && (
        <ProfileRow
          emoji="🏥"
          label="Medical Aid"
          value={[profile.medical_aid_scheme, profile.medical_aid_number].filter(Boolean).join(' · ')}
        />
      )}

      {/* Blood Type */}
      <ProfileRow emoji="🩸" label="Blood Type" value={profile.blood_type} />

      {/* Allergies */}
      {profile.allergies && profile.allergies.length > 0 && (
        <View
          style={{
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18, width: 28 }}>⚠️</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: brand.body }}>ALLERGIES</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 38 }}>
            {profile.allergies.map((a, i) => (
              <Chip key={i} label={a} color="red" />
            ))}
          </View>
        </View>
      )}

      {/* Medications */}
      {profile.medications && profile.medications.length > 0 && (
        <View
          style={{
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18, width: 28 }}>💊</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: brand.body }}>MEDICATIONS</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 38 }}>
            {profile.medications.map((m, i) => (
              <Chip key={i} label={m} color="blue" />
            ))}
          </View>
        </View>
      )}

      {/* Doctor */}
      {(profile.doctor_name || profile.doctor_phone) && (
        <ProfileRow
          emoji="🏥"
          label="Doctor"
          value={[profile.doctor_name, profile.doctor_phone].filter(Boolean).join(' · ')}
        />
      )}

      {/* Dentist */}
      {(profile.dentist_name || profile.dentist_phone) && (
        <ProfileRow
          emoji="🦷"
          label="Dentist"
          value={[profile.dentist_name, profile.dentist_phone].filter(Boolean).join(' · ')}
        />
      )}

      {/* Medical Notes */}
      <ProfileRow emoji="📋" label="Medical Notes" value={profile.medical_notes} />

      {/* Emergency Notes */}
      {profile.emergency_notes && (
        <View
          style={{
            marginTop: 4,
            padding: 14,
            backgroundColor: '#FEF2F2',
            borderRadius: 12,
            gap: 4,
            borderCurve: 'continuous',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: brand.error }}>🆘 EMERGENCY ACTION</Text>
          <Text style={{ fontSize: 14, color: brand.dark, lineHeight: 20 }} selectable>
            {profile.emergency_notes}
          </Text>
        </View>
      )}

      {/* Edit button */}
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => ({
          marginTop: 20,
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: brand.blue,
          backgroundColor: brand.lightBg,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: brand.blue }}>Edit Profile</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EmergencyChildProfileScreen() {
  const insets = useSafeAreaInsets();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadChildren = useCallback(async () => {
    const { data } = await supabase.from('children' as any).select('id, name').order('name');
    const kids = (data as unknown as Child[]) ?? [];
    setChildren(kids);
    if (kids.length > 0 && !selectedChild) setSelectedChild(kids[0].id);
  }, [selectedChild]);

  const loadProfile = useCallback(async () => {
    if (!selectedChild) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase.from('child_emergency_profiles' as any) as any)
      .select('*')
      .eq('child_id', selectedChild)
      .maybeSingle();
    setProfile((data as EmergencyProfile) ?? null);
    setLoading(false);
  }, [selectedChild]);

  useEffect(() => { loadChildren(); }, [loadChildren]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  const selectedChildName = children.find((c) => c.id === selectedChild)?.name ?? '';

  const handleShare = useCallback(() => {
    if (!profile || !selectedChildName) return;
    const lines = [
      `=== EMERGENCY PROFILE: ${selectedChildName.toUpperCase()} ===`,
      profile.medical_aid_scheme ? `Medical Aid: ${profile.medical_aid_scheme} (${profile.medical_aid_number ?? 'no number'})` : '',
      profile.blood_type ? `Blood Type: ${profile.blood_type}` : '',
      profile.allergies?.length ? `Allergies: ${profile.allergies.join(', ')}` : '',
      profile.medications?.length ? `Medications: ${profile.medications.join(', ')}` : '',
      profile.doctor_name ? `Doctor: ${profile.doctor_name} ${profile.doctor_phone ?? ''}`.trim() : '',
      profile.dentist_name ? `Dentist: ${profile.dentist_name} ${profile.dentist_phone ?? ''}`.trim() : '',
      profile.medical_notes ? `Medical Notes: ${profile.medical_notes}` : '',
      profile.emergency_notes ? `Emergency Action: ${profile.emergency_notes}` : '',
    ].filter(Boolean).join('\n');

    Clipboard.setString(lines);
    Alert.alert(
      'Copied to clipboard',
      'Share this with the school, day care, or activity organiser. Keep this information current.',
    );
  }, [profile, selectedChildName]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Emergency Profiles',
          headerTintColor: brand.blue,
          headerStyle: { backgroundColor: brand.card },
        }}
      />

      <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
        {/* Child selector */}
        <View
          style={{
            backgroundColor: brand.card,
            paddingTop: 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          {children.length === 0 ? (
            <Text style={{ paddingHorizontal: 20, color: brand.body, fontSize: 14 }}>
              No children found. Add a child in the Family screen first.
            </Text>
          ) : (
            <ChildSelector children={children} selected={selectedChild} onSelect={setSelectedChild} />
          )}
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}
        >
          {loading ? (
            <ActivityIndicator color={brand.blue} style={{ marginTop: 60 }} />
          ) : !selectedChild ? (
            <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
              <Text style={{ fontSize: 40 }}>👶</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark }}>Select a child</Text>
              <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
                Choose a child above to view or create their emergency profile
              </Text>
            </View>
          ) : profile ? (
            <ProfileCard
              profile={profile}
              childName={selectedChildName}
              onEdit={() => setShowModal(true)}
              onShare={handleShare}
            />
          ) : (
            <View
              style={{
                margin: 20,
                backgroundColor: brand.card,
                borderRadius: 20,
                padding: 40,
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 2px 16px rgba(43,116,214,0.08)',
              }}
            >
              <Text style={{ fontSize: 48 }}>🆘</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: brand.dark }}>No emergency profile yet</Text>
              <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center', lineHeight: 20 }}>
                Create an emergency profile for {selectedChildName} with medical aid details, allergies, medications, and emergency contacts.
              </Text>
              <Pressable
                onPress={() => setShowModal(true)}
                style={({ pressed }) => ({
                  backgroundColor: brand.blue,
                  borderRadius: 14,
                  paddingHorizontal: 28,
                  paddingVertical: 14,
                  opacity: pressed ? 0.8 : 1,
                  boxShadow: '0 4px 14px rgba(43,116,214,0.30)',
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Profile</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      {selectedChild && (
        <EditProfileModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadProfile(); }}
          childId={selectedChild}
          childName={selectedChildName}
          initial={profile}
        />
      )}
    </>
  );
}
