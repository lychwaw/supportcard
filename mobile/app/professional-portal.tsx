import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Alert, ActivityIndicator, Modal, Share, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/use-permissions';
import { useCurrency } from '@/hooks/use-currency';
import { convertAmount, CURRENCY_SYMBOL, type Currency } from '@/lib/currency';

type ProfessionalLink = {
  id: string;
  status: string;
  parent_id?: string;
  notes?: string | null;
  parent?: { full_name: string | null; email: string | null } | null;
};


export default function ProfessionalPortalScreen() {
  const insets = useSafeAreaInsets();
  const { permissions, loading: permLoading } = usePermissions();
  const { currency } = useCurrency();
  const sym = CURRENCY_SYMBOL[currency];
  const [links, setLinks] = useState<ProfessionalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRecordsLink, setViewRecordsLink] = useState<ProfessionalLink | null>(null);
  const [recordsData, setRecordsData] = useState<{ expenses: any[]; events: any[]; docs: any[] } | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: linkData } = await supabase
      .from('professional_links' as any)
      .select('*')
      .eq('professional_id', user.id)
      .eq('status', 'active');
    const links = (linkData as any[] | null) ?? [];
    const parentIds = links.map((l: any) => l.parent_id).filter(Boolean);
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (parentIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles' as any)
        .select('id, full_name, email')
        .in('id', parentIds);
      for (const p of (profiles as any[]) ?? []) {
        profileMap[p.id] = { full_name: p.full_name, email: p.email };
      }
    }
    const enriched = links.map((l: any) => ({ ...l, parent: profileMap[l.parent_id] ?? null }));
    setLinks(enriched);
    setNotesDraft(prev => {
      const next: Record<string, string> = { ...prev };
      for (const l of enriched) if (!(l.id in next)) next[l.id] = l.notes ?? '';
      return next;
    });
    setLoading(false);
  }, []);

  const handleClaim = useCallback(async () => {
    const token = claimToken.trim().toUpperCase();
    if (!token) { setClaimError('Enter the invite code.'); return; }
    setClaiming(true); setClaimError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setClaimError('Sign in required.'); return; }
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';
      const res = await fetch(`${apiBase}/api/professional-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'claim', token }),
      });
      const data = await res.json();
      if (!res.ok) { setClaimError(data.error ?? 'Could not claim invite.'); return; }
      setClaimSuccess(true);
      loadLinks();
    } catch { setClaimError('Something went wrong. Please try again.'); }
    finally { setClaiming(false); }
  }, [claimToken, loadLinks]);

  const saveNotes = useCallback(async (linkId: string) => {
    setSavingNotesId(linkId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://supportcard-prod.vercel.app';
      await fetch(`${apiBase}/api/professional-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'update_notes', link_id: linkId, notes: notesDraft[linkId] ?? '' }),
      });
    } catch {}
    setSavingNotesId(null);
  }, [notesDraft]);

  const openRecords = useCallback(async (link: ProfessionalLink) => {
    setViewRecordsLink(link);
    setRecordsData(null);
    setRecordsLoading(true);
    try {
      const parentId = link.parent_id ?? (link as any).id;
      const [expRes, evRes, docRes] = await Promise.all([
        supabase.from('expense_requests' as any).select('id,category,amount,currency,status,created_at').eq('requester_id', parentId).order('created_at', { ascending: false }).limit(20),
        supabase.from('calendar_events' as any).select('id,event_type,event_date,notes').eq('user_id' as any, parentId).order('event_date' as any, { ascending: false }).limit(20),
        supabase.from('legal_documents' as any).select('id,document_type,file_name,created_at').eq('user_id' as any, parentId).order('created_at', { ascending: false }).limit(20),
      ]);
      setRecordsData({ expenses: (expRes.data as any[]) ?? [], events: (evRes.data as any[]) ?? [], docs: (docRes.data as any[]) ?? [] });
    } catch {
      setRecordsData({ expenses: [], events: [], docs: [] });
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const generateBulkReport = useCallback(async () => {
    const lines: string[] = ['SupportCard Co-Parenting Report', `Generated: ${new Date().toLocaleDateString('en-ZA')}`, ''];
    for (const link of links) {
      lines.push(`Family: ${link.parent?.full_name ?? 'Parent'} (${link.parent?.email ?? ''})`, '');
    }
    const parentIds = links.map(l => l.parent_id).filter(Boolean);
    const { data: expenses } = await supabase.from('expense_requests' as any).select('category,amount,currency,status,created_at').in('requester_id' as any, parentIds).order('created_at', { ascending: false }).limit(50);
    const { data: events } = await supabase.from('calendar_events' as any).select('event_type,event_date').in('user_id' as any, parentIds).order('event_date' as any, { ascending: false }).limit(50);
    if (expenses?.length) {
      lines.push('--- EXPENSE RECORDS ---');
      for (const e of expenses as any[]) {
        lines.push(`${(e.created_at as string).slice(0, 10)}  ${e.category}  ${sym}${convertAmount(Number(e.amount), (e.currency as Currency) ?? 'ZAR', currency).toFixed(2)}  [${e.status}]`);
      }
      lines.push('');
    }
    if (events?.length) {
      lines.push('--- CALENDAR EVENTS ---');
      for (const ev of events as any[]) {
        lines.push(`${ev.event_date}  ${ev.event_type}`);
      }
    }
    try {
      await Share.share({ message: lines.join('\n'), title: 'SupportCard Bulk Report' });
    } catch {
      Alert.alert('Could not share', 'Share was cancelled or unavailable.');
    }
  }, [links]);

  useEffect(() => {
    if (permLoading) return;
    if (!permissions.canAccessProfessionalPortal) { setLoading(false); return; }
    loadLinks();
  }, [permLoading, permissions.canAccessProfessionalPortal, loadLinks]);

  if (permLoading || loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Professional Portal', headerTintColor: brand.blue }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={brand.blue} />
        </View>
      </>
    );
  }

  if (!permissions.canAccessProfessionalPortal) {
    return (
      <>
        <Stack.Screen options={{ title: 'Professional Portal', headerTintColor: brand.blue }} />
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderCurve: 'continuous', padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator, maxWidth: 320 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderCurve: 'continuous' }}>
              <Ionicons name="shield-checkmark-outline" size={32} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.label, textAlign: 'center', marginBottom: 10 }}>
              Professional Access Required
            </Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 21 }}>
              This view is only available to verified professionals linked by a parent family.
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Professional Portal', headerTintColor: brand.blue }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Math.max(insets.bottom, 24) }}
        showsVerticalScrollIndicator={false}>

        {/* Claim invite banner */}
        {links.length === 0 && (
          <Pressable onPress={() => { setClaimToken(''); setClaimError(''); setClaimSuccess(false); setShowClaimModal(true); }}
            style={({ pressed }) => ({ backgroundColor: '#8B5CF6' + '14', borderRadius: 16, borderCurve: 'continuous', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: '#8B5CF6' + '30', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#8B5CF6' + '20', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="key-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.label }}>Claim an invite</Text>
              <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 2 }}>Enter the code a parent shared with you</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.secondaryLabel} style={{ opacity: 0.4 }} />
          </Pressable>
        )}

        {links.length > 0 && (
          <Pressable onPress={() => { setClaimToken(''); setClaimError(''); setClaimSuccess(false); setShowClaimModal(true); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name="add-circle-outline" size={16} color={brand.blue} />
            <Text style={{ fontSize: 13, color: brand.blue, fontWeight: '600' }}>Claim another invite</Text>
          </Pressable>
        )}

        {/* Identity card */}
        <View style={{ backgroundColor: brand.blue + '10', borderRadius: 18, borderCurve: 'continuous', padding: 18, borderLeftWidth: 3, borderLeftColor: brand.blue, borderWidth: 0.5, borderColor: brand.blue + '25', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="scale-outline" size={24} color={brand.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: brand.blue }}>Professional View</Text>
              <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 2 }}>Read-only access</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            You have read-only access to the families that have invited you.
          </Text>
        </View>

        {/* Linked Families */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel }}>
          Linked Families
        </Text>

        {links.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 32, alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderCurve: 'continuous' }}>
              <Ionicons name="people-outline" size={28} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>No linked families</Text>
            <Text style={{ fontSize: 13, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 20 }}>
              A parent must invite you from their SupportCard app before you can view their records.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {links.map(link => {
              const initial = (link.parent?.full_name || link.parent?.email || '?')[0].toUpperCase();
              return (
                <View key={link.id} style={{ backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', padding: 16, borderWidth: 0.5, borderColor: colors.separator }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontWeight: '700', fontSize: 20, color: brand.blue }}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>{link.parent?.full_name ?? 'Parent'}</Text>
                      {link.parent?.email ? <Text selectable style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>{link.parent.email}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <View style={{ backgroundColor: '#22C55E18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                        <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '700' }}>Active</Text>
                      </View>
                      <Pressable onPress={() => openRecords(link)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                        <Text style={{ color: brand.blue, fontSize: 13, fontWeight: '600' }}>View Records</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={{ height: 0.5, backgroundColor: colors.separator }} />
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>YOUR NOTES</Text>
                    <TextInput
                      style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, fontSize: 14, color: colors.label, borderWidth: 0.5, borderColor: colors.separator, minHeight: 72, textAlignVertical: 'top', borderCurve: 'continuous' }}
                      placeholder="Add observations, recommendations, or case notes…"
                      placeholderTextColor={colors.secondaryLabel}
                      multiline
                      value={notesDraft[link.id] ?? ''}
                      onChangeText={v => setNotesDraft(prev => ({ ...prev, [link.id]: v }))}
                    />
                    <Pressable onPress={() => saveNotes(link.id)} disabled={savingNotesId === link.id}
                      style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 10, paddingVertical: 10, alignItems: 'center', opacity: pressed || savingNotesId === link.id ? 0.7 : 1 })}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{savingNotesId === link.id ? 'Saving…' : 'Save Notes'}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}


        {/* Note */}
        <View style={{ backgroundColor: brand.blue + '08', borderRadius: 14, borderCurve: 'continuous', padding: 14, borderLeftWidth: 3, borderLeftColor: brand.blue, borderWidth: 0.5, borderColor: brand.blue + '20' }}>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            All access is read-only. You cannot modify, approve or dispute any records.
          </Text>
        </View>

        {links.length > 0 && (
          <Pressable onPress={generateBulkReport}
            style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 16, borderCurve: 'continuous', padding: 16, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }], boxShadow: '0 4px 12px rgba(43,116,214,0.25)' })}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Generate Bulk Report</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={!!viewRecordsLink} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setViewRecordsLink(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setViewRecordsLink(null)}><Text style={{ color: brand.blue, fontSize: 16 }}>Close</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>
              {viewRecordsLink?.parent?.full_name ?? 'Family Records'}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {recordsLoading ? (
              <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator size="large" color={brand.blue} /></View>
            ) : recordsData ? (
              <>
                {/* Expenses */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Expense Records</Text>
                {recordsData.expenses.length === 0 ? (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 18, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
                    <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>No expense records</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 0.5, borderColor: colors.separator }}>
                    {recordsData.expenses.map((e, i) => (
                      <View key={e.id}>
                        {i > 0 && <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: 16 }} />}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
                          <Ionicons name="receipt-outline" size={16} color="#F59E0B" />
                          <Text style={{ flex: 1, fontSize: 14, color: colors.label }}>{e.category}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.label, fontVariant: ['tabular-nums'] }}>{sym}{convertAmount(Number(e.amount), (e.currency as Currency) ?? 'ZAR', currency).toFixed(2)}</Text>
                          <View style={{ backgroundColor: e.status === 'approved' ? '#22C55E18' : e.status === 'rejected' ? '#EF444418' : '#F59E0B18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: e.status === 'approved' ? '#22C55E' : e.status === 'rejected' ? '#EF4444' : '#F59E0B' }}>{e.status}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Calendar events */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Calendar & Handoffs</Text>
                {recordsData.events.length === 0 ? (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 18, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
                    <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>No events</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 0.5, borderColor: colors.separator }}>
                    {recordsData.events.map((ev, i) => (
                      <View key={ev.id}>
                        {i > 0 && <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: 16 }} />}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
                          <Ionicons name="calendar-outline" size={16} color={brand.blue} />
                          <Text style={{ flex: 1, fontSize: 14, color: colors.label }}>{ev.event_type}</Text>
                          <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{ev.event_date}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Documents */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Documents</Text>
                {recordsData.docs.length === 0 ? (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 18, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
                    <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>No documents</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 0.5, borderColor: colors.separator }}>
                    {recordsData.docs.map((doc, i) => (
                      <View key={doc.id}>
                        {i > 0 && <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: 16 }} />}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
                          <Ionicons name="document-outline" size={16} color="#8B5CF6" />
                          <Text style={{ flex: 1, fontSize: 14, color: colors.label }}>{doc.file_name}</Text>
                          <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{(doc.created_at as string).slice(0, 10)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* Claim invite modal */}
      <Modal visible={showClaimModal} animationType="slide" presentationStyle="formSheet"
        onRequestClose={() => setShowClaimModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setShowClaimModal(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Close</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Claim Invite</Text>
            <View style={{ width: 48 }} />
          </View>
          <View style={{ padding: 24, gap: 20 }}>
            {!claimSuccess ? (
              <>
                <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
                  Enter the 8-character code the parent shared with you to link to their family records.
                </Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: claimError ? brand.error : colors.separator, padding: 16, fontSize: 28, fontWeight: '700', color: colors.label, borderCurve: 'continuous', letterSpacing: 6, textAlign: 'center' }}
                  placeholder="ABCD1234"
                  placeholderTextColor={colors.secondaryLabel}
                  value={claimToken}
                  onChangeText={v => { setClaimToken(v.toUpperCase().replace(/\s/g, '')); setClaimError(''); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  returnKeyType="done"
                  onSubmitEditing={handleClaim}
                  autoFocus
                />
                {!!claimError && <Text style={{ fontSize: 13, color: brand.error, textAlign: 'center' }}>{claimError}</Text>}
                <Pressable onPress={handleClaim} disabled={claiming || claimToken.length < 6}
                  style={({ pressed }) => ({ backgroundColor: claiming || claimToken.length < 6 ? colors.separator : '#8B5CF6', borderRadius: 14, paddingVertical: 15, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{claiming ? 'Linking…' : 'Link to Family'}</Text>
                </Pressable>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 16, paddingVertical: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: brand.teal + '20', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="checkmark-circle" size={36} color={brand.teal} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.label, textAlign: 'center' }}>You're linked!</Text>
                <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 20 }}>
                  The family's records are now visible in your portal.
                </Text>
                <Pressable onPress={() => setShowClaimModal(false)}
                  style={({ pressed }) => ({ backgroundColor: brand.teal, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Done</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
