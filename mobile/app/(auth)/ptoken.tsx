/**
 * Deep link handler for professional invite links.
 * URL: supportcard://auth?ptoken=prof_xxx
 * or:  https://supportcard.vercel.app/auth?ptoken=prof_xxx
 *
 * When a professional receives an invite link and taps it, Expo Router
 * lands here, we verify the token against Supabase, then route them
 * through signup/login with the professional role pre-set.
 */
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

export default function PTokenScreen() {
  const { ptoken } = useLocalSearchParams<{ ptoken: string }>();

  useEffect(() => {
    if (!ptoken) { router.replace('/(auth)/'); return; }

    const verify = async () => {
      // Check if the token exists and is pending
      const { data: link, error } = await supabase
        .from('professional_links' as any)
        .select('id, status, invited_email')
        .eq('token', ptoken)
        .eq('status', 'pending')
        .maybeSingle();

      if (error || !link) {
        // Invalid or already used — send to login with a message
        router.replace('/(auth)/');
        return;
      }

      // Valid token — redirect to signup pre-filling the professional role
      router.replace({
        pathname: '/(auth)/signup',
        params: { ptoken, role: 'professional', email: (link as any).invited_email ?? '' },
      });
    };

    verify();
  }, [ptoken]);

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <ActivityIndicator size="large" color={brand.blue} />
      <Text style={{ fontSize: 15, color: brand.body }}>Verifying invite link…</Text>
    </View>
  );
}
