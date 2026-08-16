import { useState, useEffect, useCallback } from 'react';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';

interface CourtOrder { id: string; title?: string; reference_number?: string; due_date?: string; status?: string; created_at: string }
interface ComplianceLog { id: string; event_type: string; description?: string; created_at: string }

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function computeStats(orders: CourtOrder[], logs: ComplianceLog[]) {
  const activeCount = orders.filter(o => o.status === 'active').length;
  const upcoming = orders.filter(o => o.due_date && (o.status === 'active' || o.status === 'pending'))
    .map(o => new Date(o.due_date!)).filter(d => d >= new Date()).sort((a, b) => a.getTime() - b.getTime());
  let nextLabel = '—';
  if (upcoming.length > 0) {
    const diff = Math.ceil((upcoming[0].getTime() - Date.now()) / 86_400_000);
    nextLabel = diff === 0 ? 'Today' : diff === 1 ? '1 day' : `${diff} days`;
  }
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthLogs = logs.filter(l => new Date(l.created_at) >= monthStart);
  const rateLabel = thisMonthLogs.length === 0 ? '—' : `${thisMonthLogs.length} event${thisMonthLogs.length !== 1 ? 's' : ''}`;
  return { activeCount, nextLabel, rateLabel };
}

const EVENT_TYPES = ['custody_exchange','expense_approved','court_order_met','school_pickup','medical_visit','other'];

export default function ComplianceScreen() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<CourtOrder[]>([]);
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logText, setLogText] = useState('');
  const [logEventType, setLogEventType] = useState('custody_exchange');
  const [logSaving, setLogSaving] = useState(false);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [orderTitle, setOrderTitle] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [orderDueDate, setOrderDueDate] = useState('');
  const [orderStatus, setOrderStatus] = useState<'active' | 'pending'>('active');
  const [orderSaving, setOrderSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, logsRes] = await Promise.all([
        supabase.from('court_orders' as any).select('*').order('due_date', { ascending: true }),
        supabase.from('compliance_logs' as any).select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      setOrders((ordersRes.data as unknown as CourtOrder[] | null) ?? []);
      setLogs((logsRes.data as unknown as ComplianceLog[] | null) ?? []);
    } catch {
      setOrders([]); setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddOrder = useCallback(async () => {
    if (!orderTitle.trim()) { Alert.alert('Title required', 'Please enter a title for this order.'); return; }
    if (orderDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(orderDueDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format (e.g. 2026-09-15).');
      return;
    }
    setOrderSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase.from('court_orders' as any) as any).insert({
        user_id: user.id,
        title: orderTitle.trim(),
        reference_number: orderRef.trim() || null,
        due_date: orderDueDate || null,
        status: orderStatus,
      });
      if (error) throw error;
      setShowAddOrderModal(false);
      setOrderTitle(''); setOrderRef(''); setOrderDueDate(''); setOrderStatus('active');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save court order.');
    } finally {
      setOrderSaving(false);
    }
  }, [orderTitle, orderRef, orderDueDate, orderStatus, loadData]);

  const handleLogEvent = useCallback(async () => {
    if (!logText.trim()) return;
    setLogSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase.from('compliance_logs' as any) as any).insert({ user_id: user.id, event_type: logEventType, description: logText.trim(), source: 'manual' });
      if (error) throw error;
      setShowLogModal(false); setLogText(''); loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save event.');
    } finally {
      setLogSaving(false);
    }
  }, [logEventType, logText, loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  const { activeCount, nextLabel, rateLabel } = computeStats(orders, logs);

  return (
    <>
      <Stack.Screen options={{ title: 'Compliance', headerTintColor: brand.blue }} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator size="large" color={brand.blue} /></View>
        ) : (
          <>
            {/* Overview stat cards */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
              <Text style={{ fontWeight: '600', fontSize: 13, color: colors.secondaryLabel, marginBottom: 12 }}>Overview</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }} contentContainerStyle={{ gap: 10 }}>
                {[
                  { value: String(activeCount), label: 'Active Orders', color: brand.blue },
                  { value: nextLabel, label: 'Next Due', color: '#F59E0B' },
                  { value: rateLabel, label: 'This Month', color: brand.teal },
                ].map(card => (
                  <View key={card.label} style={{ width: 120, height: 90, borderRadius: 18, borderCurve: 'continuous', backgroundColor: card.color, padding: 14, justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 26, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] }}>{card.value}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>{card.label}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Court Orders */}
            <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label }}>Court Orders & Obligations</Text>
                <Pressable onPress={() => setShowAddOrderModal(true)} hitSlop={12}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: brand.blue }}>+ Add</Text>
                </Pressable>
              </View>
              {orders.length === 0 ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', padding: 24, alignItems: 'center', gap: 8, marginBottom: 12, borderWidth: 0.5, borderColor: colors.separator }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                    <Ionicons name="document-text-outline" size={24} color={brand.blue} />
                  </View>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label }}>No court orders yet</Text>
                  <Text style={{ color: colors.secondaryLabel, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>Log your parenting plan and maintenance orders to track compliance</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {orders.map(order => (
                    <View key={order.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: colors.separator }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderCurve: 'continuous' }}>
                          <Ionicons name="document-text-outline" size={20} color="#fff" />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label }}>{order.title ?? 'Court Order'}</Text>
                          {order.reference_number ? <Text selectable style={{ color: colors.secondaryLabel, fontSize: 12 }}>Ref: {order.reference_number}</Text> : null}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <View style={{ backgroundColor: brand.blue + '12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 12, color: brand.blue, fontWeight: '600' }}>Due {formatDate(order.due_date)}</Text>
                            </View>
                            <View style={{ backgroundColor: order.status === 'active' ? '#22C55E18' : '#F59E0B18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: order.status === 'active' ? '#22C55E' : '#F59E0B' }}>{order.status === 'active' ? 'Active' : 'Pending'}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Compliance Log */}
            <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label, marginBottom: 12 }}>Recent Compliance Log</Text>
              {logs.length === 0 ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', padding: 24, alignItems: 'center', gap: 8, borderWidth: 0.5, borderColor: colors.separator }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: brand.teal + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                    <Ionicons name="bar-chart-outline" size={24} color={brand.teal} />
                  </View>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label }}>No compliance events logged</Text>
                  <Text style={{ color: colors.secondaryLabel, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>Events like custody exchanges and expense approvals are automatically logged.</Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {logs.map(log => (
                    <View key={log.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 14, borderWidth: 0.5, borderColor: colors.separator }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#22C55E18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                          <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', fontSize: 14, color: colors.label }}>{log.event_type.replace(/_/g, ' ')}</Text>
                          {log.description ? <Text style={{ color: colors.secondaryLabel, fontSize: 13, marginTop: 1 }}>{log.description}</Text> : null}
                        </View>
                        <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>{formatDate(log.created_at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: colors.label, marginBottom: 12 }}>Quick Actions</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { icon: 'document-outline' as const, label: 'Export Report', note: 'PDF on Premium', onPress: () => router.push('/monthly-report' as any) },
                  { icon: 'create-outline' as const, label: 'Log Event', onPress: () => setShowLogModal(true) },
                  { icon: 'calendar-outline' as const, label: 'View Calendar', onPress: () => router.push('/(tabs)/calendar' as any) },
                ].map(action => (
                  <Pressable key={action.label} onPress={action.onPress}
                    style={({ pressed }) => ({ flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 14, alignItems: 'center', gap: 6, borderWidth: 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                      <Ionicons name={action.icon} size={20} color={brand.blue} />
                    </View>
                    <Text style={{ fontWeight: '700', fontSize: 12, color: colors.label, textAlign: 'center' }}>{action.label}</Text>
                    {action.note ? <Text style={{ fontSize: 10, color: colors.secondaryLabel, textAlign: 'center' }}>{action.note}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showAddOrderModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddOrderModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setShowAddOrderModal(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Add Court Order</Text>
            <Pressable onPress={handleAddOrder} disabled={orderSaving}>
              {orderSaving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Title *</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 15, color: colors.label }}
                placeholder="e.g. Maintenance Order, Parenting Plan" placeholderTextColor={colors.secondaryLabel}
                value={orderTitle} onChangeText={setOrderTitle} autoFocus />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Reference Number (optional)</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 15, color: colors.label }}
                placeholder="e.g. Case 12345/2026" placeholderTextColor={colors.secondaryLabel}
                value={orderRef} onChangeText={setOrderRef} />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Due Date (optional)</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 15, color: colors.label }}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.secondaryLabel}
                keyboardType="numbers-and-punctuation" value={orderDueDate} onChangeText={setOrderDueDate} />
            </View>
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['active', 'pending'] as const).map(s => (
                  <Pressable key={s} onPress={() => setOrderStatus(s)}
                    style={({ pressed }) => ({ flex: 1, paddingVertical: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: orderStatus === s ? brand.blue : colors.surface, borderWidth: orderStatus === s ? 0 : 0.5, borderColor: colors.separator, alignItems: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: orderStatus === s ? '#fff' : colors.secondaryLabel }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showLogModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowLogModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setShowLogModal(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Log Compliance Event</Text>
            <Pressable onPress={handleLogEvent} disabled={logSaving}>
              {logSaving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Event Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {EVENT_TYPES.map(type => (
                    <Pressable key={type} onPress={() => setLogEventType(type)}
                      style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: logEventType === type ? 0 : 0.5, borderColor: colors.separator, backgroundColor: logEventType === type ? brand.blue : colors.surface, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: logEventType === type ? '#fff' : colors.secondaryLabel }}>
                        {type.replace(/_/g, ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Description</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 15, color: colors.label, minHeight: 100, textAlignVertical: 'top' }}
                placeholder="Describe what happened…" placeholderTextColor={colors.secondaryLabel}
                multiline value={logText} onChangeText={setLogText} autoFocus />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
