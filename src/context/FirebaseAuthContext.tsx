import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onIdTokenChanged,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface FirebaseAuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType>({
  user: null,
  token: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
});

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);

          // Synchronize user profile with backend database
          fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              displayName: currentUser.displayName,
              photoUrl: currentUser.photoURL,
            }),
          }).catch((err) => {
            console.warn('[FirebaseAuth] User sync notice:', err);
          });
        } catch (err) {
          console.error('[FirebaseAuth] Failed to retrieve ID token:', err);
          setToken(null);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      // Ignore user-cancelled popup close
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('[FirebaseAuth] Google Sign-In failed:', err);
        throw err;
      }
    }
  };

  const signOutUser = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error('[FirebaseAuth] Sign out failed:', err);
      throw err;
    }
  };

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        token,
        loading,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export const useFirebaseAuth = () => useContext(FirebaseAuthContext);
