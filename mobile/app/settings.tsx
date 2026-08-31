import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Switch, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { CURRENCY_OPTIONS } from '@/lib/currency';

interface UserInfo {
  email: string;
  displayName: string;
  initials: string;
  plan: string;
  idVerified: boolean;
}

const TIER_COLORS: Record<string, string> = {
  Preview: brand.body, Essential: brand.blue, Plus: brand.teal, Premium: '#F59E0B',
};

function SettingsGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 8 }}>
      {label && (
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 8, paddingHorizontal: 4 }}>
          {label}
        </Text>
      )}
      <View style={{ backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous', boxShadow: '0 1px 6px rgba(0, 0, 0, 0.05)' }}>
        {children}
      </View>
    </View>
  );
}

interface RowProps {
  label: string;
  subtitle?: string;
  value?: string;
  icon?: string;
  iconColor?: string;
  showChevron?: boolean;
  destructive?: boolean;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}

function SettingsRow({ label, subtitle, value, icon, iconColor, showChevron = false, destructive = false, rightElement, onPress, isLast = false }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 13,
        backgroundColor: pressed && onPress ? (destructive ? brand.error + '08' : brand.blue + '06') : 'transparent',
        borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: colors.separator,
        minHeight: 52, gap: 12,
      })}
    >
      {icon && (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (iconColor ?? brand.blue) + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', flexShrink: 0 }}>
          <Ionicons name={icon as any} size={18} color={iconColor ?? brand.blue} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: destructive ? brand.error : colors.label }}>{label}</Text>
        {subtitle && <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {rightElement ?? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value ? <Text style={{ fontSize: 14, color: colors.secondaryLabel }}>{value}</Text> : null}
          {showChevron && <Ionicons name="chevron-forward" size={15} color={colors.secondaryLabel} style={{ opacity: 0.4 }} />}
        </View>
      )}
    </Pressable>
  );
}

function ReferralCodeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<'ok' | 'error' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { if (!visible) { setCode(''); setResult(null); setMessage(''); } }, [visible]);

  const handleSubmit = useCallback(async () => {
    if (!code.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setResult('error'); setMessage('Sign in required.'); return; }
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';
      const res = await fetch(`${apiBase}/api/referral-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult('ok');
        setMessage('Code applied — thank you!');
      } else {
        setResult('error');
        setMessage(data.error ?? 'Could not apply code.');
      }
    } catch {
      setResult('error');
      setMessage('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [code]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Referral Code</Text>
          <Pressable onPress={handleSubmit} disabled={saving || !code.trim() || result === 'ok'}>
            <Text style={{ color: saving || !code.trim() || result === 'ok' ? colors.secondaryLabel : brand.blue, fontSize: 16, fontWeight: '600' }}>
              {saving ? 'Applying…' : 'Apply'}
            </Text>
          </Pressable>
        </View>
        <View style={{ padding: 20, gap: 16 }}>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            Enter a referral code from a partner or friend. Codes can be entered within 7 days of creating your account.
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface, borderRadius: 14, borderWidth: 0.5,
              borderColor: result === 'ok' ? '#22C55E' : result === 'error' ? brand.error : colors.separator,
              padding: 16, fontSize: 18, color: colors.label, borderCurve: 'continuous',
              letterSpacing: 3, fontWeight: '600', textAlign: 'center',
            }}
            placeholder="LIESEL42"
            placeholderTextColor={colors.secondaryLabel}
            value={code}
            onChangeText={v => { setCode(v.toUpperCase().replace(/\s/g, '')); setResult(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            autoFocus
            editable={result !== 'ok'}
          />
          {message ? (
            <Text style={{ fontSize: 13, color: result === 'ok' ? '#22C55E' : brand.error, textAlign: 'center', fontWeight: '600' }}>
              {message}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!visible) setNewPassword(''); }, [visible]);

  const handleSave = useCallback(async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Password updated', 'Your password has been changed successfully.');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update password.');
    } finally {
      setSaving(false);
    }
  }, [newPassword, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Change Password</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={{ color: saving ? colors.secondaryLabel : brand.blue, fontSize: 16, fontWeight: '600' }}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>New Password</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 16, color: colors.label, borderCurve: 'continuous' }}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.secondaryLabel}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoFocus
            />
          </View>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            You will be signed out of other devices after changing your password.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditProfileModal({ visible, currentName, onClose, onSaved }: { visible: boolean; currentName: string; onClose: () => void; onSaved: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setName(currentName); }, [visible, currentName]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required', 'Please enter a display name.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
      if (error) throw error;
      onSaved(trimmed);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }, [name, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={{ color: saving ? colors.secondaryLabel : brand.blue, fontSize: 16, fontWeight: '600' }}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Display Name</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 16, color: colors.label, borderCurve: 'continuous' }}
              placeholder="Your name"
              placeholderTextColor={colors.secondaryLabel}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoFocus
            />
          </View>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            Visible to your co-parent and any professionals linked to your account.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [userInfo, setUserInfo] = useState<UserInfo>({ email: '', displayName: 'Your Account', initials: '?', plan: 'Preview', idVerified: false });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [wiping, setWiping] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showReferralCode, setShowReferralCode] = useState(false);
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (user) {
          const email = user.email ?? '';
          const displayName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || 'Your Account';
          const { data: profile } = await supabase.from('profiles' as any).select('subscription_tier, id_verified').eq('id', user.id).maybeSingle();
          const raw = (profile as any)?.subscription_tier ?? 'preview';
          const tierMap: Record<string, string> = { preview: 'Preview', essential: 'Essential', plus: 'Plus', premium: 'Premium', family_plus: 'Plus', free: 'Preview', legal: 'Premium' };
          const plan = tierMap[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
          setUserInfo({ email, displayName, initials: (displayName !== 'Your Account' ? displayName : email).charAt(0).toUpperCase(), plan, idVerified: (profile as any)?.id_verified ?? false });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleChangePassword() {
    setShowChangePassword(true);
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/' as any);
        },
      },
    ]);
  }

  async function doWipe() {
    setShowWipeConfirm(false);
    setWiping(true);
    try {
      const { error } = await supabase.rpc('wipe_my_history' as any);
      if (error) Alert.alert('Error', error.message);
      else Alert.alert('Done', 'Your family history has been wiped.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    } finally {
      setWiping(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Final confirmation',
              'Your account, all co-parent links, expense records, calendar events, and documents will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) throw new Error('Not signed in');
                      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';
                      const resp = await fetch(`${apiBase}/api/delete-account`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      if (!resp.ok) {
                        const body = await resp.json().catch(() => ({}));
                        throw new Error((body as any).error ?? `Server error ${resp.status}`);
                      }
                      await supabase.auth.signOut();
                    } catch (e: any) {
                      Alert.alert('Error', e?.message ?? 'Could not delete account. Email info@southsphere.global for help.');
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  }

  const tierColor = TIER_COLORS[userInfo.plan] ?? brand.blue;

  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerTintColor: brand.blue, headerStyle: { backgroundColor: colors.surface as any } }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile hero ── */}
        <View style={{ borderRadius: 24, borderCurve: 'continuous', padding: 24, marginBottom: 8, backgroundColor: '#1C3252' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.23)' }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>
                {loading ? '…' : userInfo.initials}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }}>
                {loading ? 'Loading…' : userInfo.displayName}
              </Text>
              {userInfo.email ? <Text selectable style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{userInfo.email}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tierColor === brand.body ? 'rgba(255,255,255,0.5)' : tierColor }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>{userInfo.plan}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={() => setShowEditProfile(true)}
            style={({ pressed }) => ({ marginTop: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }], borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' })}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Edit Profile</Text>
          </Pressable>
        </View>

        <SettingsGroup label="Account">
          <SettingsRow label="Notifications" subtitle="Push alerts for events & messages"
            icon="bell-outline" iconColor={brand.blue}
            rightElement={<Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: colors.separator, true: brand.blue }} thumbColor="#fff" />}
          />
          <SettingsRow label="Currency" icon="cash-outline" iconColor="#22C55E" rightElement={
            <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 3, gap: 3 }}>
              {CURRENCY_OPTIONS.map(opt => {
                const active = currency === opt.value;
                return (
                  <Pressable key={opt.value} onPress={() => setCurrency(opt.value)}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: active ? brand.blue : 'transparent' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.secondaryLabel }}>{opt.value}</Text>
                  </Pressable>
                );
              })}
            </View>
          } />
          <SettingsRow label="Change Password" icon="lock-closed-outline" iconColor="#F59E0B" showChevron onPress={handleChangePassword} isLast />
        </SettingsGroup>

        <SettingsGroup label="Subscription">
          <SettingsRow label="Current Plan" icon="star-outline" iconColor="#F59E0B" value={userInfo.plan} />
          <SettingsRow label="Upgrade Plan" icon="arrow-up-circle-outline" iconColor={brand.teal} showChevron onPress={() => router.push('/pricing' as any)} />
          <SettingsRow label="Manage Subscription" icon="settings-outline" iconColor={brand.blue} showChevron
            onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
          />
          <SettingsRow label="Billing History" icon="receipt-outline" iconColor={brand.body} showChevron
            onPress={() => Alert.alert('Billing History', userInfo.plan === 'Preview' ? 'You are on the free Preview plan. Upgrade to see billing history.' : `You are on the ${userInfo.plan} plan. Subscription receipts are available in the App Store under your Apple ID.`)}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup label="Privacy & Security">
          <SettingsRow label="Privacy Policy" icon="shield-outline" iconColor={brand.body} showChevron onPress={() => Linking.openURL('https://supportcard-prod.vercel.app/privacy')} />
          <SettingsRow label="Terms of Service" icon="document-text-outline" iconColor={brand.body} showChevron onPress={() => Linking.openURL('https://supportcard-prod.vercel.app/terms')} />
          <SettingsRow label="Delete Account" icon="trash-outline" iconColor={brand.error} destructive onPress={handleDeleteAccount} isLast />
        </SettingsGroup>

        <SettingsGroup label="Support">
          <SettingsRow label="Enter Referral Code" icon="gift-outline" iconColor={brand.teal} showChevron onPress={() => setShowReferralCode(true)} />
          <SettingsRow label="Help Center" icon="help-circle-outline" iconColor={brand.blue} showChevron onPress={() => Linking.openURL('mailto:info@southsphere.global?subject=SupportCard%20Help')} />
          <SettingsRow label="Contact Support" icon="mail-outline" iconColor={brand.teal} showChevron onPress={() => Linking.openURL('mailto:info@southsphere.global')} />
          <SettingsRow label="App Version" icon="information-circle-outline" iconColor={brand.body} value="1.0.0" isLast />
        </SettingsGroup>

        <SettingsGroup label="Danger Zone">
          <SettingsRow
            label={wiping ? 'Wiping…' : 'Wipe family history'}
            subtitle="Removes all expenses, check-ins & events"
            icon="flame-outline"
            iconColor={brand.error}
            destructive={!wiping}
            rightElement={wiping ? <ActivityIndicator size="small" color={brand.error} /> : <Ionicons name="chevron-forward" size={15} color={brand.error} style={{ opacity: 0.5 }} />}
            onPress={wiping ? undefined : () => setShowWipeConfirm(true)}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow label="Sign Out" icon="log-out-outline" iconColor={brand.error} destructive onPress={handleSignOut} isLast />
        </SettingsGroup>
      </ScrollView>

      {/* Wipe confirm modal */}
      <Modal visible={showWipeConfirm} transparent animationType="fade" onRequestClose={() => setShowWipeConfirm(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 }} onPress={() => setShowWipeConfirm(false)}>
          <Pressable onPress={e => e.stopPropagation?.()} style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, gap: 16, borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: brand.error + '18', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="warning-outline" size={26} color={brand.error} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label, textAlign: 'center' }}>Wipe family history?</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, lineHeight: 21, textAlign: 'center' }}>
              Permanently deletes all expenses, custody check-ins, zones, and calendar events.{'\n\n'}Children and co-parent links are kept. Cannot be undone.
            </Text>
            <Pressable onPress={doWipe} style={({ pressed }) => ({ backgroundColor: brand.error, borderRadius: 14, paddingVertical: 15, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Wipe History</Text>
            </Pressable>
            <Pressable onPress={() => setShowWipeConfirm(false)} style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 10, opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: colors.secondaryLabel, fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <EditProfileModal
        visible={showEditProfile}
        currentName={userInfo.displayName === 'Your Account' ? '' : userInfo.displayName}
        onClose={() => setShowEditProfile(false)}
        onSaved={(name) => {
          setUserInfo(prev => ({ ...prev, displayName: name, initials: name.charAt(0).toUpperCase() }));
          setShowEditProfile(false);
        }}
      />
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
      <ReferralCodeModal
        visible={showReferralCode}
        onClose={() => setShowReferralCode(false)}
      />
    </>
  );
}
