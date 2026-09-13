import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { brand, colors } from '@/theme/colors';
import { openExternalUrl } from '@/lib/open-link';
import { pressScale } from '@/lib/press';
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

type Partner = { id: string; firstName: string };

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
  // Everyone on the other side of the user's children. A parent with children
  // from two relationships has two co-parents, and each is a separate
  // conversation. This used to read only the first child and made the second
  // co-parent unreachable.
  const [partners, setPartners] = useState<Partner[]>([]);
  const [coParentId, setCoParentId] = useState<string | null>(null);
  const [unreadFrom, setUnreadFrom] = useState<Set<string>>(new Set());
  const [toneWarning, setToneWarning] = useState<ToneWarning | null>(null);
  const [ready, setReady] = useState(false);
  const pendingTextRef  = useRef<string>('');
  const flatListRef     = useRef<FlatList>(null);
  // Refs hold the resolved IDs so realtime callbacks always have the latest values
  // without relying on stale state closures.
  const userIdRef       = useRef<string | null>(null);
  const coParentIdRef   = useRef<string | null>(null);

  const coParentName = partners.find(p => p.id === coParentId)?.firstName ?? null;

  const selectPartner = (id: string | null) => {
    coParentIdRef.current = id;
    setCoParentId(id);
    if (id) setUnreadFrom(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  // Resolve every co-parent, keeping the current conversation open if that person
  // is still linked. Returns true when the open conversation changed.
  const resolvePartners = async (myId: string): Promise<boolean> => {
    const { data: kids } = await supabase
      .from('children' as any)
      .select('parent_id, co_parent_id')
      .or(`parent_id.eq.${myId},co_parent_id.eq.${myId}`);
    const ids = Array.from(new Set(
      ((kids as any[]) ?? [])
        .map(k => (k.parent_id === myId ? k.co_parent_id : k.parent_id))
        .filter((id): id is string => !!id && id !== myId),
    ));

    let list: Partner[] = [];
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles' as any)
        .select('id, full_name')
        .in('id', ids);
      const names = new Map(((profiles as any[]) ?? []).map(p => [p.id, p.full_name as string | null]));
      list = ids.map(id => ({ id, firstName: names.get(id)?.split(' ')[0] || 'Co-parent' }));
    }
    setPartners(list);

    const current = coParentIdRef.current;
    const next = current && ids.includes(current) ? current : (ids[0] ?? null);
    if (next === current) return false;
    selectPartner(next);
    return true;
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Set refs BEFORE state so loadMessages() and the realtime callback
      // always operate on the resolved IDs without stale-closure issues.
      userIdRef.current = user.id;
      setUserId(user.id);

      await resolvePartners(user.id);
      await loadMessages();
      setReady(true);
      channel = supabase
        .channel('messages-realtime-tab')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Only wake up for messages delivered TO this user, not every message
          // between any two users in the database.
          filter: `receiver_id=eq.${user.id}`,
        }, (payload: any) => {
          const from = payload?.new?.sender_id as string | undefined;
          // A message from someone other than the open conversation marks them
          // unread on the switcher rather than silently vanishing.
          if (from && from !== coParentIdRef.current) {
            setUnreadFrom(prev => new Set(prev).add(from));
            return;
          }
          loadMessages();
        })
        .subscribe();
    })();
    return () => { channel?.unsubscribe(); };
  }, []);

  // Clear unread badge whenever Messages comes into focus.
  useFocusEffect(useCallback(() => {
    const path = (FileSystem.documentDirectory ?? '') + 'msgs_last_read.json';
    FileSystem.writeAsStringAsync(path, JSON.stringify({ ts: new Date().toISOString() })).catch(() => {});
  }, []));

  // Re-check co-parents every time the Messages tab comes into focus, which
  // covers someone being linked on the Family screen while this tab was mounted.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const myId = userIdRef.current;
        if (!myId) return; // Still loading auth; the mount effect handles it
        const changed = await resolvePartners(myId);
        if (changed) {
          setMessages([]);
          await loadMessages();
        }
      })();
    }, [])
  );

  const loadMessages = async () => {
    const myId    = userIdRef.current;
    const theirId = coParentIdRef.current;
    if (!myId || !theirId) { setMessages([]); return; }
    const { data } = await supabase
      .from('messages' as any)
      .select('*, sender:sender_id(full_name)')
      // Scoped to this conversation only, never another family's messages
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${theirId}),and(sender_id.eq.${theirId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true })
      .limit(100);
    // Switching conversations while this was loading means the result belongs to
    // the previous person. Showing it would put their thread under the new name.
    if (coParentIdRef.current !== theirId) return;
    setMessages((data as any) || []);
  };

  const switchTo = (id: string) => {
    if (id === coParentIdRef.current) return;
    selectPartner(id);
    setToneWarning(null);
    setMessages([]);
    loadMessages();
  };

  const doSend = async (text: string) => {
    // The ref, not state: the message must go to whoever is open right now.
    const recipientId = coParentIdRef.current;
    if (!text.trim() || !recipientId) return;
    setIsSending(true);
    setToneWarning(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('messages' as any).insert({
        content: text.trim(),
        sender_id: user.id,
        receiver_id: recipientId,
      });

      // Push notification to co-parent when app is backgrounded (best-effort).
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles' as any)
          .select('full_name')
          .eq('id', user.id)
          .single();
        const senderName = (profile as any)?.full_name?.split(' ')[0] ?? 'Co-parent';
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/apns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            action: 'notify-message',
            recipient_id: recipientId,
            sender_name: senderName,
            message_preview: text.trim().slice(0, 100),
          }),
        }).catch(() => {});
      }
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
                  { text: 'Open Phone', onPress: () => openExternalUrl('tel:', 'phone dialler') },
                  { text: 'Cancel', style: 'cancel' },
                ],
              )}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 8, borderRadius: 10, backgroundColor: brand.blue + '12' })}
            >
              <Ionicons name="call-outline" size={20} color={brand.blue} />
            </Pressable>
          </View>
        </View>

        {/* One conversation per co-parent. Hidden for the usual single co-parent. */}
        {partners.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 14, marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {partners.map(p => {
              const active = p.id === coParentId;
              const unread = !active && unreadFrom.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => switchTo(p.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Conversation with ${p.firstName}${unread ? ', new messages' : ''}`}
                  style={pressScale({
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingVertical: 7, paddingLeft: 7, paddingRight: 14,
                    borderRadius: 20, borderCurve: 'continuous',
                    backgroundColor: active ? brand.blue : colors.background,
                    borderWidth: 0.5, borderColor: active ? brand.blue : colors.separator,
                  })}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(255,255,255,0.22)' : brand.blue + '18' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : brand.blue }}>
                      {p.firstName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#fff' : colors.label }}>{p.firstName}</Text>
                  {unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brand.error }} />}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
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
          ListEmptyComponent={() => ready ? (
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
          ) : null}
        />

        {/* Tone warning */}
        {toneWarning && (
          <View style={{ backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 16, gap: 10, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="warning-outline" size={15} color="#F59E0B" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B' }}>Tone Check: this seems heated</Text>
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
