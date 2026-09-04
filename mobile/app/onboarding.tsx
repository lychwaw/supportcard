import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, Pressable, FlatList, useWindowDimensions,
  StatusBar, Platform, type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'expenses',
    icon: 'receipt-outline',
    tint: brand.blue,
    title: 'Share the costs,\nfairly',
    body: 'Log an expense, send it to your co-parent for approval, and keep a clear record of who paid for what.',
  },
  {
    key: 'calendar',
    icon: 'calendar-outline',
    tint: brand.blue,
    title: 'One shared\nschedule',
    body: 'Custody days, pickups, handovers and school events — visible to both parents and always up to date.',
  },
  {
    key: 'scai',
    icon: 'flash',
    tint: brand.teal,
    title: 'Just ask\nMy SCAI',
    body: 'Your AI co-parenting assistant. Schedule a pickup, log a check-in or raise a request — it sets it up for you.',
  },
  {
    key: 'reports',
    icon: 'document-text-outline',
    tint: brand.warning,
    title: 'Court-ready\nrecords',
    body: 'Turn a month of activity into a clean summary you can hand to an attorney or take to court.',
  },
  {
    key: 'messages',
    icon: 'chatbubbles-outline',
    tint: brand.blue,
    title: 'Keep it on\nthe record',
    body: 'Timestamped messages between co-parents, so nothing ever comes down to he-said she-said.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const isLast = index === SLIDES.length - 1;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const next = viewableItems[0]?.index;
    if (typeof next === 'number') {
      setIndex(next);
      if (Platform.OS === 'ios') Haptics.selectionAsync();
    }
  }).current;

  // Mark the tour complete, then hand off to plan selection.
  // The update is best-effort: if it fails the user still gets into the app,
  // they'd just see the tour once more on next launch.
  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase
          .from('profiles')
          .update({ onboarded_at: new Date().toISOString() })
          .eq('id', session.user.id);
      }
    } catch {
      // non-fatal — continue to pricing regardless
    }
    router.replace('/pricing');
  }, [finishing]);

  const next = useCallback(() => {
    if (isLast) { finish(); return; }
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }, [isLast, index, finish]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" />

      {/* ── Skip ── */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={finish}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: 6, paddingHorizontal: 4 })}
        >
          <Text style={{ color: colors.secondaryLabel, fontSize: 15, fontWeight: '600' }}>Skip</Text>
        </Pressable>
      </View>

      {/* ── Slides ── */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={s => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => (
          <View style={{ width, alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 }}>
            <View
              style={{
                width: 104, height: 104, borderRadius: 30, borderCurve: 'continuous',
                backgroundColor: item.tint + '18',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 36,
              }}
            >
              <Ionicons name={item.icon} size={50} color={item.tint} />
            </View>

            <Text
              style={{
                fontSize: 32, fontWeight: '800', color: colors.label,
                textAlign: 'center', letterSpacing: -0.6, lineHeight: 38,
                marginBottom: 16,
              }}
            >
              {item.title}
            </Text>

            <Text
              style={{
                fontSize: 16, color: colors.secondaryLabel,
                textAlign: 'center', lineHeight: 24, maxWidth: 340,
              }}
            >
              {item.body}
            </Text>
          </View>
        )}
      />

      {/* ── Dots ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingTop: 32 }}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={{
              height: 7,
              width: i === index ? 22 : 7,
              borderRadius: 4,
              backgroundColor: i === index ? brand.blue : brand.pillBorder,
            }}
          />
        ))}
      </View>

      {/* ── CTA ── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20, paddingTop: 24, marginTop: 'auto' }}>
        <Pressable
          onPress={next}
          disabled={finishing}
          style={({ pressed }) => ({
            height: 54, borderRadius: 16, borderCurve: 'continuous',
            backgroundColor: brand.blue,
            alignItems: 'center', justifyContent: 'center',
            opacity: finishing ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            boxShadow: '0 4px 16px rgba(43,116,214,0.28)',
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {isLast ? 'See plans' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
