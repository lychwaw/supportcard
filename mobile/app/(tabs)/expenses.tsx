import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
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
const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B', approved: '#22C55E', rejected: '#EF4444',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Declined',
};

type MainTab = 'Requests' | 'Payments' | 'Categories';
type Direction = 'Received' | 'Sent';

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
  const [mainTab, setMainTab] = useState<MainTab>('Requests');
  const [direction, setDirection] = useState<Direction>('Received');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase
      .from('expense_requests' as any)
      .select('*, child:child_id(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    setRequests((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const getFiltered = () => {
    let list = requests;
    if (mainTab === 'Requests') list = list.filter(r => r.status === 'pending');
    else if (mainTab === 'Payments') list = list.filter(r => r.status !== 'pending');
    if (direction === 'Sent') list = list.filter(r => r.requester_id === userId);
    else list = list.filter(r => r.requester_id !== userId);
    return list;
  };

  const getCategoryGroups = () => {
    const groups: Record<string, ExpenseRequest[]> = {};
    for (const r of requests) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  };

  const handleScanReceipt = () => {
    Alert.alert('Scan Receipt', 'How would you like to add the receipt?', [
      { text: 'Camera', onPress: async () => {
        setScanning(true);
        const result = await scanReceiptFromCamera();
        setScanning(false);
        if (result) {
          if (result.amount) setAmount(result.amount.toString());
          if (result.category) setCategory(result.category);
          if (result.description) setDescription(result.description);
          setScannedImageUri(result.imageUri);
        }
      }},
      { text: 'Photo Library', onPress: async () => {
        setScanning(true);
        const result = await scanReceiptFromLibrary();
        setScanning(false);
        if (result) {
          if (result.amount) setAmount(result.amount.toString());
          if (result.category) setCategory(result.category);
          if (result.description) setDescription(result.description);
          setScannedImageUri(result.imageUri);
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleApprove = async (id: string, action: 'approved' | 'rejected') => {
    await supabase.from('expense_requests' as any).update({ status: action }).eq('id', id);
    loadRequests();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete expense?', 'This will permanently remove this request.', [
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
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); setSubmitError('Not signed in'); return; }
    const { error } = await supabase.from('expense_requests' as any).insert({
      requester_id: user.id, amount: n, category, description: description || null, status: 'pending',
    });
    setSubmitting(false);
    if (error) { setSubmitError(error.message); return; }
    setShowAdd(false); setAmount(''); setDescription(''); setScannedImageUri(null); setSubmitError(null);
    loadRequests();
  };

  const filtered = getFiltered();
  const categoryGroups = getCategoryGroups();
  const MAIN_TABS: MainTab[] = ['Requests', 'Payments', 'Categories'];

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F9FC' }}>
      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + 14, backgroundColor: brand.card, borderBottomWidth: 0.5, borderBottomColor: brand.separator }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 }}>
          <Pressable onPress={() => router.push('/(tabs)/more')} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="menu-outline" size={26} color={brand.dark} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: brand.dark }}>Expenses</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Underline-style tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20 }}>
          {MAIN_TABS.map(tab => (
            <Pressable key={tab} onPress={() => setMainTab(tab)}
              style={{ flex: 1, alignItems: 'center', paddingBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: mainTab === tab ? '700' : '500', color: mainTab === tab ? brand.blue : brand.body }}>
                {tab}
              </Text>
              {mainTab === tab && (
                <View style={{ position: 'absolute', bottom: 0, height: 2.5, width: '60%', backgroundColor: brand.blue, borderRadius: 2 }} />
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {/* Received / Sent pill toggle */}
      {mainTab !== 'Categories' && (
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          {(['Received', 'Sent'] as Direction[]).map(dir => (
            <Pressable key={dir} onPress={() => setDirection(dir)}
              style={{
                paddingHorizontal: 28, paddingVertical: 9, borderRadius: 22,
                backgroundColor: direction === dir ? brand.blue : brand.card,
                borderWidth: direction === dir ? 0 : 1.5,
                borderColor: brand.separator,
              }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: direction === dir ? '#fff' : brand.body }}>{dir}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 12, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : mainTab === 'Categories' ? (
          <View style={{ gap: 10 }}>
            {categoryGroups.length === 0 ? <EmptyState /> : categoryGroups.map(([cat, items]) => {
              const col = CATEGORY_COLOR[cat] ?? brand.blue;
              const total = items.reduce((s, r) => s + Number(r.amount), 0);
              return (
                <View key={cat} style={{ backgroundColor: brand.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: col + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={CATEGORY_ICON[cat] ?? 'cube-outline'} size={22} color={col} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>{cat}</Text>
                    <Text style={{ fontSize: 13, color: brand.body }}>{items.length} request{items.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>R{total.toFixed(0)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.length === 0 ? <EmptyState /> : filtered.map(req => {
              const statusColor = STATUS_COLOR[req.status] ?? brand.body;
              const catColor = CATEGORY_COLOR[req.category] ?? brand.blue;
              const isMine = req.requester_id === userId;
              return (
                <View key={req.id} style={{ backgroundColor: brand.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: catColor + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={CATEGORY_ICON[req.category] ?? 'cube-outline'} size={22} color={catColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>{req.description || req.category}</Text>
                    <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>{formatDate(req.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>R{Number(req.amount).toFixed(0)}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: statusColor }}>{STATUS_LABEL[req.status] ?? req.status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Full-width bottom button ── */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 8, left: 16, right: 16 }}>
        <Pressable onPress={() => setShowAdd(true)}
          style={({ pressed }) => ({
            backgroundColor: brand.blue, borderRadius: 14, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(43,116,214,0.30)',
            opacity: pressed ? 0.88 : 1,
          })}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>New expense request</Text>
        </Pressable>
      </View>

      {/* ── Add Expense Modal ── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet"
        onRequestClose={() => { setShowAdd(false); setSubmitError(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: brand.lightBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: brand.separator, backgroundColor: brand.card }}>
            <Pressable onPress={() => { setShowAdd(false); setSubmitError(null); }}>
              <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>New Expense</Text>
            <Pressable onPress={submit} disabled={submitting}>
              <Text style={{ color: submitting ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>
                {submitting ? 'Saving…' : 'Add'}
              </Text>
            </Pressable>
          </View>
          {submitError && (
            <View style={{ backgroundColor: '#FEF2F2', padding: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#FECACA', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600', flex: 1 }}>{submitError}</Text>
            </View>
          )}
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <Pressable onPress={handleScanReceipt} disabled={scanning}
              style={{ backgroundColor: brand.blue, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {scanning ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera-outline" size={20} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{scanning ? 'Scanning…' : 'Scan Receipt with AI'}</Text>
            </Pressable>
            {scannedImageUri && (
              <View>
                <Image source={{ uri: scannedImageUri }} style={{ width: '100%', height: 140, borderRadius: 12, resizeMode: 'cover' }} />
                <Pressable onPress={() => setScannedImageUri(null)} style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11 }}>Remove</Text>
                </Pressable>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: brand.separator }} />
              <Text style={{ color: brand.body, fontSize: 12 }}>or enter manually</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: brand.separator }} />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount (Rand)</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 32, fontWeight: '700', color: brand.dark, borderWidth: 1.5, borderColor: brand.separator, textAlign: 'center' }}
                keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={brand.separator}
                value={amount} onChangeText={setAmount}
              />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CATEGORIES.map(cat => {
                    const active = category === cat;
                    const col = CATEGORY_COLOR[cat] ?? brand.blue;
                    return (
                      <Pressable key={cat} onPress={() => setCategory(cat)}
                        style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, borderColor: active ? col : brand.separator, backgroundColor: active ? col + '18' : brand.card }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={CATEGORY_ICON[cat] ?? 'cube-outline'} size={14} color={active ? col : brand.body} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: active ? col : brand.body }}>{cat}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: brand.body, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description (Optional)</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 15, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator, height: 100, textAlignVertical: 'top' }}
                placeholder="What was this expense for?" placeholderTextColor={brand.body}
                multiline value={description} onChangeText={setDescription}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 48, alignItems: 'center', gap: 12, marginTop: 8 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: brand.separator, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="receipt-outline" size={28} color={brand.body} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '600', color: brand.dark }}>Nothing here yet</Text>
      <Text style={{ fontSize: 13, color: brand.body, textAlign: 'center' }}>Tap the button below to log a shared expense</Text>
    </View>
  );
}
