import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router/stack';
import { ThemeProvider, DefaultTheme, DarkTheme, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { Session } from '@supabase/supabase-js';
import { View, Text, Pressable, useColorScheme, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { initRevenueCat } from '@/lib/revenuecat';
import { CurrencyProvider } from '@/context/currency-context';

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
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Update downloaded — will apply on next cold launch (avoids JS context teardown crash)
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

function AuthGate({
  session,
  needsOnboarding,
}: {
  session: Session | null | undefined;
  needsOnboarding: boolean | null;
}) {
  const router = useRouter();
  const segments = useSegments();
  // Fire the onboarding redirect at most once per app launch. If the user quits
  // mid-tour, onboarded_at is still NULL so they get it again next cold start.
  const sentToOnboarding = useRef(false);

  useEffect(() => {
    if (session === undefined) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) { router.replace('/(auth)'); return; }

    if (session && needsOnboarding && !sentToOnboarding.current) {
      sentToOnboarding.current = true;
      router.replace('/onboarding');
      return;
    }

    if (session && inAuthGroup && !needsOnboarding) router.replace('/(tabs)');
  }, [session, segments, needsOnboarding]);

  return null;
}

// ─── App shell ────────────────────────────────────────────────────────────────

function AppShell({ session, needsOnboarding }: { session: Session | null; needsOnboarding: boolean | null }) {
  const colorScheme = useColorScheme();
  usePushNotifications(); // register for push notifications once authenticated

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : theme}>
      <CurrencyProvider>
      <AuthGate session={session} needsOnboarding={needsOnboarding} />
      <Stack screenOptions={{ headerShown: false, headerBackTitle: '' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="pricing" options={{ headerShown: false }} />
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
        <Stack.Screen name="id-verification" options={{ headerShown: true, gestureEnabled: false, headerBackVisible: false }} />
      </Stack>
      </CurrencyProvider>
    </ThemeProvider>
  );
}

// ─── Root layout ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ioniconsFontUrl = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');

// Has this user completed the intro tour? Fails safe in every direction: if the
// column is missing (migration not run), the request errors, or the network is
// slow, we treat them as onboarded. Skipping the tour is a far better outcome
// than holding up the app, and they get another chance on the next cold start.
async function loadOnboardingState(userId: string): Promise<boolean> {
  try {
    const result = await Promise.race([
      supabase.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]);
    if (!result || result.error) return false;
    return !result.data?.onboarded_at;
  } catch {
    return false;
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    // Load Ionicons from unpkg to bypass Vercel CDN cache corruption
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `@font-face { font-family: 'Ionicons'; src: url('https://unpkg.com/@expo/vector-icons@15.0.2/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype'); font-display: block; }`;
      document.head.appendChild(style);
    }
    checkForUpdates();

    // Hard ceiling on the splash screen. getSession() reads from SecureStore and,
    // when the stored token has expired, refreshes it over the network — so it can
    // be slow on a cold start regardless of anything else we do. A frozen splash
    // is the worst possible first impression, so drop it after 2.5s no matter
    // what; AuthGate routes correctly once the session does arrive.
    const splashTimer = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 2500);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        initRevenueCat(session.user.id);
        // Fire-and-forget: create any recurring expense requests that are due
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/recurring-expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'check' }),
        }).catch(() => {});
        // Resolved in the background — awaiting this held the splash screen up
        // for as long as the profile query took.
        loadOnboardingState(session.user.id).then(setNeedsOnboarding);
      } else {
        setNeedsOnboarding(false);
      }
      clearTimeout(splashTimer);
      SplashScreen.hideAsync();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        initRevenueCat(session.user.id);
        setNeedsOnboarding(await loadOnboardingState(session.user.id));
      } else {
        setNeedsOnboarding(false);
      }
    });

    return () => {
      clearTimeout(splashTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Only the session gates the first render. needsOnboarding may still be null
  // here; AuthGate treats that as "not yet known" and simply doesn't redirect
  // to the tour until it resolves, rather than holding the whole app back.
  //
  // If the splash timer fired before the session arrived, showing null here
  // would leave a blank screen — so render the brand ground with a spinner
  // instead. In practice this is visible only on a slow cold start.
  if (session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={brand.blue} />
      </View>
    );
  }

  return <AppShell session={session} needsOnboarding={needsOnboarding} />;
}
