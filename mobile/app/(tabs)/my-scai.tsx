import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  FlatList, KeyboardAvoidingView, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';

interface Action { summary: string }
interface Message { id: string; role: 'user' | 'assistant'; content: string; actions?: Action[] }

function cleanText(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SUGGESTIONS: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string; color: string }> = [
  { icon: 'calendar-outline',    text: 'Schedule a pickup',       color: brand.blue },
  { icon: 'cash-outline',        text: 'Request funds',           color: '#22C55E' },
  { icon: 'school-outline',      text: 'Add school event',        color: '#8B5CF6' },
  { icon: 'medical-outline',     text: 'Add a doctor visit',      color: '#F59E0B' },
  { icon: 'swap-horizontal-outline', text: 'Log a drop-off',      color: brand.teal },
  { icon: 'location-outline',    text: 'Log a check-in',          color: '#EF4444' },
];

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={{ borderRadius: 24, padding: 28, alignItems: 'center', gap: 16, marginBottom: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: brand.teal + '35', borderCurve: 'continuous', boxShadow: '0 4px 20px rgba(14, 169, 104, 0.10)' }}>
        <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: brand.teal + '20', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
          <Ionicons name="flash" size={36} color={brand.teal} />
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '700', fontSize: 26, color: colors.label, letterSpacing: -0.5 }}>My SCAI</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
            Your AI co-parenting assistant.{'\n'}Schedule, request, log — just ask.
          </Text>
        </View>
      </View>

      {/* Suggestions grid */}
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 12 }}>
        Try asking me to…
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s.text} onPress={() => onSuggestion(s.text)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16,
              backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.separator,
              borderCurve: 'continuous', transform: [{ scale: pressed ? 0.95 : 1 }],
              flexBasis: '47%', flexGrow: 1,
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
            })}>
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: s.color + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name={s.icon} size={16} color={s.color} />
            </View>
            <Text style={{ color: colors.label, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={2}>{s.text}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <View style={{ alignItems: 'flex-end', marginVertical: 4, paddingHorizontal: 16 }}>
      <View style={{ maxWidth: '78%', backgroundColor: brand.blue, borderRadius: 20, borderBottomRightRadius: 4, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>{content}</Text>
      </View>
    </View>
  );
}

function AssistantBubble({ content, actions }: { content: string; actions?: Action[] }) {
  return (
    <View style={{ alignItems: 'flex-start', marginVertical: 4, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', gap: 10, maxWidth: '85%', alignItems: 'flex-end' }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: brand.teal + '20', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', flexShrink: 0 }}>
          <Ionicons name="flash" size={14} color={brand.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderBottomLeftRadius: 4, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 0.5, borderColor: colors.separator }}>
            <Text style={{ color: colors.label, fontSize: 15, lineHeight: 22 }}>{content}</Text>
          </View>
          {actions && actions.length > 0 && (
            <View style={{ gap: 4, marginTop: 6 }}>
              {actions.map((a, i) => (
                <View key={i} style={{ backgroundColor: brand.teal + '12', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                  <Ionicons name="checkmark-circle" size={14} color={brand.teal} />
                  <Text style={{ color: brand.teal, fontSize: 13, fontWeight: '600' }}>{a.summary}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function UpgradeWall() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, paddingBottom: insets.bottom + 32 }}>
      <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: brand.teal + '20', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', marginBottom: 20 }}>
        <Ionicons name="flash" size={36} color={brand.teal} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.label, textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 }}>My SCAI</Text>
      <Text style={{ fontSize: 15, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
        The AI co-parenting assistant is available on Plus and Premium plans.
      </Text>
      <Pressable onPress={() => router.push('/pricing' as any)}
        style={({ pressed }) => ({ backgroundColor: brand.teal, borderRadius: 16, borderCurve: 'continuous', paddingVertical: 16, paddingHorizontal: 40, opacity: pressed ? 0.8 : 1 })}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>View Plans</Text>
      </Pressable>
    </View>
  );
}

export default function MyScaiTabScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles' as any).select('subscription_tier').eq('id', user.id).maybeSingle();
      setTier((data as any)?.subscription_tier ?? 'preview');
    })();
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const allMessages = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL ?? ''}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'scai-chat', messages: allMessages }),
      });
      const data = await res.json();
      const reply = res.status === 403
        ? 'My SCAI requires a Plus or Premium plan. Tap View Plans to upgrade.'
        : cleanText(data.reply ?? data.error ?? 'Sorry, I could not process that.');
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: reply,
        actions: data.actions ?? [],
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong.',
      }]);
    } finally {
      setIsSending(false);
    }
  }, [isSending, messages]);

  const renderItem = useCallback(({ item }: { item: Message }) => {
    if (item.role === 'user') return <UserBubble content={item.content} />;
    return <AssistantBubble content={item.content} actions={item.actions} />;
  }, []);

  if (tier === null) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (tier === 'preview' || tier === 'free' || tier === 'essential') return <UpgradeWall />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Header ── */}
      <View style={{
        paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 20,
        backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: brand.teal + '20', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
          <Ionicons name="flash" size={20} color={brand.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.label, letterSpacing: -0.3 }}>My SCAI</Text>
          <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>AI Co-Parenting Assistant</Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={() => setMessages([])} hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 8, borderRadius: 10, backgroundColor: colors.background })}>
            <Ionicons name="create-outline" size={20} color={brand.blue} />
          </Pressable>
        )}
      </View>

      {/* ── Chat area ── */}
      {messages.length === 0 ? (
        <EmptyState onSuggestion={t => setInput(t)} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 14 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          style={{ backgroundColor: colors.background }}
        />
      )}

      {/* Typing indicator */}
      {isSending && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 4, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: brand.teal + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="flash" size={11} color={brand.teal} />
            </View>
            <ActivityIndicator size="small" color={brand.teal} />
            <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>SCAI is thinking…</Text>
          </View>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={{
        backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.separator,
        paddingHorizontal: 12, paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <TextInput
          style={{
            flex: 1, backgroundColor: colors.background, borderRadius: 22,
            paddingVertical: 12, paddingHorizontal: 16,
            fontSize: 15, color: colors.label, maxHeight: 120,
            borderWidth: 0.5, borderColor: colors.separator,
          }}
          placeholder="Ask My SCAI anything…"
          placeholderTextColor={colors.secondaryLabel}
          value={input}
          onChangeText={setInput}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
          editable={!isSending}
        />
        <Pressable
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isSending}
          style={({ pressed }) => ({
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: input.trim() && !isSending ? brand.teal : colors.separator,
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
