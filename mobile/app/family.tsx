import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, Pressable, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Share,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

type Child = {
  id: string;
  name: string;
  custody_split_pct: number;
  parent_id: string;
  co_parent_id: string | null;
};
type CoParent = { id: string; full_name: string | null; email: string | null };

export default function FamilyScreen() {
  const [children, setChildren] = useState<Child[]>([]);
  const [coParent, setCoParent] = useState<CoParent | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add Child modal
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [custodySplit, setCustodySplit] = useState('50');
  const [addingChild, setAddingChild] = useState(false);

  // Invite Co-Parent modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: kids } = await supabase
      .from('children' as any)
      .select('id, name, custody_split_pct, parent_id, co_parent_id')
      .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);

    const kidList = ((kids as any) || []) as Child[];
    setChildren(kidList);

    // Find co-parent via children table (same lookup as messages.tsx)
    if (kidList.length > 0) {
      const child = kidList[0];
      const coParentId = child.parent_id === user.id ? child.co_parent_id : child.parent_id;
      if (coParentId) {
        const { data: cp } = await supabase
          .from('profiles' as any)
          .select('id, full_name, email')
          .eq('id', coParentId)
          .maybeSingle();
        setCoParent(cp as any);
      } else {
        setCoParent(null);
      }
    }

    setLoading(false);
  };

  const handleAddChild = async () => {
    const name = childName.trim();
    if (!name) return;
    const split = Math.max(0, Math.min(100, parseInt(custodySplit, 10) || 50));
    setAddingChild(true);
    const { error } = await supabase.from('children' as any).insert({
      name,
      parent_id: userId,
      custody_split_pct: split,
    });
    setAddingChild(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowAddChild(false);
    setChildName('');
    setCustodySplit('50');
    load();
  };

  const handleLinkCoParent = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    if (children.length === 0) {
      Alert.alert('Add a child first', 'You need to add at least one child before linking a co-parent.');
      setShowInvite(false);
      return;
    }

    setLinking(true);

    const { data: match } = await supabase
      .from('profiles' as any)
      .select('id, full_name, email')
      .eq('email', email)
      .maybeSingle();

    if (!match) {
      setLinking(false);
      Alert.alert(
        'Not registered yet',
        `No SupportCard account found for ${email}.\n\nAsk them to sign up, then come back and link them here.`,
        [
          {
            text: 'Share App Link',
            onPress: () => Share.share({ message: `Join me on SupportCard — co-parenting made easier. Sign up at https://supportcard.vercel.app` }),
          },
          { text: 'OK' },
        ]
      );
      return;
    }

    const cp = match as any;

    // Link co-parent to the first child that doesn't have one yet
    const childToLink = children.find(c => !c.co_parent_id);
    if (!childToLink) {
      setLinking(false);
      Alert.alert('Already linked', 'All children already have a co-parent linked.');
      return;
    }

    if (cp.id === userId) {
      setLinking(false);
      Alert.alert('Invalid', 'You cannot link yourself as a co-parent.');
      return;
    }

    const { error } = await supabase
      .from('children' as any)
      .update({ co_parent_id: cp.id })
      .eq('id', childToLink.id);

    setLinking(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowInvite(false);
    setInviteEmail('');
    Alert.alert('Co-parent linked!', `${cp.full_name || cp.email} is now linked. They can now see shared events and messages.`);
    load();
  };

  const handleDeleteChild = (id: string, name: string) => {
    Alert.alert(
      `Remove ${name}?`,
      'This will remove this child and all related records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('children' as any).delete().eq('id', id);
            if (error) {
              Alert.alert('Could not remove', error.message);
              return;
            }
            load();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.lightBg }}
      contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}
    >
      <Stack.Screen options={{
        title: 'Family',
        headerTintColor: brand.blue,
        headerStyle: { backgroundColor: brand.card },
      }} />

      {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} /> : (
        <>
          {/* Co-parent section */}
          <View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark, marginBottom: 12 }}>Co-Parent</Text>
            {coParent ? (
              <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
                    {(coParent.full_name || coParent.email || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: brand.dark }}>{coParent.full_name || 'Co-Parent'}</Text>
                  <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>{coParent.email}</Text>
                </View>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                  <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '600' }}>Linked</Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 24, alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="people-outline" size={28} color={brand.body} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>No co-parent linked</Text>
                <Text style={{ fontSize: 13, color: brand.body, marginBottom: 16, textAlign: 'center' }}>
                  Link your co-parent to start coordinating. They must have a SupportCard account first.
                </Text>
                <Pressable
                  onPress={() => setShowInvite(true)}
                  style={{ backgroundColor: brand.blue, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Link Co-Parent</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Children section */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Children ({children.length})</Text>
              <Pressable
                onPress={() => setShowAddChild(true)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
            </View>

            {children.length === 0 ? (
              <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 24, alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="person-outline" size={28} color={brand.body} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark, marginBottom: 12 }}>No children added yet</Text>
                <Pressable
                  onPress={() => setShowAddChild(true)}
                  style={{ backgroundColor: brand.blue, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add a Child</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {children.map(child => (
                  <View key={child.id} style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="person-outline" size={22} color={brand.blue} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: brand.dark }}>{child.name}</Text>
                      {userId === child.parent_id && (
                        <Pressable
                          onPress={() => handleDeleteChild(child.id, child.name)}
                          hitSlop={10}
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
                        >
                          <Ionicons name="trash-outline" size={17} color={brand.body} />
                        </Pressable>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: brand.body, marginBottom: 6 }}>Custody Split</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: brand.blue }}>{child.custody_split_pct}%</Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: brand.lightBg, borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ width: `${child.custody_split_pct}%`, height: '100%', backgroundColor: brand.blue, borderRadius: 3 }} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body }}>{100 - child.custody_split_pct}%</Text>
                    </View>
                    {!child.co_parent_id && (
                      <Pressable
                        onPress={() => setShowInvite(true)}
                        style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: brand.lightBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: brand.blue }}
                      >
                        <Text style={{ fontSize: 12, color: brand.blue, fontWeight: '600' }}>+ Link co-parent</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {/* Add Child Modal */}
      <Modal visible={showAddChild} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: brand.lightBg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: brand.separator, backgroundColor: brand.card }}>
            <Pressable onPress={() => { setShowAddChild(false); setChildName(''); setCustodySplit('50'); }}>
              <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Add Child</Text>
            <Pressable onPress={handleAddChild} disabled={addingChild || !childName.trim()}>
              <Text style={{ color: addingChild || !childName.trim() ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>
                {addingChild ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>CHILD'S NAME</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 16, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
                placeholder="e.g. Amara"
                placeholderTextColor={brand.body}
                value={childName}
                onChangeText={setChildName}
                autoFocus
              />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>
                YOUR CUSTODY PERCENTAGE ({custodySplit}%)
              </Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 24, fontWeight: '700', color: brand.dark, borderWidth: 1.5, borderColor: brand.separator, textAlign: 'center' }}
                keyboardType="number-pad"
                placeholder="50"
                placeholderTextColor={brand.separator}
                value={custodySplit}
                onChangeText={v => setCustodySplit(v.replace(/[^0-9]/g, ''))}
                maxLength={3}
              />
              <Text style={{ fontSize: 12, color: brand.body, marginTop: 6, textAlign: 'center' }}>
                Enter 0–100. Co-parent gets {100 - (parseInt(custodySplit, 10) || 50)}%.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Link Co-Parent Modal */}
      <Modal visible={showInvite} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: brand.lightBg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: brand.separator, backgroundColor: brand.card }}>
            <Pressable onPress={() => { setShowInvite(false); setInviteEmail(''); }}>
              <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Link Co-Parent</Text>
            <Pressable onPress={handleLinkCoParent} disabled={linking || !inviteEmail.trim()}>
              <Text style={{ color: linking || !inviteEmail.trim() ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>
                {linking ? 'Linking...' : 'Link'}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={{ backgroundColor: brand.lightBg, borderRadius: 12, padding: 14 }}>
              <Text style={{ fontSize: 13, color: brand.body, lineHeight: 20 }}>
                Enter the email address your co-parent used to sign up for SupportCard. They must already have an account — if not, share the app link so they can register first.
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>CO-PARENT'S EMAIL</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 16, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
                placeholder="coparent@email.com"
                placeholderTextColor={brand.body}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoFocus
              />
            </View>
            <Pressable
              onPress={() => Share.share({ message: 'Join me on SupportCard — co-parenting made easier. Sign up at https://supportcard.vercel.app' })}
              style={{ backgroundColor: brand.card, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: brand.separator }}
            >
              <Ionicons name="share-social-outline" size={20} color={brand.blue} />
              <Text style={{ fontSize: 14, color: brand.blue, fontWeight: '600' }}>Share app link with co-parent</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
