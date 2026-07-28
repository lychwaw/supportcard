import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

type Goal = { id: string; title: string; target_amount: number; child_id: string | null; child?: { name: string } | null };
type Contribution = { id: string; amount: number; note: string | null; created_at: string; contributor?: { full_name: string | null } | null };

const CONTRIBUTION_TOTALS = new Map<string, number>();

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
    const goals = (g || []) as Goal[];
    setGoals(goals);

    const totals = new Map<string, number>();
    for (const goal of goals) {
      const { data: contribs } = await supabase.from('goal_contributions' as any)
        .select('amount').eq('goal_id', goal.id);
      totals.set(goal.id, ((contribs || []) as any[]).reduce((s: number, c: any) => s + Number(c.amount), 0));
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
    await supabase.from('child_goals' as any).insert({ title: goalTitle.trim(), target_amount: target, created_by: user.id });
    setSaving(false); setShowAdd(false); setGoalTitle(''); setGoalTarget(''); load();
  };

  const addContribution = async (goalId: string) => {
    const amt = parseFloat(contribAmount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from('goal_contributions' as any).insert({ goal_id: goalId, amount: amt, note: contribNote.trim() || null, contributor_id: user.id });
    setSaving(false); setShowContrib(null); setContribAmount(''); setContribNote(''); load();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Goals & Wishlist', headerTintColor: brand.blue, headerStyle: { backgroundColor: brand.card } }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: brand.lightBg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>

        <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: brand.blue }}>
          <Text style={{ fontSize: 13, color: brand.body, lineHeight: 19 }}>
            Goals track savings contributions as an append-only ledger. No money moves through the app — contributions are logged for transparency only.
          </Text>
        </View>

        <Pressable onPress={() => setShowAdd(true)}
          style={{ backgroundColor: brand.blue, borderRadius: 14, padding: 16, alignItems: 'center', boxShadow: '0 4px 12px rgba(43,116,214,0.25)' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Add Goal</Text>
        </Pressable>

        {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 24 }} /> : goals.length === 0 ? (
          <View style={{ backgroundColor: brand.card, borderRadius: 20, padding: 40, alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: brand.lightBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="star-outline" size={32} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>No goals yet</Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>Create savings goals for your children's education, activities or wishlist items</Text>
          </View>
        ) : goals.map(goal => {
          const raised = contributions.get(goal.id) || 0;
          const pct = Math.min(100, goal.target_amount > 0 ? (raised / goal.target_amount) * 100 : 0);
          return (
            <View key={goal.id} style={{ backgroundColor: brand.card, borderRadius: 16, padding: 20, boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>{goal.title}</Text>
                  {goal.child?.name && <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>For {goal.child.name}</Text>}
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: brand.blue }}>
                  R{raised.toFixed(0)} / R{Number(goal.target_amount).toFixed(0)}
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: brand.lightBg, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? '#22C55E' : brand.blue, borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 12, color: brand.body, marginBottom: 12 }}>{pct.toFixed(0)}% of goal reached</Text>
              <Pressable onPress={() => { setShowContrib(goal.id); setContribAmount(''); setContribNote(''); }}
                style={{ backgroundColor: brand.lightBg, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1.5, borderColor: brand.blue }}>
                <Text style={{ color: brand.blue, fontWeight: '600', fontSize: 14 }}>+ Log Contribution</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet">
        <View style={{ padding: 20, backgroundColor: brand.card, borderBottomWidth: 1, borderBottomColor: brand.separator, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>New Goal</Text>
          <Pressable onPress={addGoal} disabled={saving}><Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, backgroundColor: brand.lightBg }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>GOAL TITLE</Text>
            <TextInput style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 15, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
              placeholder="e.g. School Camp, New Bicycle" placeholderTextColor={brand.body} value={goalTitle} onChangeText={setGoalTitle} />
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>TARGET AMOUNT (R)</Text>
            <TextInput style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 24, fontWeight: '700', color: brand.dark, borderWidth: 1.5, borderColor: brand.separator, textAlign: 'center' }}
              placeholder="0" placeholderTextColor={brand.body} keyboardType="decimal-pad" value={goalTarget} onChangeText={setGoalTarget} />
          </View>
        </ScrollView>
      </Modal>

      {/* Add Contribution Modal */}
      <Modal visible={!!showContrib} animationType="slide" presentationStyle="formSheet">
        <View style={{ padding: 20, backgroundColor: brand.card, borderBottomWidth: 1, borderBottomColor: brand.separator, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setShowContrib(null)}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Log Contribution</Text>
          <Pressable onPress={() => showContrib && addContribution(showContrib)} disabled={saving}>
            <Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>Log</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, backgroundColor: brand.lightBg }}>
          <View style={{ backgroundColor: brand.lightBg, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 12, color: brand.body }}>Contributions are logged for transparency — money transfers happen off-platform via EFT.</Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>AMOUNT (R)</Text>
            <TextInput style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 28, fontWeight: '700', color: brand.dark, borderWidth: 1.5, borderColor: brand.separator, textAlign: 'center' }}
              placeholder="0" placeholderTextColor={brand.body} keyboardType="decimal-pad" value={contribAmount} onChangeText={setContribAmount} />
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, marginBottom: 6 }}>NOTE (OPTIONAL)</Text>
            <TextInput style={{ backgroundColor: brand.card, borderRadius: 12, padding: 16, fontSize: 15, color: brand.dark, borderWidth: 1.5, borderColor: brand.separator }}
              placeholder="e.g. Birthday gift, monthly contribution" placeholderTextColor={brand.body} value={contribNote} onChangeText={setContribNote} />
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}
