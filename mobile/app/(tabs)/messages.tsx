import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors } from '@/theme/colors';
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

async function analyzeTone(text: string): Promise<{ tone: string; rewrite: string | null } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action: 'tone-check', message: text }),
    });
    const data = await res.json();
    return { tone: data.tone, rewrite: data.rewrite ?? null };
  } catch {
    return null;
  }
}

export default function MessagesTabScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [coParentId, setCoParentId] = useState<string | null>(null);
  const [coParentName, setCoParentName] = useState<string | null>(null);
  const [toneWarning, setToneWarning] = useState<ToneWarning | null>(null);
  const pendingTextRef  = useRef<string>('');
  const flatListRef     = useRef<FlatList>(null);
  // Refs hold the resolved IDs so realtime callbacks always have the latest values
  // without relying on stale state closures.
  const userIdRef       = useRef<string | null>(null);
  const coParentIdRef   = useRef<string | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Set refs BEFORE state so loadMessages() and the realtime callback
      // always operate on the resolved IDs without stale-closure issues.
      userIdRef.current = user.id;
      setUserId(user.id);

      const { data: children } = await supabase
        .from('children' as any)
        .select('parent_id, co_parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`)
        .limit(1);

      if (children && children.length > 0) {
        const child = children[0] as any;
        const partnerId = child.parent_id === user.id ? child.co_parent_id : child.parent_id;
        if (partnerId) {
          coParentIdRef.current = partnerId;
          setCoParentId(partnerId);
          const { data: profile } = await supabase
            .from('profiles' as any)
            .select('full_name')
            .eq('id', partnerId)
            .single();
          setCoParentName((profile as any)?.full_name?.split(' ')[0] ?? null);
        }
      }

      await loadMessages();
      channel = supabase
        .channel('messages-realtime-tab')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Only wake up for messages delivered TO this user — prevents reloading
          // on every message between any two users in the database.
          filter: `receiver_id=eq.${user.id}`,
        }, () => loadMessages())
        .subscribe();
    })();
    return () => { channel?.unsubscribe(); };
  }, []);

  const loadMessages = async () => {
    const myId    = userIdRef.current;
    const theirId = coParentIdRef.current;
    // No IDs yet — co-parent hasn't been resolved; don't load anything
    if (!myId || !theirId) return;
    const { data } = await supabase
      .from('messages' as any)
      .select('*, sender:sender_id(full_name)')
      // Scoped to this conversation only — never returns other families' messages
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${theirId}),and(sender_id.eq.${theirId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data as any) || []);
  };

  const doSend = async (text: string) => {
    if (!text.trim() || !coParentId) return;
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
    if (result && (result.tone === 'hostile' || result.tone === 'negative') && result.rewrite) {
      setToneWarning({ message: text, rewrite: result.rewrite });
      return;
    }
    setInput('');
    pendingTextRef.current = '';
    await doSend(text);
  };

  const coInitial = coParentName?.charAt(0).toUpperCase() ?? '?';

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === userId;
    return (
      <View style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start', marginVertical: 3, paddingHorizontal: 16, alignItems: 'flex-end', gap: 8 }}>
        {!isMe && (
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: brand.blue + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: brand.blue }}>{coInitial}</Text>
          </View>
        )}
        {isMe ? (
          <View style={{ maxWidth: '75%', backgroundColor: brand.blue, borderRadius: 20, borderBottomRightRadius: 4, padding: 12 }}>
            <Text style={{ fontSize: 15, color: '#fff', lineHeight: 21 }}>{item.content}</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4, textAlign: 'right' }}>
              {new Date(item.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ) : (
          <View style={{ maxWidth: '75%', backgroundColor: colors.surface, borderRadius: 20, borderBottomLeftRadius: 4, padding: 12, borderWidth: 0.5, borderColor: colors.separator }}>
            {item.sender?.full_name && (
              <Text style={{ fontSize: 11, fontWeight: '700', color: brand.blue, marginBottom: 4 }}>{item.sender.full_name}</Text>
            )}
            <Text style={{ fontSize: 15, color: colors.label, lineHeight: 21 }}>{item.content}</Text>
            <Text style={{ fontSize: 11, color: colors.secondaryLabel, marginTop: 4, textAlign: 'right' }}>
              {new Date(item.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {coParentName ? (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: brand.blue + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: brand.blue + '30' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: brand.blue }}>{coInitial}</Text>
            </View>
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.separator, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.secondaryLabel} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.label, letterSpacing: -0.3 }}>
              {coParentName ? coParentName : 'Messages'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' }} />
              <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
                {coParentName ? 'Co-parent' : 'No co-parent linked yet'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable
              hitSlop={10}
              onPress={() => Alert.alert(
                'Phone call',
                `Open your Contacts or Phone app to call ${coParentName ?? 'your co-parent'} directly.`,
                [
                  { text: 'Open Phone', onPress: () => Linking.openURL('tel:') },
                  { text: 'Cancel', style: 'cancel' },
                ],
              )}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 8, borderRadius: 10, backgroundColor: brand.blue + '12' })}
            >
              <Ionicons name="call-outline" size={20} color={brand.blue} />
            </Pressable>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: 14, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          style={{ backgroundColor: colors.background }}
          ListEmptyComponent={() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name="chatbubbles-outline" size={30} color={brand.blue} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label, textAlign: 'center' }}>
                {coParentId ? 'No messages yet' : 'No co-parent linked'}
              </Text>
              <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 21 }}>
                {coParentId
                  ? 'Send the first message below'
                  : 'Link a co-parent in Family settings to start messaging'}
              </Text>
            </View>
          )}
        />

        {/* Tone warning */}
        {toneWarning && (
          <View style={{ backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 16, gap: 10, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="warning-outline" size={15} color="#F59E0B" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B' }}>Tone Check — This seems heated</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, fontStyle: 'italic', lineHeight: 21, paddingLeft: 4 }}>
              "{toneWarning.rewrite}"
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => { if (toneWarning?.rewrite) setInput(toneWarning.rewrite); setToneWarning(null); }}
                style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: brand.blue, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Use Suggestion</Text>
              </Pressable>
              <Pressable onPress={async () => { const t = pendingTextRef.current || toneWarning?.message || input; setToneWarning(null); setInput(''); pendingTextRef.current = ''; await doSend(t); }}
                style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel }}>Send Anyway</Text>
              </Pressable>
              <Pressable onPress={() => setToneWarning(null)}
                style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 22, opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', padding: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          gap: 8, backgroundColor: colors.surface,
          borderTopWidth: 0.5, borderTopColor: colors.separator,
        }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: colors.background, borderRadius: 22,
              paddingHorizontal: 16, paddingVertical: 11,
              fontSize: 15, color: colors.label, maxHeight: 100,
              borderWidth: 0.5, borderColor: colors.separator,
            }}
            placeholder="Type a message…"
            placeholderTextColor={colors.secondaryLabel}
            multiline
            value={input}
            onChangeText={setInput}
            editable={!isAnalyzing && !isSending}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || isAnalyzing || isSending || !coParentId}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: input.trim() && !isAnalyzing && !isSending ? brand.blue : colors.separator,
              transform: [{ scale: pressed ? 0.9 : 1 }],
            })}
          >
            {isAnalyzing || isSending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color="#fff" />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
