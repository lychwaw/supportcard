import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TextInput, Pressable, Modal,
  Alert, ActivityIndicator, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const TYPE_EMOJI: Record<ContactType, string> = {
  Doctor: '🏥',
  School: '🎓',
  Family: '👨‍👩‍👧',
  Other: '📞',
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

  // Form state
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
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
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

  // Group contacts by type
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
        }}>
          <Text style={{ fontSize: 14, color: brand.dark, fontWeight: '500', marginBottom: 4 }}>
            🚨 Emergency contacts are shared with your co-parent and only used in genuine emergencies.
          </Text>
          <Text style={{ fontSize: 12, color: brand.body }}>
            Add doctors, schools, and trusted contacts your co-parent may need to reach.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : contacts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📞</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>
              No emergency contacts yet
            </Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
              Add your doctor, school, and trusted contacts
            </Text>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            {orderedTypes.map(type => {
              const group = grouped[type];
              if (!group || group.length === 0) return null;
              return (
                <View key={type}>
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: brand.body,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginBottom: 8,
                  }}>
                    {type}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {group.map(contact => (
                      <Pressable
                        key={contact.id}
                        onLongPress={() => deleteContact(contact)}
                        style={{
                          backgroundColor: brand.card,
                          borderRadius: 16,
                          padding: 16,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
                        }}
                      >
                        {/* Icon circle */}
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: `${TYPE_COLOR[contact.contact_type]}18`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 20 }}>{TYPE_EMOJI[contact.contact_type]}</Text>
                        </View>

                        {/* Name & relationship */}
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

                        {/* Phone + call button */}
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text selectable style={{ fontSize: 14, color: brand.dark, fontWeight: '500' }}>
                            {contact.phone}
                          </Text>
                          <Pressable
                            onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: '#22C55E18',
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Text style={{ fontSize: 12 }}>📞</Text>
                            <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '600' }}>Call</Text>
                          </Pressable>
                        </View>
                      </Pressable>
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
          position: 'absolute',
          bottom: 96,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: brand.blue,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(43,116,214,0.30)',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
      </Pressable>

      {/* Add Contact Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: brand.lightBg }}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            paddingTop: insets.top + 16,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
            backgroundColor: brand.card,
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
            {/* Full Name */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>
                FULL NAME *
              </Text>
              <TextInput
                style={{
                  backgroundColor: brand.card,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: brand.dark,
                  borderWidth: 1.5,
                  borderColor: brand.separator,
                }}
                placeholder="Dr. Jane Smith"
                placeholderTextColor={brand.body}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* Phone Number */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>
                PHONE NUMBER *
              </Text>
              <TextInput
                style={{
                  backgroundColor: brand.card,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: brand.dark,
                  borderWidth: 1.5,
                  borderColor: brand.separator,
                }}
                placeholder="+27 21 000 0000"
                placeholderTextColor={brand.body}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {/* Relationship */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>
                RELATIONSHIP / ROLE
              </Text>
              <TextInput
                style={{
                  backgroundColor: brand.card,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: brand.dark,
                  borderWidth: 1.5,
                  borderColor: brand.separator,
                }}
                placeholder="Paediatrician, Class teacher…"
                placeholderTextColor={brand.body}
                value={relationship}
                onChangeText={setRelationship}
                autoCapitalize="sentences"
              />
            </View>

            {/* Contact Type */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 10 }}>
                CONTACT TYPE
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CONTACT_TYPES.map(type => (
                  <Pressable
                    key={type}
                    onPress={() => setContactType(type)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: contactType === type ? TYPE_COLOR[type] : brand.separator,
                      backgroundColor: contactType === type ? `${TYPE_COLOR[type]}14` : brand.card,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{TYPE_EMOJI[type]}</Text>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: contactType === type ? TYPE_COLOR[type] : brand.body,
                    }}>
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
