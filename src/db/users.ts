import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';
import { getSupabaseServerClient, isSupabaseServerConfigured } from '../../server/lib/supabase.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  photoUrl?: string,
  role: string = 'user',
  preferences: Record<string, any> = {}
) {
  // 1. Supabase as PRIMARY if configured
  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .upsert({
            id: uid,
            uid,
            email,
            display_name: displayName || null,
            photo_url: photoUrl || null,
            role: role || 'user',
            preferences: preferences || {},
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          return {
            uid: data.uid,
            email: data.email,
            displayName: data.display_name,
            photoUrl: data.photo_url,
            role: data.role,
            preferences: data.preferences,
          };
        }
      } catch (err) {
        console.warn('[UsersDB] Supabase upsert notice, falling back:', err);
      }
    }
  }

  // 2. Cloud SQL fallback
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
        photoUrl: photoUrl || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
          photoUrl: photoUrl || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.warn('Database getOrCreateUser fallback notice:', error);
    return {
      uid,
      email,
      displayName: displayName || null,
      photoUrl: photoUrl || null,
      role: role || 'user',
      preferences,
    };
  }
}

export async function getUserByUid(uid: string) {
  // 1. Supabase as PRIMARY if configured
  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('uid', uid)
          .single();

        if (!error && data) {
          return {
            uid: data.uid,
            email: data.email,
            displayName: data.display_name,
            photoUrl: data.photo_url,
            role: data.role,
            preferences: data.preferences,
          };
        }
      } catch (err) {
        console.warn('[UsersDB] Supabase query notice:', err);
      }
    }
  }

  // 2. Cloud SQL fallback
  try {
    const records = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return records[0] || null;
  } catch (error) {
    console.warn('Database getUserByUid notice:', error);
    return null;
  }
}
