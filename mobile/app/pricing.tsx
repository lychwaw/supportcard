import { useState } from 'react';
import { router } from 'expo-router';
import {
  ScrollView, View, Text, Pressable, StatusBar,
  Linking, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { formatPrice, CURRENCY_OPTIONS } from '@/lib/currency';
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

  const p = (usd: number) => formatPrice(usd, currency);

  const handleCTA = async (tier: string, free?: boolean) => {
    if (free) { router.replace('/(tabs)/'); return; }

    setCheckoutLoading(tier);
    try {
      if (Platform.OS === 'ios') {
        await purchaseWithRevenueCat(tier);
        router.replace('/(tabs)/');
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
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not restore purchases.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#1E3A5F', '#2B74D6']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 24, paddingHorizontal: 16, overflow: 'hidden' }}
      >
        <View style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/')}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' })}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="heart-outline" size={18} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20, flex: 1, letterSpacing: -0.4 }}>Plans & Pricing</Text>
        </View>

        {/* Currency toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderCurve: 'continuous' }}>
          {CURRENCY_OPTIONS.map(opt => {
            const active = currency === opt.value;
            return (
              <Pressable key={opt.value} onPress={() => setCurrency(opt.value)}
                style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 9, borderRadius: 11, borderCurve: 'continuous',
                  backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}>
                <Text style={{ fontSize: 15 }}>{opt.flag}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                  {opt.sublabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>

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
          <Text style={{ fontWeight: '900', fontSize: 30, color: colors.label, marginTop: 12, letterSpacing: -0.6 }}>Preview</Text>
          <View style={{ alignSelf: 'flex-start', backgroundColor: brand.blue + '12', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginTop: 6 }}>
            <Text style={{ color: brand.blue, fontSize: 13, fontWeight: '600' }}>Tiny trial access</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 4 }}>
            <Text style={{ fontWeight: '900', fontSize: 46, color: colors.label, letterSpacing: -1 }}>{p(0)}</Text>
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
          <Text style={{ fontWeight: '900', fontSize: 30, color: colors.label, marginTop: 12, letterSpacing: -0.6 }}>Essential</Text>
          <View style={{ alignSelf: 'flex-start', backgroundColor: brand.blue + '12', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginTop: 6 }}>
            <Text style={{ color: brand.blue, fontSize: 13, fontWeight: '600' }}>Basic capped use</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 4 }}>
            <Text style={{ fontWeight: '900', fontSize: 46, color: colors.label, letterSpacing: -1 }}>{p(4.99)}</Text>
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

        {/* ── Plus (MOST POPULAR) ── gradient card */}
        <View style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 28px rgba(12,148,136,0.30)' }}>
          {/* Badge */}
          <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>MOST POPULAR</Text>
          </View>
          <LinearGradient
            colors={['#0C9488', '#0D7A6E']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ padding: 24, borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden' }}
          >
            <View style={{ position: 'absolute', right: -60, bottom: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="flash" size={26} color="#fff" />
            </View>
            <Text style={{ fontWeight: '900', fontSize: 30, color: '#fff', marginTop: 12, letterSpacing: -0.6 }}>Plus</Text>
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginTop: 6 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Advanced features</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontWeight: '900', fontSize: 46, color: '#fff', letterSpacing: -1 }}>{p(6.99)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17 }}>/mo</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>FOUNDER OFFER</Text>
              </View>
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
                : <Text style={{ color: brand.teal, fontWeight: '800', fontSize: 15 }}>Choose Plus</Text>}
            </Pressable>
          </LinearGradient>
        </View>

        {/* ── Premium ── */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, borderCurve: 'continuous', padding: 24, borderWidth: 0.5, borderColor: colors.separator, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="shield-checkmark-outline" size={26} color="#F59E0B" />
          </View>
          <Text style={{ fontWeight: '900', fontSize: 30, color: colors.label, marginTop: 12, letterSpacing: -0.6 }}>Premium</Text>
          <View style={{ alignSelf: 'flex-start', backgroundColor: '#F59E0B18', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginTop: 6 }}>
            <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '600' }}>Advanced records</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 4 }}>
            <Text style={{ fontWeight: '900', fontSize: 46, color: colors.label, letterSpacing: -1 }}>{p(14.99)}</Text>
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

        {/* ── Founder Offer ── */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, borderCurve: 'continuous', padding: 20, borderWidth: 0.5, borderColor: brand.blue + '30', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: brand.blue + '15', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderCurve: 'continuous' }}>
            <Ionicons name="gift-outline" size={26} color={brand.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: brand.blue, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Founder Offer</Text>
            <Text style={{ color: colors.label, fontSize: 14, lineHeight: 21 }}>
              Plus is <Text style={{ fontWeight: '800' }}>{p(6.99)}/month</Text> for the first 5,000 families. Lock in this rate as long as you stay subscribed.
            </Text>
          </View>
        </View>

        {/* Restore Purchases — required by Apple */}
        {Platform.OS === 'ios' && (
          <Pressable onPress={handleRestore} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, alignItems: 'center', paddingVertical: 8 })}>
            <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>Restore Purchases</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
