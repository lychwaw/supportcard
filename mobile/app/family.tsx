import { useState, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

type Child = { id: string; name: string; custody_split_pct: number };
type CoParent = { id: string; full_name: string | null; email: string | null };

export default function FamilyScreen() {
  const [children, setChildren] = useState<Child[]>([]);
  const [coParent, setCoParent] = useState<CoParent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: kids }, { data: profile }] = await Promise.all([
        supabase.from('children' as any).select('id, name, custody_split_pct').or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`),
        supabase.from('profiles' as any).select('co_parent_id').eq('id', user.id).maybeSingle(),
      ]);
      setChildren((kids as any) || []);
      if ((profile as any)?.co_parent_id) {
        const { data: cp } = await supabase.from('profiles' as any).select('id, full_name, email').eq('id', (profile as any).co_parent_id).maybeSingle();
        setCoParent(cp as any);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.lightBg }}
      contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}
    >
      <Stack.Screen options={{ title: 'Family', headerTintColor: brand.blue, headerStyle: { backgroundColor: brand.card } }} />

      {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} /> : (
        <>
          {/* Co-parent section */}
          <View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark, marginBottom: 12 }}>Co-Parent</Text>
            {coParent ? (
              <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{(coParent.full_name || coParent.email || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: brand.dark }}>{coParent.full_name || 'Co-Parent'}</Text>
                  <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>{coParent.email}</Text>
                </View>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '600' }}>✓ Linked</Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 24, alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>👨‍👧</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>No co-parent linked</Text>
                <Text style={{ fontSize: 13, color: brand.body, marginBottom: 16, textAlign: 'center' }}>Invite your co-parent to start coordinating</Text>
                <Pressable style={{ backgroundColor: brand.blue, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Invite Co-Parent</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Children section */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Children ({children.length})</Text>
              <Pressable style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: brand.blue, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 20, lineHeight: 22 }}>+</Text>
              </Pressable>
            </View>
            {children.length === 0 ? (
              <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 24, alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>👶</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }}>No children yet</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {children.map(child => (
                  <View key={child.id} style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 24 }}>👶</Text>
                      </View>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>{child.name}</Text>
                    </View>
                    {/* Custody split */}
                    <Text style={{ fontSize: 12, color: brand.body, marginBottom: 6 }}>Custody Split</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: brand.blue }}>{child.custody_split_pct}%</Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: brand.lightBg, borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ width: `${child.custody_split_pct}%`, height: '100%', backgroundColor: brand.blue, borderRadius: 3 }} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body }}>{100 - child.custody_split_pct}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
