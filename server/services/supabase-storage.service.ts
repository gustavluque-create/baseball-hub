import { getSupabaseServerClient } from '../lib/supabase.ts';

export type StorageBucket = 'players' | 'teams' | 'news' | 'avatars';

export interface StorageUser {
  uid: string;
  role?: string;
}

export class SupabaseStorageService {
  private static instance: SupabaseStorageService;

  public static getInstance(): SupabaseStorageService {
    if (!SupabaseStorageService.instance) {
      SupabaseStorageService.instance = new SupabaseStorageService();
    }
    return SupabaseStorageService.instance;
  }

  /**
   * Valida estrictamente si un usuario posee autorización para operar sobre un bucket y archivo específico
   */
  public validateStorageAccess(
    bucket: StorageBucket,
    filename: string,
    user?: StorageUser | null,
    operation: 'upload' | 'delete' = 'upload'
  ): { allowed: boolean; error?: string; status: number } {
    if (!user || !user.uid) {
      return { allowed: false, error: 'Autenticación requerida para acceder al almacenamiento.', status: 401 };
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const userRole = (user.role || 'user').toLowerCase();

    // 1. Buckets institucionales (players, teams, news)
    if (['players', 'teams', 'news'].includes(bucket)) {
      const allowedRoles = ['superadmin', 'admin', 'editor'];
      if (bucket === 'players' || bucket === 'teams') {
        allowedRoles.push('official_scorer');
      }

      if (!allowedRoles.includes(userRole)) {
        return {
          allowed: false,
          error: `Operación denegada: se requieren permisos administrativos (${allowedRoles.join(', ')}) para modificar el bucket '${bucket}'.`,
          status: 403,
        };
      }

      return { allowed: true, status: 200 };
    }

    // 2. Bucket de avatares (avatars)
    if (bucket === 'avatars') {
      // Superadministradores y administradores pueden gestionar cualquier avatar
      if (['superadmin', 'admin'].includes(userRole)) {
        return { allowed: true, status: 200 };
      }

      // Usuarios normales solo pueden subir/borrar archivos asociados estrictamente a su propio UID
      const uidPrefix = user.uid.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const isOwnedByUser =
        cleanFilename === uidPrefix ||
        cleanFilename === `${uidPrefix}.png` ||
        cleanFilename === `${uidPrefix}.jpg` ||
        cleanFilename === `${uidPrefix}.jpeg` ||
        cleanFilename === `${uidPrefix}.webp` ||
        cleanFilename.startsWith(`${uidPrefix}_`) ||
        cleanFilename.startsWith(`${uidPrefix}/`);

      if (!isOwnedByUser) {
        return {
          allowed: false,
          error: 'Operación denegada: únicamente puede gestionar archivos dentro de su propia carpeta o prefijo de avatar.',
          status: 403,
        };
      }

      return { allowed: true, status: 200 };
    }

    return { allowed: false, error: 'Bucket no reconocido.', status: 400 };
  }

  /**
   * Carga segura validando credenciales y permisos del usuario antes de utilizar el cliente administrativo
   */
  async uploadImageSecure(
    bucket: StorageBucket,
    filename: string,
    fileData: Buffer | string,
    user?: StorageUser | null,
    contentType: string = 'image/png'
  ): Promise<{ success: boolean; url?: string; error?: string; status: number }> {
    const authCheck = this.validateStorageAccess(bucket, filename, user, 'upload');
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error, status: authCheck.status };
    }

    const uploadRes = await this.uploadImage(bucket, filename, fileData, contentType);
    return {
      success: uploadRes.success,
      url: uploadRes.url,
      error: uploadRes.error,
      status: uploadRes.success ? 200 : 500,
    };
  }

  /**
   * Eliminación segura validando credenciales y permisos del usuario antes de utilizar el cliente administrativo
   */
  async deleteImageSecure(
    bucket: StorageBucket,
    filename: string,
    user?: StorageUser | null
  ): Promise<{ success: boolean; error?: string; status: number }> {
    const authCheck = this.validateStorageAccess(bucket, filename, user, 'delete');
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error, status: authCheck.status };
    }

    const deleted = await this.deleteImage(bucket, filename);
    return {
      success: deleted,
      error: deleted ? undefined : 'Error al eliminar el archivo de Supabase Storage.',
      status: deleted ? 200 : 500,
    };
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
