import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Child {
  id: string;
  name: string;
}

interface ReportCard {
  id: string;
  file_name: string;
  description: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

interface SchoolEvent {
  id: string;
  event_type: string | null;
  event_date: string;
  notes: string | null;
}

interface SchoolNotice {
  id: string;
  school_name: string | null;
  notice_text: string | null;
  child_id: string | null;
  notice_date: string | null;
  category: string | null;
  created_at: string;
}

type Section = 'reports' | 'events' | 'notices';

const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Term 4'];
const CATEGORIES = ['General', 'Urgent', 'Permission'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Child Selector ────────────────────────────────────────────────────────────

function ChildSelector({
  children,
  selected,
  onSelect,
}: {
  children: Child[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 4 }}
    >
      <Pressable
        onPress={() => onSelect(null)}
        style={({ pressed }) => ({
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: selected === null ? brand.blue : brand.card,
          borderWidth: 1.5,
          borderColor: selected === null ? brand.blue : brand.separator,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: selected === null ? '#fff' : brand.body }}>
          All
        </Text>
      </Pressable>
      {children.map((child) => (
        <Pressable
          key={child.id}
          onPress={() => onSelect(child.id)}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: selected === child.id ? brand.blue : brand.card,
            borderWidth: 1.5,
            borderColor: selected === child.id ? brand.blue : brand.separator,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: selected === child.id ? '#fff' : brand.body }}>
            {child.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Section Tabs ──────────────────────────────────────────────────────────────

function SectionTabs({
  active,
  onSelect,
}: {
  active: Section;
  onSelect: (s: Section) => void;
}) {
  const tabs: { key: Section; label: string }[] = [
    { key: 'reports', label: 'Report Cards' },
    { key: 'events', label: 'School Events' },
    { key: 'notices', label: 'Notices' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: brand.card,
        borderBottomWidth: 1,
        borderBottomColor: brand.separator,
      }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onSelect(tab.key)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            borderBottomWidth: 2.5,
            borderBottomColor: active === tab.key ? brand.blue : 'transparent',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: active === tab.key ? '700' : '500',
              color: active === tab.key ? brand.blue : brand.body,
            }}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Upload Report Card Modal ──────────────────────────────────────────────────

function UploadReportModal({
  visible,
  onClose,
  onSaved,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  children: Child[];
}) {
  const insets = useSafeAreaInsets();
  const [term, setTerm] = useState(TERMS[0]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [childId, setChildId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const fileName = `${term} ${year}${childId ? ` — ${children.find(c => c.id === childId)?.name ?? ''}` : ''}`;
      const { error } = await supabase.from('legal_documents').insert({
        user_id: user.id,
        document_type: 'school',
        file_name: fileName,
        description: `${term} ${year} report card`,
        metadata: { term, year, child_id: childId },
      });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save report card.');
    } finally {
      setSaving(false);
    }
  }, [term, year, childId, children, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: brand.lightBg }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            paddingTop: insets.top + 12,
            backgroundColor: brand.card,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          <Pressable onPress={onClose}>
            <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Upload Report Card</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>
              {saving ? 'Saving…' : 'Upload'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Term
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {TERMS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTerm(t)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: term === t ? brand.blue : brand.card,
                    borderWidth: 1.5,
                    borderColor: term === t ? brand.blue : brand.separator,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: term === t ? '#fff' : brand.body }}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Year
            </Text>
            <TextInput
              style={{
                backgroundColor: brand.card,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: brand.separator,
                padding: 14,
                fontSize: 16,
                color: brand.dark,
                borderCurve: 'continuous',
              }}
              placeholder="2026"
              placeholderTextColor={brand.body}
              keyboardType="numeric"
              value={year}
              onChangeText={setYear}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Child (optional)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => setChildId(null)}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: childId === null ? brand.blue : brand.card,
                  borderWidth: 1.5,
                  borderColor: childId === null ? brand.blue : brand.separator,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: childId === null ? '#fff' : brand.body }}>All</Text>
              </Pressable>
              {children.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setChildId(c.id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: childId === c.id ? brand.blue : brand.card,
                    borderWidth: 1.5,
                    borderColor: childId === c.id ? brand.blue : brand.separator,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: childId === c.id ? '#fff' : brand.body }}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ backgroundColor: brand.lightBg, borderRadius: 12, padding: 14 }}>
            <Text style={{ fontSize: 13, color: brand.body, lineHeight: 18 }}>
              Document file upload support coming soon. This will log the report card record — attach a file in the next update.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Notice Modal ──────────────────────────────────────────────────────────

function AddNoticeModal({
  visible,
  onClose,
  onSaved,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  children: Child[];
}) {
  const insets = useSafeAreaInsets();
  const [schoolName, setSchoolName] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [childId, setChildId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!noticeText.trim()) {
      Alert.alert('Notice text required', 'Please enter the notice details.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase.from('school_notices' as any) as any).insert({
        user_id: user.id,
        school_name: schoolName.trim() || null,
        notice_text: noticeText.trim(),
        child_id: childId,
        notice_date: date,
        category,
      });
      if (error) throw error;
      setSchoolName('');
      setNoticeText('');
      setChildId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setCategory(CATEGORIES[0]);
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save notice.');
    } finally {
      setSaving(false);
    }
  }, [schoolName, noticeText, childId, date, category, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: brand.lightBg }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            paddingTop: insets.top + 12,
            backgroundColor: brand.card,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          <Pressable onPress={onClose}>
            <Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: brand.dark }}>Add Notice</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text style={{ color: saving ? brand.body : brand.blue, fontSize: 16, fontWeight: '600' }}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              School Name (optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: brand.card,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: brand.separator,
                padding: 14,
                fontSize: 15,
                color: brand.dark,
                borderCurve: 'continuous',
              }}
              placeholder="e.g. Springfield Primary"
              placeholderTextColor={brand.body}
              value={schoolName}
              onChangeText={setSchoolName}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Notice *
            </Text>
            <TextInput
              style={{
                backgroundColor: brand.card,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: brand.separator,
                padding: 14,
                fontSize: 15,
                color: brand.dark,
                minHeight: 120,
                textAlignVertical: 'top',
                borderCurve: 'continuous',
              }}
              placeholder="Paste or type the school notice here…"
              placeholderTextColor={brand.body}
              multiline
              value={noticeText}
              onChangeText={setNoticeText}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Date
            </Text>
            <TextInput
              style={{
                backgroundColor: brand.card,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: brand.separator,
                padding: 14,
                fontSize: 15,
                color: brand.dark,
                borderCurve: 'continuous',
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={brand.body}
              value={date}
              onChangeText={setDate}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Category
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor:
                      category === cat
                        ? cat === 'Urgent'
                          ? brand.error
                          : brand.blue
                        : brand.card,
                    borderWidth: 1.5,
                    borderColor:
                      category === cat
                        ? cat === 'Urgent'
                          ? brand.error
                          : brand.blue
                        : brand.separator,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                    borderCurve: 'continuous',
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: category === cat ? '#fff' : brand.body,
                    }}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: brand.body, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Child (optional)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setChildId(null)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: childId === null ? brand.blue : brand.card,
                    borderWidth: 1.5,
                    borderColor: childId === null ? brand.blue : brand.separator,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: childId === null ? '#fff' : brand.body }}>All</Text>
                </Pressable>
                {children.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setChildId(c.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: childId === c.id ? brand.blue : brand.card,
                      borderWidth: 1.5,
                      borderColor: childId === c.id ? brand.blue : brand.separator,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: childId === c.id ? '#fff' : brand.body }}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SchoolHubScreen() {
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState<Section>('reports');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([]);
  const [notices, setNotices] = useState<SchoolNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [childRes, reportRes, eventRes, noticeRes] = await Promise.all([
        supabase.from('children' as any).select('id, name').order('name'),
        supabase
          .from('legal_documents')
          .select('*')
          .eq('document_type', 'school')
          .order('created_at', { ascending: false }),
        supabase
          .from('calendar_events' as any)
          .select('*')
          .ilike('event_type' as any, '%school%')
          .order('event_date' as any),
        (supabase.from('school_notices' as any) as any)
          .select('*')
          .order('created_at', { ascending: false }),
      ]);
      if (childRes.data) setChildren(childRes.data as unknown as Child[]);
      if (reportRes.data) setReportCards(reportRes.data as unknown as ReportCard[]);
      if (eventRes.data) setSchoolEvents(eventRes.data as unknown as SchoolEvent[]);
      if (noticeRes.data) setNotices(noticeRes.data as unknown as SchoolNotice[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Report Cards tab ────────────────────────────────────────────────────────

  const renderReportCards = () => {
    const filtered = selectedChild
      ? reportCards.filter((r) => r.metadata?.child_id === selectedChild)
      : reportCards;

    return (
      <View style={{ padding: 20, gap: 12 }}>
        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View
            style={{
              backgroundColor: brand.card,
              borderRadius: 20,
              padding: 40,
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 2px 12px rgba(43,116,214,0.07)',
            }}
          >
            <Ionicons name="bar-chart-outline" size={40} color={brand.body} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark }}>No report cards yet</Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
              Upload term report cards to keep track of school progress
            </Text>
            <Pressable
              onPress={() => setShowUploadModal(true)}
              style={({ pressed }) => ({
                marginTop: 4,
                backgroundColor: brand.blue,
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Upload Report Card</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map((report) => (
            <View
              key={report.id}
              style={{
                backgroundColor: brand.card,
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
                borderCurve: 'continuous',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: brand.lightBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Ionicons name="bar-chart-outline" size={24} color={brand.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>{report.file_name}</Text>
                {report.description ? (
                  <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }}>{report.description}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8, marginLeft: 8 }}>
                <Text style={{ fontSize: 11, color: brand.body }}>{formatDate(report.created_at)}</Text>
                <Pressable
                  onPress={() => Alert.alert('Coming Soon', 'Document viewer coming soon')}
                  style={({ pressed }) => ({
                    backgroundColor: brand.lightBg,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: brand.blue,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: brand.blue }}>View</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {filtered.length > 0 && (
          <Pressable
            onPress={() => setShowUploadModal(true)}
            style={({ pressed }) => ({
              backgroundColor: brand.blue,
              borderRadius: 16,
              padding: 18,
              alignItems: 'center',
              marginTop: 4,
              opacity: pressed ? 0.85 : 1,
              boxShadow: '0 4px 14px rgba(43,116,214,0.30)',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Upload Report Card</Text>
          </Pressable>
        )}
      </View>
    );
  };

  // ── School Events tab ───────────────────────────────────────────────────────

  const renderSchoolEvents = () => {
    return (
      <View style={{ padding: 20, gap: 12 }}>
        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : schoolEvents.length === 0 ? (
          <View
            style={{
              backgroundColor: brand.card,
              borderRadius: 20,
              padding: 40,
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 2px 12px rgba(43,116,214,0.07)',
            }}
          >
            <Ionicons name="school-outline" size={40} color={brand.body} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark }}>No school events yet</Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
              School events are logged via the Calendar — tap below to add one
            </Text>
          </View>
        ) : (
          schoolEvents.map((event) => (
            <View
              key={event.id}
              style={{
                backgroundColor: brand.card,
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
                borderCurve: 'continuous',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: brand.lightBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Ionicons name="school-outline" size={24} color={brand.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: brand.dark }}>
                  {event.event_type || 'School Event'}
                </Text>
                {event.notes ? (
                  <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }} numberOfLines={2}>{event.notes}</Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 12, color: brand.body, marginLeft: 8 }}>
                {event.event_date}
              </Text>
            </View>
          ))
        )}

        <Pressable
          onPress={() => {
            Alert.alert(
              'Add School Event',
              'School events are managed in the Calendar. Head there to add a school event.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go to Calendar', onPress: () => router.push('/(tabs)/calendar') },
              ]
            );
          }}
          style={({ pressed }) => ({
            backgroundColor: brand.blue,
            borderRadius: 16,
            padding: 18,
            alignItems: 'center',
            marginTop: 4,
            opacity: pressed ? 0.85 : 1,
            boxShadow: '0 4px 14px rgba(43,116,214,0.30)',
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Add School Event</Text>
        </Pressable>
      </View>
    );
  };

  // ── Notices tab ─────────────────────────────────────────────────────────────

  const renderNotices = () => {
    const filtered = selectedChild
      ? notices.filter((n) => n.child_id === selectedChild || n.child_id === null)
      : notices;

    return (
      <View style={{ padding: 20, gap: 12 }}>
        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View
            style={{
              backgroundColor: brand.card,
              borderRadius: 20,
              padding: 40,
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 2px 12px rgba(43,116,214,0.07)',
            }}
          >
            <Ionicons name="mail-outline" size={40} color={brand.body} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.dark }}>No notices logged</Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>
              Add any important school communications here
            </Text>
            <Pressable
              onPress={() => setShowNoticeModal(true)}
              style={({ pressed }) => ({
                marginTop: 4,
                backgroundColor: brand.blue,
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add Notice</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {filtered.map((notice) => {
              const isUrgent = notice.category === 'Urgent';
              return (
                <View
                  key={notice.id}
                  style={{
                    backgroundColor: brand.card,
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: '0 1px 8px rgba(43,116,214,0.07)',
                    borderCurve: 'continuous',
                    borderLeftWidth: isUrgent ? 4 : 0,
                    borderLeftColor: isUrgent ? brand.error : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      {notice.school_name ? (
                        <Text style={{ fontSize: 13, fontWeight: '700', color: brand.blue, marginBottom: 4 }}>
                          {notice.school_name}
                        </Text>
                      ) : null}
                      <Text style={{ fontSize: 15, color: brand.dark, lineHeight: 21 }}>
                        {notice.notice_text}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 12, alignItems: 'flex-end', gap: 6 }}>
                      <Text style={{ fontSize: 11, color: brand.body }}>{notice.notice_date || formatDate(notice.created_at)}</Text>
                      {notice.category ? (
                        <View
                          style={{
                            backgroundColor: isUrgent ? '#FEF2F2' : brand.lightBg,
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: isUrgent ? brand.error : brand.blue,
                            }}
                          >
                            {notice.category}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
            <Pressable
              onPress={() => setShowNoticeModal(true)}
              style={({ pressed }) => ({
                backgroundColor: brand.blue,
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
                marginTop: 4,
                opacity: pressed ? 0.85 : 1,
                boxShadow: '0 4px 14px rgba(43,116,214,0.30)',
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Add Notice</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'School Hub',
          headerTintColor: brand.blue,
          headerStyle: { backgroundColor: brand.card },
        }}
      />

      <View style={{ flex: 1, backgroundColor: brand.lightBg }}>
        {/* Child selector */}
        <View
          style={{
            backgroundColor: brand.card,
            paddingTop: 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: brand.separator,
          }}
        >
          <ChildSelector children={children} selected={selectedChild} onSelect={setSelectedChild} />
        </View>

        {/* Section tabs */}
        <SectionTabs active={activeSection} onSelect={setActiveSection} />

        {/* Content */}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}
        >
          {activeSection === 'reports' && renderReportCards()}
          {activeSection === 'events' && renderSchoolEvents()}
          {activeSection === 'notices' && renderNotices()}
        </ScrollView>
      </View>

      <UploadReportModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSaved={() => { setShowUploadModal(false); loadData(); }}
        children={children}
      />
      <AddNoticeModal
        visible={showNoticeModal}
        onClose={() => setShowNoticeModal(false)}
        onSaved={() => { setShowNoticeModal(false); loadData(); }}
        children={children}
      />
    </>
  );
}
