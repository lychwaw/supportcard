import { useState } from 'react';
import { router } from 'expo-router';
import {
  ScrollView, View, Text, Pressable, StatusBar,
  Linking, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { CURRENCY_OPTIONS } from '@/lib/currency';
import { purchaseWithRevenueCat, restoreRevenueCatPurchases } from '@/lib/revenuecat';

function FeatureRow({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: accent ? brand.teal : brand.blue + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark" size={12} color={accent ? '#fff' : brand.blue} />
      </View>
      <Text style={{ color: accent ? 'rgba(255,255,255,0.9)' : colors.label, fontSize: 15, flex: 1 }}>{text}</Text>
    </View>
  );
}

function Divider({ light }: { light?: boolean }) {
  return <View style={{ height: 0.5, backgroundColor: light ? 'rgba(255,255,255,0.2)' : colors.separator, marginVertical: 16 }} />;
}

export default function PricingScreen() {
  const insets = useSafeAreaInsets();
  const { currency, setCurrency } = useCurrency();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Actual App Store Connect prices — must match exactly what Apple charges
  const PRICES: Record<string, { USD: string; ZAR: string }> = {
    supportcard_essential_monthly: { USD: '$3.99', ZAR: 'R89.99' },
    supportcard_plus_monthly:      { USD: '$5.99', ZAR: 'R129.99' },
    supportcard_premium_monthly:   { USD: '$12.99', ZAR: 'R269.00' },
  };

  const p = (packageId: string) => {
    const tier = PRICES[packageId];
    if (!tier) return 'Free';
    return currency === 'USD' ? tier.USD : tier.ZAR;
  };

  const syncTier = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';
    await fetch(`${apiBase}/api/sync-tier`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
  };

  const handleCTA = async (tier: string, free?: boolean) => {
    if (free) { router.replace('/(tabs)'); return; }

    setCheckoutLoading(tier);
    try {
      if (Platform.OS === 'ios') {
        await purchaseWithRevenueCat(tier);
        await syncTier();
        router.replace('/(tabs)');
      } else {
        // Web — use Dodo checkout
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          Alert.alert('Sign in required', 'Please sign in to subscribe.');
          return;
        }
        const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';
        const res = await fetch(`${apiBase}/api/dodo-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ tier }),
        });
        const data = await res.json();
        if (!res.ok) {
          Alert.alert('Checkout error', data.error ?? 'Could not start checkout.');
          return;
        }
        if (typeof window !== 'undefined') {
          window.location.href = data.payment_link;
        } else {
          await Linking.openURL(data.payment_link);
        }
      }
    } catch (e: any) {
      if ((e as any)?.userCancelled) return;
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreRevenueCatPurchases();
      await syncTier();
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not restore purchases.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: '#1C3252', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' })}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="heart-outline" size={17} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 20, flex: 1, letterSpacing: -0.3 }}>Plans & Pricing</Text>
        </View>

        {/* Currency toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 3, borderCurve: 'continuous' }}>
          {CURRENCY_OPTIONS.map(opt => {
            const active = currency === opt.value;
            return (
              <Pressable key={opt.value} onPress={() => setCurrency(opt.value)}
                style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 8, borderRadius: 9, borderCurve: 'continuous',
                  backgroundColor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {opt.sublabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Preview ── */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, borderCurve: 'continuous', padding: 24, borderWidth: 0.5, borderColor: colors.separator, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="gift-outline" size={26} color={brand.blue} />
          </View>
          <Text style={{ fontWeight: '700', fontSize: 30, color: colors.label, marginTop: 12, letterSpacing: -0.4 }}>Preview</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 14, marginTop: 3 }}>Tiny trial access</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 46, color: colors.label, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>Free</Text>
          </View>
          <Text style={{ color: colors.secondaryLabel, fontSize: 15, marginTop: 4 }}>For testing the basics.</Text>
          <Divider />
          <FeatureRow text="1 child profile" />
          <FeatureRow text="5 calendar events total" />
          <FeatureRow text="3 expense requests / month" />
          <FeatureRow text="30 parent messages / month" />
          <FeatureRow text="3 stored documents" />
          <FeatureRow text="No My SCAI" />
          <Pressable
            onPress={() => handleCTA('preview', true)}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, borderCurve: 'continuous',
              borderWidth: 1, borderColor: colors.separator,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 20, transform: [{ scale: pressed ? 0.97 : 1 }],
              backgroundColor: colors.background,
            })}
          >
            <Text style={{ color: colors.label, fontWeight: '700', fontSize: 15 }}>Start Preview</Text>
          </Pressable>
        </View>

        {/* ── Essential ── */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, borderCurve: 'continuous', padding: 24, borderWidth: 0.5, borderColor: colors.separator, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="calendar-outline" size={26} color={brand.blue} />
          </View>
          <Text style={{ fontWeight: '700', fontSize: 30, color: colors.label, marginTop: 12, letterSpacing: -0.4 }}>Essential</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 14, marginTop: 3 }}>Basic capped use</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 46, color: colors.label, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{p('supportcard_essential_monthly')}</Text>
            <Text style={{ color: colors.secondaryLabel, fontSize: 17 }}>/mo</Text>
          </View>
          <Text style={{ color: colors.secondaryLabel, fontSize: 15, marginTop: 4 }}>For simple structure without AI.</Text>
          <Divider />
          <FeatureRow text="1 child profile" />
          <FeatureRow text="40 calendar events / month" />
          <FeatureRow text="20 expense requests / month" />
          <FeatureRow text="500 parent messages / month" />
          <FeatureRow text="25 stored documents" />
          <FeatureRow text="No My SCAI" />
          <Pressable
            onPress={() => handleCTA('essential')}
            disabled={checkoutLoading === 'essential'}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, borderCurve: 'continuous',
              borderWidth: 1, borderColor: brand.blue + '50',
              alignItems: 'center', justifyContent: 'center',
              marginTop: 20, transform: [{ scale: pressed ? 0.97 : 1 }],
              backgroundColor: brand.blue + '08',
            })}
          >
            {checkoutLoading === 'essential'
              ? <ActivityIndicator color={brand.blue} />
              : <Text style={{ color: brand.blue, fontWeight: '700', fontSize: 15 }}>Get Organised</Text>}
          </Pressable>
        </View>

        {/* ── Plus (MOST POPULAR) ── */}
        <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: brand.teal, borderCurve: 'continuous', boxShadow: '0 4px 20px rgba(12,148,136,0.22)' }}>
          <View style={{ position: 'absolute', top: 18, right: 18 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' }}>Most popular</Text>
          </View>
          <View style={{ padding: 24 }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="flash" size={26} color="#fff" />
            </View>
            <Text style={{ fontWeight: '700', fontSize: 30, color: '#fff', marginTop: 12, letterSpacing: -0.4 }}>Plus</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 3 }}>Advanced features</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontWeight: '700', fontSize: 46, color: '#fff', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{p('supportcard_plus_monthly')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17 }}>/mo</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginTop: 4 }}>The smart co-parenting system.</Text>
            <Divider light />
            <FeatureRow text="Up to 3 child profiles" accent />
            <FeatureRow text="150 calendar events / month" accent />
            <FeatureRow text="100 expense requests / month" accent />
            <FeatureRow text="2,500 parent messages / month" accent />
            <FeatureRow text="5 PDF exports / month" accent />
            <FeatureRow text="My SCAI included" accent />
            <Pressable
              onPress={() => handleCTA('plus')}
              disabled={checkoutLoading === 'plus'}
              style={({ pressed }) => ({
                height: 52, borderRadius: 14, borderCurve: 'continuous',
                backgroundColor: '#fff',
                alignItems: 'center', justifyContent: 'center',
                marginTop: 20, transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              {checkoutLoading === 'plus'
                ? <ActivityIndicator color={brand.teal} />
                : <Text style={{ color: brand.teal, fontWeight: '700', fontSize: 15 }}>Choose Plus</Text>}
            </Pressable>
          </View>
        </View>

        {/* ── Premium ── */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, borderCurve: 'continuous', padding: 24, borderWidth: 0.5, borderColor: colors.separator, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="shield-checkmark-outline" size={26} color="#F59E0B" />
          </View>
          <Text style={{ fontWeight: '700', fontSize: 30, color: colors.label, marginTop: 12, letterSpacing: -0.4 }}>Premium</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 14, marginTop: 3 }}>Advanced records</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 46, color: colors.label, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{p('supportcard_premium_monthly')}</Text>
            <Text style={{ color: colors.secondaryLabel, fontSize: 17 }}>/mo</Text>
          </View>
          <Text style={{ color: colors.secondaryLabel, fontSize: 15, marginTop: 4 }}>The complete protection plan.</Text>
          <Divider />
          <FeatureRow text="2 co-parenting circles" />
          <FeatureRow text="Unlimited fair-use activity" />
          <FeatureRow text="25 GB document storage" />
          <FeatureRow text="25 PDF exports / month" />
          <FeatureRow text="Professional access" />
          <FeatureRow text="Advanced My SCAI" />
          <Pressable
            onPress={() => handleCTA('premium')}
            disabled={checkoutLoading === 'premium'}
            style={({ pressed }) => ({
              height: 52, borderRadius: 14, borderCurve: 'continuous',
              borderWidth: 1, borderColor: '#F59E0B50',
              alignItems: 'center', justifyContent: 'center',
              marginTop: 20, transform: [{ scale: pressed ? 0.97 : 1 }],
              backgroundColor: '#F59E0B10',
            })}
          >
            {checkoutLoading === 'premium'
              ? <ActivityIndicator color="#F59E0B" />
              : <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 15 }}>Protect Records</Text>}
          </Pressable>
        </View>

        {/* Restore Purchases — required by Apple */}
        {Platform.OS === 'ios' && (
          <Pressable onPress={handleRestore} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, alignItems: 'center', paddingVertical: 8 })}>
            <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>Restore Purchases</Text>
          </Pressable>
        )}

        {/* Terms & Privacy — required by Apple for auto-renewable subscriptions */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 12 }}>
          <Pressable onPress={() => Linking.openURL('https://supportcard-prod.vercel.app/terms')} hitSlop={8}>
            <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>Terms of Use</Text>
          </Pressable>
          <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://supportcard-prod.vercel.app/privacy')} hitSlop={8}>
            <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
