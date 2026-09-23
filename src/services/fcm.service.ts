import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { firebaseApp, firebaseConfig } from '../lib/firebase.ts';

export interface FcmRegistrationStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  token: string | null;
  subscribedTeams: string[];
  registeredAt?: string;
}

class FcmClientService {
  private static instance: FcmClientService;
  private messagingInstance: Messaging | null = null;
  private token: string | null = null;
  private isChecking = false;

  public static getInstance(): FcmClientService {
    if (!FcmClientService.instance) {
      FcmClientService.instance = new FcmClientService();
    }
    return FcmClientService.instance;
  }

  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('fcm_device_token') : null;
  }

  /**
   * Check if Firebase Cloud Messaging is supported in this browser environment
   */
  public async checkSupport(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }
    try {
      return await isSupported();
    } catch (err) {
      console.warn('[FCM] isSupported check failed:', err);
      return false;
    }
  }

  /**
   * Get the current messaging instance if supported
   */
  public async getMessagingInstance(): Promise<Messaging | null> {
    if (this.messagingInstance) return this.messagingInstance;
    const supported = await this.checkSupport();
    if (!supported) return null;

    try {
      this.messagingInstance = getMessaging(firebaseApp);
      return this.messagingInstance;
    } catch (err) {
      console.warn('[FCM] Failed to initialize getMessaging:', err);
      return null;
    }
  }

  /**
   * Get current registration and permission status
   */
  public async getStatus(currentFavoriteTeams: string[] = []): Promise<FcmRegistrationStatus> {
    const supported = await this.checkSupport();
    if (!supported) {
      return {
        isSupported: false,
        permission: 'unsupported',
        token: null,
        subscribedTeams: [],
      };
    }

    const permission = Notification.permission;
    const storedToken = localStorage.getItem('fcm_device_token');
    const storedTeams = localStorage.getItem('fcm_subscribed_teams');
    const subscribedTeams = storedTeams ? JSON.parse(storedTeams) : currentFavoriteTeams;

    return {
      isSupported: true,
      permission,
      token: storedToken,
      subscribedTeams,
      registeredAt: localStorage.getItem('fcm_registered_at') || undefined,
    };
  }

  /**
   * Request browser permission and obtain FCM device token
   */
  public async requestPermissionAndRegister(favoriteTeams: string[]): Promise<{
    success: boolean;
    token?: string;
    permission: NotificationPermission | 'unsupported';
    error?: string;
  }> {
    const supported = await this.checkSupport();
    if (!supported) {
      return {
        success: false,
        permission: 'unsupported',
        error: 'Las notificaciones push no son compatibles con este navegador.',
      };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          permission,
          error: 'Permiso de notificaciones denegado por el usuario.',
        };
      }

      // Register or ensure service worker is active
      let swRegistration: ServiceWorkerRegistration | undefined;
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[FCM] Service Worker registration notice:', swErr);
      }

      const messaging = await this.getMessagingInstance();
      if (!messaging) {
        throw new Error('No se pudo inicializar Firebase Messaging');
      }

      // Retrieve device token
      const token = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        throw new Error('No se pudo generar el token de registro de FCM');
      }

      this.token = token;
      localStorage.setItem('fcm_device_token', token);
      localStorage.setItem('fcm_subscribed_teams', JSON.stringify(favoriteTeams));
      localStorage.setItem('fcm_registered_at', new Date().toISOString());

      // Send token and favorite teams to backend
      await this.sendTokenToBackend(token, favoriteTeams);

      return {
        success: true,
        token,
        permission: 'granted',
      };
    } catch (err: any) {
      console.error('[FCM] Registration failed:', err);
      return {
        success: false,
        permission: Notification.permission,
        error: err.message || 'Error al registrar token de notificaciones FCM',
      };
    }
  }

  /**
   * Send the token and favorite teams list to the server API
   */
  public async sendTokenToBackend(token: string, favoriteTeams: string[]): Promise<boolean> {
    try {
      const response = await fetch('/api/notifications/fcm/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          favoriteTeamIds: favoriteTeams,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return true;
    } catch (err) {
      console.error('[FCM] Failed to register token with backend:', err);
      return false;
    }
  }

  /**
   * Update favorite teams subscribed for FCM alerts
   */
  public async syncFavoriteTeams(favoriteTeams: string[]): Promise<boolean> {
    const token = this.token || localStorage.getItem('fcm_device_token');
    if (!token) return false;

    localStorage.setItem('fcm_subscribed_teams', JSON.stringify(favoriteTeams));
    return this.sendTokenToBackend(token, favoriteTeams);
  }

  /**
   * Listen for push messages while the application is in foreground
   */
  public async setupForegroundListener(
    onMessageReceived: (payload: any) => void
  ): Promise<(() => void) | null> {
    const messaging = await this.getMessagingInstance();
    if (!messaging) return null;

    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground push message received:', payload);
        onMessageReceived(payload);

        // Show browser notification if permitted even in foreground
        if (Notification.permission === 'granted') {
          const title = payload.notification?.title || payload.data?.title || '⚾ ¡Carrera Anotada!';
          const body = payload.notification?.body || payload.data?.body || 'Un equipo ha anotado.';
          try {
            new Notification(title, {
              body,
              icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
              tag: payload.data?.gameId || 'score-alert',
            });
          } catch {
            // Service worker fallback
          }
        }
      });
      return unsubscribe;
    } catch (err) {
      console.warn('[FCM] Error setting up foreground listener:', err);
      return null;
    }
  }

  /**
   * Trigger a test push notification from backend
   */
  public async sendTestPush(teamId?: string): Promise<{ success: boolean; message: string }> {
    const token = this.token || localStorage.getItem('fcm_device_token');
    if (!token) {
      return { success: false, message: 'Primero activa las notificaciones push' };
    }

    try {
      const res = await fetch('/api/notifications/fcm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, teamId }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Error al enviar prueba push' };
    }
  }
}

export const fcmClient = FcmClientService.getInstance();
