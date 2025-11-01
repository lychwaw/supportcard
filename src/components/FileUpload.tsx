import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload, 
  X, 
  File, 
  Image, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { uploadFile, validateFile, FILE_CONFIGS, FileUploadResult } from '@/lib/file-upload';
import { toast } from 'sonner';

interface FileUploadProps {
  onUploadComplete?: (result: FileUploadResult) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  bucket?: string;
  path?: string;
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
}

export function FileUpload({
  onUploadComplete,
  onUploadError,
  accept,
  maxSize = 5 * 1024 * 1024, // 5MB default
  allowedTypes = [],
  allowedExtensions = [],
  bucket = 'uploads',
  path,
  className = '',
  disabled = false,
  multiple = false
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file
    const validation = validateFile(file, {
      maxSize,
      allowedTypes,
      allowedExtensions
    });

    if (!validation.isValid) {
      toast.error(validation.error || 'Invalid file');
      onUploadError?.(validation.error || 'Invalid file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadFile({
        bucket,
        path,
        file,
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      });

      if (result.success) {
        setUploadedFiles(prev => [...prev, result]);
        toast.success('File uploaded successfully!');
        onUploadComplete?.(result);
      } else {
        toast.error(result.error || 'Upload failed');
        onUploadError?.(result.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-4 h-4" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="w-4 h-4" />;
    } else {
      return <File className="w-4 h-4" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground" />
          )}
          
          <div className="text-sm">
            <span className="font-medium text-primary">Click to upload</span> or drag and drop
          </div>
          
          <div className="text-xs text-muted-foreground">
            {allowedTypes.length > 0 && `Types: ${allowedTypes.join(', ')}`}
            {allowedExtensions.length > 0 && `Extensions: ${allowedExtensions.join(', ')}`}
            {maxSize && ` (Max ${Math.round(maxSize / 1024 / 1024)}MB)`}
          </div>
        </div>

        {isUploading && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="w-full" />
            <div className="text-xs text-muted-foreground mt-1">
              {uploadProgress}% uploaded
            </div>
          </div>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Uploaded Files</Label>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <Card key={index} className="p-3">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getFileIcon('')}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {file.url ? 'Uploaded successfully' : 'Upload failed'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {file.path}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {file.success ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Specialized components for common use cases
export function AvatarUpload({ onUploadComplete, className }: {
  onUploadComplete?: (result: FileUploadResult) => void;
  className?: string;
}) {
  return (
    <FileUpload
      onUploadComplete={onUploadComplete}
      accept="image/*"
      maxSize={FILE_CONFIGS.AVATAR.maxSize}
      allowedTypes={FILE_CONFIGS.AVATAR.allowedTypes}
      allowedExtensions={FILE_CONFIGS.AVATAR.allowedExtensions}
      bucket={FILE_CONFIGS.AVATAR.bucket}
      className={className}
    />
  );
}

export function ReceiptUpload({ onUploadComplete, className }: {
  onUploadComplete?: (result: FileUploadResult) => void;
  className?: string;
}) {
  return (
    <FileUpload
      onUploadComplete={onUploadComplete}
      accept="image/*,application/pdf"
      maxSize={FILE_CONFIGS.RECEIPT.maxSize}
      allowedTypes={FILE_CONFIGS.RECEIPT.allowedTypes}
      allowedExtensions={FILE_CONFIGS.RECEIPT.allowedExtensions}
      bucket={FILE_CONFIGS.RECEIPT.bucket}
      className={className}
    />
  );
}
