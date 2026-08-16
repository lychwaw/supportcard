import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

WebBrowser.maybeCompleteAuthSession();

async function handleGoogleSignIn(setError: (e: string) => void) {
  setError('');
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) setError(error.message);
    return;
  }
  const redirectTo = 'supportcard://';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) { setError(error?.message ?? 'Could not start sign-in'); return; }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const url = result.url;
  if (url.includes('code=')) {
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(url);
    if (sessionError) setError(sessionError.message);
  } else {
    const fragment = url.includes('#') ? url.split('#')[1] : url.split('?').slice(1).join('?');
    const params = new URLSearchParams(fragment ?? '');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) setError(sessionError.message);
    } else {
      setError('Sign-in failed — please try again.');
    }
  }
}

async function handleAppleSignIn(setError: (e: string) => void) {
  setError('');
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) setError(error.message);
    return;
  }
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) { setError('Apple Sign In failed — no identity token received.'); return; }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) setError(error.message);
  } catch (e: any) {
    if (e?.code !== 'ERR_REQUEST_CANCELED') {
      setError(e?.message ?? 'Apple Sign In failed.');
    }
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  async function handleForgotPassword() {
    const addr = email.trim();
    if (!addr) {
      Alert.alert('Reset password', 'Enter your email address above, then tap Forgot password.');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
    });
    if (resetError) {
      Alert.alert('Error', resetError.message);
    } else {
      Alert.alert('Check your email', `A password reset link has been sent to ${addr}.`);
    }
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

        <Text style={{ fontSize: 28, fontWeight: '700', color: brand.dark, letterSpacing: -0.5, marginBottom: 6 }}>
          Welcome back
        </Text>
        <Text style={{ fontSize: 15, color: brand.body, marginBottom: 32, lineHeight: 22 }}>
          Sign in to continue
        </Text>

        {/* Social auth buttons */}
        <View style={{ gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => handleGoogleSignIn(setError)}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: brand.separator,
              backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
              justifyContent: 'center', gap: 10, opacity: pressed ? 0.7 : 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderCurve: 'continuous',
            })}
          >
            {/* Google 'G' logo using coloured text — no external assets */}
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#4285F4', fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : undefined }}>G</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>Continue with Google</Text>
          </Pressable>

          <Pressable
            onPress={() => handleAppleSignIn(setError)}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: brand.separator,
              backgroundColor: '#000000', flexDirection: 'row', alignItems: 'center',
              justifyContent: 'center', gap: 10, opacity: pressed ? 0.7 : 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.10)', borderCurve: 'continuous',
            })}
          >
            <Text style={{ fontSize: 20, color: '#FFFFFF' }}></Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Continue with Apple</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: brand.separator }} />
          <Text style={{ fontSize: 12, color: brand.body, fontWeight: '500' }}>or sign in with email</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: brand.separator }} />
        </View>

        {/* Email field */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: brand.dark, marginBottom: 8, letterSpacing: 0.1 }}>
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
              height: 52, borderRadius: 12, borderWidth: 1.5,
              borderColor: emailFocused ? brand.blue : brand.separator,
              backgroundColor: '#FFFFFF', paddingHorizontal: 16,
              fontSize: 15, color: brand.dark, borderCurve: 'continuous',
            }}
          />
        </View>

        {/* Password field */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: brand.dark, marginBottom: 8, letterSpacing: 0.1 }}>
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
                height: 52, borderRadius: 12, borderWidth: 1.5,
                borderColor: passwordFocused ? brand.blue : brand.separator,
                backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingRight: 52,
                fontSize: 15, color: brand.dark, borderCurve: 'continuous',
              }}
            />
            <Pressable
              onPress={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 4 }}
              hitSlop={8}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={brand.body} />
            </Pressable>
          </View>
        </View>

        {/* Forgot password */}
        <Pressable onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: 32 }} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: brand.blue }}>Forgot password?</Text>
        </Pressable>

        {/* Sign in button */}
        <Pressable
          onPress={handleSignIn}
          disabled={loading}
          style={({ pressed }) => ({
            height: 56, borderRadius: 14, backgroundColor: brand.blue,
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(43,116,214,0.30)',
            opacity: pressed || loading ? 0.80 : 1, borderCurve: 'continuous',
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        {!!error && (
          <Text selectable style={{ marginTop: 12, fontSize: 13, color: brand.error, textAlign: 'center', lineHeight: 18 }}>
            {error}
          </Text>
        )}

        {/* Sign up link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32 }}>
          <Text style={{ fontSize: 14, color: brand.body }}>{"Don't have an account? "}</Text>
          <Pressable onPress={() => router.push('/(auth)/signup')} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: brand.blue }}>Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </LinearGradient>
  );
}
