import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

/**
 * Password reset, done with a six-digit code rather than a magic link.
 *
 * A link would have to open a browser, hand off to Supabase, then deep link
 * back into the app — three places it can break, and it strands the user in
 * Safari when it does. A code the user reads out of the email and types here
 * keeps the whole flow inside the app.
 *
 * This requires the Supabase "Reset Password" email template to include
 * {{ .Token }}. The default template only contains {{ .ConfirmationURL }}.
 */

type Step = 'request' | 'verify' | 'done';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [emailFocused, setEmailFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const inputStyle = (focused: boolean, invalid = false) => ({
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: invalid ? brand.error : focused ? brand.blue : colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.label,
    borderCurve: 'continuous' as const,
  });

  const labelStyle = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.label,
    marginBottom: 8,
    letterSpacing: 0.1,
  };

  // ── Step 1: send the code ──────────────────────────────────────────────
  async function sendCode() {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(addr);
    setLoading(false);

    // Deliberately not distinguishing "no such account" from success: telling a
    // stranger which addresses are registered leaks your user list.
    if (err && !/not found|no user/i.test(err.message)) {
      setError(err.message);
      return;
    }
    setNotice(`If an account exists for ${addr}, a six-digit code is on its way.`);
    setStep('verify');
  }

  // ── Step 2: verify the code and set the new password ───────────────────
  async function applyNewPassword() {
    const token = code.trim();
    if (token.length < 6) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    // verifyOtp returns a session, which is what lets updateUser change the
    // password without knowing the old one.
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'recovery',
    });
    if (otpError) {
      setLoading(false);
      setError(
        /expired/i.test(otpError.message)
          ? 'That code has expired. Request a new one.'
          : 'That code is not correct. Check the email and try again.',
      );
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStep('done');
  }

  // ── Success ────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <LinearGradient
        colors={isDark ? ['#0d1a2e', '#070d16'] : ['#CEDFFF', '#FFFFFF']}
        locations={[0, 0.55]}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
      >
        <View
          style={{
            width: 72, height: 72, borderRadius: 36, backgroundColor: brand.teal,
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}
        >
          <Ionicons name="checkmark" size={36} color="#FFFFFF" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.label, marginBottom: 8, textAlign: 'center' }}>
          Password changed
        </Text>
        <Text style={{ fontSize: 15, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
          You&rsquo;re signed in with your new password.
        </Text>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => ({
            height: 52, borderRadius: 14, backgroundColor: brand.blue,
            alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
            opacity: pressed ? 0.8 : 1, borderCurve: 'continuous',
          })}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Continue</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  // ── Request / verify ───────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={isDark ? ['#0d1a2e', '#070d16'] : ['#CEDFFF', '#FFFFFF']}
      locations={[0, 0.55]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
        >
          <Pressable
            onPress={() => (step === 'verify' ? setStep('request') : router.back())}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, alignSelf: 'flex-start', marginBottom: 24, padding: 4 })}
          >
            <Ionicons name="chevron-back" size={26} color={colors.label} />
          </Pressable>

          <View
            style={{
              width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '18',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderCurve: 'continuous',
            }}
          >
            <Ionicons name={step === 'request' ? 'key-outline' : 'mail-open-outline'} size={28} color={brand.blue} />
          </View>

          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.label, letterSpacing: -0.5, marginBottom: 8 }}>
            {step === 'request' ? 'Reset your password' : 'Enter your code'}
          </Text>
          <Text style={{ fontSize: 15, color: colors.secondaryLabel, lineHeight: 22, marginBottom: 28 }}>
            {step === 'request'
              ? 'Enter the email address on your account and we’ll send you a six-digit code.'
              : notice}
          </Text>

          {error ? (
            <View
              style={{
                backgroundColor: brand.error + '14', borderRadius: 12, padding: 14, marginBottom: 20,
                flexDirection: 'row', alignItems: 'center', gap: 10, borderCurve: 'continuous',
              }}
            >
              <Ionicons name="alert-circle" size={18} color={brand.error} />
              <Text selectable style={{ color: brand.error, fontSize: 14, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {step === 'request' ? (
            <View style={{ marginBottom: 24 }}>
              <Text style={labelStyle}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="you@example.com"
                placeholderTextColor={colors.secondaryLabel}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={sendCode}
                style={inputStyle(emailFocused)}
              />
            </View>
          ) : (
            <>
              <View style={{ marginBottom: 20 }}>
                <Text style={labelStyle}>Six-digit code</Text>
                <TextInput
                  value={code}
                  onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  placeholder="123456"
                  placeholderTextColor={colors.secondaryLabel}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  style={{ ...inputStyle(codeFocused), letterSpacing: 8, fontSize: 20, fontWeight: '600', textAlign: 'center' }}
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={labelStyle}>New password</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="••••••••"
                    placeholderTextColor={colors.secondaryLabel}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ ...inputStyle(passwordFocused), paddingRight: 52 }}
                  />
                  <Pressable
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={8}
                    style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.secondaryLabel} />
                  </Pressable>
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={labelStyle}>Confirm new password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  placeholder="••••••••"
                  placeholderTextColor={colors.secondaryLabel}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={applyNewPassword}
                  style={inputStyle(confirmFocused, confirmPassword.length > 0 && password !== confirmPassword)}
                />
              </View>
            </>
          )}

          <Pressable
            onPress={step === 'request' ? sendCode : applyNewPassword}
            disabled={loading}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, backgroundColor: brand.blue,
              alignItems: 'center', justifyContent: 'center',
              opacity: loading ? 0.6 : pressed ? 0.8 : 1, borderCurve: 'continuous',
              boxShadow: '0 4px 14px rgba(43,116,214,0.28)',
            })}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                {step === 'request' ? 'Send code' : 'Change password'}
              </Text>
            )}
          </Pressable>

          {step === 'verify' && (
            <Pressable
              onPress={() => { setCode(''); setError(''); setStep('request'); }}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, alignItems: 'center', paddingVertical: 16 })}
            >
              <Text style={{ fontSize: 14, color: brand.blue, fontWeight: '600' }}>
                Didn&rsquo;t get it? Send again
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
