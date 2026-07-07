import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenuRow {
  emoji: string;
  emojiColor: string;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '700',
        color: brand.body,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 24,
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

function MenuCard({ rows }: { rows: MenuRow[] }) {
  return (
    <View
      style={{
        backgroundColor: brand.card,
        borderRadius: 20,
        boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
        overflow: 'hidden',
      }}
    >
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        return (
          <Pressable
            key={row.title}
            onPress={() => {
              if (row.onPress) {
                row.onPress();
              } else if (row.route) {
                router.push(row.route as any);
              }
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              height: 72,
              paddingHorizontal: 16,
              backgroundColor: pressed ? brand.lightBg : brand.card,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: brand.separator,
              gap: 12,
            })}
          >
            {/* Icon */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: row.emojiColor + '1A',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20 }}>{row.emoji}</Text>
            </View>

            {/* Labels */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: row.destructive ? brand.error : brand.dark,
                }}
              >
                {row.title}
              </Text>
              {row.subtitle ? (
                <Text style={{ fontSize: 13, color: brand.body, marginTop: 1 }}>
                  {row.subtitle}
                </Text>
              ) : null}
            </View>

            {/* Chevron */}
            <Text style={{ fontSize: 16, color: brand.body, opacity: 0.5 }}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const insets = useSafeAreaInsets();

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth' as any);
        },
      },
    ]);
  }

  const sections: MenuSection[] = [
    {
      heading: 'Co-Parenting',
      rows: [
        { emoji: '💬', emojiColor: '#22C55E', title: 'Messages', subtitle: 'Chat with your co-parent', route: '/messages' },
        { emoji: '👨‍👧', emojiColor: brand.blue, title: 'Family', subtitle: 'Children, co-parent & professionals', route: '/family' },
        { emoji: '📅', emojiColor: brand.teal, title: 'Child Timeline', subtitle: 'Unified view per child', route: '/child-timeline' },
        { emoji: '🏆', emojiColor: '#F59E0B', title: 'Parenting Scoreboard', subtitle: 'Contribution & engagement metrics', route: '/parenting-scoreboard' },
      ],
    },
    {
      heading: 'Children',
      rows: [
        { emoji: '🏥', emojiColor: brand.error, title: 'Emergency Child Profile', subtitle: 'Medical aid, allergies & emergency info', route: '/emergency-child-profile' },
        { emoji: '📞', emojiColor: '#F59E0B', title: 'Emergency Contacts', subtitle: 'Doctors, schools & trusted contacts', route: '/contacts' },
      ],
    },
    {
      heading: 'Finance',
      rows: [
        { emoji: '🧾', emojiColor: '#22C55E', title: 'Transactions', subtitle: 'Expense request history', route: '/transactions' },
        { emoji: '⭐', emojiColor: '#F59E0B', title: 'Goals & Wishlist', subtitle: "Children's savings goals", route: '/goals' },
      ],
    },
    {
      heading: 'School',
      rows: [
        { emoji: '🎓', emojiColor: brand.blue, title: 'School Hub', subtitle: 'Report cards, notices & events', route: '/school-hub' },
        { emoji: '📊', emojiColor: brand.teal, title: 'Monthly Report', subtitle: 'AI-generated family summary', route: '/monthly-report' },
      ],
    },
    {
      heading: 'Legal & Records',
      rows: [
        { emoji: '📍', emojiColor: '#8B5CF6', title: 'Custody Clock', subtitle: 'Log check-ins & verified handoffs', route: '/custody-clock' },
        { emoji: '📋', emojiColor: '#F59E0B', title: 'Compliance', subtitle: 'Court orders & obligations', route: '/compliance' },
        { emoji: '⚖️', emojiColor: brand.teal, title: 'Professional Portal', subtitle: 'Lawyer & mediator access', route: '/professional-portal' },
      ],
    },
    {
      heading: 'AI Tools',
      rows: [
        { emoji: '🤖', emojiColor: '#0EA968', title: 'My SCAI', subtitle: 'AI co-parenting assistant', route: '/my-scai' },
      ],
    },
    {
      heading: 'Account',
      rows: [
        { emoji: '⚙️', emojiColor: brand.body, title: 'Settings', subtitle: 'Notifications, privacy, account', route: '/settings' },
        { emoji: '💳', emojiColor: brand.blue, title: 'Subscription', subtitle: 'Plans & billing', route: '/pricing' },
        { emoji: '🚪', emojiColor: brand.error, title: 'Sign Out', subtitle: '', onPress: handleSignOut, destructive: true },
      ],
    },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.lightBg }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Page title */}
      <Text
        style={{
          fontSize: 32,
          fontWeight: '700',
          color: brand.dark,
          marginTop: insets.top + 24,
          marginBottom: 4,
        }}
      >
        More
      </Text>

      {sections.map((section) => (
        <View key={section.heading}>
          <SectionHeading title={section.heading} />
          <MenuCard rows={section.rows} />
        </View>
      ))}
    </ScrollView>
  );
}
