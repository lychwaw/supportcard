import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router/stack';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { convertAmount, CURRENCY_SYMBOL, type Currency } from '@/lib/currency';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  School: 'school-outline', Food: 'restaurant-outline', Clothing: 'shirt-outline',
  Activities: 'football-outline', Healthcare: 'medkit-outline',
  Transportation: 'car-outline', Other: 'cube-outline',
};

const STATUS_META: Record<string, { bg: string; text: string }> = {
  pending:  { bg: '#FFF7ED', text: '#F59E0B' },
  approved: { bg: '#F0FDF4', text: '#22C55E' },
  rejected: { bg: '#FEF2F2', text: '#EF4444' },
};

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected';

type ExpenseRequest = {
  id: string; amount: number; currency: Currency; category: string; description: string | null;
  status: string; created_at: string; created_via?: string | null;
  child?: { name: string } | null; requester?: { full_name: string } | null;
};

type MonthGroup = { label: string; key: string; items: ExpenseRequest[] };

function toMonthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
function toMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}
function toDayMonth(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
function groupByMonth(items: ExpenseRequest[]): MonthGroup[] {
  const map = new Map<string, ExpenseRequest[]>();
  for (const item of items) {
    const key = toMonthKey(item.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({ key, label: toMonthLabel(key), items }));
}
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function TransactionsScreen() {
  const { currency } = useCurrency();
  const sym = CURRENCY_SYMBOL[currency];
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expense_requests' as any)
      .select('*, currency, child:child_id(name), requester:requester_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setRequests((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const thisMonthKey = currentMonthKey();
  const thisMonth = requests.filter(r => toMonthKey(r.created_at) === thisMonthKey);
  const totalRequested = thisMonth.reduce((s, r) => s + convertAmount(Number(r.amount), r.currency ?? 'ZAR', currency), 0);
  const pendingCount = thisMonth.filter(r => r.status === 'pending').length;
  const approvedCount = thisMonth.filter(r => r.status === 'approved').length;

  const groups = groupByMonth(filtered);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Transactions', headerTintColor: brand.blue }} />

      <ScrollView contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>

        {/* Disclaimer */}
        <View style={{ backgroundColor: brand.blue + '10', borderRadius: 14, borderCurve: 'continuous', borderLeftWidth: 3, borderLeftColor: brand.blue, padding: 14, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            No money moves through SupportCard — this shows expense request activity only.
          </Text>
        </View>

        {/* Summary tiles */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Requested', value: `${sym}${totalRequested.toFixed(0)}`, color: '#F59E0B' },
            { label: 'Pending', value: String(pendingCount), color: brand.blue },
            { label: 'Approved', value: String(approvedCount), color: '#22C55E' },
          ].map(stat => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', paddingVertical: 14, alignItems: 'center', gap: 4, borderWidth: 0.5, borderColor: colors.separator }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: stat.color, fontVariant: ['tabular-nums'] }}>{stat.value}</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryLabel, fontWeight: '600' }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, marginHorizontal: -4 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
            {FILTERS.map(f => (
              <Pressable key={f.key} onPress={() => setFilter(f.key)}
                style={({ pressed }) => ({
                  paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: filter === f.key ? brand.blue : colors.surface,
                  borderWidth: filter === f.key ? 0 : 0.5, borderColor: colors.separator,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: filter === f.key ? '#fff' : colors.secondaryLabel }}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 40, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderCurve: 'continuous' }}>
              <Ionicons name="receipt-outline" size={30} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label, marginBottom: 4 }}>No activity yet</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>Expense requests will appear here once submitted</Text>
          </View>
        ) : (
          <View style={{ gap: 28 }}>
            {groups.map(group => {
              const groupTotal = group.items.reduce((s, r) => s + convertAmount(Number(r.amount), r.currency ?? 'ZAR', currency), 0);
              const groupApproved = group.items.filter(r => r.status === 'approved').reduce((s, r) => s + convertAmount(Number(r.amount), r.currency ?? 'ZAR', currency), 0);
              const hasApproved = group.items.some(r => r.status === 'approved');
              return (
                <View key={group.key}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.label }}>{group.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>
                      {sym}{groupTotal.toFixed(0)}{groupApproved > 0 ? ` · ${sym}${groupApproved.toFixed(0)} approved` : ''}
                    </Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    {group.items.map(item => {
                      const meta = STATUS_META[item.status] || STATUS_META.pending;
                      return (
                        <View key={item.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: colors.separator }}>
                          <View style={{ width: 44, height: 44, borderRadius: 12, borderCurve: 'continuous', backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Ionicons name={CATEGORY_ICON[item.category] ?? 'cube-outline'} size={20} color={brand.blue} />
                          </View>
                          <View style={{ width: 70, flexShrink: 0 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: brand.blue, fontVariant: ['tabular-nums'] }}>{sym}{convertAmount(Number(item.amount), item.currency ?? 'ZAR', currency).toFixed(0)}</Text>
                            <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 1 }}>{item.category}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            {item.child?.name ? <Text style={{ fontSize: 13, fontWeight: '700', color: colors.label }} numberOfLines={1}>{item.child.name}</Text> : null}
                            {item.description ? <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginTop: 1 }} numberOfLines={1}>{item.description}</Text> : null}
                            {item.created_via === 'scai' && (
                              <View style={{ alignSelf: 'flex-start', backgroundColor: brand.teal + '12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="flash" size={10} color={brand.teal} />
                                <Text style={{ fontSize: 10, color: brand.teal, fontWeight: '700' }}>SCAI</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>{toDayMonth(item.created_at)}</Text>
                            <View style={{ backgroundColor: meta.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: meta.text, textTransform: 'capitalize' }}>{item.status}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  {hasApproved && (
                    <View style={{ backgroundColor: '#22C55E10', borderRadius: 12, borderCurve: 'continuous', padding: 12, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#22C55E' }}>
                      <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>
                        Settlement of {sym}{groupApproved.toFixed(0)} due — arrange via EFT/bank transfer
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
