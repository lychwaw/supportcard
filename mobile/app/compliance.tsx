import { useState, useEffect, useCallback } from 'react';
import { router, Stack } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourtOrder {
  id: string;
  title?: string;
  reference_number?: string;
  due_date?: string;
  status?: string;
  created_at: string;
}

interface ComplianceLog {
  id: string;
  event_type: string;
  description?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Stats derived from real data ─────────────────────────────────────────────

function computeStats(orders: CourtOrder[], logs: ComplianceLog[]) {
  const activeCount = orders.filter(o => o.status === 'active').length;

  // Next upcoming due date from active/pending orders
  const upcoming = orders
    .filter(o => o.due_date && (o.status === 'active' || o.status === 'pending'))
    .map(o => new Date(o.due_date!))
    .filter(d => d >= new Date())
    .sort((a, b) => a.getTime() - b.getTime());
  let nextLabel = '—';
  if (upcoming.length > 0) {
    const diff = Math.ceil((upcoming[0].getTime() - Date.now()) / 86_400_000);
    nextLabel = diff === 0 ? 'Today' : diff === 1 ? '1 day' : `${diff} days`;
  }

  // Compliance rate this calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthLogs = logs.filter(l => new Date(l.created_at) >= monthStart);
  const rateLabel = thisMonthLogs.length === 0 ? '—' : `${thisMonthLogs.length} event${thisMonthLogs.length !== 1 ? 's' : ''}`;

  return { activeCount, nextLabel, rateLabel };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface OverviewCardProps {
  value: string;
  label: string;
  bg: string;
}

function OverviewCard({ value, label, bg }: OverviewCardProps) {
  return (
    <View
      style={{
        width: 120,
        height: 90,
        borderRadius: 16,
        backgroundColor: bg,
        padding: 14,
        justifyContent: 'space-between',
        borderCurve: 'continuous',
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>
        {label}
      </Text>
    </View>
  );
}

interface StatusBadgeProps {
  status: string | undefined;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === 'active';
  return (
    <View
      style={{
        backgroundColor: isActive ? '#E6F9F1' : '#FEF3C7',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: isActive ? brand.teal : '#D97706',
        }}
      >
        {isActive ? 'Active' : 'Pending'}
      </Text>
    </View>
  );
}

function CourtOrderCard({ order }: { order: CourtOrder }) {
  return (
    <View
      style={{
        backgroundColor: brand.card,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        borderCurve: 'continuous',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: brand.blue,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Text style={{ fontSize: 18 }}>📋</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontWeight: '600', fontSize: 15, color: brand.dark }}>
            {order.title ?? 'Court Order'}
          </Text>
          {order.reference_number ? (
            <Text selectable style={{ color: brand.body, fontSize: 12 }}>
              Ref: {order.reference_number}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <View
              style={{
                backgroundColor: brand.lightBg,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 12, color: brand.blue, fontWeight: '500' }}>
                Due {formatDate(order.due_date)}
              </Text>
            </View>
            <StatusBadge status={order.status} />
          </View>
        </View>
      </View>
    </View>
  );
}

interface QuickActionProps {
  icon: string;
  label: string;
  note?: string;
  onPress: () => void;
}

function QuickActionButton({ icon, label, note, onPress }: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: brand.card,
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.7 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        borderCurve: 'continuous',
      })}
    >
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text style={{ fontWeight: '600', fontSize: 13, color: brand.dark, textAlign: 'center' }}>
        {label}
      </Text>
      {note ? (
        <Text style={{ fontSize: 11, color: brand.body, textAlign: 'center' }}>{note}</Text>
      ) : null}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ComplianceScreen() {
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<CourtOrder[]>([]);
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logText, setLogText] = useState('');
  const [logEventType, setLogEventType] = useState('custody_exchange');
  const [logSaving, setLogSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, logsRes] = await Promise.all([
        supabase
          .from('court_orders' as any)
          .select('*')
          .order('due_date', { ascending: true }),
        supabase
          .from('compliance_logs' as any)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setOrders((ordersRes.data as unknown as CourtOrder[] | null) ?? []);
      setLogs((logsRes.data as unknown as ComplianceLog[] | null) ?? []);
    } catch {
      // tables may not exist yet — show empty state
      setOrders([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogEvent = useCallback(async () => {
    if (!logText.trim()) return;
    setLogSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase.from('compliance_logs' as any) as any).insert({
        user_id: user.id,
        event_type: logEventType,
        description: logText.trim(),
        source: 'manual',
      });
      if (error) throw error;
      setShowLogModal(false);
      setLogText('');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save event.');
    } finally {
      setLogSaving(false);
    }
  }, [logEventType, logText, loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <Stack.Screen options={{ title: 'Compliance', headerTintColor: brand.blue }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.lightBg }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        {loading ? (
          <View style={{ paddingTop: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={brand.blue} />
          </View>
        ) : (
          <>
            {/* Overview cards */}
            {(() => {
              const { activeCount, nextLabel, rateLabel } = computeStats(orders, logs);
              return (
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                  <Text
                    style={{
                      fontWeight: '700',
                      fontSize: 13,
                      color: brand.body,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      marginBottom: 10,
                    }}
                  >
                    Overview
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    <OverviewCard value={String(activeCount)} label="Active Orders" bg={brand.blue} />
                    <OverviewCard value={nextLabel} label="Next Due" bg="#F59E0B" />
                    <OverviewCard value={rateLabel} label="This Month" bg={brand.teal} />
                  </ScrollView>
                </View>
              );
            })()}

            {/* Court Orders */}
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 17, color: brand.dark }}>
                  Court Orders & Obligations
                </Text>
                <Pressable
                  onPress={() => Alert.alert('Add Court Order', 'Court order logging coming soon. For now, contact support to add orders.')}
                  hitSlop={12}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: brand.blue }}>+ Add</Text>
                </Pressable>
              </View>

              {orders.length === 0 && (
                <View
                  style={{
                    backgroundColor: brand.card,
                    borderRadius: 14,
                    padding: 24,
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  <Text style={{ fontSize: 32 }}>📋</Text>
                  <Text style={{ fontWeight: '600', fontSize: 15, color: brand.dark }}>No court orders yet</Text>
                  <Text style={{ color: brand.body, fontSize: 13, textAlign: 'center' }}>
                    Log your parenting plan and maintenance orders to track compliance
                  </Text>
                </View>
              )}

              {orders.map((order) => (
                <CourtOrderCard key={order.id} order={order} />
              ))}
            </View>

            {/* Compliance Log */}
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 17,
                  color: brand.dark,
                  marginBottom: 12,
                }}
              >
                Recent Compliance Log
              </Text>

              {logs.length === 0 ? (
                <View
                  style={{
                    backgroundColor: brand.card,
                    borderRadius: 14,
                    padding: 24,
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    borderCurve: 'continuous',
                  }}
                >
                  <Text style={{ fontSize: 36 }}>📊</Text>
                  <Text style={{ fontWeight: '600', fontSize: 15, color: brand.dark }}>
                    No compliance events logged
                  </Text>
                  <Text
                    style={{
                      color: brand.body,
                      fontSize: 13,
                      textAlign: 'center',
                      lineHeight: 18,
                    }}
                  >
                    Events like custody exchanges and expense approvals are automatically logged.
                  </Text>
                </View>
              ) : (
                logs.map((log) => (
                  <View
                    key={log.id}
                    style={{
                      backgroundColor: brand.card,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      borderCurve: 'continuous',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: brand.lightBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>✅</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 14, color: brand.dark }}>
                          {log.event_type}
                        </Text>
                        {log.description ? (
                          <Text style={{ color: brand.body, fontSize: 13 }}>{log.description}</Text>
                        ) : null}
                      </View>
                      <Text style={{ color: brand.body, fontSize: 12 }}>
                        {formatDate(log.created_at)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Quick Actions */}
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 17,
                  color: brand.dark,
                  marginBottom: 12,
                }}
              >
                Quick Actions
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <QuickActionButton
                  icon="📄"
                  label="Export Report"
                  note="PDF on Premium"
                  onPress={() => router.push('/my-scai')}
                />
                <QuickActionButton
                  icon="📝"
                  label="Log Event"
                  onPress={() => setShowLogModal(true)}
                />
                <QuickActionButton
                  icon="📅"
                  label="View Calendar"
                  onPress={() => router.push('/(tabs)/calendar' as any)}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Log Event Modal */}
      <Modal visible={showLogModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowLogModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: brand.lightBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: brand.card, borderBottomWidth: 1, borderBottomColor: brand.separator }}>
            <Pressable onPress={() => setShowLogModal(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Log Compliance Event</Text>
            <Pressable onPress={handleLogEvent} disabled={logSaving}>
              <Text style={{ color: logSaving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>{logSaving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Event Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['custody_exchange','expense_approved','court_order_met','school_pickup','medical_visit','other'].map(type => (
                    <Pressable key={type} onPress={() => setLogEventType(type)}
                      style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: logEventType === type ? brand.blue : brand.separator, backgroundColor: logEventType === type ? brand.lightBg : brand.card, opacity: pressed ? 0.7 : 1 })}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: logEventType === type ? brand.blue : brand.body }}>
                        {type.replace(/_/g, ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>Description</Text>
              <TextInput
                style={{ backgroundColor: brand.card, borderRadius: 12, borderWidth: 1.5, borderColor: brand.separator, padding: 14, fontSize: 15, color: brand.dark, minHeight: 100, textAlignVertical: 'top', borderCurve: 'continuous' }}
                placeholder="Describe what happened…"
                placeholderTextColor={brand.body}
                multiline
                value={logText}
                onChangeText={setLogText}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
