import { useState, useRef, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const brand = {
  lightBg: '#EBF4FF',
  blue: '#2B74D6',
  card: '#FFFFFF',
  dark: '#0D1C2E',
  body: '#6B7A8D',
  separator: '#E4ECF5',
  userBubble: '#2B74D6',
  aiBubble: '#F2F6FB',
};

interface Action {
  summary: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
}

const SUGGESTIONS: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = [
  { icon: 'calendar-outline',   text: 'Schedule a pickup' },
  { icon: 'cash-outline',       text: 'Request funds' },
  { icon: 'school-outline',     text: 'Add school event' },
  { icon: 'camera-outline',     text: 'Upload a receipt' },
  { icon: 'stats-chart-outline', text: 'Generate a report' },
];

function ActionChip({ summary }: { summary: string }) {
  return (
    <View
      style={{
        backgroundColor: brand.lightBg,
        borderRadius: 20,
        paddingVertical: 4,
        paddingHorizontal: 10,
        alignSelf: 'flex-start',
        marginTop: 4,
      }}
    >
      <Text style={{ color: brand.blue, fontSize: 13, fontWeight: '500' }}>✓ {summary}</Text>
    </View>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <View style={{ alignItems: 'flex-end', marginVertical: 4, paddingHorizontal: 16 }}>
      <View
        style={{
          backgroundColor: brand.userBubble,
          maxWidth: '75%',
          borderRadius: 20,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 4,
          borderBottomLeftRadius: 20,
          paddingVertical: 12,
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>{content}</Text>
      </View>
    </View>
  );
}

function AssistantBubble({ content, actions }: { content: string; actions?: Action[] }) {
  return (
    <View style={{ alignItems: 'flex-start', marginVertical: 4, paddingHorizontal: 16 }}>
      <View
        style={{
          backgroundColor: brand.aiBubble,
          maxWidth: '75%',
          borderRadius: 20,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          borderBottomLeftRadius: 4,
          paddingVertical: 12,
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ color: brand.dark, fontSize: 15, lineHeight: 21 }}>{content}</Text>
      </View>
      {actions && actions.length > 0 && (
        <View style={{ gap: 4, marginTop: 4, paddingHorizontal: 0 }}>
          {actions.map((action, i) => (
            <ActionChip key={i} summary={action.summary} />
          ))}
        </View>
      )}
    </View>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 24,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: brand.lightBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="flash-outline" size={40} color="#0EA968" />
      </View>

      <View style={{ gap: 6, alignItems: 'center', marginTop: 20 }}>
        <Text style={{ fontWeight: '700', fontSize: 20, color: brand.dark }}>My SCAI</Text>
        <Text style={{ color: brand.body, fontSize: 14 }}>Your AI Co-Parenting Assistant</Text>
      </View>

      <View style={{ width: '100%', marginTop: 32 }}>
        <Text
          style={{
            color: brand.body,
            fontWeight: '700',
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          Try asking me to...
        </Text>
        {SUGGESTIONS.map((s, i) => (
          <Pressable
            key={s.text}
            onPress={() => onSuggestion(s.text)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: i < SUGGESTIONS.length - 1 ? 1 : 0,
              borderBottomColor: brand.separator,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={s.icon} size={18} color={brand.blue} />
            </View>
            <Text style={{ color: brand.dark, fontSize: 15, flex: 1 }}>{s.text}</Text>
            <Ionicons name="chevron-forward" size={16} color={brand.body} style={{ opacity: 0.5 }} />
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${apiBase}/api/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'scai-chat', messages: allMessages }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply ?? 'Sorry, I could not process that.',
        actions: data.actions ?? [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  }, [isSending, messages]);

  const handleSuggestion = useCallback((text: string) => {
    setInput(text);
  }, []);

  const renderItem = useCallback(({ item }: { item: Message }) => {
    if (item.role === 'user') {
      return <UserBubble content={item.content} />;
    }
    return <AssistantBubble content={item.content} actions={item.actions} />;
  }, []);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.card }} behavior="padding">
      {/* Custom Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: brand.card,
          borderBottomWidth: 1,
          borderBottomColor: brand.separator,
        }}
      >
        <View
          style={{
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
          >
            <Text style={{ color: brand.blue, fontSize: 22, fontWeight: '300' }}>←</Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: brand.dark }}>My SCAI</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Ionicons name="notifications-outline" size={22} color={brand.dark} />
            </Pressable>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: brand.blue, fontSize: 24, fontWeight: '300' }}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Chat Area */}
      {messages.length === 0 ? (
        <EmptyState onSuggestion={handleSuggestion} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingVertical: 12 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
      )}

      {/* Typing indicator */}
      {isSending && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: brand.aiBubble,
              alignSelf: 'flex-start',
              borderRadius: 20,
              paddingVertical: 10,
              paddingHorizontal: 16,
            }}
          >
            <ActivityIndicator size="small" color={brand.body} />
            <Text style={{ color: brand.body, fontSize: 14 }}>SCAI is thinking…</Text>
          </View>
        </View>
      )}

      {/* Bottom Input Bar */}
      <View
        style={{
          backgroundColor: brand.card,
          borderTopWidth: 1,
          borderTopColor: brand.separator,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TextInput
          style={{
            flex: 1,
            backgroundColor: brand.aiBubble,
            borderRadius: 22,
            paddingVertical: 12,
            paddingHorizontal: 16,
            fontSize: 15,
            color: brand.dark,
            maxHeight: 120,
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
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: brand.blue,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed || !input.trim() || isSending ? 0.5 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>▶</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
