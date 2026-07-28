import { useEffect, useState } from 'react';
import { Stack } from 'expo-router/stack';
import { ThemeProvider, DefaultTheme, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { Session } from '@supabase/supabase-js';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';
import { usePushNotifications } from '@/hooks/use-push-notifications';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: brand.lightBg,
    card: brand.card,
    primary: brand.blue,
    text: brand.dark,
    border: brand.separator,
  },
};

// ─── OTA update check ────────────────────────────────────────────────────────

async function checkForUpdates() {
  if (__DEV__) return; // never check in dev mode
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Non-fatal — continue with current bundle
  }
}

// ─── Error boundary ───────────────────────────────────────────────────────────

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Ionicons name="warning-outline" size={40} color="#F59E0B" />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', color: brand.dark, textAlign: 'center', marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
        {error.message || 'An unexpected error occurred.'}
      </Text>
      <Pressable onPress={reset}
        style={{ backgroundColor: brand.blue, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function AuthGate({ session }: { session: Session | null | undefined }) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (session === undefined) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) router.replace('/(auth)/');
    else if (session && inAuthGroup) router.replace('/(tabs)/');
  }, [session, segments]);

  return null;
}

// ─── App shell ────────────────────────────────────────────────────────────────

function AppShell({ session }: { session: Session | null }) {
  usePushNotifications(); // register for push notifications once authenticated

  return (
    <ThemeProvider value={theme}>
      <AuthGate session={session} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="my-scai" options={{ headerShown: false }} />
        <Stack.Screen name="pricing" options={{ headerShown: false }} />
        <Stack.Screen name="messages" options={{ headerShown: true }} />
        <Stack.Screen name="contacts" options={{ headerShown: true }} />
        <Stack.Screen name="transactions" options={{ headerShown: true }} />
        <Stack.Screen name="family" options={{ headerShown: true }} />
        <Stack.Screen name="settings" options={{ headerShown: true }} />
        <Stack.Screen name="custody-clock" options={{ headerShown: true }} />
        <Stack.Screen name="compliance" options={{ headerShown: true }} />
        <Stack.Screen name="professional-portal" options={{ headerShown: true }} />
        <Stack.Screen name="goals" options={{ headerShown: true }} />
        <Stack.Screen name="child-timeline" options={{ headerShown: true }} />
        <Stack.Screen name="parenting-scoreboard" options={{ headerShown: true }} />
        <Stack.Screen name="school-hub" options={{ headerShown: true }} />
        <Stack.Screen name="emergency-child-profile" options={{ headerShown: true }} />
        <Stack.Screen name="monthly-report" options={{ headerShown: true }} />
      </Stack>
    </ThemeProvider>
  );
}

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  });

  useEffect(() => {
    checkForUpdates();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      SplashScreen.hideAsync();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined || !fontsLoaded) return null;

  return <AppShell session={session} />;
}
