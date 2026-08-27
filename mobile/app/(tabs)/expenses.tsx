import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { scanReceiptFromCamera, scanReceiptFromLibrary } from '@/lib/receipt-scanner';

const CATEGORIES = ['School', 'Food', 'Clothing', 'Activities', 'Healthcare', 'Transportation', 'Other'];
const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  School: 'school-outline', Food: 'restaurant-outline', Clothing: 'shirt-outline',
  Activities: 'football-outline', Healthcare: 'medkit-outline',
  Transportation: 'car-outline', Other: 'cube-outline',
};
const CATEGORY_COLOR: Record<string, string> = {
  School: brand.blue, Food: '#F59E0B', Clothing: '#8B5CF6',
  Activities: '#22C55E', Healthcare: '#EF4444',
  Transportation: brand.teal, Other: brand.body,
};

type MainTab = 'Pending' | 'Categories';
type Direction = 'To Approve' | 'My Requests';

type ExpenseRequest = {
  id: string; amount: number; category: string; description: string | null;
  status: string; created_at: string; created_via?: string; requester_id: string;
  child?: { name: string } | null;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();
  const sym = currency === 'USD' ? '$' : 'R';
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('School');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('Pending');
  const [direction, setDirection] = useState<Direction>('To Approve');
  const [myChildren, setMyChildren] = useState<{ id: string; name: string }[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      // Fetch this user's children so we can attach child_id to new requests
      const { data: kids } = await supabase
        .from('children' as any)
        .select('id, name')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
      const kidList = (kids as any[] || []) as { id: string; name: string }[];
      setMyChildren(kidList);
      if (kidList.length > 0 && !selectedChildId) {
        setSelectedChildId(kidList[0].id);
      }
    }
    const { data } = await supabase
      .from('expense_requests' as any)
      .select('*, child:child_id(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    setRequests((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const getPending = () => {
    const pending = requests.filter(r => r.status === 'pending');
    if (direction === 'To Approve') return pending.filter(r => r.requester_id !== userId);
    return pending.filter(r => r.requester_id === userId);
  };

  const getCategoryGroups = () => {
    const groups: Record<string, ExpenseRequest[]> = {};
    for (const r of requests) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  };

  const totalApproved = requests.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount), 0);
  const totalPending  = requests.filter(r => r.status === 'pending').length;
  const toApproveCount = requests.filter(r => r.status === 'pending' && r.requester_id !== userId).length;

  const applyScannedResult = (result: Awaited<ReturnType<typeof scanReceiptFromCamera>>, imageUri?: string) => {
    if (!result) {
      Alert.alert('Scan failed', 'AI receipt scanning requires an Essential plan or above. Upgrade in Settings → Subscription.');
      return;
    }
    if (result.amount) setAmount(result.amount.toString());
    if (result.category) setCategory(result.category);
    if (result.description) setDescription(result.description);
    setScannedImageUri(result.imageUri);
  };

  const handleScanReceipt = () => {
    Alert.alert('Scan Receipt', 'How would you like to add the receipt?', [
      { text: 'Camera', onPress: async () => {
        setScanning(true);
        const result = await scanReceiptFromCamera();
        setScanning(false);
        applyScannedResult(result);
      }},
      { text: 'Photo Library', onPress: async () => {
        setScanning(true);
        const result = await scanReceiptFromLibrary();
        setScanning(false);
        applyScannedResult(result);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleApprove = async (id: string, action: 'approved' | 'rejected') => {
    // Use the server-side RPC — it verifies co-parent ownership, deducts from the
    // virtual card balance, and writes approved_by_id for the court audit trail.
    // Direct .update() would bypass all of that.
    const fn = action === 'approved' ? 'approve_expense_request' : 'reject_expense_request';
    const { error } = await supabase.rpc(fn as any, { p_request_id: id });
    if (error) {
      Alert.alert('Could not update request', error.message);
      return;
    }

    // Notify the requester's device that their expense was actioned (best-effort).
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/apns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'notify-expense', expense_id: id }),
      }).catch(() => {});
    }

    loadRequests();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete request?', 'This will permanently remove this expense request.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('expense_requests' as any).delete().eq('id', id);
        loadRequests();
      }},
    ]);
  };

  const submit = async () => {
    setSubmitError(null);
    const n = parseFloat(amount);
    if (!n || n <= 0) { setSubmitError('Enter a valid amount greater than 0'); return; }
    if (myChildren.length === 0) {
      setSubmitError('Add a child in Family settings before submitting expense requests.');
      return;
    }
    const childId = selectedChildId ?? myChildren[0]?.id ?? null;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); setSubmitError('Not signed in'); return; }
    const { error } = await supabase.from('expense_requests' as any).insert({
      requester_id: user.id, amount: n, category, description: description || null,
      status: 'pending', child_id: childId,
    });
    setSubmitting(false);
    if (error) { setSubmitError(error.message); return; }
    setShowAdd(false); setAmount(''); setDescription(''); setScannedImageUri(null); setSubmitError(null);
    loadRequests();
  };

  const pendingList = getPending();
  const categoryGroups = getCategoryGroups();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 34, fontWeight: '700', color: colors.label, letterSpacing: -1 }}>Expenses</Text>
          <Pressable onPress={() => router.push('/transactions')}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18, backgroundColor: brand.blue + '18',
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: pressed ? 0.9 : 1 }],
            })}>
            <Ionicons name="time-outline" size={18} color={brand.blue} />
          </Pressable>
        </View>
      </View>

      {/* ── Hero summary card ── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ borderRadius: 20, padding: 22, backgroundColor: brand.teal, borderCurve: 'continuous' }}>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' }}>Total Approved</Text>
          <Text style={{ color: '#fff', fontSize: 44, fontWeight: '700', letterSpacing: -1.5, lineHeight: 52, marginTop: 4, fontVariant: ['tabular-nums'] }}>
            {sym}{totalApproved.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' }}>
                {totalPending} pending
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' }} />
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' }}>
                {requests.filter(r => r.status === 'approved').length} approved
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
        {(['Pending', 'Categories'] as MainTab[]).map(tab => (
          <Pressable key={tab} onPress={() => setMainTab(tab)}
            style={{
              paddingHorizontal: 20, paddingVertical: 9, borderRadius: 22,
              backgroundColor: mainTab === tab ? brand.blue : colors.surface,
              borderWidth: mainTab === tab ? 0 : 0.5, borderColor: colors.separator,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: mainTab === tab ? '#fff' : colors.secondaryLabel }}>{tab}</Text>
            {tab === 'Pending' && toApproveCount > 0 && (
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: mainTab === tab ? 'rgba(255,255,255,0.25)' : brand.error, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{toApproveCount}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Direction toggle on pending tab */}
      {mainTab === 'Pending' && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 }}>
          {(['To Approve', 'My Requests'] as Direction[]).map(dir => (
            <Pressable key={dir} onPress={() => setDirection(dir)}
              style={{
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18,
                backgroundColor: direction === dir ? colors.label : 'transparent',
                borderWidth: direction === dir ? 0 : 0.5, borderColor: colors.separator,
              }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: direction === dir ? colors.background : colors.secondaryLabel }}>{dir}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 4, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : mainTab === 'Categories' ? (
          <View style={{ gap: 10 }}>
            {categoryGroups.length === 0 ? <EmptyState /> : categoryGroups.map(([cat, items]) => {
              const col = CATEGORY_COLOR[cat] ?? brand.blue;
              const total = items.reduce((s, r) => s + Number(r.amount), 0);
              const pct = totalApproved > 0 ? Math.round((total / totalApproved) * 100) : 0;
              return (
                <View key={cat} style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous', gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: col + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                      <Ionicons name={CATEGORY_ICON[cat] ?? 'cube-outline'} size={22} color={col} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>{cat}</Text>
                      <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>{items.length} request{items.length !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label, letterSpacing: -0.5 }}>{sym}{total.toFixed(0)}</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: colors.separator, borderRadius: 2 }}>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: col, width: `${pct}%` }} />
                  </View>
                </View>
              );
            })}
            <Pressable onPress={() => router.push('/transactions')}
              style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name="time-outline" size={22} color={brand.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>Full History</Text>
                <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>Month-by-month breakdown</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.secondaryLabel} style={{ opacity: 0.4 }} />
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {pendingList.length === 0 ? (
              <EmptyState message={direction === 'To Approve' ? 'No requests waiting for your approval' : 'No pending requests you submitted'} />
            ) : pendingList.map(req => {
              const catColor = CATEGORY_COLOR[req.category] ?? brand.blue;
              const isToApprove = direction === 'To Approve';
              return (
                <View key={req.id} style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18, gap: 14, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: catColor + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                      <Ionicons name={CATEGORY_ICON[req.category] ?? 'cube-outline'} size={22} color={catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.label }}>{req.description || req.category}</Text>
                      <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>{formatDate(req.created_at)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label, letterSpacing: -0.5 }}>{sym}{Number(req.amount).toFixed(0)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B' }}>Pending</Text>
                      </View>
                    </View>
                  </View>

                  {isToApprove && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable onPress={() => handleApprove(req.id, 'rejected')}
                        style={({ pressed }) => ({
                          flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                          backgroundColor: '#EF444418', borderWidth: 1, borderColor: '#EF444430',
                          borderCurve: 'continuous', transform: [{ scale: pressed ? 0.97 : 1 }],
                        })}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>Decline</Text>
                      </Pressable>
                      <Pressable onPress={() => handleApprove(req.id, 'approved')}
                        style={({ pressed }) => ({
                          flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                          backgroundColor: '#22C55E18', borderWidth: 1, borderColor: '#22C55E30',
                          borderCurve: 'continuous', transform: [{ scale: pressed ? 0.97 : 1 }],
                        })}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#22C55E' }}>Approve</Text>
                      </Pressable>
                    </View>
                  )}

                  {!isToApprove && (
                    <Pressable onPress={() => handleDelete(req.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="trash-outline" size={14} color={brand.error} />
                      <Text style={{ fontSize: 13, color: brand.error, fontWeight: '600' }}>Withdraw request</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Pressable onPress={() => router.push('/transactions')}
              style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Ionicons name="time-outline" size={20} color={brand.teal} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.label }}>View full history</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.secondaryLabel} style={{ opacity: 0.4 }} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ── New expense FAB ── */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 8, left: 16, right: 16 }}>
        <Pressable onPress={() => setShowAdd(true)}
          style={({ pressed }) => ({
            backgroundColor: brand.teal, borderRadius: 18, paddingVertical: 17,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 6px 20px rgba(13,148,136,0.35)',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}>
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>New expense request</Text>
        </Pressable>
      </View>

      {/* ── Add Expense Modal ── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet"
        onRequestClose={() => { setShowAdd(false); setSubmitError(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 0.5, borderBottomColor: colors.separator, backgroundColor: colors.surface }}>
            <Pressable onPress={() => { setShowAdd(false); setSubmitError(null); }}>
              <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>New Expense</Text>
            <Pressable onPress={submit} disabled={submitting}>
              <Text style={{ color: submitting ? colors.secondaryLabel : brand.blue, fontSize: 16, fontWeight: '600' }}>
                {submitting ? 'Saving…' : 'Add'}
              </Text>
            </Pressable>
          </View>
          {submitError && (
            <View style={{ backgroundColor: '#EF444410', padding: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#EF444430', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600', flex: 1 }}>{submitError}</Text>
            </View>
          )}
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <Pressable onPress={handleScanReceipt} disabled={scanning}
              style={({ pressed }) => ({ backgroundColor: brand.teal, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              {scanning ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera-outline" size={22} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{scanning ? 'Scanning…' : 'Scan Receipt with AI'}</Text>
            </Pressable>
            {scannedImageUri && (
              <View>
                <Image source={{ uri: scannedImageUri }} style={{ width: '100%', height: 140, borderRadius: 14, resizeMode: 'cover' }} />
                <Pressable onPress={() => setScannedImageUri(null)} style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11 }}>Remove</Text>
                </Pressable>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, height: 0.5, backgroundColor: colors.separator }} />
              <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>or enter manually</Text>
              <View style={{ flex: 1, height: 0.5, backgroundColor: colors.separator }} />
            </View>
            {myChildren.length > 1 && (
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 10 }}>For which child?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {myChildren.map(kid => {
                      const active = selectedChildId === kid.id;
                      return (
                        <Pressable key={kid.id} onPress={() => setSelectedChildId(kid.id)}
                          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: active ? brand.blue : colors.separator, backgroundColor: active ? brand.blue + '18' : colors.surface }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: active ? brand.blue : colors.secondaryLabel }}>{kid.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}
            {myChildren.length === 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brand.blue + '08', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: brand.blue + '20' }}>
                <Ionicons name="person-outline" size={15} color={brand.blue} />
                <Text style={{ fontSize: 13, color: colors.label }}>For <Text style={{ fontWeight: '700' }}>{myChildren[0].name}</Text></Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 10 }}>Amount (Rand)</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, fontSize: 36, fontWeight: '700', color: colors.label, borderWidth: 0.5, borderColor: colors.separator, textAlign: 'center', letterSpacing: -1, borderCurve: 'continuous' }}
                keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.separator}
                value={amount} onChangeText={v => setAmount(v.replace(/[^0-9.]/g, '').replace(/^0+([1-9])/, '$1'))}
              />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 10 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CATEGORIES.map(cat => {
                    const active = category === cat;
                    const col = CATEGORY_COLOR[cat] ?? brand.blue;
                    return (
                      <Pressable key={cat} onPress={() => setCategory(cat)}
                        style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: active ? col : colors.separator, backgroundColor: active ? col + '18' : colors.surface }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={CATEGORY_ICON[cat] ?? 'cube-outline'} size={14} color={active ? col : colors.secondaryLabel} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: active ? col : colors.secondaryLabel }}>{cat}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel, marginBottom: 10 }}>Description (optional)</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, fontSize: 15, color: colors.label, borderWidth: 0.5, borderColor: colors.separator, height: 100, textAlignVertical: 'top', borderCurve: 'continuous' }}
                placeholder="What was this expense for?" placeholderTextColor={colors.secondaryLabel}
                multiline value={description} onChangeText={setDescription}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <View style={{ borderRadius: 20, padding: 48, alignItems: 'center', gap: 14, marginTop: 8, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.teal + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
        <Ionicons name="receipt-outline" size={27} color={brand.teal} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>Nothing here yet</Text>
      <Text style={{ fontSize: 13, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 20 }}>{message ?? 'Tap the button below to log a shared expense'}</Text>
    </View>
  );
}
