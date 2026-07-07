import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { scanReceiptFromCamera, scanReceiptFromLibrary } from '@/lib/receipt-scanner';

const CATEGORIES = ['School', 'Food', 'Clothing', 'Activities', 'Healthcare', 'Transportation', 'Other'];
const CATEGORY_EMOJI: Record<string, string> = {
  School: '🎓', Food: '🍎', Clothing: '👗', Activities: '⚽',
  Healthcare: '🏥', Transportation: '🚗', Other: '📦',
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FFF7ED', text: '#F59E0B' },
  approved: { bg: '#F0FDF4', text: '#22C55E' },
  rejected: { bg: '#FEF2F2', text: '#EF4444' },
};

type ExpenseRequest = {
  id: string; amount: number; category: string; description: string | null;
  status: string; created_at: string; created_via?: string;
  child?: { name: string } | null;
};

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('School');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expense_requests' as any)
      .select('*, child:child_id(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    setRequests((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const filtered = requests.filter(r => {
    if (activeFilter === 'all') return true;
    return r.status === activeFilter;
  });

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
        } else {
          Alert.alert('Scan failed', 'Could not read the receipt. Please enter details manually.');
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
        } else {
          Alert.alert('Scan failed', 'Could not read the receipt. Please enter details manually.');
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }
    await supabase.from('expense_requests' as any).insert({
      requester_id: user.id, amount: n, category, description: description || null, status: 'pending',
    });
    setShowAdd(false); setAmount(''); setDescription(''); setScannedImageUri(null); setSubmitting(false);
    loadRequests();
  };

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 36, height: 36, backgroundColor: brand.blue, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Text style={{ color: '#fff', fontSize: 20 }}>♥</Text>
            </View>
            <Text style={{ color: brand.blue, fontWeight: '700', fontSize: 18 }}>SupportCard</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: brand.dark }}>Expenses</Text>
            <Pressable onPress={() => setShowAdd(true)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(43,116,214,0.30)' }}>
              <Text style={{ color: '#fff', fontSize: 24, lineHeight: 28 }}>+</Text>
            </Pressable>
          </View>

          {/* Filter tabs */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {(['all', 'pending', 'approved'] as const).map(f => (
              <Pressable key={f} onPress={() => setActiveFilter(f)}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: activeFilter === f ? brand.blue : brand.card,
                  boxShadow: activeFilter === f ? '0 2px 8px rgba(43,116,214,0.20)' : undefined }}>
                <Text style={{ fontSize: 13, fontWeight: '600', textTransform: 'capitalize',
                  color: activeFilter === f ? '#fff' : brand.body }}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={{ backgroundColor: brand.card, borderRadius: 20, padding: 40, alignItems: 'center', boxShadow: '0 2px 12px rgba(43,116,214,0.08)' }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💰</Text>
              <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>No expense requests</Text>
              <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>Tap + to log a shared expense</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {filtered.map(req => {
                const statusStyle = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
                return (
                  <View key={req.id} style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontSize: 24 }}>{CATEGORY_EMOJI[req.category] || '📦'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>R{Number(req.amount).toFixed(2)}</Text>
                        <View style={{ backgroundColor: statusStyle.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: statusStyle.text, textTransform: 'capitalize' }}>{req.status}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>
                        {req.category}{req.child?.name ? ` · ${req.child.name}` : ''}
                      </Text>
                      {req.description && <Text style={{ fontSize: 13, color: brand.body, marginTop: 1 }} numberOfLines={1}>{req.description}</Text>}
                      {req.created_via === 'scai' && (
                        <View style={{ flexDirection: 'row', marginTop: 4 }}>
                          <View style={{ backgroundColor: brand.lightBg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, color: brand.blue }}>🤖 My SCAI</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: brand.lightBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: brand.separator, backgroundColor: brand.card }}>
            <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>New Expense</Text>
            <Pressable onPress={submit} disabled={submitting}>
              <Text style={{ color: submitting ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>Add</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>

            {/* AI Receipt Scanner */}
            <Pressable onPress={handleScanReceipt} disabled={scanning}
              style={{ backgroundColor: brand.blue, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 12px rgba(43,116,214,0.25)' }}>
              {scanning ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 20 }}>📸</Text>}
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{scanning ? 'Scanning receipt...' : 'Scan Receipt with AI'}</Text>
            </Pressable>

            {scannedImageUri && (
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: scannedImageUri }} style={{ width: '100%', height: 140, borderRadius: 12, resizeMode: 'cover' }} />
                <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: brand.success, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓ Scanned</Text>
                </View>
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>AMOUNT (RAND)</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 32, fontWeight: '700', color: brand.dark, borderWidth: 1.5, borderColor: brand.separator, textAlign: 'center' }}
                keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={brand.separator}
                value={amount} onChangeText={setAmount}
              />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                  {CATEGORIES.map(cat => (
                    <Pressable key={cat} onPress={() => setCategory(cat)}
                      style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5,
                        borderColor: category === cat ? brand.blue : brand.separator,
                        backgroundColor: category === cat ? brand.lightBg : brand.card }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: category === cat ? brand.blue : brand.body }}>
                        {CATEGORY_EMOJI[cat]} {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>DESCRIPTION (OPTIONAL)</Text>
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
