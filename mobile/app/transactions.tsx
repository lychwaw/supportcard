import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  School: 'school-outline', Food: 'restaurant-outline', Clothing: 'shirt-outline',
  Activities: 'football-outline', Healthcare: 'medkit-outline',
  Transportation: 'car-outline', Other: 'cube-outline',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:  { bg: '#FFF7ED', text: '#F59E0B' },
  approved: { bg: '#F0FDF4', text: '#22C55E' },
  rejected: { bg: '#FEF2F2', text: '#EF4444' },
};

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected';

type ExpenseRequest = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  status: string;
  created_at: string;
  created_via?: string | null;
  child?: { name: string } | null;
  requester?: { full_name: string } | null;
};

type MonthGroup = {
  label: string;     // "June 2026"
  key: string;       // "2026-06"
  items: ExpenseRequest[];
};

function toMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

function toDayMonth(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function formatRand(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function groupByMonth(items: ExpenseRequest[]): MonthGroup[] {
  const map = new Map<string, ExpenseRequest[]>();
  for (const item of items) {
    const key = toMonthKey(item.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({ key, label: toMonthLabel(key), items }));
}

function currentMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expense_requests' as any)
      .select('*, child:child_id(name), requester:requester_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setRequests((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  // Summary stats for the current month
  const thisMonthKey = currentMonthKey();
  const thisMonth = requests.filter(r => toMonthKey(r.created_at) === thisMonthKey);
  const totalRequested = thisMonth.reduce((s, r) => s + Number(r.amount), 0);
  const pendingCount = thisMonth.filter(r => r.status === 'pending').length;
  const approvedCount = thisMonth.filter(r => r.status === 'approved').length;

  const groups = groupByMonth(filtered);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
      <Stack.Screen options={{ title: 'Transactions', headerTintColor: brand.blue }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
      >
        {/* Info banner */}
        <View style={{
          backgroundColor: brand.card,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: brand.blue,
          padding: 14,
          marginBottom: 20,
        }}>
          <Text style={{ fontSize: 13, color: brand.body, lineHeight: 18 }}>
            No money moves through SupportCard — this shows expense request activity only.
          </Text>
        </View>

        {/* Summary stat cards */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Requested', value: formatRand(totalRequested) },
            { label: 'Pending', value: String(pendingCount) },
            { label: 'Approved', value: String(approvedCount) },
          ].map(stat => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                height: 80,
                backgroundColor: brand.card,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: brand.dark }}>{stat.value}</Text>
              <Text style={{ fontSize: 12, color: brand.body, marginTop: 3 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, marginHorizontal: -4 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
            {FILTERS.map(f => (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: filter === f.key ? brand.blue : brand.card,
                  boxShadow: filter === f.key ? '0 2px 8px rgba(43,116,214,0.20)' : undefined,
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: filter === f.key ? '#fff' : brand.body,
                }}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <View style={{
            backgroundColor: brand.card,
            borderRadius: 20,
            padding: 40,
            alignItems: 'center',
            boxShadow: '0 2px 12px rgba(43,116,214,0.08)',
          }}>
            <Ionicons name="receipt-outline" size={40} color={brand.body} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>No activity yet</Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
              Expense requests will appear here once submitted
            </Text>
          </View>
        ) : (
          <View style={{ gap: 28 }}>
            {groups.map(group => {
              const groupTotal = group.items.reduce((s, r) => s + Number(r.amount), 0);
              const groupApproved = group.items
                .filter(r => r.status === 'approved')
                .reduce((s, r) => s + Number(r.amount), 0);
              const hasApproved = group.items.some(r => r.status === 'approved');

              return (
                <View key={group.key}>
                  {/* Section header */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: brand.dark,
                    }}>
                      {group.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: brand.body }}>
                      Requested: {formatRand(groupTotal)}
                      {groupApproved > 0 ? ` | Approved: ${formatRand(groupApproved)}` : ''}
                    </Text>
                  </View>

                  {/* Items */}
                  <View style={{ gap: 8 }}>
                    {group.items.map(item => {
                      const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
                      return (
                        <View
                          key={item.id}
                          style={{
                            backgroundColor: brand.card,
                            borderRadius: 14,
                            padding: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            boxShadow: '0 1px 6px rgba(43,116,214,0.07)',
                          }}
                        >
                          {/* Category emoji circle */}
                          <View style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            backgroundColor: brand.lightBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Ionicons name={CATEGORY_ICON[item.category] ?? 'cube-outline'} size={20} color={brand.blue} />
                          </View>

                          {/* Amount + category */}
                          <View style={{ width: 72, flexShrink: 0 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.blue }}>
                              {formatRand(Number(item.amount))}
                            </Text>
                            <Text style={{ fontSize: 12, color: brand.body, marginTop: 2 }}>
                              {item.category}
                            </Text>
                          </View>

                          {/* Child + description */}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            {item.child?.name ? (
                              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.dark }} numberOfLines={1}>
                                {item.child.name}
                              </Text>
                            ) : null}
                            {item.description ? (
                              <Text style={{ fontSize: 12, color: brand.body, marginTop: 1 }} numberOfLines={1}>
                                {item.description}
                              </Text>
                            ) : null}
                            {item.created_via === 'scai' && (
                              <View style={{
                                alignSelf: 'flex-start',
                                backgroundColor: brand.lightBg,
                                borderRadius: 6,
                                paddingHorizontal: 5,
                                paddingVertical: 2,
                                marginTop: 4,
                              }}>
                                <Ionicons name="hardware-chip-outline" size={10} color={brand.blue} /><Text style={{ fontSize: 10, color: brand.blue }}> SCAI</Text>
                              </View>
                            )}
                          </View>

                          {/* Date + status */}
                          <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <Text style={{ fontSize: 12, color: brand.body }}>
                              {toDayMonth(item.created_at)}
                            </Text>
                            <View style={{
                              backgroundColor: statusStyle.bg,
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            }}>
                              <Text style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: statusStyle.text,
                                textTransform: 'capitalize',
                              }}>
                                {item.status}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Settlement note */}
                  {hasApproved && (
                    <View style={{
                      backgroundColor: brand.card,
                      borderRadius: 10,
                      padding: 12,
                      marginTop: 10,
                      borderLeftWidth: 3,
                      borderLeftColor: '#22C55E',
                    }}>
                      <Text style={{ fontSize: 12, color: brand.body }}>
                        Settlement of {formatRand(groupApproved)} due — arrange via EFT/bank transfer
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
