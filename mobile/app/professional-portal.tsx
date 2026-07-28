import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/use-permissions';

type ProfessionalLink = {
  id: string;
  status: string;
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

  const loadLinks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('professional_links' as any)
      .select('*, parent:parent_id(full_name, email)')
      .eq('professional_id', user.id)
      .eq('status', 'active');
    setLinks((data as ProfessionalLink[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (permLoading) return;
    if (!permissions.canAccessProfessionalPortal) { setLoading(false); return; }
    loadLinks();
  }, [permLoading, permissions.canAccessProfessionalPortal, loadLinks]);

  if (permLoading || loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Professional Portal', headerTintColor: brand.blue }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.lightBg }}>
          <ActivityIndicator size="large" color={brand.blue} />
        </View>
      </>
    );
  }

  if (!permissions.canAccessProfessionalPortal) {
    return (
      <>
        <Stack.Screen options={{ title: 'Professional Portal', headerTintColor: brand.blue }} />
        <View style={{ flex: 1, backgroundColor: brand.lightBg, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: brand.card, borderRadius: 20, padding: 32, alignItems: 'center', boxShadow: '0 2px 12px rgba(43,116,214,0.08)', maxWidth: 320, borderCurve: 'continuous' }}>
            <Ionicons name="shield-checkmark-outline" size={48} color={brand.blue} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: brand.dark, textAlign: 'center', marginBottom: 8 }}>
              Professional Access Required
            </Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center', lineHeight: 20 }}>
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
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.lightBg }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Math.max(insets.bottom, 24) }}
      >
        {/* Professional identity card */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 16,
            padding: 16,
            borderLeftWidth: 4,
            borderLeftColor: brand.blue,
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            borderCurve: 'continuous',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: brand.teal,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="scale-outline" size={24} color={brand.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: brand.blue, fontWeight: '600' }}>Professional View</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: brand.body, lineHeight: 18 }}>
            You have read-only access to the families that have invited you.
          </Text>
        </View>

        {/* Linked Families */}
        <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>
          Linked Families
        </Text>

        {links.length === 0 ? (
          <View
            style={{
              backgroundColor: brand.card,
              borderRadius: 16,
              padding: 32,
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 1px 6px rgba(43,116,214,0.07)',
              borderCurve: 'continuous',
            }}
          >
            <Ionicons name="people-outline" size={36} color={brand.body} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>No linked families</Text>
            <Text style={{ fontSize: 13, color: brand.body, textAlign: 'center', lineHeight: 18 }}>
              A parent must invite you from their SupportCard app before you can view their records.
            </Text>
          </View>
        ) : (
          links.map((link) => {
            const initial = (link.parent?.full_name || link.parent?.email || '?')[0].toUpperCase();
            return (
              <View
                key={link.id}
                style={{
                  backgroundColor: brand.card,
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: '0 1px 6px rgba(43,116,214,0.07)',
                  borderCurve: 'continuous',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: brand.lightBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 18, color: brand.blue }}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>
                      {link.parent?.full_name ?? 'Parent'}
                    </Text>
                    {link.parent?.email ? (
                      <Text selectable style={{ fontSize: 13, color: brand.body }}>{link.parent.email}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={{ backgroundColor: '#E6F9F1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, color: brand.teal, fontWeight: '600' }}>Active</Text>
                    </View>
                    <Pressable
                      onPress={() => Alert.alert('View Records', 'Viewing family records — read only.')}
                      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    >
                      <Text style={{ color: brand.blue, fontSize: 13, fontWeight: '500' }}>View Records</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Read-only record access section */}
        <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Read-Only Record Access</Text>

        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            borderCurve: 'continuous',
          }}
        >
          {RECORD_ROWS.map((row, i) => (
            <View key={row.title}>
              {i > 0 && (
                <View style={{ height: 1, backgroundColor: brand.separator, marginLeft: 48 }} />
              )}
              <Pressable
                onPress={() => Alert.alert(row.title, `Viewing as professional — read only.`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={row.icon} size={18} color={brand.blue} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, color: brand.dark }}>{row.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={brand.body} style={{ opacity: 0.5 }} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* Note card */}
        <View
          style={{
            backgroundColor: brand.card,
            borderRadius: 14,
            padding: 14,
            borderLeftWidth: 3,
            borderLeftColor: brand.blue,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            borderCurve: 'continuous',
          }}
        >
          <Text style={{ fontSize: 13, color: brand.body, lineHeight: 18 }}>
            All access is read-only. You cannot modify, approve or dispute any records.
          </Text>
        </View>

        {/* Bulk export — only when families are linked */}
        {links.length > 0 && (
          <Pressable
            onPress={() => Alert.alert('Bulk PDF Export', 'Bulk PDF export — generating report…')}
            style={({ pressed }) => ({
              backgroundColor: brand.blue,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
              boxShadow: '0 4px 12px rgba(43,116,214,0.25)',
              borderCurve: 'continuous',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Generate Bulk Report</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}
