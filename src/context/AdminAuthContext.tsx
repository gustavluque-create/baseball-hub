import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminUser } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from './AppContext.tsx';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  adminUser: AdminUser | null;
  adminToken: string | null;
  isCheckingSession: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  navigateToAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setActiveTab } = useApp();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(() => ApiClient.getAdminToken());
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Verify stored session on mount
  useEffect(() => {
    let isMounted = true;
    const verifyStoredSession = async () => {
      try {
        const res = await ApiClient.checkAdminSession();
        if (isMounted) {
          if (res.valid && res.admin) {
            setAdminUser(res.admin);
            setAdminToken(ApiClient.getAdminToken());
          } else {
            setAdminUser(null);
            setAdminToken(null);
          }
        }
      } catch {
        if (isMounted) {
          setAdminUser(null);
          setAdminToken(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    verifyStoredSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await ApiClient.adminLogin(username, password);
      if (res.success && res.admin && res.token) {
        setAdminUser(res.admin);
        setAdminToken(res.token);
        setIsLoginModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.message || 'Credenciales inválidas' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con el servidor de autenticación' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await ApiClient.adminLogout();
    } catch (err) {
      console.warn('Error logging out on server:', err);
    } finally {
      setAdminUser(null);
      setAdminToken(null);
      setActiveTab('home');
    }
  }, [setActiveTab]);

  const openLoginModal = useCallback(() => {
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
  }, []);

  const navigateToAdmin = useCallback(() => {
    if (adminUser) {
      setActiveTab('admin');
    } else {
      setIsLoginModalOpen(true);
    }
  }, [adminUser, setActiveTab]);

  const value = {
    isAdminAuthenticated: !!adminUser,
    adminUser,
    adminToken,
    isCheckingSession,
    login,
    logout,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    navigateToAdmin,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
