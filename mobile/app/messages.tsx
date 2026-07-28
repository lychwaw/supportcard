import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router/stack';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: { full_name: string | null } | null;
};

type ToneWarning = {
  message: string;
  rewrite: string | null;
};

async function analyzeTone(
  text: string
): Promise<{ tone: string; rewrite: string | null } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ action: 'tone-check', message: text }),
      }
    );
    const data = await res.json();
    return { tone: data.tone, rewrite: data.rewrite ?? null };
  } catch {
    return null;
  }
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [coParentId, setCoParentId] = useState<string | null>(null);
  const [toneWarning, setToneWarning] = useState<ToneWarning | null>(null);
  const pendingTextRef = useRef<string>('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Find co-parent: look for a child where the current user is parent or co-parent
      const { data: children } = await supabase
        .from('children' as any)
        .select('parent_id, co_parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`)
        .limit(1);

      if (children && children.length > 0) {
        const child = children[0] as any;
        const partner = child.parent_id === user.id ? child.co_parent_id : child.parent_id;
        if (partner) setCoParentId(partner);
      }

      await loadMessages();

      channel = supabase
        .channel('messages-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadMessages())
        .subscribe();
    })();

    return () => { channel?.unsubscribe(); };
  }, []);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages' as any)
      .select('*, sender:sender_id(full_name)')
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data as any) || []);
  };

  const doSend = async (text: string) => {
    if (!text.trim()) return;
    if (!coParentId) return;
    setIsSending(true);
    setToneWarning(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('messages' as any).insert({
        content: text.trim(),
        sender_id: user.id,
        receiver_id: coParentId,
      });
    }
    setIsSending(false);
    loadMessages();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    setIsAnalyzing(true);
    pendingTextRef.current = text;

    const result = await analyzeTone(text);
    setIsAnalyzing(false);

    if (
      result &&
      (result.tone === 'hostile' || result.tone === 'negative') &&
      result.rewrite
    ) {
      setToneWarning({ message: text, rewrite: result.rewrite });
      // Don't clear input yet — user may want to edit
      return;
    }

    // Tone is fine — send
    setInput('');
    pendingTextRef.current = '';
    await doSend(text);
  };

  const handleUseSuggestion = () => {
    if (toneWarning?.rewrite) {
      setInput(toneWarning.rewrite);
    }
    setToneWarning(null);
  };

  const handleSendAnyway = async () => {
    const text = pendingTextRef.current || toneWarning?.message || input;
    setToneWarning(null);
    setInput('');
    pendingTextRef.current = '';
    await doSend(text);
  };

  const handleCancelWarning = () => {
    setToneWarning(null);
    // Leave input as-is so user can edit
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === userId;
    return (
      <View style={{
        flexDirection: 'row',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        marginVertical: 4,
        paddingHorizontal: 16,
      }}>
        <View style={{
          maxWidth: '75%',
          backgroundColor: isMe ? brand.blue : '#F2F6FB',
          borderRadius: 18,
          borderBottomRightRadius: isMe ? 4 : 18,
          borderBottomLeftRadius: isMe ? 18 : 4,
          padding: 12,
        }}>
          {!isMe && item.sender?.full_name && (
            <Text style={{
              fontSize: 11,
              fontWeight: '600',
              color: brand.blue,
              marginBottom: 4,
            }}>
              {item.sender.full_name}
            </Text>
          )}
          <Text style={{
            fontSize: 15,
            color: isMe ? '#fff' : brand.dark,
            lineHeight: 21,
          }}>
            {item.content}
          </Text>
          <Text style={{
            fontSize: 11,
            color: isMe ? 'rgba(255,255,255,0.7)' : brand.body,
            marginTop: 4,
            textAlign: 'right',
          }}>
            {new Date(item.created_at).toLocaleTimeString('en-ZA', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Custom header matching reference ── */}
      <View style={{
        paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16,
        backgroundColor: brand.card, borderBottomWidth: 0.5, borderBottomColor: brand.separator,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/')}
          hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Ionicons name="chevron-back" size={28} color={brand.dark} />
        </Pressable>
        {/* Avatar */}
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person" size={20} color="#fff" />
        </View>
        {/* Name + online status */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark }}>Co-Parent</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />
            <Text style={{ fontSize: 12, color: brand.body }}>Online</Text>
          </View>
        </View>
        {/* Actions */}
        <Pressable hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 6 })}>
          <Ionicons name="call-outline" size={22} color={brand.dark} />
        </Pressable>
        <Pressable hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 6 })}>
          <Ionicons name="videocam-outline" size={22} color={brand.dark} />
        </Pressable>
        <Pressable hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 6 })}>
          <Ionicons name="ellipsis-horizontal" size={22} color={brand.dark} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: 12 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={() => (
            <View style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 80,
              paddingHorizontal: 32,
            }}>
              <Ionicons name="chatbubbles-outline" size={48} color={brand.body} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark, textAlign: 'center' }}>
                {coParentId ? 'No messages yet' : 'No co-parent linked yet'}
              </Text>
              <Text style={{ fontSize: 14, color: brand.body, marginTop: 4, textAlign: 'center' }}>
                {coParentId
                  ? 'Start the conversation'
                  : 'Add a child and link a co-parent in the Family tab to enable messaging'}
              </Text>
            </View>
          )}
        />

        {/* Tone warning card — floats above input bar */}
        {toneWarning && (
          <View style={{
            backgroundColor: brand.card,
            borderLeftWidth: 4,
            borderLeftColor: '#F59E0B',
            padding: 16,
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: brand.separator,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B' }}>Tone Check</Text>
            </View>
            <Text style={{ fontSize: 14, color: brand.body, fontStyle: 'italic', lineHeight: 20 }}>
              This message seems heated. Consider rephrasing:{'\n'}
              "{toneWarning.rewrite}"
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={handleUseSuggestion}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: brand.blue,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.blue }}>
                  Use Suggestion
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSendAnyway}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body }}>
                  Send Anyway
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCancelWarning}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
              >
                <Text style={{ fontSize: 13, color: brand.body }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          padding: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          gap: 8,
          backgroundColor: brand.card,
          borderTopWidth: 1,
          borderTopColor: brand.separator,
        }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#F2F6FB',
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: brand.dark,
              maxHeight: 100,
            }}
            placeholder="Type a message..."
            placeholderTextColor={brand.body}
            multiline
            value={input}
            onChangeText={setInput}
            editable={!isAnalyzing && !isSending}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || isAnalyzing || isSending || !coParentId}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor:
                input.trim() && !isAnalyzing && !isSending
                  ? brand.blue
                  : brand.separator,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isAnalyzing || isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
