import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TextInput, Pressable, Modal,
  Alert, ActivityIndicator, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@/theme/colors';
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
    const { data } = await supabase
      .from('emergency_contacts' as any)
      .select('*')
      .order('created_at');
    setContacts((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadContacts(); }, []);

  const openModal = () => {
    setName(''); setPhone(''); setRelationship(''); setContactType('Doctor');
    setShowModal(true);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a full name.'); return; }
    if (!phone.trim()) { Alert.alert('Phone required', 'Please enter a phone number.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('emergency_contacts' as any).insert({
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship.trim() || null,
      contact_type: contactType,
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowModal(false);
    loadContacts();
  };

  const deleteContact = (contact: Contact) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.name} from emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await supabase.from('emergency_contacts' as any).delete().eq('id', contact.id);
            loadContacts();
          },
        },
      ]
    );
  };

  const grouped: Partial<Record<ContactType, Contact[]>> = {};
  for (const c of contacts) {
    if (!grouped[c.contact_type]) grouped[c.contact_type] = [];
    grouped[c.contact_type]!.push(c);
  }

  const orderedTypes: ContactType[] = ['Doctor', 'School', 'Family', 'Other'];

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      <Stack.Screen options={{ title: 'Emergency Contacts', headerTintColor: brand.blue }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
      >
        {/* Info banner */}
        <View style={{
          backgroundColor: brand.card,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: '#F59E0B',
          padding: 16,
          marginBottom: 20,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: brand.dark, fontWeight: '600', marginBottom: 4 }}>
              Shared with co-parent
            </Text>
            <Text style={{ fontSize: 12, color: brand.body }}>
              Add doctors, schools, and trusted contacts your co-parent may need to reach.
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : contacts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: brand.separator, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              <Ionicons name="call-outline" size={32} color={brand.body} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark }}>
              No emergency contacts yet
            </Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
              Add your doctor, school, and trusted contacts
            </Text>
            <Pressable onPress={openModal} style={{ marginTop: 8, backgroundColor: brand.blue, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add Contact</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            {orderedTypes.map(type => {
              const group = grouped[type];
              if (!group || group.length === 0) return null;
              return (
                <View key={type}>
                  <Text style={{
                    fontSize: 12, fontWeight: '700', color: brand.body,
                    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
                  }}>
                    {type}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {group.map(contact => (
                      <View
                        key={contact.id}
                        style={{
                          backgroundColor: brand.card, borderRadius: 16, padding: 16,
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
                        }}
                      >
                        <View style={{
                          width: 44, height: 44, borderRadius: 22,
                          backgroundColor: `${TYPE_COLOR[contact.contact_type]}18`,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name={TYPE_ICON[contact.contact_type]} size={20} color={TYPE_COLOR[contact.contact_type]} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark }}>
                            {contact.name}
                          </Text>
                          {contact.relationship ? (
                            <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>
                              {contact.relationship}
                            </Text>
                          ) : null}
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text selectable style={{ fontSize: 14, color: brand.dark, fontWeight: '500' }}>
                            {contact.phone}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                backgroundColor: '#22C55E18', borderRadius: 8,
                                paddingHorizontal: 8, paddingVertical: 4,
                              }}
                            >
                              <Ionicons name="call-outline" size={12} color="#22C55E" />
                              <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '600' }}>Call</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => deleteContact(contact)}
                              hitSlop={8}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="trash-outline" size={14} color={brand.body} style={{ opacity: 0.5 }} />
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
      <Pressable
        onPress={openModal}
        style={{
          position: 'absolute', bottom: 96, right: 16,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(43,116,214,0.30)',
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Add Contact Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: brand.lightBg }}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: 20, paddingTop: insets.top + 16,
            borderBottomWidth: 1, borderBottomColor: brand.separator, backgroundColor: brand.card,
          }}>
            <Pressable onPress={() => setShowModal(false)}>
              <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Add Contact</Text>
            <Pressable onPress={save} disabled={saving}>
              <Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>FULL NAME *</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 14, fontSize: 15, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
                placeholder="Dr. Jane Smith" placeholderTextColor={brand.body}
                value={name} onChangeText={setName} autoCapitalize="words"
              />
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>PHONE NUMBER *</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 14, fontSize: 15, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
                placeholder="+27 21 000 0000" placeholderTextColor={brand.body}
                keyboardType="phone-pad" value={phone} onChangeText={setPhone}
              />
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>RELATIONSHIP / ROLE</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 14, fontSize: 15, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
                placeholder="Paediatrician, Class teacher…" placeholderTextColor={brand.body}
                value={relationship} onChangeText={setRelationship} autoCapitalize="sentences"
              />
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 10 }}>CONTACT TYPE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CONTACT_TYPES.map(type => (
                  <Pressable
                    key={type}
                    onPress={() => setContactType(type)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5,
                      borderColor: contactType === type ? TYPE_COLOR[type] : brand.separator,
                      backgroundColor: contactType === type ? `${TYPE_COLOR[type]}14` : brand.card,
                    }}
                  >
                    <Ionicons name={TYPE_ICON[type]} size={14} color={contactType === type ? TYPE_COLOR[type] : brand.body} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: contactType === type ? TYPE_COLOR[type] : brand.body }}>
                      {type}
                    </Text>
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
