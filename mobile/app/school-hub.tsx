import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { brand, colors } from '@/theme/colors';

interface Child { id: string; name: string }
interface ReportCard { id: string; file_name: string; description: string | null; created_at: string; metadata: Record<string, any> | null }
interface SchoolEvent { id: string; event_type: string | null; event_date: string; notes: string | null }
interface SchoolNotice { id: string; school_name: string | null; notice_text: string | null; child_id: string | null; notice_date: string | null; category: string | null; created_at: string }

type Section = 'reports' | 'events' | 'notices';

const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Term 4'];
const CATEGORIES = ['General', 'Urgent', 'Permission'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function PillRow({ items, selected, onSelect }: { items: Array<{ id: string; label: string }>; selected: string | null; onSelect: (id: string | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map(item => (
        <Pressable key={item.id} onPress={() => onSelect(item.id === '__all__' ? null : item.id)}
          style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: (item.id === '__all__' ? selected === null : selected === item.id) ? brand.blue : 'transparent', borderWidth: (item.id === '__all__' ? selected === null : selected === item.id) ? 0 : 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: (item.id === '__all__' ? selected === null : selected === item.id) ? '#fff' : colors.secondaryLabel }}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SectionTabs({ active, onSelect }: { active: Section; onSelect: (s: Section) => void }) {
  const tabs: { key: Section; label: string }[] = [
    { key: 'reports', label: 'Report Cards' },
    { key: 'events', label: 'School Events' },
    { key: 'notices', label: 'Notices' },
  ];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
      {tabs.map(tab => (
        <Pressable key={tab.key} onPress={() => onSelect(tab.key)}
          style={({ pressed }) => ({ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: active === tab.key ? brand.blue : 'transparent', opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 13, fontWeight: active === tab.key ? '700' : '500', color: active === tab.key ? brand.blue : colors.secondaryLabel }}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function UploadReportModal({ visible, onClose, onSaved, children }: { visible: boolean; onClose: () => void; onSaved: () => void; children: Child[] }) {
  const insets = useSafeAreaInsets();
  const [term, setTerm] = useState(TERMS[0]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [childId, setChildId] = useState<string | null>(null);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const pickFile = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Please allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) setAsset(result.assets[0]);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const childName = children.find(c => c.id === childId)?.name ?? '';
      const fileName = `${term} ${year}${childName ? ` — ${childName}` : ''}`;

      let filePath: string | null = null;
      if (asset) {
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        const storageName = `school_${term.replace(' ', '')}_${year}_${Date.now()}.${ext}`;
        filePath = `${user.id}/${storageName}`;
        const { data: signedData, error: signErr } = await supabase.storage
          .from('legal-docs').createSignedUploadUrl(filePath);
        if (signErr || !signedData) throw signErr ?? new Error('Could not prepare upload');
        const uploadResult = await FileSystem.uploadAsync(signedData.signedUrl, asset.uri, {
          httpMethod: 'PUT',
          headers: { 'Content-Type': asset.mimeType ?? 'image/jpeg' },
        });
        if (uploadResult.status < 200 || uploadResult.status >= 300) throw new Error('File upload failed');
      }

      const { error } = await supabase.from('legal_documents').insert({
        user_id: user.id, uploaded_by: user.id, document_type: 'school',
        file_name: fileName, file_path: filePath,
        file_size: asset?.fileSize ?? null, mime_type: asset?.mimeType ?? null,
        description: `${term} ${year} report card`,
        metadata: { term, year, child_id: childId, storage_path: filePath },
      });
      if (error) throw error;
      // Notify co-parent (best-effort)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/apns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'notify-school', notice_text: `${term} ${year} report card uploaded` }),
        }).catch(() => {});
      }
      setAsset(null);
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save report card.');
    } finally {
      setSaving(false);
    }
  }, [term, year, childId, children, asset, onSaved]);

  const pillItems = [{ id: '__all__', label: 'All' }, ...children.map(c => ({ id: c.id, label: c.name }))];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Upload Report Card</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Term</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {TERMS.map(t => (
                <Pressable key={t} onPress={() => setTerm(t)}
                  style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: term === t ? brand.blue : colors.surface, borderWidth: term === t ? 0 : 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: term === t ? '#fff' : colors.secondaryLabel }}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Year</Text>
            <TextInput style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 16, color: colors.label }}
              placeholder="2026" placeholderTextColor={colors.secondaryLabel} keyboardType="numeric" value={year} onChangeText={v => setYear(v.replace(/[^0-9]/g, '').replace(/^0+([1-9])/, '$1'))} />
          </View>
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Child (optional)</Text>
            <PillRow items={pillItems} selected={childId} onSelect={setChildId} />
          </View>
          <Pressable onPress={pickFile} disabled={saving}
            style={({ pressed }) => ({
              borderRadius: 16, borderCurve: 'continuous', padding: 18, alignItems: 'center', gap: 6,
              backgroundColor: asset ? brand.blue + '10' : colors.surface,
              borderWidth: 1.5, borderColor: asset ? brand.blue : colors.separator,
              borderStyle: asset ? 'solid' : 'dashed',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <Ionicons name={asset ? 'checkmark-circle' : 'image-outline'} size={28} color={asset ? brand.blue : colors.secondaryLabel} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: asset ? brand.blue : colors.secondaryLabel }}>
              {asset ? asset.uri.split('/').pop() : 'Attach photo of report card (optional)'}
            </Text>
            {asset && <Text style={{ fontSize: 12, color: colors.secondaryLabel }}>Tap to change</Text>}
          </Pressable>
          <Text style={{ fontSize: 12, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 17 }}>
            Saved reports will appear here and in the <Text style={{ fontWeight: '600' }}>Documents</Text> tab.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddNoticeModal({ visible, onClose, onSaved, children }: { visible: boolean; onClose: () => void; onSaved: () => void; children: Child[] }) {
  const insets = useSafeAreaInsets();
  const [schoolName, setSchoolName] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [childId, setChildId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!noticeText.trim()) { Alert.alert('Notice text required', 'Please enter the notice details.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase.from('school_notices' as any) as any).insert({
        user_id: user.id, school_name: schoolName.trim() || null,
        notice_text: noticeText.trim(), child_id: childId, notice_date: date, category,
      });
      if (error) throw error;
      // Notify co-parent (best-effort)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/apns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'notify-school', notice_text: noticeText.trim(), school_name: schoolName.trim() || null }),
        }).catch(() => {});
      }
      setSchoolName(''); setNoticeText(''); setChildId(null);
      setDate(new Date().toISOString().split('T')[0]); setCategory(CATEGORIES[0]);
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save notice.');
    } finally {
      setSaving(false);
    }
  }, [schoolName, noticeText, childId, date, category, onSaved]);

  const pillItems = [{ id: '__all__', label: 'All' }, ...children.map(c => ({ id: c.id, label: c.name }))];

  const inputStyle = { backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous' as const, borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 15, color: colors.label };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <Pressable onPress={onClose}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Add Notice</Text>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={brand.blue} /> : <Text style={{ color: brand.blue, fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>School Name (optional)</Text>
            <TextInput style={inputStyle} placeholder="e.g. Springfield Primary" placeholderTextColor={colors.secondaryLabel} value={schoolName} onChangeText={setSchoolName} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Notice *</Text>
            <TextInput style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]} placeholder="Paste or type the school notice here…" placeholderTextColor={colors.secondaryLabel} multiline value={noticeText} onChangeText={setNoticeText} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Date</Text>
            <TextInput style={inputStyle} placeholder="YYYY-MM-DD" placeholderTextColor={colors.secondaryLabel} value={date} onChangeText={setDate} />
          </View>
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Category</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CATEGORIES.map(cat => {
                const isUrgent = cat === 'Urgent';
                const isActive = category === cat;
                const activeColor = isUrgent ? brand.error : brand.blue;
                return (
                  <Pressable key={cat} onPress={() => setCategory(cat)}
                    style={({ pressed }) => ({ flex: 1, paddingVertical: 10, borderRadius: 12, borderCurve: 'continuous', backgroundColor: isActive ? activeColor : colors.surface, borderWidth: isActive ? 0 : 0.5, borderColor: colors.separator, alignItems: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : colors.secondaryLabel }}>{cat}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Child (optional)</Text>
            <PillRow items={pillItems} selected={childId} onSelect={setChildId} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
  const [viewReport, setViewReport] = useState<ReportCard | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [childRes, reportRes, eventRes, noticeRes] = await Promise.all([
        supabase.from('children' as any).select('id, name').order('name'),
        supabase.from('legal_documents').select('*').eq('document_type', 'school').order('created_at', { ascending: false }),
        supabase.from('calendar_events' as any).select('*').ilike('event_type' as any, '%school%').order('event_date' as any),
        (supabase.from('school_notices' as any) as any).select('*').order('created_at', { ascending: false }),
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

  const childPills = [{ id: '__all__', label: 'All' }, ...children.map(c => ({ id: c.id, label: c.name }))];

  const renderReportCards = () => {
    const filtered = selectedChild ? reportCards.filter(r => r.metadata?.child_id === selectedChild) : reportCards;
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Pressable onPress={() => router.push('/(tabs)/documents')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.blue + '10', borderRadius: 14, borderCurve: 'continuous', padding: 14, borderWidth: 0.5, borderColor: brand.blue + '25', opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="folder-outline" size={18} color={brand.blue} />
          <Text style={{ flex: 1, fontSize: 13, color: brand.blue, lineHeight: 18 }}>
            Uploaded reports are saved in <Text style={{ fontWeight: '700' }}>Documents</Text> — tap to open or share them.
          </Text>
          <Ionicons name="chevron-forward" size={14} color={brand.blue} />
        </Pressable>
        {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} /> : filtered.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 40, alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="bar-chart-outline" size={28} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>No report cards yet</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>Upload term report cards to keep track of school progress</Text>
            <Pressable onPress={() => setShowUploadModal(true)}
              style={({ pressed }) => ({ marginTop: 4, backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 20, paddingVertical: 12, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Upload Report Card</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {filtered.map(report => (
              <View key={report.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
                <View style={{ width: 48, height: 48, borderRadius: 13, borderCurve: 'continuous', backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Ionicons name="bar-chart-outline" size={24} color={brand.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>{report.file_name}</Text>
                  {report.description ? <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }}>{report.description}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8, marginLeft: 8 }}>
                  <Text style={{ fontSize: 11, color: colors.secondaryLabel }}>{formatDate(report.created_at)}</Text>
                  <Pressable onPress={() => setViewReport(report)}
                    style={({ pressed }) => ({ backgroundColor: brand.blue + '10', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: brand.blue + '30', opacity: pressed ? 0.7 : 1 })}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: brand.blue }}>View</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable onPress={() => setShowUploadModal(true)}
              style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 16, borderCurve: 'continuous', padding: 18, alignItems: 'center', marginTop: 4, transform: [{ scale: pressed ? 0.97 : 1 }], boxShadow: '0 4px 14px rgba(43,116,214,0.25)' })}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Upload Report Card</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  const renderSchoolEvents = () => (
    <View style={{ padding: 16, gap: 12 }}>
      {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} /> : schoolEvents.length === 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 40, alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: colors.separator }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <Ionicons name="school-outline" size={28} color={brand.blue} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>No school events yet</Text>
          <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>School events are logged via the Calendar — tap below to add one</Text>
        </View>
      ) : (
        schoolEvents.map(event => (
          <View key={event.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 48, height: 48, borderRadius: 13, borderCurve: 'continuous', backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Ionicons name="school-outline" size={24} color={brand.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.label }}>{event.event_type || 'School Event'}</Text>
              {event.notes ? <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }} numberOfLines={2}>{event.notes}</Text> : null}
            </View>
            <Text style={{ fontSize: 12, color: colors.secondaryLabel, marginLeft: 8 }}>{event.event_date}</Text>
          </View>
        ))
      )}
      <Pressable onPress={() => Alert.alert('Add School Event', 'School events are managed in the Calendar. Head there to add a school event.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Go to Calendar', onPress: () => router.push('/(tabs)/calendar') }])}
        style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 16, borderCurve: 'continuous', padding: 18, alignItems: 'center', marginTop: 4, transform: [{ scale: pressed ? 0.97 : 1 }], boxShadow: '0 4px 14px rgba(43,116,214,0.25)' })}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Add School Event</Text>
      </Pressable>
    </View>
  );

  const renderNotices = () => {
    const filtered = selectedChild ? notices.filter(n => n.child_id === selectedChild || n.child_id === null) : notices;
    return (
      <View style={{ padding: 16, gap: 12 }}>
        {loading ? <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} /> : filtered.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 40, alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: colors.separator }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '12', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
              <Ionicons name="mail-outline" size={28} color={brand.blue} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.label }}>No notices logged</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>Add any important school communications here</Text>
            <Pressable onPress={() => setShowNoticeModal(true)}
              style={({ pressed }) => ({ marginTop: 4, backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 20, paddingVertical: 12, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Add Notice</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {filtered.map(notice => {
              const isUrgent = notice.category === 'Urgent';
              return (
                <View key={notice.id} style={{ backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 16, borderWidth: 0.5, borderColor: colors.separator, borderLeftWidth: isUrgent ? 3 : 0.5, borderLeftColor: isUrgent ? brand.error : colors.separator }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      {notice.school_name ? <Text style={{ fontSize: 13, fontWeight: '700', color: brand.blue, marginBottom: 4 }}>{notice.school_name}</Text> : null}
                      <Text style={{ fontSize: 15, color: colors.label, lineHeight: 21 }}>{notice.notice_text}</Text>
                    </View>
                    <View style={{ marginLeft: 12, alignItems: 'flex-end', gap: 6 }}>
                      <Text style={{ fontSize: 11, color: colors.secondaryLabel }}>{notice.notice_date || formatDate(notice.created_at)}</Text>
                      {notice.category ? (
                        <View style={{ backgroundColor: isUrgent ? '#FEF2F2' : brand.blue + '10', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isUrgent ? brand.error : brand.blue }}>{notice.category}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
            <Pressable onPress={() => setShowNoticeModal(true)}
              style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 16, borderCurve: 'continuous', padding: 18, alignItems: 'center', marginTop: 4, transform: [{ scale: pressed ? 0.97 : 1 }], boxShadow: '0 4px 14px rgba(43,116,214,0.25)' })}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Add Notice</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'School Hub', headerTintColor: brand.blue }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ backgroundColor: colors.surface, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
          <PillRow items={childPills} selected={selectedChild} onSelect={setSelectedChild} />
        </View>
        <SectionTabs active={activeSection} onSelect={setActiveSection} />
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}>
          {activeSection === 'reports' && renderReportCards()}
          {activeSection === 'events' && renderSchoolEvents()}
          {activeSection === 'notices' && renderNotices()}
        </ScrollView>
      </View>
      <UploadReportModal visible={showUploadModal} onClose={() => setShowUploadModal(false)} onSaved={() => { setShowUploadModal(false); loadData(); }} children={children} />
      <AddNoticeModal visible={showNoticeModal} onClose={() => setShowNoticeModal(false)} onSaved={() => { setShowNoticeModal(false); loadData(); }} children={children} />

      <Modal visible={!!viewReport} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setViewReport(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setViewReport(null)}><Text style={{ color: brand.blue, fontSize: 16 }}>Close</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Report Card</Text>
            <View style={{ width: 48 }} />
          </View>
          {viewReport && (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
              <View style={{ backgroundColor: brand.blue + '10', borderRadius: 20, borderCurve: 'continuous', padding: 24, alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: brand.blue + '25' }}>
                <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                  <Ionicons name="bar-chart-outline" size={32} color={brand.blue} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.label, textAlign: 'center' }}>{viewReport.file_name}</Text>
                {viewReport.description ? <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center' }}>{viewReport.description}</Text> : null}
              </View>
              <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, overflow: 'hidden' }}>
                {[
                  { label: 'Term', value: viewReport.metadata?.term ?? '—' },
                  { label: 'Year', value: viewReport.metadata?.year ?? '—' },
                  { label: 'Child', value: (() => { const c = children.find(c => c.id === viewReport.metadata?.child_id); return c?.name ?? 'All children'; })() },
                  { label: 'Added', value: formatDate(viewReport.created_at) },
                ].map((row, i, arr) => (
                  <View key={row.label}>
                    {i > 0 && <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: 16 }} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
                      <Text style={{ fontSize: 15, color: colors.secondaryLabel }}>{row.label}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.label }}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}
