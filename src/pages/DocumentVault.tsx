import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Trash2, Download, Shield, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { z } from 'zod';
import SubscriptionGate from '@/components/SubscriptionGate';

// Zod schema for document upload validation
const DocumentUploadSchema = z.object({
  document_type: z.enum(['court_order', 'medical_card', 'agreement', 'other']),
  description: z.string().max(1000).optional(),
  file: z.instanceof(File).refine(
    (file) => file.size <= 10 * 1024 * 1024, // 10MB max
    'File size must be less than 10MB'
  ).refine(
    (file) => ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type),
    'Only PDF, JPEG, and PNG files are allowed'
  ),
});

interface LegalDocument {
  id: string;
  user_id: string;
  child_id: string | null;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  description: string | null;
  is_shared: boolean;
  created_at: string;
}

const DocumentVault = () => {
  const { user } = useAuth();
  const { children } = useRole();
  const { canViewDocuments } = usePermissions();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documentType, setDocumentType] = useState<'court_order' | 'medical_card' | 'agreement' | 'other'>('court_order');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<LegalDocument | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (user && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [user, children]);

  useEffect(() => {
    if (user) {
      if (selectedChildId) {
        fetchDocuments();
      } else {
        setLoading(false);
        setDocuments([]);
      }
    }
  }, [user, selectedChildId]);

  if (!canViewDocuments) {
    return (
      <SubscriptionGate
        title="Legal Documents are a Legal tier feature"
        description="Upgrade to SupportCard Legal to access secure document storage."
      />
    );
  }

  const fetchDocuments = async () => {
    if (!user || !selectedChildId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)('legal_documents')
        .select('*')
        .eq('child_id', selectedChildId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      if (data) setDocuments(data as LegalDocument[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Validate with Zod
        DocumentUploadSchema.parse({ document_type: documentType, file, description });
        setSelectedFile(file);
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast.error(error.errors[0].message);
        }
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!user || !selectedChildId || !selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading(true);
    try {
      // Validate with Zod
      const validated = DocumentUploadSchema.parse({
        document_type: documentType,
        file: selectedFile,
        description: description || undefined,
      });

      // Generate unique file path
      const fileExt = validated.file.name.split('.').pop();
      const fileName = `${user.id}_${selectedChildId}_${Date.now()}.${fileExt}`;
      const filePath = `legal-docs/${selectedChildId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('legal-docs')
        .upload(filePath, validated.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('new row violates row-level security')) {
          toast.error('Storage bucket not configured or access denied. Please check bucket settings.');
        } else {
          console.error('Upload error:', uploadError);
          toast.error(`Upload failed: ${uploadError.message}`);
        }
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('legal-docs')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        toast.error('Failed to get file URL');
        return;
      }

      // Insert document record
      const { error: insertError } = await (supabase.from as any)('legal_documents')
        .insert({
          user_id: user.id,
          child_id: selectedChildId,
          document_type: validated.document_type,
          file_name: validated.file.name,
          file_path: filePath,
          file_size: validated.file.size,
          mime_type: validated.file.type,
          uploaded_by: user.id,
          description: validated.description || null,
          is_shared: true, // Shared with co-parent
        });

      if (insertError) throw insertError;

      toast.success('Document uploaded successfully');
      setIsDialogOpen(false);
      setSelectedFile(null);
      setDescription('');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Failed to upload document');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete || !user) return;

    try {
      // RLS will prevent deletion if user didn't upload the document
      const { error: deleteError } = await (supabase.from as any)('legal_documents')
        .delete()
        .eq('id', documentToDelete.id);

      if (deleteError) {
        if (deleteError.message.includes('row-level security')) {
          toast.error('You can only delete documents you uploaded');
        } else {
          throw deleteError;
        }
        return;
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('legal-docs')
        .remove([documentToDelete.file_path]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Don't fail the operation if storage delete fails
      }

      toast.success('Document deleted successfully');
      setIsDeleteDialogOpen(false);
      setDocumentToDelete(null);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleDownload = async (document: LegalDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('legal-docs')
        .download(document.file_path);

      if (error) throw error;
      if (!data) {
        toast.error('File not found');
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const canDelete = (document: LegalDocument) => {
    return user?.id === document.uploaded_by;
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      court_order: 'Court Order',
      medical_card: 'Medical Card',
      agreement: 'Agreement',
      other: 'Other',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground">Store and share important documents</p>
          </div>
        </div>
        <div className="flex gap-2">
          {children.length > 0 && (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Upload important documents for {selectedChild?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={documentType} onValueChange={(value: any) => setDocumentType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="court_order">Court Order</SelectItem>
                      <SelectItem value="medical_card">Medical Card</SelectItem>
                      <SelectItem value="agreement">Agreement</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File (PDF, JPEG, PNG - Max 10MB)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    placeholder="Add a description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Documents are shared with your co-parent. You can only delete documents you uploaded.
                  </AlertDescription>
                </Alert>
                <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="w-full">
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Please add a child first to upload documents</p>
          </CardContent>
        </Card>
      ) : !selectedChildId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Please select a child to view documents</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Documents for {selectedChild?.name}</CardTitle>
            <CardDescription>All uploaded documents</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <Card key={doc.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold">{doc.file_name}</h3>
                            <Badge variant="outline">{getDocumentTypeLabel(doc.document_type)}</Badge>
                            {doc.is_shared && (
                              <Badge variant="secondary" className="text-xs">
                                Shared
                              </Badge>
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Uploaded: {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}</span>
                            <span>Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                            {!canDelete(doc) && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Lock className="w-3 h-3" />
                                Uploaded by co-parent
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          {canDelete(doc) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDocumentToDelete(doc);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The document will be permanently deleted.
              {documentToDelete && !canDelete(documentToDelete) && (
                <span className="block mt-2 text-red-600 font-semibold">
                  ⚠️ You can only delete documents you uploaded.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentVault;

