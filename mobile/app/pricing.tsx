import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable, StatusBar, Linking, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { formatPrice, CURRENCY_OPTIONS } from '@/lib/currency';

function LogoIcon() {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        borderCurve: 'continuous',
        backgroundColor: brand.blue,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 20 }}>♡</Text>
    </View>
  );
}

function TaglinePill({ text }: { text: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: brand.lightBg,
        borderWidth: 1.5,
        borderColor: '#C3DAFB',
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 12,
        marginTop: 8,
      }}
    >
      <Text style={{ color: brand.blue, fontSize: 13, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

function FeatureRow({ text, blue }: { text: string; blue?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: blue ? brand.blue : brand.lightBg,
          borderWidth: blue ? 0 : 1.5,
          borderColor: '#C3DAFB',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: blue ? '#fff' : brand.blue, fontSize: 11, fontWeight: '700' }}>✓</Text>
      </View>
      <Text style={{ color: blue ? brand.blue : brand.body, fontSize: 15, flex: 1 }}>{text}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: brand.separator, marginVertical: 16 }} />;
}

function TierIcon({
  icon,
  iconColor,
  bg,
  size = 52,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={26} color={iconColor} />
    </View>
  );
}

function OutlinedCTA({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: brand.dark,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
        marginTop: 20,
      })}
    >
      {loading
        ? <ActivityIndicator color={brand.dark} />
        : <Text style={{ color: brand.dark, fontWeight: '700', fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

export default function PricingScreen() {
  const { currency, setCurrency } = useCurrency();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const p = (usd: number) => formatPrice(usd, currency);

  const handleCTA = async (tier: string, free?: boolean) => {
    if (free) { router.replace('/(tabs)/'); return; }

    setCheckoutLoading(tier);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Sign in required', 'Please sign in to subscribe.'); return; }

      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard.vercel.app';
      const res = await fetch(`${apiBase}/api/dodo-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tier }),
      });

      const json = await res.json();
      if (!res.ok) { Alert.alert('Error', json.error ?? 'Could not start checkout.'); return; }

      await Linking.openURL(json.payment_link);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      <StatusBar barStyle="dark-content" backgroundColor={brand.lightBg} />

      {/* Custom Header */}
      <View style={{ backgroundColor: brand.lightBg, paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <LogoIcon />
          <Text style={{ color: brand.blue, fontWeight: '700', fontSize: 18, flex: 1 }}>Support Card</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: brand.dark, fontSize: 24, fontWeight: '400' }}>✕</Text>
          </Pressable>
        </View>

        {/* Currency toggle — always visible on pricing page */}
        <View style={{ flexDirection: 'row', backgroundColor: brand.card, borderRadius: 12, padding: 4, borderWidth: 1.5, borderColor: brand.separator }}>
          {CURRENCY_OPTIONS.map(opt => {
            const active = currency === opt.value;
            return (
              <Pressable key={opt.value} onPress={() => setCurrency(opt.value)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 8, borderRadius: 8,
                  backgroundColor: active ? brand.blue : 'transparent' }}>
                <Text style={{ fontSize: 16 }}>{opt.flag}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#fff' : brand.body }}>
                  {opt.sublabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      >
        {/* Preview Card */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 24,
            boxShadow: '0 2px 16px rgba(43,116,214,0.08)',
          }}
        >
          <TierIcon icon="gift-outline" iconColor={brand.blue} bg={brand.lightBg} />
          <Text style={{ fontWeight: '700', fontSize: 32, color: brand.dark, marginTop: 12 }}>
            Preview
          </Text>
          <TaglinePill text="Tiny trial access" />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 48, color: brand.dark }}>{p(0)}</Text>
          </View>
          <Text style={{ color: brand.body, fontSize: 15, marginTop: 4 }}>
            For testing the basics.
          </Text>
          <Divider />
          <FeatureRow text="1 child profile" />
          <FeatureRow text="5 calendar events total" />
          <FeatureRow text="3 expense requests / month" />
          <FeatureRow text="30 parent messages / month" />
          <FeatureRow text="3 stored documents" />
          <FeatureRow text="No My SCAI" />
          <OutlinedCTA label="Start Preview" onPress={() => handleCTA('preview', true)} />
        </View>

        {/* Essential Card */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 24,
            boxShadow: '0 2px 16px rgba(43,116,214,0.08)',
          }}
        >
          <TierIcon icon="calendar-outline" iconColor={brand.blue} bg={brand.lightBg} />
          <Text style={{ fontWeight: '700', fontSize: 32, color: brand.dark, marginTop: 12 }}>
            Essential
          </Text>
          <TaglinePill text="Basic capped use" />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 48, color: brand.dark }}>{p(4.99)}</Text>
            <Text style={{ color: brand.body, fontSize: 17 }}>/mo</Text>
          </View>
          <Text style={{ color: brand.body, fontSize: 15, marginTop: 4 }}>
            For simple structure without AI.
          </Text>
          <Divider />
          <FeatureRow text="1 child profile" />
          <FeatureRow text="40 calendar events / month" />
          <FeatureRow text="20 expense requests / month" />
          <FeatureRow text="500 parent messages / month" />
          <FeatureRow text="25 stored documents" />
          <FeatureRow text="No My SCAI" />
          <OutlinedCTA label="Get Organised" loading={checkoutLoading === 'essential'} onPress={() => handleCTA('essential')} />
        </View>

        {/* Plus Card — MOST POPULAR */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 24,
            boxShadow: '0 2px 16px rgba(43,116,214,0.08)',
          }}
        >
          {/* Most Popular Badge */}
          <View
            style={{
              position: 'absolute',
              top: -12,
              right: 20,
              backgroundColor: brand.blue,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 4,
              zIndex: 1,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
              ★ MOST POPULAR
            </Text>
          </View>

          <TierIcon icon="flash" iconColor="#fff" bg={brand.teal} />
          <Text style={{ fontWeight: '700', fontSize: 32, color: brand.dark, marginTop: 12 }}>
            Plus
          </Text>
          <TaglinePill text="Advanced features" />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 48, color: brand.blue }}>{p(9.99)}</Text>
            <Text style={{ color: brand.body, fontSize: 17 }}>/mo</Text>
          </View>
          <Text style={{ color: brand.body, fontSize: 15, marginTop: 4 }}>
            The smart co-parenting system.
          </Text>
          <Divider />
          <FeatureRow text="Up to 3 child profiles" />
          <FeatureRow text="150 calendar events / month" />
          <FeatureRow text="100 expense requests / month" />
          <FeatureRow text="2,500 parent messages / month" />
          <FeatureRow text="5 PDF exports / month" />
          <FeatureRow text="My SCAI included" blue />

          <Pressable
            onPress={() => handleCTA('plus')}
            disabled={checkoutLoading === 'plus'}
            style={({ pressed }) => ({
              height: 56,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: brand.blue,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed || checkoutLoading === 'plus' ? 0.85 : 1,
              marginTop: 20,
              boxShadow: '0 4px 12px rgba(43,116,214,0.30)',
            })}
          >
            {checkoutLoading === 'plus'
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Choose Plus</Text>}
          </Pressable>
        </View>

        {/* Premium Card */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 24,
            boxShadow: '0 2px 16px rgba(43,116,214,0.08)',
          }}
        >
          <TierIcon icon="shield-checkmark-outline" iconColor={brand.blue} bg={brand.lightBg} />
          <Text style={{ fontWeight: '700', fontSize: 32, color: brand.dark, marginTop: 12 }}>
            Premium
          </Text>
          <TaglinePill text="Advanced records" />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16, gap: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 48, color: brand.dark }}>{p(14.99)}</Text>
            <Text style={{ color: brand.body, fontSize: 17 }}>/mo</Text>
          </View>
          <Text style={{ color: brand.body, fontSize: 15, marginTop: 4 }}>
            The complete protection plan.
          </Text>
          <Divider />
          <FeatureRow text="2 co-parenting circles" />
          <FeatureRow text="Unlimited fair-use activity" />
          <FeatureRow text="25 GB document storage" />
          <FeatureRow text="25 PDF exports / month" />
          <FeatureRow text="Professional access" />
          <FeatureRow text="Advanced My SCAI" />
          <OutlinedCTA label="Protect Records" loading={checkoutLoading === 'premium'} onPress={() => handleCTA('premium')} />
        </View>

        {/* Founder Offer Card */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 24,
            boxShadow: '0 2px 16px rgba(43,116,214,0.08)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: brand.lightBg,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Text style={{ fontSize: 28 }}>🎁</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: brand.dark, fontSize: 15, lineHeight: 22 }}>
              <Text style={{ fontWeight: '700', color: brand.blue }}>Founder Offer:</Text>
              {' '}SupportCard Plus for{' '}
              <Text style={{ fontWeight: '700' }}>{p(6.99)}/month</Text>
              {' '}for the first 5,000 families — locked for 12 months.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
