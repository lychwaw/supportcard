import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
  Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

export default function IdVerificationScreen() {
  const insets = useSafeAreaInsets();
  const [idNumber, setIdNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles' as any).select('id_verified').eq('id', user.id).maybeSingle();
      setAlreadyVerified((data as any)?.id_verified ?? false);
    })();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = idNumber.trim();
    if (trimmed.length !== 13 || !/^\d{13}$/.test(trimmed)) {
      Alert.alert('Invalid ID', 'Please enter your 13-digit SA ID number.');
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please confirm your consent to verify your identity.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';
      const resp = await fetch(`${apiBase}/api/korapay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: 'verify-id',
          id_number: trimmed,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          verification_consent: true,
        }),
      });

      const body = await resp.json();

      if (!resp.ok) {
        if (resp.status === 409) {
          setAlreadyVerified(true);
          return;
        }
        throw new Error(body?.error ?? `Verification failed (${resp.status})`);
      }

      if (body.verified) {
        setAlreadyVerified(true);
      } else {
        Alert.alert(
          'Verification failed',
          'We could not verify your identity with the provided details. Please check your ID number and try again.',
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [idNumber, firstName, lastName, consent]);

  if (alreadyVerified === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Verify Identity', headerBackVisible: false, gestureEnabled: false }} />
        <ActivityIndicator color={brand.blue} />
      </View>
    );
  }

  if (alreadyVerified) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <Stack.Screen options={{ title: 'Verify Identity', headerBackVisible: false, gestureEnabled: false }} />
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark" size={36} color={brand.teal} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.label, textAlign: 'center' }}>Identity Verified</Text>
        <Text style={{ fontSize: 15, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 22 }}>
          Your SA ID has been verified. This badge stays on your account permanently.
        </Text>
        <Pressable onPress={() => router.back()}
          style={({ pressed }) => ({ marginTop: 8, backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', paddingVertical: 15, paddingHorizontal: 32, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Verify Identity', headerBackVisible: false, gestureEnabled: false, headerRight: () => (
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ fontSize: 16, color: brand.blue }}>Not Now</Text>
        </Pressable>
      ) }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 20 }} keyboardShouldPersistTaps="handled">

        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 16, gap: 6, borderWidth: 0.5, borderColor: colors.separator }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.label }}>Why verify?</Text>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            Verified accounts display a trust badge to your co-parent and professional contacts. Your ID number is checked against the Home Affairs registry and never stored.
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>SA ID Number</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 18, color: colors.label, fontVariant: ['tabular-nums'], letterSpacing: 1.5 }}
              placeholder="0000000000000"
              placeholderTextColor={colors.secondaryLabel}
              value={idNumber}
              onChangeText={t => setIdNumber(t.replace(/\D/g, '').slice(0, 13))}
              keyboardType="number-pad"
              maxLength={13}
              autoFocus
            />
            {idNumber.length > 0 && idNumber.length < 13 && (
              <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{13 - idNumber.length} digits remaining</Text>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>First Name (optional — improves accuracy)</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 16, color: colors.label }}
              placeholder="As it appears on your ID"
              placeholderTextColor={colors.secondaryLabel}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Last Name (optional)</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 16, fontSize: 16, color: colors.label }}
              placeholder="As it appears on your ID"
              placeholderTextColor={colors.secondaryLabel}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <Pressable onPress={() => setConsent(c => !c)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: consent ? brand.teal + '60' : colors.separator, padding: 16 }}>
          <Switch
            value={consent}
            onValueChange={setConsent}
            trackColor={{ false: colors.separator, true: brand.teal }}
            thumbColor="#fff"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <Text style={{ flex: 1, fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            I consent to SupportCard verifying my SA ID number against the Department of Home Affairs registry via KoraPay. My ID number will not be stored.
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || idNumber.length !== 13 || !consent}
          style={({ pressed }) => ({
            backgroundColor: brand.blue,
            borderRadius: 16,
            borderCurve: 'continuous',
            padding: 17,
            alignItems: 'center',
            opacity: (submitting || idNumber.length !== 13 || !consent) ? 0.45 : pressed ? 0.8 : 1,
          })}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Verify Identity</Text>
          }
        </Pressable>

        <Text style={{ fontSize: 12, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 17 }}>
          Verification is handled by KoraPay and checked against Home Affairs. South Sphere Tech (Pty) Ltd does not store your ID number.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
