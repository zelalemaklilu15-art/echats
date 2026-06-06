// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

export interface UploadResult {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface UploadProgress {
  percentage: number;
  bytesTransferred: number;
  totalBytes: number;
}

// Upload profile picture
export const uploadProfilePicture = async (
  userId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `avatar.${fileExt}`;
  const path = `${userId}/${fileName}`;

  return uploadFile('avatars', path, file, onProgress);
};

// Helper — current authenticated user id for path-scoped uploads.
const requireUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('Not authenticated');
  }
  return data.user.id;
};

// Upload chat image — path is "{userId}/{chatId}/{file}" so storage RLS
// can enforce that users only write into their own folder.
export const uploadChatImage = async (
  chatId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const userId = await requireUserId();
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const path = `${userId}/${chatId}/${fileName}`;
  return uploadFile('chat-media', path, file, onProgress);
};

// Upload chat file
export const uploadChatFile = async (
  chatId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const userId = await requireUserId();
  const fileName = `${Date.now()}-${file.name}`;
  const path = `${userId}/${chatId}/${fileName}`;
  return uploadFile('chat-media', path, file, onProgress);
};

// Upload voice message
export const uploadVoiceMessage = async (
  chatId: string,
  audioBlob: Blob,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const userId = await requireUserId();
  const fileName = `${Date.now()}.webm`;
  const path = `${userId}/${chatId}/${fileName}`;
  const file = new File([audioBlob], 'voice.webm', { type: 'audio/webm' });
  return uploadFile('chat-media', path, file, onProgress);
};

// Core upload function
const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  // Simulate progress for now (Supabase JS doesn't have built-in progress)
  if (onProgress) {
    onProgress({ percentage: 0, bytesTransferred: 0, totalBytes: file.size });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Upload error:', error);
    throw error;
  }

  if (onProgress) {
    onProgress({ percentage: 100, bytesTransferred: file.size, totalBytes: file.size });
  }

  // Get signed URL (1 hour expiry) for private buckets
  const { data: urlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 3600);

  if (urlError || !urlData) {
    throw new Error('Failed to create signed URL');
  }

  return {
    url: urlData.signedUrl,
    path: data.path,
    name: file.name,
    size: file.size,
    type: file.type,
  };
};

// Delete file
export const deleteFile = async (bucket: string, path: string): Promise<void> => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Delete error:', error);
    throw error;
  }
};

// Get signed file URL (async for private buckets)
export const getFileUrl = async (bucket: string, path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  
  if (error || !data) {
    throw new Error('Failed to create signed URL');
  }
  
  return data.signedUrl;
};

// Validate file
export const validateFile = (
  file: File,
  options?: { maxSize?: number; allowedTypes?: string[] }
): { valid: boolean; error?: string } => {
  const maxSize = options?.maxSize || 10 * 1024 * 1024; // 10MB default
  const allowedTypes = options?.allowedTypes;

  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` };
  }

  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} is not allowed` };
  }

  return { valid: true };
};

// Compress image
export const compressImage = async (
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};
