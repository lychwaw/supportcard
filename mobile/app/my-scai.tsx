import { useState, useRef, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, Pressable, TextInput, ScrollView,
  FlatList, KeyboardAvoidingView, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const colors = {
  lightBg: '#EBF4FF', blue: '#2B74D6', card: '#FFFFFF',
  dark: '#0D1C2E', body: '#6B7A8D', separator: '#E4ECF5',
};

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

interface Action { summary: string }
interface Message { id: string; role: 'user' | 'assistant'; content: string; actions?: Action[] }

const SUGGESTIONS = [
  { icon: 'calendar-outline' as const,    text: 'Schedule a pick-up for Friday at 3:30 PM' },
  { icon: 'receipt-outline' as const,     text: 'Log a school expense for child' },
  { icon: 'stats-chart-outline' as const, text: 'How much did I spend on child this month?' },
];

function UserBubble({ content }: { content: string }) {
  return (
    <View style={{ alignItems: 'flex-end', marginVertical: 4, paddingHorizontal: 16 }}>
      <View style={{ backgroundColor: colors.blue, maxWidth: '78%', borderRadius: 20, borderBottomRightRadius: 4, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>{content}</Text>
      </View>
    </View>
  );
}

function AssistantBubble({ content, actions }: { content: string; actions?: Action[] }) {
  return (
    <View style={{ alignItems: 'flex-start', marginVertical: 4, paddingHorizontal: 16 }}>
      <View style={{ backgroundColor: '#F2F6FB', maxWidth: '78%', borderRadius: 20, borderBottomLeftRadius: 4, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ color: colors.dark, fontSize: 15, lineHeight: 21 }}>{content}</Text>
      </View>
      {actions && actions.length > 0 && (
        <View style={{ gap: 4, marginTop: 4 }}>
          {actions.map((a, i) => (
            <View key={i} style={{ backgroundColor: colors.lightBg, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={13} color={colors.blue} />
              <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '500' }}>{a.summary}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      {/* Large greeting */}
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.blue, marginBottom: 6 }}>
        Hi Co-Parent,
      </Text>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.dark, lineHeight: 32, marginBottom: 12 }}>
        I'm your co-parenting{'\n'}AI assistant.
      </Text>
      <Text style={{ fontSize: 15, color: colors.body, lineHeight: 22, marginBottom: 36 }}>
        I can help you with scheduling, expense tracking, answers and more. How can I help?
      </Text>

      {/* Suggestion rows */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(43,116,214,0.07)' }}>
        {SUGGESTIONS.map((s, i) => (
          <Pressable key={s.text} onPress={() => onSuggestion(s.text)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 14,
              padding: 16,
              borderBottomWidth: i < SUGGESTIONS.length - 1 ? 1 : 0,
              borderBottomColor: colors.separator,
              backgroundColor: pressed ? colors.lightBg : colors.card,
            })}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.lightBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={s.icon} size={20} color={colors.blue} />
            </View>
            <Text style={{ color: colors.dark, fontSize: 14, flex: 1, lineHeight: 20 }}>{s.text}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.body} style={{ opacity: 0.4 }} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

export default function MyScaiScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL ?? ''}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'scai-chat', messages: allMessages }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: cleanText(data.reply ?? 'Sorry, I could not process that.'),
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.card }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Header ── */}
      <View style={{
        paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16,
        backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.separator,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/')}
          hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Ionicons name="chevron-back" size={28} color={colors.dark} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ionicons name="sparkles" size={16} color={colors.blue} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.dark }}>My SCAI</Text>
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={() => setMessages([])} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name="create-outline" size={22} color={colors.blue} />
          </Pressable>
        ) : (
          <Pressable hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.dark} />
          </Pressable>
        )}
      </View>

      {/* ── Chat / Empty state ── */}
      {messages.length === 0 ? (
        <EmptyState onSuggestion={t => setInput(t)} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          style={{ backgroundColor: colors.lightBg }}
        />
      )}

      {/* Thinking indicator */}
      {isSending && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 4, backgroundColor: colors.lightBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F2F6FB', alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 }}>
            <ActivityIndicator size="small" color={colors.body} />
            <Text style={{ color: colors.body, fontSize: 14 }}>SCAI is thinking…</Text>
          </View>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={{
        backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.separator,
        paddingHorizontal: 16, paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <TextInput
          style={{
            flex: 1, backgroundColor: '#F2F6FB', borderRadius: 24,
            paddingVertical: 12, paddingHorizontal: 18,
            fontSize: 15, color: colors.dark, maxHeight: 120,
          }}
          placeholder="Ask My SCAI anything..."
          placeholderTextColor={colors.body}
          value={input}
          onChangeText={setInput}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
          editable={!isSending}
        />
        {input.trim() ? (
          <Pressable onPress={() => sendMessage(input)} disabled={isSending}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', opacity: pressed || isSending ? 0.5 : 1 })}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name="mic-outline" size={26} color={colors.body} />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
