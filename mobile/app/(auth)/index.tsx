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
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

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
    if (authError) {
      setError(authError.message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: brand.lightBg }}
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
        {/* Logo + App name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: brand.blue,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(43,116,214,0.30)',
            }}
          >
            <Text style={{ fontSize: 22, color: '#FFFFFF' }}>♥</Text>
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: brand.blue,
              letterSpacing: -0.3,
            }}
          >
            SupportCard
          </Text>
        </View>

        {/* Title + subtitle */}
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: brand.dark,
            letterSpacing: -0.5,
            marginBottom: 6,
          }}
        >
          Welcome back
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: brand.body,
            marginBottom: 40,
            lineHeight: 22,
          }}
        >
          Sign in to continue
        </Text>

        {/* Email field */}
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

        {/* Password field */}
        <View style={{ marginBottom: 10 }}>
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
              <Text style={{ fontSize: 18, color: brand.body }}>
                {showPassword ? '🙈' : '👁️'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Forgot password */}
        <Pressable
          style={{ alignSelf: 'flex-end', marginBottom: 32 }}
          hitSlop={8}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: brand.blue,
            }}
          >
            Forgot password?
          </Text>
        </Pressable>

        {/* Sign in button */}
        <Pressable
          onPress={handleSignIn}
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
            {loading ? 'Signing in…' : 'Sign in'}
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

        {/* Sign up link */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 32,
          }}
        >
          <Text style={{ fontSize: 14, color: brand.body }}>
            {"Don't have an account? "}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/signup')} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: brand.blue }}>
              Sign up
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
