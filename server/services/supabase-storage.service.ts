import { getSupabaseServerClient } from '../lib/supabase.ts';

export type StorageBucket = 'players' | 'teams' | 'news' | 'avatars';

export interface StorageUser {
  uid: string;
  role?: string;
}

export interface ImageValidationResult {
  valid: boolean;
  mimeType?: string;
  error?: string;
  status: number;
}

/**
 * Valida de forma estricta los bytes reales del búfer (magic numbers) y la cuota de tamaño del bucket.
 * NUNCA confía en la cabecera contentType proporcionada por el cliente.
 */
export function detectAndValidateImageBuffer(
  buffer: Buffer,
  bucket: StorageBucket
): ImageValidationResult {
  const bucketLimits: Record<StorageBucket, { maxBytes: number; allowedMimes: string[] }> = {
    players: {
      maxBytes: 5 * 1024 * 1024, // 5 MB
      allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    },
    teams: {
      maxBytes: 5 * 1024 * 1024, // 5 MB
      allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    },
    news: {
      maxBytes: 10 * 1024 * 1024, // 10 MB
      allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    },
    avatars: {
      maxBytes: 3 * 1024 * 1024, // 3 MB
      allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
    },
  };

  const config = bucketLimits[bucket];
  if (!config) {
    return { valid: false, error: `Bucket '${bucket}' no reconocido.`, status: 400 };
  }

  // 1. Archivo vacío o corrupto
  if (!buffer || buffer.length < 16) {
    return { valid: false, error: 'Archivo vacío o corrupto (mínimo 16 bytes).', status: 400 };
  }

  // 2. Comprobación de tamaño máximo
  if (buffer.length > config.maxBytes) {
    const maxMb = config.maxBytes / (1024 * 1024);
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo permitido de ${maxMb} MB para el bucket '${bucket}'.`,
      status: 413,
    };
  }

  // 3. Inspección rigurosa de magic numbers en binario
  let detectedMime: string | null = null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = 'image/png';
  }
  // JPEG / JPG: FF D8 FF
  else if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    detectedMime = 'image/jpeg';
  }
  // GIF: GIF87a o GIF89a
  else if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    detectedMime = 'image/gif';
  }
  // WEBP: 'RIFF'....'WEBP'
  else if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedMime = 'image/webp';
  }
  // SVG: solo permitido en players y teams
  else if (config.allowedMimes.includes('image/svg+xml')) {
    const headerStr = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8').trim().toLowerCase();
    if (headerStr.includes('<svg') || (headerStr.startsWith('<?xml') && headerStr.includes('<svg'))) {
      const fullText = buffer.toString('utf8').toLowerCase();
      // Protección Anti-XSS en SVG
      if (
        fullText.includes('<script') ||
        fullText.includes('javascript:') ||
        fullText.includes('onload=') ||
        fullText.includes('onerror=') ||
        fullText.includes('<iframe')
      ) {
        return {
          valid: false,
          error: 'Archivo SVG rechazado: contiene scripts o atributos potencialmente peligrosos.',
          status: 400,
        };
      }
      detectedMime = 'image/svg+xml';
    }
  }

  // Si no coincidió con ninguna firma binaria válida
  if (!detectedMime) {
    return {
      valid: false,
      error: 'Formato de imagen inválido o cabecera binaria corrupta. El archivo no corresponde a una imagen reconocida.',
      status: 400,
    };
  }

  // Verificar que el formato detectado esté en la lista permitida para el bucket
  if (!config.allowedMimes.includes(detectedMime)) {
    return {
      valid: false,
      error: `El formato detectado '${detectedMime}' no está permitido en el bucket '${bucket}'. Formatos permitidos: ${config.allowedMimes.join(', ')}.`,
      status: 400,
    };
  }

  return { valid: true, mimeType: detectedMime, status: 200 };
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
      if (['superadmin', 'admin'].includes(userRole)) {
        return { allowed: true, status: 200 };
      }

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
    clientContentType?: string
  ): Promise<{ success: boolean; url?: string; error?: string; status: number }> {
    // 1. Validación estricta de autorización y propiedad
    const authCheck = this.validateStorageAccess(bucket, filename, user, 'upload');
    if (!authCheck.allowed) {
      return { success: false, error: authCheck.error, status: authCheck.status };
    }

    // 2. Extracción de búfer
    let buffer: Buffer;
    try {
      if (typeof fileData === 'string') {
        if (fileData.startsWith('data:')) {
          const parts = fileData.split(',');
          buffer = Buffer.from(parts[1] || '', 'base64');
        } else {
          buffer = Buffer.from(fileData, 'base64');
        }
      } else {
        buffer = fileData;
      }
    } catch {
      return { success: false, error: 'Datos de archivo corruptos o codificación base64 inválida.', status: 400 };
    }

    // 3. Validación de contenido binario real y límites de tamaño (cero confianza en clientContentType)
    const validation = detectAndValidateImageBuffer(buffer, bucket);
    if (!validation.valid || !validation.mimeType) {
      return { success: false, error: validation.error, status: validation.status };
    }

    // 4. Llamada al servicio con el MIME verificado por magic bytes
    const uploadRes = await this.uploadImage(bucket, filename, buffer, validation.mimeType);
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
      // Supabase storage no configurado en entorno local; responder coherentemente
      return { success: false, error: 'Supabase storage is not configured.' };
    }

    try {
      let buffer: Buffer;
      if (typeof fileData === 'string') {
        if (fileData.startsWith('data:')) {
          const parts = fileData.split(',');
          buffer = Buffer.from(parts[1] || '', 'base64');
        } else {
          buffer = Buffer.from(fileData, 'base64');
        }
      } else {
        buffer = fileData;
      }

      // Validación de magic numbers para llamadas internas
      const validation = detectAndValidateImageBuffer(buffer, bucket);
      if (!validation.valid || !validation.mimeType) {
        return { success: false, error: validation.error };
      }

      const finalContentType = validation.mimeType;
      const cleanPath = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(cleanPath, buffer, {
          contentType: finalContentType,
          upsert: true,
        });

      if (error) {
        return { success: false, error: error.message };
      }

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
