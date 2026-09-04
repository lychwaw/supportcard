import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Share,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';

interface Child { id: string; name: string }
interface EmergencyProfile {
  id: string; child_id: string;
  medical_aid_scheme: string | null; medical_aid_number: string | null;
  blood_type: string | null; allergies: string[] | null; medications: string[] | null;
  doctor_name: string | null; doctor_phone: string | null;
  dentist_name: string | null; dentist_phone: string | null;
  medical_notes: string | null; emergency_notes: string | null;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];

function ChildSelector({ children, selected, onSelect }: { children: Child[]; selected: string | null; onSelect: (id: string | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}>
      {children.map(child => (
        <Pressable key={child.id} onPress={() => onSelect(child.id)}
          style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: selected === child.id ? brand.blue : 'transparent', borderWidth: selected === child.id ? 0 : 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: selected === child.id ? '#fff' : colors.secondaryLabel }}>
            {child.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ProfileRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.separator, gap: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, borderCurve: 'continuous', backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={brand.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 3 }}>{label}</Text>
        <Text style={{ fontSize: 15, color: colors.label, lineHeight: 21 }} selectable>{value}</Text>
      </View>
    </View>
  );
}

function Chip({ label, onRemove, color = 'blue' }: { label: string; onRemove?: () => void; color?: 'blue' | 'red' }) {
  const bg = color === 'red' ? '#FEF2F2' : brand.blue + '12';
  const textColor = color === 'red' ? brand.error : brand.blue;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: textColor }}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={{ fontSize: 14, color: textColor, fontWeight: '700', lineHeight: 16 }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

function ChipInput({ label, items, onAdd, onRemove, color = 'blue', placeholder }: {
  label: string; items: string[];
  onAdd: (val: string) => void; onRemove: (idx: number) => void;
  color?: 'blue' | 'red'; placeholder?: string;
}) {
  const [text, setText] = useState('');
  const handleAdd = () => { const v = text.trim(); if (v) { onAdd(v); setText(''); } };
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 12, fontSize: 15, color: colors.label }}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`} placeholderTextColor={colors.secondaryLabel}
          value={text} onChangeText={setText} onSubmitEditing={handleAdd} returnKeyType="done" />
        <Pressable onPress={handleAdd}
          style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, lineHeight: 22 }}>+</Text>
        </Pressable>
      </View>
      {items.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {items.map((item, idx) => <Chip key={`${item}-${idx}`} label={item} onRemove={() => onRemove(idx)} color={color} />)}
        </View>
      )}
    </View>
  );
}

function EditProfileModal({ visible, onClose, onSaved, childId, childName, initial }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
  childId: string; childName: string; initial: Partial<EmergencyProfile> | null;
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

  useEffect(() => {
    if (visible) {
      setScheme(initial?.medical_aid_scheme ?? ''); setMemberNum(initial?.medical_aid_number ?? '');
      setBloodType(initial?.blood_type ?? ''); setAllergies(initial?.allergies ?? []);
      setMedications(initial?.medications ?? []); setDoctorName(initial?.doctor_name ?? '');
      setDoctorPhone(initial?.doctor_phone ?? ''); setDentistName(initial?.dentist_name ?? '');
      setDentistPhone(initial?.dentist_phone ?? ''); setMedNotes(initial?.medical_notes ?? '');
      setEmergencyNotes(initial?.emergency_notes ?? '');
    }
  }, [visible, initial]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await (supabase.from('child_emergency_profiles' as any) as any).upsert({
        child_id: childId,
        medical_aid_scheme: scheme.trim() || null, medical_aid_number: memberNum.trim() || null,
        blood_type: bloodType || null,
        allergies: allergies.length > 0 ? allergies : null, medications: medications.length > 0 ? medications : null,
        doctor_name: doctorName.trim() || null, doctor_phone: doctorPhone.trim() || null,
        dentist_name: dentistName.trim() || null, dentist_phone: dentistPhone.trim() || null,
        medical_notes: medNotes.trim() || null, emergency_notes: emergencyNotes.trim() || null,
      }, { onConflict: 'child_id' });
      if (error) throw error;
      // Notify co-parent (best-effort)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/apns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'notify-emergency', child_name: childName }),
        }).catch(() => {});
      }
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }, [childId, scheme, memberNum, bloodType, allergies, medications, doctorName, doctorPhone, dentistName, dentistPhone, medNotes, emergencyNotes, onSaved]);

  const inputStyle = { backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous' as const, borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 15, color: colors.label };
  const sectionLabelStyle = { fontSize: 12, fontWeight: '600' as const, color: colors.secondaryLabel };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>{initial ? 'Edit' : 'Create'} — {childName}</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 60 }}>
          {/* Medical Aid */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>Medical Aid</Text>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Text style={sectionLabelStyle}>Scheme Name</Text>
                <TextInput style={inputStyle} placeholder="e.g. Discovery Health" placeholderTextColor={colors.secondaryLabel} value={scheme} onChangeText={setScheme} />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={sectionLabelStyle}>Member Number</Text>
                <TextInput style={inputStyle} placeholder="e.g. 12345678" placeholderTextColor={colors.secondaryLabel} value={memberNum} onChangeText={setMemberNum} />
              </View>
            </View>
          </View>
          {/* Blood Type */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>Blood Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BLOOD_TYPES.map(bt => (
                <Pressable key={bt} onPress={() => setBloodType(bt === bloodType ? '' : bt)}
                  style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: bloodType === bt ? brand.blue : 'transparent', borderWidth: bloodType === bt ? 0 : 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: bloodType === bt ? '#fff' : colors.secondaryLabel }}>{bt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <ChipInput label="Allergies" items={allergies} onAdd={v => setAllergies(p => [...p, v])} onRemove={i => setAllergies(p => p.filter((_, idx) => idx !== i))} color="red" placeholder="e.g. Peanuts, Penicillin…" />
          <ChipInput label="Current Medications" items={medications} onAdd={v => setMedications(p => [...p, v])} onRemove={i => setMedications(p => p.filter((_, idx) => idx !== i))} color="blue" placeholder="e.g. Ventolin 100mcg…" />
          {/* Doctor */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>Doctor</Text>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}><Text style={sectionLabelStyle}>Doctor Name</Text><TextInput style={inputStyle} placeholder="Dr. Jane Smith" placeholderTextColor={colors.secondaryLabel} value={doctorName} onChangeText={setDoctorName} /></View>
              <View style={{ gap: 6 }}><Text style={sectionLabelStyle}>Doctor Phone</Text><TextInput style={inputStyle} placeholder="+27 11 000 0000" placeholderTextColor={colors.secondaryLabel} keyboardType="phone-pad" value={doctorPhone} onChangeText={setDoctorPhone} /></View>
            </View>
          </View>
          {/* Dentist */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>Dentist</Text>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}><Text style={sectionLabelStyle}>Dentist Name</Text><TextInput style={inputStyle} placeholder="Dr. John Doe" placeholderTextColor={colors.secondaryLabel} value={dentistName} onChangeText={setDentistName} /></View>
              <View style={{ gap: 6 }}><Text style={sectionLabelStyle}>Dentist Phone</Text><TextInput style={inputStyle} placeholder="+27 11 000 0001" placeholderTextColor={colors.secondaryLabel} keyboardType="phone-pad" value={dentistPhone} onChangeText={setDentistPhone} /></View>
            </View>
          </View>
          {/* Medical Notes */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>Medical Notes</Text>
            <TextInput style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]} placeholder="Any ongoing conditions, treatment notes, special needs…" placeholderTextColor={colors.secondaryLabel} multiline value={medNotes} onChangeText={setMedNotes} />
          </View>
          {/* Emergency Notes */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.error }}>Emergency Action</Text>
            <TextInput
              style={{ backgroundColor: '#FEF2F2', borderRadius: 14, borderCurve: 'continuous', borderWidth: 1.5, borderColor: '#FECACA', padding: 14, fontSize: 15, color: '#1F2937', minHeight: 100, textAlignVertical: 'top' }}
              placeholder="In emergency, call 10111 first, then… (include any critical instructions)" placeholderTextColor="#F87171"
              multiline value={emergencyNotes} onChangeText={setEmergencyNotes} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProfileCard({ profile, childName, onEdit, onShare }: { profile: EmergencyProfile; childName: string; onEdit: () => void; onShare: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 24, margin: 16, borderLeftWidth: 4, borderLeftColor: brand.error, borderWidth: 0.5, borderColor: colors.separator, boxShadow: '0 2px 16px rgba(239,68,68,0.08)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="heart-circle" size={28} color={brand.error} />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label }}>{childName}</Text>
            <Text style={{ fontSize: 12, color: brand.error, fontWeight: '600' }}>Emergency Profile</Text>
          </View>
        </View>
        <Pressable onPress={onShare}
          style={({ pressed }) => ({ backgroundColor: brand.blue + '10', borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: brand.blue + '30', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: brand.blue }}>Share</Text>
        </Pressable>
      </View>

      {(profile.medical_aid_scheme || profile.medical_aid_number) && (
        <ProfileRow icon="medkit-outline" label="Medical Aid" value={[profile.medical_aid_scheme, profile.medical_aid_number].filter(Boolean).join(' · ')} />
      )}
      <ProfileRow icon="water-outline" label="Blood Type" value={profile.blood_type} />

      {profile.allergies && profile.allergies.length > 0 && (
        <View style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.separator, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning-outline" size={17} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel }}>Allergies</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 42 }}>
            {profile.allergies.map((a, i) => <Chip key={i} label={a} color="red" />)}
          </View>
        </View>
      )}

      {profile.medications && profile.medications.length > 0 && (
        <View style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.separator, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, borderCurve: 'continuous', backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="medical-outline" size={17} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel }}>Medications</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 42 }}>
            {profile.medications.map((m, i) => <Chip key={i} label={m} color="blue" />)}
          </View>
        </View>
      )}

      {(profile.doctor_name || profile.doctor_phone) && (
        <ProfileRow icon="medkit-outline" label="Doctor" value={[profile.doctor_name, profile.doctor_phone].filter(Boolean).join(' · ')} />
      )}
      {(profile.dentist_name || profile.dentist_phone) && (
        <ProfileRow icon="medical-outline" label="Dentist" value={[profile.dentist_name, profile.dentist_phone].filter(Boolean).join(' · ')} />
      )}
      <ProfileRow icon="document-text-outline" label="Medical Notes" value={profile.medical_notes} />

      {profile.emergency_notes && (
        <View style={{ marginTop: 4, padding: 16, backgroundColor: '#FEF2F2', borderRadius: 14, borderCurve: 'continuous', gap: 6, borderWidth: 1, borderColor: '#FECACA' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: brand.error }}>Emergency Action</Text>
          <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 21 }} selectable>{profile.emergency_notes}</Text>
        </View>
      )}

      <Pressable onPress={onEdit}
        style={({ pressed }) => ({ marginTop: 20, borderRadius: 14, borderCurve: 'continuous', padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: brand.blue, backgroundColor: brand.blue + '08', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: brand.blue }}>Edit Profile</Text>
      </Pressable>
    </View>
  );
}

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
    const { data } = await (supabase.from('child_emergency_profiles' as any) as any).select('*').eq('child_id', selectedChild).maybeSingle();
    setProfile((data as EmergencyProfile) ?? null);
    setLoading(false);
  }, [selectedChild]);

  useEffect(() => { loadChildren(); }, [loadChildren]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  const selectedChildName = children.find(c => c.id === selectedChild)?.name ?? '';

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
    Share.share({ message: lines });
  }, [profile, selectedChildName]);

  return (
    <>
      <Stack.Screen options={{ title: 'Emergency Profiles', headerTintColor: brand.blue }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ backgroundColor: colors.surface, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          {children.length === 0 ? (
            <Text style={{ paddingHorizontal: 20, color: colors.secondaryLabel, fontSize: 14 }}>
              No children found. Add a child in the Family screen first.
            </Text>
          ) : (
            <ChildSelector children={children} selected={selectedChild} onSelect={setSelectedChild} />
          )}
        </View>

        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}>
          {loading ? (
            <ActivityIndicator color={brand.blue} style={{ marginTop: 60 }} />
          ) : !selectedChild ? (
            <View style={{ alignItems: 'center', padding: 48, gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, borderCurve: 'continuous', backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-outline" size={32} color={brand.blue} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Select a child</Text>
              <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 21 }}>Choose a child above to view or create their emergency profile</Text>
            </View>
          ) : profile ? (
            <ProfileCard profile={profile} childName={selectedChildName} onEdit={() => setShowModal(true)} onShare={handleShare} />
          ) : (
            <View style={{ margin: 16, backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 48, alignItems: 'center', gap: 16, borderWidth: 0.5, borderColor: colors.separator }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="heart-circle" size={40} color={brand.error} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label }}>No emergency profile yet</Text>
              <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 21 }}>
                Create an emergency profile for {selectedChildName} with medical aid details, allergies, medications, and emergency contacts.
              </Text>
              <Pressable onPress={() => setShowModal(true)}
                style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 28, paddingVertical: 14, transform: [{ scale: pressed ? 0.97 : 1 }], boxShadow: '0 4px 14px rgba(43,116,214,0.25)' })}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Profile</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      {selectedChild && (
        <EditProfileModal visible={showModal} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadProfile(); }} childId={selectedChild} childName={selectedChildName} initial={profile} />
      )}
    </>
  );
}
