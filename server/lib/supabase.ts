import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let serverSupabaseInstance: SupabaseClient | null = null;

export function isSupabaseServerConfigured(): boolean {
  if (!supabaseUrl || !supabaseServiceRoleKey) return false;
  if (supabaseUrl.includes('your-project') || supabaseUrl.includes('placeholder')) return false;
  return supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://');
}

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) {
    return null;
  }

  if (!serverSupabaseInstance) {
    serverSupabaseInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serverSupabaseInstance;
}

export const supabaseAdmin = getSupabaseServerClient();
