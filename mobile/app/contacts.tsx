import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TextInput, Pressable, Modal,
  Alert, ActivityIndicator, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

type ContactType = 'Doctor' | 'School' | 'Family' | 'Other';

type Contact = {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
  contact_type: ContactType;
  created_at: string;
};

const TYPE_ICON: Record<ContactType, keyof typeof Ionicons.glyphMap> = {
  Doctor: 'medkit-outline',
  School: 'school-outline',
  Family: 'people-outline',
  Other: 'call-outline',
};

const TYPE_COLOR: Record<ContactType, string> = {
  Doctor: '#22C55E',
  School: '#2B74D6',
  Family: '#8B5CF6',
  Other: '#6B7A8D',
};

const CONTACT_TYPES: ContactType[] = ['Doctor', 'School', 'Family', 'Other'];

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [contactType, setContactType] = useState<ContactType>('Doctor');
  const [saving, setSaving] = useState(false);

  const loadContacts = async () => {
    setLoading(true);
    const { data } = await supabase.from('emergency_contacts' as any).select('*').order('created_at');
    setContacts((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadContacts(); }, []);

  const openModal = () => {
    setName(''); setPhone(''); setRelationship(''); setContactType('Doctor');
    setShowModal(true);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    if (!phone.trim()) { Alert.alert('Phone required'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('emergency_contacts' as any).insert({
      user_id: user.id, name: name.trim(), phone: phone.trim(),
      relationship: relationship.trim() || null, contact_type: contactType,
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowModal(false);
    loadContacts();
  };

  const deleteContact = (contact: Contact) => {
    Alert.alert('Remove Contact', `Remove ${contact.name} from emergency contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('emergency_contacts' as any).delete().eq('id', contact.id);
          loadContacts();
        },
      },
    ]);
  };

  const grouped: Partial<Record<ContactType, Contact[]>> = {};
  for (const c of contacts) {
    if (!grouped[c.contact_type]) grouped[c.contact_type] = [];
    grouped[c.contact_type]!.push(c);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Emergency Contacts', headerTintColor: brand.blue }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={{ backgroundColor: '#F59E0B10', borderRadius: 16, borderCurve: 'continuous', borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: colors.label, fontWeight: '700', marginBottom: 3 }}>Shared with co-parent</Text>
            <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>Add doctors, schools, and trusted contacts your co-parent may need to reach.</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : contacts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="call-outline" size={32} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>No emergency contacts yet</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>Add your doctor, school, and trusted contacts</Text>
            <Pressable onPress={openModal}
              style={({ pressed }) => ({ marginTop: 4, backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 24, paddingVertical: 13, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add Contact</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            {(['Doctor', 'School', 'Family', 'Other'] as ContactType[]).map(type => {
              const group = grouped[type];
              if (!group || group.length === 0) return null;
              return (
                <View key={type}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 10 }}>
                    {type}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {group.map(contact => (
                      <View key={contact.id} style={{ backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: colors.separator }}>
                        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: TYPE_COLOR[contact.contact_type] + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                          <Ionicons name={TYPE_ICON[contact.contact_type]} size={22} color={TYPE_COLOR[contact.contact_type]} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>{contact.name}</Text>
                          {contact.relationship ? <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>{contact.relationship}</Text> : null}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 8 }}>
                          <Text selectable style={{ fontSize: 14, color: colors.label, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{contact.phone}</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22C55E18', borderRadius: 8, borderCurve: 'continuous', paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Ionicons name="call-outline" size={12} color="#22C55E" />
                              <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '700' }}>Call</Text>
                            </Pressable>
                            <Pressable onPress={() => deleteContact(contact)} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}>
                              <Ionicons name="trash-outline" size={15} color={colors.secondaryLabel} />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable onPress={openModal}
        style={({ pressed }) => ({
          position: 'absolute', bottom: 96, right: 16,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(43,116,214,0.30)',
          transform: [{ scale: pressed ? 0.92 : 1 }],
        })}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Add Contact Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setShowModal(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Add Contact</Text>
            <Pressable onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Full Name *</Text>
              <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, fontSize: 15, color: colors.label, borderWidth: 0.5, borderColor: colors.separator }}
                placeholder="Dr. Jane Smith" placeholderTextColor={colors.secondaryLabel} value={name} onChangeText={setName} autoCapitalize="words" autoFocus />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Phone Number *</Text>
              <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, fontSize: 15, color: colors.label, borderWidth: 0.5, borderColor: colors.separator }}
                placeholder="+27 21 000 0000" placeholderTextColor={colors.secondaryLabel} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Relationship / Role</Text>
              <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, fontSize: 15, color: colors.label, borderWidth: 0.5, borderColor: colors.separator }}
                placeholder="Paediatrician, Class teacher…" placeholderTextColor={colors.secondaryLabel} value={relationship} onChangeText={setRelationship} autoCapitalize="sentences" />
            </View>
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Contact Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CONTACT_TYPES.map(type => (
                  <Pressable key={type} onPress={() => setContactType(type)}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 7,
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
                      borderWidth: contactType === type ? 0 : 0.5,
                      borderColor: colors.separator,
                      backgroundColor: contactType === type ? TYPE_COLOR[type] + '18' : colors.surface,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    })}>
                    <Ionicons name={TYPE_ICON[type]} size={14} color={contactType === type ? TYPE_COLOR[type] : colors.secondaryLabel} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: contactType === type ? TYPE_COLOR[type] : colors.secondaryLabel }}>{type}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
