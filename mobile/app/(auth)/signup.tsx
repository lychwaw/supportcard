import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';
import { type Currency, CURRENCY_OPTIONS } from '@/lib/currency';

WebBrowser.maybeCompleteAuthSession();

async function handleOAuth(provider: 'google' | 'apple', setError: (e: string) => void) {
  setError('');
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) setError(error.message);
    return;
  }
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) { setError(error?.message ?? 'Could not start sign-in'); return; }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) setError(sessionError.message);
  }
}

type Role = 'parent' | 'professional';

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3;
}

const STRENGTH_COLORS: Record<number, string> = {
  0: brand.separator,
  1: brand.error,
  2: brand.warning,
  3: brand.success,
};

const STRENGTH_LABELS: Record<number, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
};

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('parent');
  const [currency, setCurrency] = useState<Currency>('ZAR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const strength = passwordStrength(password);
  const strengthColor = STRENGTH_COLORS[strength];
  const strengthLabel = STRENGTH_LABELS[strength];

  async function handleSignUp() {
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
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
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), role },
      },
    });
    // Save currency preference to profile immediately after signup
    if (!authError && data.user) {
      await supabase
        .from('profiles' as any)
        .update({ preferred_currency: currency })
        .eq('id', data.user.id);
    }
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: brand.lightBg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: brand.blue,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 4px 20px rgba(43,116,214,0.30)',
          }}
        >
          <Ionicons name="mail-outline" size={32} color="#FFFFFF" />
        </View>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: brand.dark,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Check your email
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: brand.body,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 32,
          }}
        >
          We sent a confirmation link to{'\n'}
          <Text style={{ fontWeight: '600', color: brand.dark }}>{email}</Text>
        </Text>
        <Pressable
          onPress={() => router.replace('/(auth)/')}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: 14,
            backgroundColor: brand.blue,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            opacity: pressed ? 0.80 : 1,
            boxShadow: '0 4px 12px rgba(43,116,214,0.30)',
            borderCurve: 'continuous',
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
            Back to sign in
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#CEDFFF', '#FFFFFF']} locations={[0, 0.55]} style={{ flex: 1 }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 72,
          paddingBottom: 48,
        }}
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(43,116,214,0.32)', borderCurve: 'continuous' }}>
            <Ionicons name="people" size={38} color="#fff" />
          </View>
        </View>

        {/* Title + subtitle */}
        <Text style={{ fontSize: 28, fontWeight: '700', color: brand.dark, letterSpacing: -0.5, marginBottom: 6 }}>
          Create account
        </Text>
        <Text style={{ fontSize: 15, color: brand.body, marginBottom: 32, lineHeight: 22 }}>
          Co-parenting, made simple.
        </Text>

        {/* Social auth buttons */}
        <View style={{ gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => handleOAuth('google', setError)}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: brand.separator,
              backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
              justifyContent: 'center', gap: 10, opacity: pressed ? 0.7 : 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderCurve: 'continuous',
            })}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#4285F4' }}>G</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>Sign up with Google</Text>
          </Pressable>

          <Pressable
            onPress={() => handleOAuth('apple', setError)}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: brand.separator,
              backgroundColor: '#000000', flexDirection: 'row', alignItems: 'center',
              justifyContent: 'center', gap: 10, opacity: pressed ? 0.7 : 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.10)', borderCurve: 'continuous',
            })}
          >
            <Text style={{ fontSize: 20, color: '#FFFFFF' }}></Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Sign up with Apple</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: brand.separator }} />
          <Text style={{ fontSize: 12, color: brand.body, fontWeight: '500' }}>or sign up with email</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: brand.separator }} />
        </View>

        {/* Full name */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: brand.dark,
              marginBottom: 8,
              letterSpacing: 0.1,
            }}
          >
            Full name
          </Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Jane Smith"
            placeholderTextColor={brand.body}
            autoCapitalize="words"
            autoCorrect={false}
            style={{
              height: 52,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: nameFocused ? brand.blue : brand.separator,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 16,
              fontSize: 15,
              color: brand.dark,
              borderCurve: 'continuous',
            }}
          />
        </View>

        {/* Email */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: brand.dark,
              marginBottom: 8,
              letterSpacing: 0.1,
            }}
          >
            Email address
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder="you@example.com"
            placeholderTextColor={brand.body}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: 52,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: emailFocused ? brand.blue : brand.separator,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 16,
              fontSize: 15,
              color: brand.dark,
              borderCurve: 'continuous',
            }}
          />
        </View>

        {/* Password with strength indicator */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: brand.dark,
              marginBottom: 8,
              letterSpacing: 0.1,
            }}
          >
            Password
          </Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="••••••••"
              placeholderTextColor={brand.body}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                height: 52,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: passwordFocused ? brand.blue : brand.separator,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 16,
                paddingRight: 52,
                fontSize: 15,
                color: brand.dark,
                borderCurve: 'continuous',
              }}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute',
                right: 14,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
              hitSlop={8}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={brand.body} />
            </Pressable>
          </View>

          {/* Strength dots */}
          {password.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
              }}
            >
              {([1, 2, 3] as const).map((level) => (
                <View
                  key={level}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 4,
                    backgroundColor: strength >= level ? strengthColor : brand.separator,
                  }}
                />
              ))}
              {strengthLabel ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: strengthColor,
                    minWidth: 44,
                    textAlign: 'right',
                  }}
                >
                  {strengthLabel}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Confirm password */}
        <View style={{ marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: brand.dark,
              marginBottom: 8,
              letterSpacing: 0.1,
            }}
          >
            Confirm password
          </Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              placeholder="••••••••"
              placeholderTextColor={brand.body}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                height: 52,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor:
                  confirmFocused
                    ? brand.blue
                    : confirmPassword.length > 0 && confirmPassword !== password
                    ? brand.error
                    : brand.separator,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 16,
                paddingRight: 52,
                fontSize: 15,
                color: brand.dark,
                borderCurve: 'continuous',
              }}
            />
            <Pressable
              onPress={() => setShowConfirm((v) => !v)}
              style={{
                position: 'absolute',
                right: 14,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
              hitSlop={8}
            >
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={brand.body} />
            </Pressable>
          </View>
        </View>

        {/* Account type selector */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: brand.dark,
              marginBottom: 12,
              letterSpacing: 0.1,
            }}
          >
            Account type
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(
              [
                { key: 'parent', label: 'Parent', icon: 'people-outline' as const },
                { key: 'professional', label: 'Professional', icon: 'briefcase-outline' as const },
              ] as { key: Role; label: string; icon: keyof typeof Ionicons.glyphMap }[]
            ).map(({ key, label, icon }) => {
              const selected = role === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setRole(key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: selected ? brand.blue : brand.separator,
                    backgroundColor: selected ? '#EBF4FF' : '#FFFFFF',
                    paddingVertical: 16,
                    alignItems: 'center',
                    gap: 6,
                    opacity: pressed ? 0.80 : 1,
                    boxShadow: selected
                      ? '0 2px 12px rgba(43,116,214,0.12)'
                      : '0 1px 4px rgba(0,0,0,0.04)',
                    borderCurve: 'continuous',
                  })}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: selected ? brand.blue + '20' : brand.lightBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={24} color={selected ? brand.blue : brand.body} />
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: selected ? brand.blue : brand.body,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Currency selector */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: brand.dark, marginBottom: 4, letterSpacing: 0.1 }}>
            Currency
          </Text>
          <Text style={{ fontSize: 12, color: brand.body, marginBottom: 12 }}>
            Subscription prices will display in your chosen currency
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {CURRENCY_OPTIONS.map(opt => {
              const selected = currency === opt.value;
              return (
                <Pressable key={opt.value} onPress={() => setCurrency(opt.value)}
                  style={({ pressed }) => ({
                    flex: 1, borderRadius: 16, borderWidth: 1.5,
                    borderColor: selected ? brand.blue : brand.separator,
                    backgroundColor: selected ? '#EBF4FF' : '#FFFFFF',
                    paddingVertical: 14, alignItems: 'center', gap: 4,
                    opacity: pressed ? 0.8 : 1,
                    boxShadow: selected ? '0 2px 12px rgba(43,116,214,0.12)' : undefined,
                    borderCurve: 'continuous',
                  })}>
                  <Text style={{ fontSize: 24 }}>{opt.flag}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: selected ? brand.blue : brand.dark }}>
                    {opt.value}
                  </Text>
                  <Text style={{ fontSize: 11, color: selected ? brand.blue : brand.body }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Create account button */}
        <Pressable
          onPress={handleSignUp}
          disabled={loading}
          style={({ pressed }) => ({
            height: 56,
            borderRadius: 14,
            backgroundColor: brand.blue,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(43,116,214,0.30)',
            opacity: pressed || loading ? 0.80 : 1,
            borderCurve: 'continuous',
          })}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: 0.2,
            }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        {/* Error message */}
        {!!error && (
          <Text
            selectable
            style={{
              marginTop: 12,
              fontSize: 13,
              color: brand.error,
              textAlign: 'center',
              lineHeight: 18,
            }}
          >
            {error}
          </Text>
        )}

        {/* Sign in link */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 32,
          }}
        >
          <Text style={{ fontSize: 14, color: brand.body }}>
            Already have an account?{' '}
          </Text>
          <Pressable onPress={() => router.replace('/(auth)/')} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: brand.blue }}>
              Sign in
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </LinearGradient>
  );
}
