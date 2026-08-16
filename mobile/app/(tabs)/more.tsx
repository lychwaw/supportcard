import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

interface MenuRow {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  route?: string;
  onPress?: () => void;
  destructive?: boolean;
}

interface MenuSection {
  heading: string;
  rows: MenuRow[];
}

const TIER_COLORS: Record<string, string> = {
  Preview: brand.body,
  Essential: brand.blue,
  Plus: brand.teal,
  Premium: '#F59E0B',
};

function MenuCard({ rows }: { rows: MenuRow[] }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        return (
          <Pressable
            key={row.title}
            onPress={() => { if (row.onPress) row.onPress(); else if (row.route) router.push(row.route as any); }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 13,
              backgroundColor: pressed ? (row.destructive ? brand.error + '08' : brand.blue + '06') : 'transparent',
              borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: colors.separator,
              gap: 14,
            })}
          >
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: row.iconColor + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name={row.icon} size={19} color={row.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: row.destructive ? brand.error : colors.label }}>{row.title}</Text>
              {row.subtitle ? <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 1 }}>{row.subtitle}</Text> : null}
            </View>
            {!row.destructive && <Ionicons name="chevron-forward" size={15} color={colors.secondaryLabel} style={{ opacity: 0.35 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState({ name: 'Loading…', email: '', initials: '?', plan: 'Preview' });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles' as any).select('full_name, subscription_tier').eq('id', user.id).maybeSingle();
      const raw   = (data as any)?.subscription_tier ?? 'preview';
      const tiers: Record<string, string> = { preview: 'Preview', essential: 'Essential', plus: 'Plus', premium: 'Premium', family_plus: 'Plus', free: 'Preview', legal: 'Premium' };
      const name  = (data as any)?.full_name || (user.user_metadata?.full_name as string) || 'Your Account';
      setProfile({
        name,
        email: user.email ?? '',
        initials: name.charAt(0).toUpperCase(),
        plan: tiers[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1),
      });
    })();
  }, []);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/' as any);
      }},
    ]);
  }

  const tierColor = TIER_COLORS[profile.plan] ?? brand.blue;

  const sections: MenuSection[] = [
    {
      heading: 'Co-Parenting',
      rows: [
        { icon: 'flash-outline',       iconColor: brand.teal,  title: 'My SCAI',              subtitle: 'AI co-parenting assistant',             route: '/(tabs)/my-scai' },
        { icon: 'chatbubble-outline',  iconColor: brand.blue,  title: 'Messages',             subtitle: 'Chat with your co-parent',              route: '/(tabs)/messages' },
        { icon: 'people-outline',      iconColor: brand.blue,  title: 'Family',               subtitle: 'Children, co-parent & professionals',   route: '/family' },
        { icon: 'time-outline',        iconColor: brand.blue,  title: 'Child Timeline',       subtitle: 'Unified view per child',                route: '/child-timeline' },
        { icon: 'ribbon-outline',      iconColor: brand.blue,  title: 'Parenting Scoreboard', subtitle: 'Contribution & engagement metrics',     route: '/parenting-scoreboard' },
      ],
    },
    {
      heading: 'Children',
      rows: [
        { icon: 'medical-outline',     iconColor: brand.error, title: 'Emergency Child Profile', subtitle: 'Medical aid, allergies & emergency info', route: '/emergency-child-profile' },
        { icon: 'call-outline',        iconColor: brand.body,  title: 'Emergency Contacts',      subtitle: 'Doctors, schools & trusted contacts',    route: '/contacts' },
      ],
    },
    {
      heading: 'Finance',
      rows: [
        { icon: 'receipt-outline',     iconColor: brand.teal, title: 'Transactions',     subtitle: 'Expense request history',      route: '/transactions' },
        { icon: 'star-outline',        iconColor: brand.teal, title: 'Goals & Wishlist', subtitle: "Children's savings goals",     route: '/goals' },
      ],
    },
    {
      heading: 'School',
      rows: [
        { icon: 'school-outline',      iconColor: brand.blue, title: 'School Hub',     subtitle: 'Report cards, notices & events', route: '/school-hub' },
        { icon: 'stats-chart-outline', iconColor: brand.teal, title: 'Monthly Report', subtitle: 'AI-generated family summary',    route: '/monthly-report' },
      ],
    },
    {
      heading: 'Legal & Records',
      rows: [
        { icon: 'location-outline',      iconColor: brand.blue, title: 'Custody Clock',       subtitle: 'Log check-ins & verified handoffs', route: '/custody-clock' },
        { icon: 'document-text-outline', iconColor: brand.body, title: 'Compliance',          subtitle: 'Court orders & obligations',         route: '/compliance' },
        { icon: 'documents-outline',     iconColor: brand.body, title: 'Documents',           subtitle: 'Legal, school & medical files',      route: '/(tabs)/documents' },
        { icon: 'briefcase-outline',     iconColor: brand.teal, title: 'Professional Portal', subtitle: 'Lawyer & mediator access',           route: '/professional-portal' },
      ],
    },
    {
      heading: 'Account',
      rows: [
        { icon: 'settings-outline', iconColor: brand.body,  title: 'Settings',     subtitle: 'Notifications, privacy, account', route: '/settings' },
        { icon: 'card-outline',     iconColor: brand.blue,  title: 'Subscription', subtitle: 'Plans & billing',                 route: '/pricing' },
        { icon: 'log-out-outline',  iconColor: brand.error, title: 'Sign Out',     subtitle: '', onPress: handleSignOut, destructive: true },
      ],
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile hero ── */}
      <View style={{ paddingTop: insets.top + 24, paddingBottom: 28, paddingHorizontal: 24, backgroundColor: '#1C3252' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>{profile.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }}>{profile.name}</Text>
            {profile.email ? <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{profile.email}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tierColor === brand.body ? 'rgba(255,255,255,0.5)' : tierColor }} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>{profile.plan}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/settings')}
            style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="settings-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* ── Quick actions ── */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 18, marginBottom: 4 }}>
        {[
          { icon: 'flash' as const, color: brand.teal, label: 'SCAI', route: '/(tabs)/my-scai' },
          { icon: 'chatbubble' as const, color: brand.blue, label: 'Messages', route: '/(tabs)/messages' },
          { icon: 'location' as const, color: '#F59E0B', label: 'Clock', route: '/custody-clock' },
          { icon: 'card' as const, color: '#8B5CF6', label: 'Plans', route: '/pricing' },
        ].map(item => (
          <Pressable key={item.label} onPress={() => router.push(item.route as any)}
            style={({ pressed }) => ({
              flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14,
              backgroundColor: colors.surface, borderRadius: 16, borderWidth: 0.5,
              borderColor: colors.separator, borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.93 : 1 }],
            })}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: item.color + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name={item.icon} size={19} color={item.color} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryLabel }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Sections ── */}
      <View style={{ paddingHorizontal: 16 }}>
        {sections.map(section => (
          <View key={section.heading}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel, marginTop: 26, marginBottom: 8, paddingHorizontal: 4 }}>
              {section.heading}
            </Text>
            <MenuCard rows={section.rows} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
