import { getSupabaseServerClient } from '../lib/supabase.ts';

export type StorageBucket = 'players' | 'teams' | 'news' | 'avatars';

export class SupabaseStorageService {
  private static instance: SupabaseStorageService;

  public static getInstance(): SupabaseStorageService {
    if (!SupabaseStorageService.instance) {
      SupabaseStorageService.instance = new SupabaseStorageService();
    }
    return SupabaseStorageService.instance;
  }

  /**
   * Upload an image (base64 data URI or buffer) to Supabase Storage
   */
  async uploadImage(
    bucket: StorageBucket,
    filename: string,
    fileData: Buffer | string,
    contentType: string = 'image/png'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      // Supabase storage not configured; return as is or local reference
      return { success: false, error: 'Supabase storage is not configured.' };
    }

    try {
      let buffer: Buffer;
      if (typeof fileData === 'string') {
        if (fileData.startsWith('data:')) {
          const parts = fileData.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          if (mimeMatch) contentType = mimeMatch[1];
          buffer = Buffer.from(parts[1], 'base64');
        } else {
          buffer = Buffer.from(fileData, 'base64');
        }
      } else {
        buffer = fileData;
      }

      // Safe clean path
      const cleanPath = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(cleanPath, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
      return {
        success: true,
        url: publicUrlData.publicUrl,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error uploading to storage' };
    }
  }

  /**
   * Delete an image from Supabase Storage
   */
  async deleteImage(bucket: StorageBucket, filename: string): Promise<boolean> {
    const supabase = getSupabaseServerClient();
    if (!supabase) return false;

    try {
      const cleanPath = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const { error } = await supabase.storage.from(bucket).remove([cleanPath]);
      return !error;
    } catch {
      return false;
    }
  }
}

export const supabaseStorageService = SupabaseStorageService.getInstance();
