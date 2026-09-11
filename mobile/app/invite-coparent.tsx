import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, Pressable, TextInput, ScrollView, Share,
  StatusBar, Platform, KeyboardAvoidingView, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { brand, colors } from '@/theme/colors';
import { pressFade, pressScale } from '@/lib/press';
import { inviteMessage, rememberInvitedCoParent } from '@/lib/coparent-invite';

/**
 * The step between the tour and plan selection.
 *
 * This is the highest-leverage screen in the funnel. A household with one
 * parent in it has no calendar to share, no expense to approve and nobody to
 * message, so a solo user churns no matter how good the rest of the app is.
 * Asking here, while intent is highest, is what makes the second account
 * happen.
 *
 * Deliberately framed as a setup task rather than a referral: the parent is
 * connecting their own household, not recommending a product.
 */

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'calendar-outline', text: 'Custody days and handovers update for both of you' },
  { icon: 'receipt-outline', text: 'Expenses get approved instead of argued about' },
  { icon: 'chatbubbles-outline', text: 'Messages are timestamped and on the record' },
];

export default function InviteCoParentScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const firstName = name.trim().split(/\s+/)[0] ?? '';

  const goToPlans = useCallback(() => router.replace('/pricing'), []);

  const sendInvite = useCallback(async () => {
    if (sending) return;
    setSending(true);
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Remember them either way. Family picks this up so linking later is a
    // confirmation rather than a form.
    await rememberInvitedCoParent(name, email);

    try {
      await Share.share({ message: inviteMessage(firstName) });
    } catch {
      // The user dismissed the sheet, or it failed to open. Either way there's
      // nothing useful to say, and they still move forward.
    }
    setSending(false);
    goToPlans();
  }, [sending, name, email, firstName, goToPlans]);

  const cta = firstName ? `Invite ${firstName}` : 'Send the invite';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 28,
            paddingHorizontal: 24,
            paddingBottom: 24,
            gap: 24,
          }}
        >
          <View style={{ alignItems: 'center', gap: 18 }}>
            <View
              style={{
                width: 96, height: 96, borderRadius: 28, borderCurve: 'continuous',
                backgroundColor: brand.blue + '18',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="people-outline" size={46} color={brand.blue} />
            </View>

            <Text
              style={{
                fontSize: 30, fontWeight: '800', color: colors.label,
                textAlign: 'center', letterSpacing: -0.6, lineHeight: 36,
              }}
            >
              Add your{'\n'}co-parent
            </Text>

            <Text
              style={{
                fontSize: 16, color: colors.secondaryLabel,
                textAlign: 'center', lineHeight: 23, maxWidth: 320,
              }}
            >
              SupportCard works once you're both in it. This takes about ten
              seconds and you only do it once.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.surface, borderRadius: 18,
              borderCurve: 'continuous', borderWidth: 0.5,
              borderColor: colors.separator, padding: 18, gap: 14,
            }}
          >
            {BENEFITS.map(b => (
              <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name={b.icon} size={20} color={brand.blue} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.label, lineHeight: 20 }}>
                  {b.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryLabel, letterSpacing: 0.4 }}>
                THEIR NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Sarah"
                placeholderTextColor={colors.secondaryLabel}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                style={{
                  backgroundColor: colors.surface, borderRadius: 14,
                  borderCurve: 'continuous', borderWidth: 0.5,
                  borderColor: colors.separator, paddingHorizontal: 16,
                  paddingVertical: 14, fontSize: 16, color: colors.label,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryLabel, letterSpacing: 0.4 }}>
                THEIR EMAIL (OPTIONAL)
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="so we can link your accounts later"
                placeholderTextColor={colors.secondaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="done"
                onSubmitEditing={sendInvite}
                style={{
                  backgroundColor: colors.surface, borderRadius: 14,
                  borderCurve: 'continuous', borderWidth: 0.5,
                  borderColor: colors.separator, paddingHorizontal: 16,
                  paddingVertical: 14, fontSize: 16, color: colors.label,
                }}
              />
            </View>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16, paddingTop: 12, gap: 6 }}>
          <Pressable
            onPress={sendInvite}
            disabled={sending}
            style={pressScale({
              height: 54, borderRadius: 16, borderCurve: 'continuous',
              backgroundColor: brand.blue,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: sending ? 0.6 : 1,
              boxShadow: '0 4px 16px rgba(43,116,214,0.28)',
            })}
          >
            <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{cta}</Text>
          </Pressable>

          <Pressable
            onPress={goToPlans}
            disabled={sending}
            hitSlop={8}
            style={pressFade({ alignItems: 'center', paddingVertical: 14 })}
          >
            <Text style={{ color: colors.secondaryLabel, fontSize: 15, fontWeight: '600' }}>
              I'll do this later
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
