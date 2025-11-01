import { supabase } from '@/integrations/supabase/client';

export interface FileUploadOptions {
  bucket: string;
  path?: string;
  file: File;
  onProgress?: (progress: number) => void;
}

export interface FileUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  path?: string;
}

export const uploadFile = async ({
  bucket,
  path,
  file,
  onProgress
}: FileUploadOptions): Promise<FileUploadResult> => {
  try {
    // Generate unique filename if no path provided
    const fileExt = file.name.split('.').pop();
    const fileName = path || `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    onProgress?.(100);

    return {
      success: true,
      url: urlData.publicUrl,
      path: filePath
    };
  } catch (error) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

export const deleteFile = async (bucket: string, path: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('File delete error:', error);
    return false;
  }
};

export const getFileUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return data.publicUrl;
};

// File validation utilities
export const validateFile = (file: File, options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}): { isValid: boolean; error?: string } => {
  const { maxSize = 5 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options;

  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
    };
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type must be one of: ${allowedTypes.join(', ')}`
    };
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return {
        isValid: false,
        error: `File extension must be one of: ${allowedExtensions.join(', ')}`
      };
    }
  }

  return { isValid: true };
};

// Common file upload configurations
export const FILE_CONFIGS = {
  AVATAR: {
    bucket: 'avatars',
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp']
  },
  RECEIPT: {
    bucket: 'receipts',
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf']
  },
  DOCUMENT: {
    bucket: 'documents',
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png']
  }
};

// Helper function to upload avatar
export const uploadAvatar = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<FileUploadResult> => {
  const validation = validateFile(file, FILE_CONFIGS.AVATAR);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error
    };
  }

  return uploadFile({
    bucket: FILE_CONFIGS.AVATAR.bucket,
    file,
    onProgress
  });
};

// Helper function to upload receipt
export const uploadReceipt = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<FileUploadResult> => {
  const validation = validateFile(file, FILE_CONFIGS.RECEIPT);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error
    };
  }

  return uploadFile({
    bucket: FILE_CONFIGS.RECEIPT.bucket,
    file,
    onProgress
  });
};
