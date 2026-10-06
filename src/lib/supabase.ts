import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

let clientSupabaseInstance: SupabaseClient | null = null;

export function isSupabaseClientConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (supabaseUrl.includes('your-project') || supabaseUrl.includes('placeholder')) return false;
  return supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://');
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseClientConfigured()) {
    return null;
  }

  if (!clientSupabaseInstance) {
    clientSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    });
  }

  return clientSupabaseInstance;
}

export const supabase = getSupabaseClient();
