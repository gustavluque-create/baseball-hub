import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || '';
}

function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function getSupabaseAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLIC_KEY ||
    ''
  );
}

let cachedAdminInstance: SupabaseClient | null = null;
let cachedAdminKey: string = '';
let cachedAdminUrl: string = '';

let cachedAuthInstance: SupabaseClient | null = null;
let cachedAuthKey: string = '';
let cachedAuthUrl: string = '';

let customAdminInstanceOverride: SupabaseClient | null = null;

/**
 * Permite inyectar o restaurar una instancia mock/custom del cliente administrativo para tests controlados.
 */
export function setSupabaseAdminClientOverride(client: SupabaseClient | null): void {
  customAdminInstanceOverride = client;
}

/**
 * Verifica si las credenciales administrativas de Supabase están configuradas.
 * Requiere estrictamente SUPABASE_SERVICE_ROLE_KEY (nunca acepta la clave anónima).
 */
export function isSupabaseServerConfigured(): boolean {
  if (customAdminInstanceOverride !== null) {
    return true;
  }
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) return false;
  if (url.includes('your-project') || url.includes('placeholder')) return false;
  return url.startsWith('https://') || url.startsWith('http://');
}

/**
 * Verifica si las credenciales de autenticación pública de Supabase están configuradas.
 * Requiere SUPABASE_ANON_KEY o clave pública equivalente.
 */
export function isSupabaseAuthConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;
  if (url.includes('your-project') || url.includes('placeholder')) return false;
  return url.startsWith('https://') || url.startsWith('http://');
}

/**
 * Cliente administrativo:
 * - Utiliza exclusivamente SUPABASE_SERVICE_ROLE_KEY.
 * - Se utiliza para operaciones administrativas y consultas privilegiadas (auth.admin, tablas protegidas).
 * - Nunca se expone al frontend ni se utiliza para iniciar sesión como usuarios normales.
 * - Configurado con persistSession: false y autoRefreshToken: false en backend.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (customAdminInstanceOverride !== null) {
    return customAdminInstanceOverride;
  }

  if (!isSupabaseServerConfigured()) {
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!cachedAdminInstance || cachedAdminKey !== key || cachedAdminUrl !== url) {
    cachedAdminInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    cachedAdminKey = key;
    cachedAdminUrl = url;
  }

  return cachedAdminInstance;
}

// Compatibilidad con invocadores existentes que utilicen getSupabaseServerClient o supabaseAdmin
export const getSupabaseServerClient = getSupabaseAdminClient;
export const supabaseAdmin = getSupabaseAdminClient();

/**
 * Cliente de autenticación:
 * - Utiliza SUPABASE_ANON_KEY o la clave pública equivalente configurada para el proyecto.
 * - Se utiliza para signInWithPassword() y operaciones de autenticación de usuario.
 * - Debe tener persistSession: false y autoRefreshToken: false en el backend.
 * - No comparte el estado de sesión con el cliente administrativo.
 * - No utiliza SUPABASE_SERVICE_ROLE_KEY para iniciar sesión con credenciales de usuarios normales.
 */
export function getSupabaseAuthClient(): SupabaseClient | null {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!cachedAuthInstance || cachedAuthKey !== key || cachedAuthUrl !== url) {
    cachedAuthInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    cachedAuthKey = key;
    cachedAuthUrl = url;
  }

  return cachedAuthInstance;
}

/**
 * Crea una nueva instancia independiente del cliente de autenticación para operaciones aisladas.
 */
export function createSupabaseAuthClient(): SupabaseClient | null {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

