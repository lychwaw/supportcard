import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { CURRENCY_OPTIONS } from '@/lib/currency';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserInfo {
  email: string;
  displayName: string;
  initials: string;
  plan: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(email: string): string {
  if (!email) return '?';
  return email.charAt(0).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: brand.card,
        borderRadius: 20,
        boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {children}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '700',
        color: brand.body,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

interface RowProps {
  label: string;
  value?: string;
  showChevron?: boolean;
  destructive?: boolean;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}

function SettingsRow({
  label,
  value,
  showChevron = false,
  destructive = false,
  rightElement,
  onPress,
  isLast = false,
}: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed && onPress ? brand.lightBg : brand.card,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: brand.separator,
        minHeight: 52,
        gap: 8,
      })}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: '400',
          color: destructive ? brand.error : brand.dark,
        }}
      >
        {label}
      </Text>

      {rightElement ?? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value ? (
            <Text style={{ fontSize: 15, color: brand.body }}>{value}</Text>
          ) : null}
          {showChevron && (
            <Text style={{ fontSize: 16, color: brand.body, opacity: 0.5 }}>›</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

// ─── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  currentName,
  onClose,
  onSaved,
}: {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: brand.lightBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: brand.card, borderBottomWidth: 1, borderBottomColor: brand.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Display Name</Text>
            <TextInput
              style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 16, color: brand.dark, borderCurve: 'continuous' }}
              placeholder="Your name"
              placeholderTextColor={brand.body}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoFocus
            />
          </View>
          <Text style={{ fontSize: 13, color: brand.body, lineHeight: 18 }}>
            This name is visible to your co-parent and any professionals linked to your account.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const [userInfo, setUserInfo] = useState<UserInfo>({
    email: '',
    displayName: 'Your Account',
    initials: '?',
    plan: 'Preview',
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (user) {
          const email = user.email ?? '';
          const displayName =
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            'Your Account';

          // Read subscription tier from profiles table — not user_metadata
          const { data: profile } = await supabase
            .from('profiles' as any)
            .select('subscription_tier, subscription_status')
            .eq('id', user.id)
            .maybeSingle();

          const raw = (profile as any)?.subscription_tier ?? 'preview';
          const tierMap: Record<string, string> = {
            preview: 'Preview', essential: 'Essential',
            plus: 'Plus', premium: 'Premium',
            family_plus: 'Plus', free: 'Preview', legal: 'Premium',
          };
          const plan = tierMap[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);

          setUserInfo({
            email,
            displayName,
            initials: getInitials(email || displayName),
            plan,
          });
        }
      } catch (_) {
        // silently ignore — show defaults
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  function handleChangePassword() {
    Alert.prompt(
      'Change Password',
      'Enter your new password:',
      async (newPassword) => {
        if (!newPassword || newPassword.length < 6) {
          Alert.alert('Error', 'Password must be at least 6 characters.');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          Alert.alert('Error', error.message);
        } else {
          Alert.alert('Success', 'Your password has been updated.');
        }
      },
      'secure-text'
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Request Sent', 'Your account deletion request has been received. Our team will process it within 30 days.');
          },
        },
      ]
    );
  }

  const planColor = userInfo.plan === 'Plus' ? brand.teal : brand.blue;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.lightBg }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          paddingTop: 16,
          gap: 0,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <SectionCard>
          <View style={{ padding: 24, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {/* Avatar */}
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: brand.blue,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ fontSize: 26, fontWeight: '700', color: '#FFFFFF' }}
                >
                  {userInfo.initials}
                </Text>
              </View>

              {/* Name + email */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: brand.dark,
                  }}
                >
                  {loading ? '...' : userInfo.displayName}
                </Text>
                {userInfo.email ? (
                  <Text
                    selectable
                    style={{ fontSize: 14, color: brand.body, marginTop: 2 }}
                  >
                    {userInfo.email}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Edit Profile button */}
            <Pressable
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                borderWidth: 1.5,
                borderColor: brand.blue,
                borderRadius: 10,
                paddingHorizontal: 18,
                paddingVertical: 8,
                opacity: pressed ? 0.7 : 1,
              })}
              onPress={() => setShowEditProfile(true)}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: brand.blue }}>
                Edit Profile
              </Text>
            </Pressable>
          </View>
        </SectionCard>

        <View style={{ height: 20 }} />

        {/* Account section */}
        <SectionLabel title="Account" />
        <SectionCard>
          <SettingsRow
            label="Notifications"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: brand.separator, true: brand.blue }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingsRow
            label="Currency"
            rightElement={
              <View style={{ flexDirection: 'row', backgroundColor: brand.lightBg, borderRadius: 10, padding: 3, gap: 3 }}>
                {CURRENCY_OPTIONS.map(opt => {
                  const active = currency === opt.value;
                  return (
                    <Pressable key={opt.value} onPress={() => setCurrency(opt.value)}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                        backgroundColor: active ? brand.blue : 'transparent' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : brand.body }}>
                        {opt.flag} {opt.value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            }
          />
          <SettingsRow
            label="Language"
            value="English"
            showChevron
            onPress={() => Alert.alert('Language', 'Language selection coming soon.')}
          />
          <SettingsRow
            label="Change Password"
            showChevron
            onPress={handleChangePassword}
            isLast
          />
        </SectionCard>

        <View style={{ height: 20 }} />

        {/* Subscription section */}
        <SectionLabel title="Subscription" />
        <SectionCard>
          <SettingsRow
            label="Current Plan"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    backgroundColor: planColor + '1A',
                    borderRadius: 100,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: planColor }}>
                    {userInfo.plan}
                  </Text>
                </View>
              </View>
            }
          />
          <SettingsRow
            label="Upgrade Plan"
            showChevron
            onPress={() => router.push('/pricing' as any)}
          />
          <SettingsRow
            label="Billing History"
            showChevron
            onPress={() =>
              Alert.alert(
                'Billing History',
                userInfo.plan === 'Preview'
                  ? 'You are on the free Preview plan. Upgrade to see billing history.'
                  : `You are on the ${userInfo.plan} plan. Full billing history is available at supportcard.vercel.app — your invoices are managed by Dodo Payments.`,
                [{ text: 'OK' }]
              )
            }
            isLast
          />
        </SectionCard>

        <View style={{ height: 20 }} />

        {/* Privacy & Security section */}
        <SectionLabel title="Privacy & Security" />
        <SectionCard>
          <SettingsRow
            label="Privacy Policy"
            showChevron
            onPress={() => Alert.alert('Privacy Policy', 'Opening privacy policy…')}
          />
          <SettingsRow
            label="Terms of Service"
            showChevron
            onPress={() => Alert.alert('Terms of Service', 'Opening terms of service…')}
          />
          <SettingsRow
            label="Delete Account"
            destructive
            onPress={handleDeleteAccount}
            isLast
          />
        </SectionCard>

        <View style={{ height: 20 }} />

        {/* Support section */}
        <SectionLabel title="Support" />
        <SectionCard>
          <SettingsRow
            label="Help Center"
            showChevron
            onPress={() => Alert.alert('Help Center', 'Opening help center…')}
          />
          <SettingsRow
            label="Contact Support"
            showChevron
            onPress={() => Alert.alert('Contact Support', 'Opening support chat…')}
          />
          <SettingsRow
            label="App Version"
            rightElement={
              <Text style={{ fontSize: 15, color: brand.body }}>1.0.0</Text>
            }
            isLast
          />
        </SectionCard>
      </ScrollView>

      <EditProfileModal
        visible={showEditProfile}
        currentName={userInfo.displayName === 'Your Account' ? '' : userInfo.displayName}
        onClose={() => setShowEditProfile(false)}
        onSaved={(name) => {
          setUserInfo(prev => ({
            ...prev,
            displayName: name,
            initials: name.charAt(0).toUpperCase(),
          }));
          setShowEditProfile(false);
        }}
      />
    </>
  );
}
