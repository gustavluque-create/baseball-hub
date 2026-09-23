import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  ScoreNotificationEvent,
  RealTimeConnectionMode,
  RealTimeConnectionStatus,
} from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from './AppContext.tsx';
import { playBaseballScoreChime } from '../utils/scoreNotification.ts';

export interface ScoreNotificationContextType {
  // Settings & Status
  desktopNotificationsEnabled: boolean;
  setDesktopNotificationsEnabled: (enabled: boolean) => void;
  browserPermission: NotificationPermission | 'unsupported';
  requestBrowserPermission: () => Promise<NotificationPermission | 'unsupported'>;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  notifyOnlyFavorites: boolean;
  setNotifyOnlyFavorites: (onlyFavs: boolean) => void;
  connectionMode: RealTimeConnectionMode;
  setConnectionMode: (mode: RealTimeConnectionMode) => void;
  pollingIntervalMs: number;
  setPollingIntervalMs: (ms: number) => void;
  connectionStatus: RealTimeConnectionStatus;
  lastEventTimestamp: number | null;
  activeClientsCount: number;

  // Active floating toasts
  toasts: ScoreNotificationEvent[];
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;

  // History & Log
  history: ScoreNotificationEvent[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearHistory: () => void;

  // Quick View Modal State
  activeQuickViewToast: ScoreNotificationEvent | null;
  setActiveQuickViewToast: (toast: ScoreNotificationEvent | null) => void;

  // Actions & Simulation
  triggerTestNotification: () => Promise<void>;
  simulateScoreChange: (gameId?: string, side?: 'home' | 'away', runs?: number) => Promise<void>;
  sendWebhookUpdate: (payload: {
    gameId: string;
    scoringTeamSide?: 'home' | 'away';
    runs?: number;
    playDescription?: string;
    title?: string;
  }) => Promise<{ success: boolean; message: string }>;
  refreshNotificationFeed: () => Promise<void>;
}

const ScoreNotificationContext = createContext<ScoreNotificationContextType | undefined>(undefined);

export const ScoreNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isFavoriteTeam, navigateToGame } = useApp();

  // Desktop notification permission
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Persisted desktop notification enabled preference
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabledState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_desktop_notifs');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const setDesktopNotificationsEnabled = (enabled: boolean) => {
    setDesktopNotificationsEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_hub_desktop_notifs', String(enabled));
    }
  };

  // Sound preference
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_notif_sound');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_hub_notif_sound', String(enabled));
    }
  };

  // Filter only favorite teams
  const [notifyOnlyFavorites, setNotifyOnlyFavoritesState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_notif_only_favorites');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  const setNotifyOnlyFavorites = (onlyFavs: boolean) => {
    setNotifyOnlyFavoritesState(onlyFavs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_hub_notif_only_favorites', String(onlyFavs));
    }
  };

  // Real-time connection mode: 'stream' (SSE) or 'polling'
  const [connectionMode, setConnectionModeState] = useState<RealTimeConnectionMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_realtime_mode') as RealTimeConnectionMode | null;
      if (saved && ['stream', 'polling'].includes(saved)) {
        return saved;
      }
    }
    return 'stream';
  });

  const setConnectionMode = (mode: RealTimeConnectionMode) => {
    setConnectionModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_hub_realtime_mode', mode);
    }
  };

  // Polling interval in ms
  const [pollingIntervalMs, setPollingIntervalMsState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_polling_interval');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 3000) return parsed;
      }
    }
    return 6000;
  });

  const setPollingIntervalMs = (ms: number) => {
    setPollingIntervalMsState(ms);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_hub_polling_interval', String(ms));
    }
  };

  const [connectionStatus, setConnectionStatus] = useState<RealTimeConnectionStatus>('connecting');
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number | null>(null);
  const [activeClientsCount, setActiveClientsCount] = useState<number>(1);

  // Floating toasts and history
  const [toasts, setToasts] = useState<ScoreNotificationEvent[]>([]);
  const [history, setHistory] = useState<ScoreNotificationEvent[]>([]);
  const [activeQuickViewToast, setActiveQuickViewToast] = useState<ScoreNotificationEvent | null>(null);

  // Set of seen event IDs for deduplication
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const lastPollTimeRef = useRef<number>(Date.now() - 3600000); // 1 hour ago initially
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  // Request browser desktop notification permission
  const requestBrowserPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        setDesktopNotificationsEnabled(true);
      }
      return permission;
    } catch (err) {
      console.warn('Error requesting browser notification permission:', err);
      return 'unsupported';
    }
  };

  // Process incoming score change event
  const handleIncomingScoreEvent = useCallback(
    (event: ScoreNotificationEvent) => {
      if (!event || !event.id) return;

      // Deduplicate
      if (seenEventIdsRef.current.has(event.id)) {
        return;
      }
      seenEventIdsRef.current.add(event.id);

      // Check favorite teams filter
      const isFavHome = isFavoriteTeam(event.homeTeam.id);
      const isFavAway = isFavoriteTeam(event.awayTeam.id);
      const isFavMatch = isFavHome || isFavAway;

      // Always add to history log
      setHistory((prev) => {
        const exists = prev.some((e) => e.id === event.id);
        if (exists) return prev;
        return [{ ...event, read: false }, ...prev].slice(0, 50);
      });

      setLastEventTimestamp(event.timestamp || Date.now());

      // If user opted to receive alerts ONLY for favorites and this is not a favorite match, stop here
      if (notifyOnlyFavorites && !isFavMatch) {
        return;
      }

      // 1. Play synthesized baseball stadium chime
      if (soundEnabled) {
        playBaseballScoreChime(true);
      }

      // 2. Add in-app floating toast
      setToasts((prev) => {
        // Keep at most 3 active floating toasts
        const filtered = prev.filter((t) => t.id !== event.id);
        return [event, ...filtered].slice(0, 3);
      });

      // 3. Trigger Browser Desktop System Notification if enabled and permitted
      if (
        desktopNotificationsEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const scoringTeam = event.scoringTeam?.shortName || (event.scoringTeamSide === 'home' ? event.homeTeam.shortName : event.awayTeam.shortName);
          const title = `⚾ ${event.title || '¡CARRERA ANOTADA!'} • ${scoringTeam} +${event.runsScored}`;
          const body = `${event.awayTeam.shortName} ${event.awayScore} - ${event.homeTeam.shortName} ${event.homeScore} (${event.inning}ª ${event.isTopInning ? '▲ Alta' : '▼ Baja'})\n${event.description}`;

          const desktopNotif = new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: `baseball-score-${event.gameId}-${event.id}`,
            requireInteraction: false,
            silent: !soundEnabled,
          });

          desktopNotif.onclick = () => {
            window.focus();
            navigateToGame(event.gameId);
            desktopNotif.close();
          };

          // Auto-close after 8 seconds
          setTimeout(() => {
            try {
              desktopNotif.close();
            } catch {
              // Ignore
            }
          }, 8000);
        } catch (e) {
          console.debug('Desktop notification error:', e);
        }
      }
    },
    [
      isFavoriteTeam,
      notifyOnlyFavorites,
      soundEnabled,
      desktopNotificationsEnabled,
      navigateToGame,
    ]
  );

  // Dismiss a toast by ID
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setHistory((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Compute unread count
  const unreadCount = useMemo(() => {
    return history.filter((item) => !item.read).length;
  }, [history]);

  // Initial load of past history
  useEffect(() => {
    ApiClient.getNotificationsHistory(20)
      .then((items) => {
        if (Array.isArray(items)) {
          items.forEach((item) => seenEventIdsRef.current.add(item.id));
          setHistory(items);
        }
      })
      .catch((err) => {
        console.warn('Could not prefetch notification history:', err);
      });
  }, []);

  // Setup Real-Time Stream (SSE / Browser Webhooks)
  const setupEventSource = useCallback(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) {
      setConnectionMode('polling');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus('connecting');

    try {
      const es = new EventSource('/api/events/score-changes');
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionStatus('connected');
      };

      es.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === 'connected') {
            setConnectionStatus('connected');
            if (message.activeClients) {
              setActiveClientsCount(message.activeClients);
            }
            if (Array.isArray(message.recentEvents) && message.recentEvents.length > 0) {
              // Populate seen IDs
              message.recentEvents.forEach((ev: ScoreNotificationEvent) => {
                seenEventIdsRef.current.add(ev.id);
              });
            }
          } else if (message.type === 'score:change' && message.data) {
            handleIncomingScoreEvent(message.data);
          }
        } catch (err) {
          console.warn('SSE message parse warning:', err);
        }
      };

      es.onerror = (err) => {
        console.warn('SSE connection error, attempting reconnection or polling fallback:', err);
        setConnectionStatus('error');
        es.close();
        eventSourceRef.current = null;

        // Schedule reconnection
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          if (connectionMode === 'stream') {
            setupEventSource();
          }
        }, 5000);
      };
    } catch (err) {
      console.warn('Failed to create EventSource:', err);
      setConnectionStatus('error');
    }
  }, [connectionMode, handleIncomingScoreEvent]);

  // Setup Polling Service
  const runPollingCycle = useCallback(async () => {
    try {
      const since = lastPollTimeRef.current;
      const res = await ApiClient.pollScoreNotifications(since, 20);

      lastPollTimeRef.current = res.timestamp || Date.now();
      if (res.activeClients) {
        setActiveClientsCount(res.activeClients);
      }
      setConnectionStatus('polling');

      if (Array.isArray(res.events) && res.events.length > 0) {
        // Process new events in chronological order
        const sorted = [...res.events].sort((a, b) => a.timestamp - b.timestamp);
        sorted.forEach((ev) => handleIncomingScoreEvent(ev));
      }
    } catch (err) {
      console.warn('Polling error:', err);
      setConnectionStatus('error');
    }
  }, [handleIncomingScoreEvent]);

  // Manage Connection based on connectionMode
  useEffect(() => {
    if (connectionMode === 'stream') {
      setupEventSource();
      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
      };
    } else {
      // Polling mode
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnectionStatus('polling');
      runPollingCycle();

      const timer = window.setInterval(runPollingCycle, pollingIntervalMs);
      pollingTimerRef.current = timer;

      return () => {
        clearInterval(timer);
      };
    }
  }, [connectionMode, pollingIntervalMs, setupEventSource, runPollingCycle]);

  // Trigger a test notification
  const triggerTestNotification = async (): Promise<void> => {
    try {
      const res = await ApiClient.testScoreNotification();
      if (res.event) {
        handleIncomingScoreEvent(res.event);
      }
    } catch (err) {
      console.warn('Error triggering test notification:', err);
    }
  };

  // Simulate run on server
  const simulateScoreChange = async (gameId?: string, side?: 'home' | 'away', runs = 1): Promise<void> => {
    console.log(
      `%c[STATE HOOK: useScoreNotifications]%c simulateScoreChange() writing score increment to database -> gameId: ${gameId || 'auto'}, side: ${side || 'auto'}, runs: ${runs}`,
      'color: #d97706; font-weight: bold;',
      'color: inherit;'
    );
    try {
      await ApiClient.simulateGameRun({ gameId, side, runs });
      console.log(
        `%c[STATE HOOK: useScoreNotifications]%c simulateScoreChange() successfully persisted to database`,
        'color: #10b981; font-weight: bold;',
        'color: inherit;'
      );
    } catch (err: any) {
      console.warn(
        `%c[STATE HOOK: useScoreNotifications]%c simulateScoreChange() failed to persist score: ${err.message}`,
        'color: #ef4444; font-weight: bold;',
        'color: inherit;'
      );
    }
  };

  // Send webhook update
  const sendWebhookUpdate = async (payload: {
    gameId: string;
    scoringTeamSide?: 'home' | 'away';
    runs?: number;
    playDescription?: string;
    title?: string;
  }): Promise<{ success: boolean; message: string }> => {
    console.log(
      `%c[STATE HOOK: useScoreNotifications]%c sendWebhookUpdate() dispatching score event write to database`,
      'color: #d97706; font-weight: bold;',
      'color: inherit;',
      payload
    );
    try {
      const res = await ApiClient.sendScoreWebhook(payload);
      if (res.event) {
        handleIncomingScoreEvent(res.event);
      }
      console.log(
        `%c[STATE HOOK: useScoreNotifications]%c sendWebhookUpdate() write confirmed by database: ${res.message}`,
        'color: #10b981; font-weight: bold;',
        'color: inherit;'
      );
      return { success: res.success, message: res.message };
    } catch (err: any) {
      console.warn(
        `%c[STATE HOOK: useScoreNotifications]%c sendWebhookUpdate() write failed: ${err.message}`,
        'color: #ef4444; font-weight: bold;',
        'color: inherit;'
      );
      return { success: false, message: err?.message || 'Error enviando webhook' };
    }
  };

  const refreshNotificationFeed = async (): Promise<void> => {
    try {
      const items = await ApiClient.getNotificationsHistory(30);
      setHistory(items);
    } catch (err) {
      console.warn('Error refreshing feed:', err);
    }
  };

  return (
    <ScoreNotificationContext.Provider
      value={{
        desktopNotificationsEnabled,
        setDesktopNotificationsEnabled,
        browserPermission,
        requestBrowserPermission,
        soundEnabled,
        setSoundEnabled,
        notifyOnlyFavorites,
        setNotifyOnlyFavorites,
        connectionMode,
        setConnectionMode,
        pollingIntervalMs,
        setPollingIntervalMs,
        connectionStatus,
        lastEventTimestamp,
        activeClientsCount,
        toasts,
        dismissToast,
        clearAllToasts,
        history,
        unreadCount,
        markAllAsRead,
        clearHistory,
        activeQuickViewToast,
        setActiveQuickViewToast,
        triggerTestNotification,
        simulateScoreChange,
        sendWebhookUpdate,
        refreshNotificationFeed,
      }}
    >
      {children}
    </ScoreNotificationContext.Provider>
  );
};

export const useScoreNotifications = (): ScoreNotificationContextType => {
  const context = useContext(ScoreNotificationContext);
  if (!context) {
    throw new Error('useScoreNotifications must be used within a ScoreNotificationProvider');
  }
  return context;
};
