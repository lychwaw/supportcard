import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

type Goal = { id: string; title: string; target_amount: number; child_id: string | null; child?: { name: string } | null };

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showContrib, setShowContrib] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: g } = await supabase.from('child_goals' as any).select('*, child:child_id(name)').order('created_at', { ascending: false });
    const goalList = (g || []) as Goal[];
    setGoals(goalList);

    const goalIds = goalList.map(g => g.id);
    const totals = new Map<string, number>();
    if (goalIds.length > 0) {
      const { data: allContribs } = await supabase
        .from('goal_contributions' as any)
        .select('goal_id, amount')
        .in('goal_id', goalIds);
      for (const c of (allContribs || []) as any[]) {
        totals.set(c.goal_id, (totals.get(c.goal_id) ?? 0) + Number(c.amount));
      }
    }
    setContributions(totals);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addGoal = async () => {
    const target = parseFloat(goalTarget);
    if (!goalTitle.trim() || !target || target <= 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('child_goals' as any).insert({ title: goalTitle.trim(), target_amount: target, created_by: user.id });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowAdd(false); setGoalTitle(''); setGoalTarget(''); load();
  };

  const addContribution = async (goalId: string) => {
    const amt = parseFloat(contribAmount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('goal_contributions' as any).insert({ goal_id: goalId, amount: amt, note: contribNote.trim() || null, contributor_id: user.id });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowContrib(null); setContribAmount(''); setContribNote(''); load();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Goals & Wishlist', headerTintColor: brand.blue }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Info card */}
        <View style={{ backgroundColor: brand.blue + '10', borderRadius: 16, borderCurve: 'continuous', borderLeftWidth: 3, borderLeftColor: brand.blue, padding: 16 }}>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>
            Goals track savings contributions as an append-only ledger. No money moves through the app — contributions are logged for transparency only.
          </Text>
        </View>

        {/* Add button */}
        <Pressable onPress={() => setShowAdd(true)}
          style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 16, borderCurve: 'continuous', padding: 16, alignItems: 'center', boxShadow: '0 4px 12px rgba(43,116,214,0.25)', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Add Goal</Text>
        </Pressable>

        {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 24 }} /> : goals.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 40, alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderCurve: 'continuous' }}>
              <Ionicons name="star-outline" size={32} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label, marginBottom: 6 }}>No goals yet</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 20 }}>
              Create savings goals for your children's education, activities or wishlist items
            </Text>
          </View>
        ) : goals.map(goal => {
          const raised = contributions.get(goal.id) || 0;
          const pct = Math.min(100, goal.target_amount > 0 ? (raised / goal.target_amount) * 100 : 0);
          const done = pct >= 100;
          return (
            <View key={goal.id} style={{ backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', padding: 20, borderWidth: 0.5, borderColor: colors.separator }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>{goal.title}</Text>
                  {goal.child?.name && <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>For {goal.child.name}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: done ? '#22C55E' : brand.blue, fontVariant: ['tabular-nums'] }}>
                    R{raised.toFixed(0)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>
                    / R{Number(goal.target_amount).toFixed(0)}
                  </Text>
                </View>
              </View>
              <View style={{ height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: done ? '#22C55E' : brand.blue, borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginBottom: 14, fontVariant: ['tabular-nums'] }}>
                {pct.toFixed(0)}% of goal reached
              </Text>
              <Pressable onPress={() => { setShowContrib(goal.id); setContribAmount(''); setContribNote(''); }}
                style={({ pressed }) => ({
                  backgroundColor: brand.blue + '10', borderRadius: 12, borderCurve: 'continuous',
                  padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: brand.blue + '40',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}>
                <Text style={{ color: brand.blue, fontWeight: '700', fontSize: 14 }}>+ Log Contribution</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={{ padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>New Goal</Text>
          <Pressable onPress={addGoal} disabled={saving}>
            {saving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} style={{ backgroundColor: colors.background }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Goal Title</Text>
            <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 16, fontSize: 15, color: colors.label, borderWidth: 0.5, borderColor: colors.separator }}
              placeholder="e.g. School Camp, New Bicycle" placeholderTextColor={colors.secondaryLabel} value={goalTitle} onChangeText={setGoalTitle} autoFocus />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Target Amount (R)</Text>
            <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 16, fontSize: 28, fontWeight: '700', color: colors.label, borderWidth: 0.5, borderColor: colors.separator, textAlign: 'center', fontVariant: ['tabular-nums'] }}
              placeholder="0" placeholderTextColor={colors.secondaryLabel} keyboardType="decimal-pad" value={goalTarget}
              onChangeText={v => setGoalTarget(v.replace(/[^0-9.]/g, '').replace(/^0+([1-9])/, '$1'))} />
          </View>
        </ScrollView>
      </Modal>

      {/* Add Contribution Modal */}
      <Modal visible={!!showContrib} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowContrib(null)}>
        <View style={{ padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setShowContrib(null)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Log Contribution</Text>
          <Pressable onPress={() => showContrib && addContribution(showContrib)} disabled={saving}>
            {saving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Log</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} style={{ backgroundColor: colors.background }}>
          <View style={{ backgroundColor: brand.blue + '08', borderRadius: 12, borderCurve: 'continuous', padding: 14, borderWidth: 0.5, borderColor: brand.blue + '20' }}>
            <Text style={{ fontSize: 13, color: colors.secondaryLabel, lineHeight: 19 }}>Contributions are logged for transparency — money transfers happen off-platform via EFT.</Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Amount (R)</Text>
            <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 16, fontSize: 32, fontWeight: '700', color: colors.label, borderWidth: 0.5, borderColor: colors.separator, textAlign: 'center', fontVariant: ['tabular-nums'] }}
              placeholder="0" placeholderTextColor={colors.secondaryLabel} keyboardType="decimal-pad" value={contribAmount}
              onChangeText={v => setContribAmount(v.replace(/[^0-9.]/g, '').replace(/^0+([1-9])/, '$1'))} autoFocus />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Note (Optional)</Text>
            <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 16, fontSize: 15, color: colors.label, borderWidth: 0.5, borderColor: colors.separator }}
              placeholder="e.g. Birthday gift, monthly contribution" placeholderTextColor={colors.secondaryLabel} value={contribNote} onChangeText={setContribNote} />
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}
