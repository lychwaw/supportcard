import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, Pressable, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Share,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors } from '@/theme/colors';
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
  const insets = useSafeAreaInsets();
  const [children, setChildren] = useState<Child[]>([]);
  const [coParent, setCoParent] = useState<CoParent | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [custodySplit, setCustodySplit] = useState('50');
  const [addingChild, setAddingChild] = useState(false);

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
    const { error } = await supabase.from('children' as any).insert({ name, parent_id: userId, custody_split_pct: split });
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
          { text: 'Share App Link', onPress: () => Share.share({ message: 'Join me on SupportCard — co-parenting made easier. Sign up at https://supportcard-prod.vercel.app' }) },
          { text: 'OK' },
        ]
      );
      return;
    }

    const cp = match as any;
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

    const { error } = await supabase.from('children' as any).update({ co_parent_id: cp.id }).eq('id', childToLink.id);
    setLinking(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowInvite(false);
    setInviteEmail('');
    Alert.alert('Co-parent linked!', `${cp.full_name || cp.email} is now linked. They can now see shared events and messages.`);
    load();
  };

  const handleDeleteChild = (id: string, name: string) => {
    Alert.alert(`Remove ${name}?`, 'This will remove this child and all related records. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('children' as any).delete().eq('id', id);
          if (error) { Alert.alert('Could not remove', error.message); return; }
          load();
        },
      },
    ]);
  };

  const coInitial = ((coParent?.full_name || coParent?.email || '?')[0] || '?').toUpperCase();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Family', headerTintColor: brand.blue }} />

      {loading ? (
        <ActivityIndicator color={brand.blue} style={{ marginTop: 60 }} />
      ) : (
        <>
          {/* ── Co-Parent Section ── */}
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Co-Parent
            </Text>

            {coParent ? (
              <LinearGradient
                colors={['#1E3A5F', '#2B74D6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ borderRadius: 20, borderCurve: 'continuous', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }}
              >
                <View style={{ position: 'absolute', right: -30, top: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.07)' }} />
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{coInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>{coParent.full_name || 'Co-Parent'}</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{coParent.email}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
                  <Text style={{ fontSize: 12, color: '#4ADE80', fontWeight: '700' }}>Linked</Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 24, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
                <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderCurve: 'continuous' }}>
                  <Ionicons name="people-outline" size={28} color={brand.blue} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label, marginBottom: 6 }}>No co-parent linked</Text>
                <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
                  Link your co-parent to start coordinating. They must have a SupportCard account first.
                </Text>
                <Pressable
                  onPress={() => setShowInvite(true)}
                  style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13, transform: [{ scale: pressed ? 0.96 : 1 }], borderCurve: 'continuous' })}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Link Co-Parent</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Children Section ── */}
          <View style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Children ({children.length})
              </Text>
              <Pressable
                onPress={() => setShowAddChild(true)}
                style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
            </View>

            {children.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 28, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
                <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: brand.teal + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderCurve: 'continuous' }}>
                  <Ionicons name="person-outline" size={28} color={brand.teal} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label, marginBottom: 14 }}>No children added yet</Text>
                <Pressable
                  onPress={() => setShowAddChild(true)}
                  style={({ pressed }) => ({ backgroundColor: brand.teal, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13, transform: [{ scale: pressed ? 0.96 : 1 }], borderCurve: 'continuous' })}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add a Child</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {children.map(child => {
                  const myPct = child.custody_split_pct;
                  const theirPct = 100 - myPct;
                  return (
                    <View key={child.id} style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 18, borderWidth: 0.5, borderColor: colors.separator }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: brand.blue + '15', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                          <Ionicons name="person-outline" size={22} color={brand.blue} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>{child.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 2 }}>
                            {coParent ? `With ${coParent.full_name?.split(' ')[0] ?? 'Co-parent'}` : 'No co-parent linked'}
                          </Text>
                        </View>
                        {userId === child.parent_id && (
                          <Pressable
                            onPress={() => handleDeleteChild(child.id, child.name)}
                            hitSlop={10}
                            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 6, borderRadius: 10, backgroundColor: colors.background })}
                          >
                            <Ionicons name="trash-outline" size={17} color={colors.secondaryLabel} />
                          </Pressable>
                        )}
                      </View>

                      {/* Custody split bar */}
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                        Custody Split
                      </Text>
                      <View style={{ height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${myPct}%`, backgroundColor: brand.blue, borderRadius: 4 }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brand.blue }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: brand.blue }}>You {myPct}%</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondaryLabel + '60' }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryLabel }}>
                            {coParent?.full_name?.split(' ')[0] ?? 'Co-parent'} {theirPct}%
                          </Text>
                        </View>
                      </View>

                      {!child.co_parent_id && (
                        <Pressable
                          onPress={() => setShowInvite(true)}
                          style={({ pressed }) => ({
                            marginTop: 14, alignSelf: 'flex-start', backgroundColor: brand.blue + '10',
                            borderRadius: 10, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 8,
                            borderWidth: 1, borderColor: brand.blue + '30',
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                          })}
                        >
                          <Text style={{ fontSize: 13, color: brand.blue, fontWeight: '700' }}>+ Link co-parent</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {/* ── Add Child Modal ── */}
      <Modal visible={showAddChild} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddChild(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => { setShowAddChild(false); setChildName(''); setCustodySplit('50'); }}>
              <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Add Child</Text>
            <Pressable onPress={handleAddChild} disabled={addingChild || !childName.trim()}>
              {addingChild ? <ActivityIndicator color={brand.blue} /> : (
                <Text style={{ color: !childName.trim() ? colors.secondaryLabel : brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.8 }}>Child's Name</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 16, fontSize: 16, color: colors.label, borderWidth: 0.5, borderColor: colors.separator }}
                placeholder="e.g. Amara"
                placeholderTextColor={colors.secondaryLabel}
                value={childName}
                onChangeText={setChildName}
                autoFocus
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Your Custody % ({custodySplit}%)
              </Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 16, fontSize: 32, fontWeight: '800', color: colors.label, borderWidth: 0.5, borderColor: colors.separator, textAlign: 'center' }}
                keyboardType="number-pad"
                placeholder="50"
                placeholderTextColor={colors.secondaryLabel}
                value={custodySplit}
                onChangeText={v => setCustodySplit(v.replace(/[^0-9]/g, ''))}
                maxLength={3}
              />
              <Text style={{ fontSize: 13, color: colors.secondaryLabel, textAlign: 'center' }}>
                Co-parent gets {100 - (parseInt(custodySplit, 10) || 50)}%.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Link Co-Parent Modal ── */}
      <Modal visible={showInvite} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowInvite(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => { setShowInvite(false); setInviteEmail(''); }}>
              <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Link Co-Parent</Text>
            <Pressable onPress={handleLinkCoParent} disabled={linking || !inviteEmail.trim()}>
              {linking ? <ActivityIndicator color={brand.blue} /> : (
                <Text style={{ color: !inviteEmail.trim() ? colors.secondaryLabel : brand.blue, fontSize: 16, fontWeight: '600' }}>Link</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={{ backgroundColor: brand.blue + '08', borderRadius: 14, borderCurve: 'continuous', padding: 16, borderWidth: 0.5, borderColor: brand.blue + '20' }}>
              <Text style={{ fontSize: 14, color: colors.label, lineHeight: 21 }}>
                Enter the email your co-parent used to sign up for SupportCard. They must already have an account — share the app link below if they haven't registered yet.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.8 }}>Co-Parent's Email</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 16, fontSize: 16, color: colors.label, borderWidth: 0.5, borderColor: colors.separator }}
                placeholder="coparent@email.com"
                placeholderTextColor={colors.secondaryLabel}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoFocus
              />
            </View>
            <Pressable
              onPress={() => Share.share({ message: 'Join me on SupportCard — co-parenting made easier. Sign up at https://supportcard-prod.vercel.app' })}
              style={({ pressed }) => ({
                backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous',
                padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
                borderWidth: 0.5, borderColor: colors.separator,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name="share-social-outline" size={18} color={brand.blue} />
              </View>
              <Text style={{ fontSize: 14, color: brand.blue, fontWeight: '700' }}>Share app link with co-parent</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
