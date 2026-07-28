import { useState, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

const DOC_TYPES = ['All', 'Legal', 'Medical', 'School', 'Financial', 'Other'];
const DOC_ICON: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  Legal:     { icon: 'briefcase-outline',    color: brand.blue },
  Medical:   { icon: 'medical-outline',      color: '#EF4444' },
  School:    { icon: 'school-outline',       color: '#8B5CF6' },
  Financial: { icon: 'receipt-outline',      color: '#F59E0B' },
  Other:     { icon: 'document-outline',     color: brand.body },
};

type Document = { id: string; document_type: string; description: string | null; file_name: string | null; created_at: string };

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('All');

  useEffect(() => {
    supabase.from('legal_documents' as any).select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setDocuments((data as any) || []); setLoading(false); });
  }, []);

  const filtered = documents.filter(d => activeType === 'All' || d.document_type === activeType.toLowerCase());

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.lightBg }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: brand.dark, marginBottom: 20 }}>Documents</Text>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, marginHorizontal: -4 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
            {DOC_TYPES.map(type => (
              <Pressable key={type} onPress={() => setActiveType(type)}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: activeType === type ? brand.blue : brand.card,
                  boxShadow: activeType === type ? '0 2px 8px rgba(43,116,214,0.20)' : undefined }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: activeType === type ? '#fff' : brand.body }}>{type}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={brand.blue} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={{ backgroundColor: brand.card, borderRadius: 16, padding: 40, alignItems: 'center', boxShadow: '0 2px 12px rgba(43,116,214,0.08)' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: brand.separator, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="document-outline" size={28} color={brand.body} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: brand.dark, marginBottom: 4 }}>No documents yet</Text>
            <Text style={{ fontSize: 14, color: brand.body, textAlign: 'center' }}>Store legal, school, and medical documents securely</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map(doc => (
              <Pressable key={doc.id}
                style={{ backgroundColor: brand.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', boxShadow: '0 1px 8px rgba(43,116,214,0.07)' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_ICON[doc.document_type]?.color ?? brand.body, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons
                    name={DOC_ICON[doc.document_type]?.icon ?? 'document-outline'}
                    size={20}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: brand.dark }} numberOfLines={1}>
                    {doc.file_name || doc.document_type}
                  </Text>
                  {doc.description && <Text style={{ fontSize: 13, color: brand.body, marginTop: 2 }} numberOfLines={1}>{doc.description}</Text>}
                  <Text style={{ fontSize: 12, color: brand.body, marginTop: 2 }}>
                    {new Date(doc.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={brand.body} style={{ opacity: 0.5 }} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
