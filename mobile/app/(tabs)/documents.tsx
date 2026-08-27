import { useState, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { brand, colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

const DOC_TYPES = ['All', 'Legal', 'Medical', 'School', 'Financial', 'Other'];
const DOC_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  Legal:     { icon: 'briefcase-outline',    color: brand.blue },
  Medical:   { icon: 'medical-outline',      color: '#EF4444' },
  School:    { icon: 'school-outline',       color: '#8B5CF6' },
  Financial: { icon: 'receipt-outline',      color: '#F59E0B' },
  Other:     { icon: 'document-outline',     color: brand.body },
};

type Document = { id: string; document_type: string; description: string | null; file_name: string | null; file_path: string | null; created_at: string; metadata?: { storage_path?: string } | null };

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState('Other');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadDocuments = () => {
    supabase.from('legal_documents' as any).select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setDocuments((data as any) || []); setLoading(false); });
  };

  useEffect(() => { loadDocuments(); }, []);

  const handlePickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `${uploadType.toLowerCase()}_${Date.now()}.${ext}`;
      const storagePath = `${user.id}/${fileName}`;
      const contentType = asset.mimeType ?? 'image/jpeg';

      const { data: signedData, error: signErr } = await supabase.storage
        .from('legal-docs')
        .createSignedUploadUrl(storagePath);
      if (signErr || !signedData) throw signErr ?? new Error('Could not prepare upload');

      const uploadResult = await FileSystem.uploadAsync(signedData.signedUrl, asset.uri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': contentType },
      });
      if (uploadResult.status < 200 || uploadResult.status >= 300) throw new Error('File upload failed');

      const { error: dbErr } = await (supabase.from('legal_documents' as any) as any).insert({
        user_id: user.id,
        uploaded_by: user.id,
        document_type: uploadType,
        file_name: fileName,
        file_path: storagePath,
        file_size: asset.fileSize ?? 0,
        mime_type: contentType,
        description: uploadDesc.trim() || null,
        metadata: { storage_path: storagePath },
      });
      if (dbErr) throw dbErr;
      // Notify co-parent (best-effort)
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        if (!session) return;
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/apns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'notify-document', doc_type: uploadType, doc_name: uploadDesc.trim() || fileName }),
        }).catch(() => {});
      });
      setShowUpload(false);
      setUploadDesc('');
      setUploadType('Other');
      loadDocuments();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDocument = async (doc: Document) => {
    const path = doc.file_path ?? doc.metadata?.storage_path;
    if (path) {
      const { data, error } = await supabase.storage.from('legal-docs').createSignedUrl(path, 60);
      if (data?.signedUrl) {
        await WebBrowser.openBrowserAsync(data.signedUrl);
        return;
      }
      if (error) console.error('Signed URL error:', error.message);
    }
    Alert.alert(doc.file_name || 'Document', doc.description || 'No description');
  };

  const handleDelete = (doc: Document) => {
    Alert.alert('Delete document', `Delete "${doc.file_name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const path = doc.file_path ?? doc.metadata?.storage_path;
        if (path) await supabase.storage.from('legal-docs').remove([path]);
        await (supabase.from('legal_documents' as any) as any).delete().eq('id', doc.id);
        loadDocuments();
      }},
    ]);
  };

  const filtered = documents.filter(d => activeType === 'All' || d.document_type?.toLowerCase() === activeType.toLowerCase());

  const totalByType: Record<string, number> = {};
  for (const doc of documents) {
    const t = doc.document_type ?? 'Other';
    totalByType[t] = (totalByType[t] || 0) + 1;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 34, fontWeight: '700', color: colors.label, letterSpacing: -1 }}>Documents</Text>
              <Text style={{ fontSize: 14, color: colors.secondaryLabel, marginTop: 4 }}>
                {documents.length} file{documents.length !== 1 ? 's' : ''} stored securely
              </Text>
            </View>
            <Pressable onPress={() => setShowUpload(true)}
              style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 16, paddingVertical: 10, marginTop: 6, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ Upload</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Stats chips ── */}
        {documents.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
            {Object.entries(totalByType).map(([type, count]) => {
              const meta = DOC_META[type] ?? DOC_META.Other;
              return (
                <Pressable key={type} onPress={() => setActiveType(type === activeType ? 'All' : type)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
                    backgroundColor: activeType === type ? meta.color + '18' : colors.surface,
                    borderWidth: 1, borderColor: activeType === type ? meta.color + '40' : colors.separator,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}>
                  <Ionicons name={meta.icon} size={14} color={meta.color} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: activeType === type ? meta.color : colors.secondaryLabel }}>{type}</Text>
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: meta.color + '20', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: meta.color }}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ── Filter pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, marginBottom: 16 }}>
          {DOC_TYPES.map(type => (
            <Pressable key={type} onPress={() => setActiveType(type)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeType === type ? brand.blue : colors.surface,
                borderWidth: activeType === type ? 0 : 0.5, borderColor: colors.separator,
              }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: activeType === type ? '#fff' : colors.secondaryLabel }}>{type}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Content ── */}
        <View style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={{ borderRadius: 20, padding: 52, alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous' }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: brand.blue + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                <Ionicons name="document-outline" size={27} color={brand.blue} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>No documents yet</Text>
              <Text style={{ fontSize: 14, color: colors.secondaryLabel, textAlign: 'center', lineHeight: 20 }}>
                {activeType === 'All'
                  ? 'Store legal, school, and medical documents securely'
                  : `No ${activeType.toLowerCase()} documents found`}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {filtered.map(doc => {
                const type  = doc.document_type ?? 'Other';
                const meta  = DOC_META[type] ?? DOC_META.Other;
                const date  = new Date(doc.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <Pressable key={doc.id}
                    onPress={() => handleOpenDocument(doc)}
                    onLongPress={() => handleDelete(doc)}
                    style={({ pressed }) => ({
                      backgroundColor: colors.surface, borderRadius: 18, padding: 18,
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      borderWidth: 0.5, borderColor: colors.separator, borderCurve: 'continuous',
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}>
                    <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: meta.color + '18', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
                      <Ionicons name={meta.icon} size={22} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.label }} numberOfLines={1}>
                        {doc.file_name || type}
                      </Text>
                      {doc.description && <Text style={{ fontSize: 13, color: colors.secondaryLabel, marginTop: 2 }} numberOfLines={1}>{doc.description}</Text>}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: meta.color + '12' }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: meta.color }}>{type}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.secondaryLabel }}>{date}</Text>
                      </View>
                    </View>
                    <Ionicons name={(doc.file_path ?? doc.metadata?.storage_path) ? 'open-outline' : 'chevron-forward'} size={15} color={colors.secondaryLabel} style={{ opacity: 0.35 }} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showUpload} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowUpload(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Pressable onPress={() => setShowUpload(false)} disabled={uploading}><Text style={{ color: brand.blue, fontSize: 16 }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.label }}>Upload Document</Text>
            <View style={{ width: 48 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Document Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['Legal', 'Medical', 'School', 'Financial', 'Other'] as const).map(t => {
                  const meta = DOC_META[t] ?? DOC_META.Other;
                  return (
                    <Pressable key={t} onPress={() => setUploadType(t)}
                      style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: uploadType === t ? meta.color : colors.surface, borderWidth: uploadType === t ? 0 : 0.5, borderColor: colors.separator, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: uploadType === t ? '#fff' : colors.secondaryLabel }}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryLabel }}>Description (optional)</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 0.5, borderColor: colors.separator, padding: 14, fontSize: 15, color: colors.label }}
                placeholder="e.g. Birth certificate, grant letter" placeholderTextColor={colors.secondaryLabel}
                value={uploadDesc} onChangeText={setUploadDesc} />
            </View>
            <Pressable onPress={handlePickAndUpload} disabled={uploading}
              style={({ pressed }) => ({ backgroundColor: brand.blue, borderRadius: 16, borderCurve: 'continuous', padding: 18, alignItems: 'center', gap: 8, transform: [{ scale: pressed ? 0.97 : 1 }], boxShadow: '0 4px 12px rgba(43,116,214,0.25)' })}>
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={24} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Choose Photo to Upload</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Supports JPG, PNG — long-press any document to delete</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
