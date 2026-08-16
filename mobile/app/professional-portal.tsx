import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Alert, ActivityIndicator, Modal, Share } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/use-permissions';

type ProfessionalLink = {
  id: string;
  status: string;
  parent_id?: string;
  parent?: { full_name: string | null; email: string | null } | null;
};

const RECORD_ROWS: Array<{ icon: 'receipt-outline' | 'calendar-outline' | 'document-outline'; title: string }> = [
  { icon: 'receipt-outline',  title: 'Expense Records' },
  { icon: 'calendar-outline', title: 'Calendar & Handoffs' },
  { icon: 'document-outline', title: 'Documents' },
];

export default function ProfessionalPortalScreen() {
  const insets = useSafeAreaInsets();
  const { permissions, loading: permLoading } = usePermissions();
  const [links, setLinks] = useState<ProfessionalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRecordsLink, setViewRecordsLink] = useState<ProfessionalLink | null>(null);
  const [recordsData, setRecordsData] = useState<{ expenses: any[]; events: any[]; docs: any[] } | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const loadLinks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('professional_links' as any)
      .select('*, parent_id, parent:parent_id(full_name, email)')
      .eq('professional_id', user.id)
      .eq('status', 'active');
    setLinks((data as ProfessionalLink[] | null) ?? []);
    setLoading(false);
  }, []);

  const openRecords = useCallback(async (link: ProfessionalLink) => {
    setViewRecordsLink(link);
    setRecordsData(null);
    setRecordsLoading(true);
    try {
      const parentId = link.parent_id ?? (link as any).id;
      const [expRes, evRes, docRes] = await Promise.all([
        supabase.from('expense_requests' as any).select('id,category,amount,status,created_at').eq('requester_id', parentId).order('created_at', { ascending: false }).limit(20),
        supabase.from('calendar_events' as any).select('id,event_type,event_date,notes').order('event_date' as any, { ascending: false }).limit(20),
        supabase.from('legal_documents' as any).select('id,document_type,file_name,created_at').order('created_at', { ascending: false }).limit(20),
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
    const { data: expenses } = await supabase.from('expense_requests' as any).select('category,amount,status,created_at').order('created_at', { ascending: false }).limit(50);
    const { data: events } = await supabase.from('calendar_events' as any).select('event_type,event_date').order('event_date' as any, { ascending: false }).limit(50);
    if (expenses?.length) {
      lines.push('--- EXPENSE RECORDS ---');
      for (const e of expenses as any[]) {
        lines.push(`${(e.created_at as string).slice(0, 10)}  ${e.category}  R${Number(e.amount).toFixed(2)}  [${e.status}]`);
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
                </View>
              );
            })}
          </View>
        )}

        {/* Read-only record access */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel }}>
          Read-Only Record Access
        </Text>

        <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 0.5, borderColor: colors.separator }}>
          {RECORD_ROWS.map((row, i) => (
            <View key={row.title}>
              {i > 0 && <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: 60 }} />}
              <Pressable onPress={() => Alert.alert(row.title, `Viewing as professional — read only.`)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: pressed ? brand.blue + '06' : 'transparent' })}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', marginRight: 14 }}>
                  <Ionicons name={row.icon} size={18} color={brand.blue} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, color: colors.label }}>{row.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.secondaryLabel} style={{ opacity: 0.5 }} />
              </Pressable>
            </View>
          ))}
        </View>

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
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.label, fontVariant: ['tabular-nums'] }}>R{Number(e.amount).toFixed(2)}</Text>
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
    </>
  );
}
