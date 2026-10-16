import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase.ts';

export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: string;
  preferences?: Record<string, any>;
}

interface UserAuthContextType {
  user: AppUser | null;
  token: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserAuthContext = createContext<UserAuthContextType>({
  user: null,
  token: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
  refreshUser: async () => {},
});

export const UserAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const syncBackendUser = useCallback(async (jwt: string, profile: Partial<AppUser>) => {
    try {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          displayName: profile.displayName,
          photoUrl: profile.photoURL,
        }),
      });
    } catch (err) {
      console.warn('[UserAuth] Sync with backend notice:', err);
    }
  }, []);

  const handleSession = useCallback(async (session: any) => {
    if (session && session.user) {
      const u = session.user;
      const metadata = u.user_metadata || {};
      const appUser: AppUser = {
        id: u.id,
        uid: u.id,
        email: u.email || null,
        displayName: metadata.full_name || metadata.name || u.email?.split('@')[0] || 'Aficionado',
        photoURL: metadata.avatar_url || metadata.picture || null,
        role: u.app_metadata?.role || metadata.role || 'user',
      };
      setUser(appUser);
      setToken(session.access_token || null);
      if (session.access_token) {
        await syncBackendUser(session.access_token, appUser);
      }
    } else {
      setUser(null);
      setToken(null);
    }
    setLoading(false);
  }, [syncBackendUser]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    }).catch((err) => {
      console.warn('[UserAuth] getSession notice:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSession]);

  const signInWithGoogle = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('[UserAuth] Supabase client not configured');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('[UserAuth] Google sign in error:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    setToken(null);
  };

  const refreshUser = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    }
  };

  return (
    <UserAuthContext.Provider
      value={{
        user,
        token,
        loading,
        signInWithGoogle,
        signOutUser,
        refreshUser,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);
