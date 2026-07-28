import { useState, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  FlatList, KeyboardAvoidingView, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

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

const SUGGESTIONS: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = [
  { icon: 'calendar-outline',    text: 'Schedule a pickup' },
  { icon: 'cash-outline',        text: 'Request funds' },
  { icon: 'school-outline',      text: 'Add school event' },
  { icon: 'camera-outline',      text: 'Upload a receipt' },
  { icon: 'stats-chart-outline', text: 'Generate a report' },
];

function UserBubble({ content }: { content: string }) {
  return (
    <View style={{ alignItems: 'flex-end', marginVertical: 4, paddingHorizontal: 16 }}>
      <View style={{
        backgroundColor: brand.blue, maxWidth: '75%',
        borderRadius: 20, borderBottomRightRadius: 4,
        paddingVertical: 12, paddingHorizontal: 16,
      }}>
        <Text style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>{content}</Text>
      </View>
    </View>
  );
}

function AssistantBubble({ content, actions }: { content: string; actions?: Action[] }) {
  return (
    <View style={{ alignItems: 'flex-start', marginVertical: 4, paddingHorizontal: 16 }}>
      <View style={{
        backgroundColor: '#F2F6FB', maxWidth: '75%',
        borderRadius: 20, borderBottomLeftRadius: 4,
        paddingVertical: 12, paddingHorizontal: 16,
      }}>
        <Text style={{ color: brand.dark, fontSize: 15, lineHeight: 21 }}>{content}</Text>
      </View>
      {actions && actions.length > 0 && (
        <View style={{ gap: 4, marginTop: 4 }}>
          {actions.map((a, i) => (
            <View key={i} style={{ backgroundColor: brand.lightBg, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={13} color={brand.blue} />
              <Text style={{ color: brand.blue, fontSize: 13, fontWeight: '500' }}>{a.summary}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="flash-outline" size={36} color="#0EA968" />
      </View>
      <View style={{ alignItems: 'center', marginTop: 20, gap: 6 }}>
        <Text style={{ fontWeight: '800', fontSize: 24, color: brand.dark }}>My SCAI</Text>
        <Text style={{ color: brand.body, fontSize: 14 }}>Your AI Co-Parenting Assistant</Text>
      </View>
      <View style={{ width: '100%', marginTop: 36 }}>
        <Text style={{ color: brand.body, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
          Try asking me to...
        </Text>
        {SUGGESTIONS.map((s, i) => (
          <Pressable key={s.text} onPress={() => onSuggestion(s.text)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 12,
              borderBottomWidth: i < SUGGESTIONS.length - 1 ? 1 : 0,
              borderBottomColor: brand.separator,
              opacity: pressed ? 0.6 : 1,
            })}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={s.icon} size={20} color={brand.blue} />
            </View>
            <Text style={{ color: brand.dark, fontSize: 15, flex: 1 }}>{s.text}</Text>
            <Ionicons name="chevron-forward" size={16} color={brand.body} style={{ opacity: 0.4 }} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

export default function MyScaiTabScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.card }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Header ── */}
      <View style={{
        paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 20,
        backgroundColor: brand.card, borderBottomWidth: 0.5, borderBottomColor: brand.separator,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: brand.dark }}>My SCAI</Text>
          <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>AI Co-Parenting Assistant</Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={() => setMessages([])} hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 8 })}>
            <Ionicons name="create-outline" size={22} color={brand.blue} />
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
          contentContainerStyle={{ paddingVertical: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          style={{ backgroundColor: brand.lightBg }}
        />
      )}

      {/* Typing indicator */}
      {isSending && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 4, backgroundColor: brand.lightBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F2F6FB', alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 }}>
            <ActivityIndicator size="small" color={brand.body} />
            <Text style={{ color: brand.body, fontSize: 14 }}>SCAI is thinking…</Text>
          </View>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={{
        backgroundColor: brand.card, borderTopWidth: 1, borderTopColor: brand.separator,
        paddingHorizontal: 12, paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <TextInput
          style={{
            flex: 1, backgroundColor: '#F2F6FB', borderRadius: 22,
            paddingVertical: 12, paddingHorizontal: 16,
            fontSize: 15, color: brand.dark, maxHeight: 120,
          }}
          placeholder="Ask My SCAI anything..."
          placeholderTextColor={brand.body}
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
            backgroundColor: brand.blue,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed || !input.trim() || isSending ? 0.4 : 1,
          })}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
