import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  Trash2,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  ExternalLink,
  Eye,
  Settings,
  RefreshCw,
  Star,
  Flame,
  Zap,
  CheckCheck,
  Send,
  Sliders,
  ChevronDown,
  Info,
} from 'lucide-react';
import { useScoreNotifications } from '../context/ScoreNotificationContext.tsx';
import { useApp } from '../context/AppContext.tsx';
import { ScoreNotificationEvent } from '../types/index.ts';

export const NotificationCenterDropdown: React.FC = () => {
  const {
    toasts,
    history,
    unreadCount,
    markAllAsRead,
    clearHistory,
    soundEnabled,
    setSoundEnabled,
    desktopNotificationsEnabled,
    setDesktopNotificationsEnabled,
    browserPermission,
    requestBrowserPermission,
    connectionMode,
    setConnectionMode,
    connectionStatus,
    pollingIntervalMs,
    setPollingIntervalMs,
    notifyOnlyFavorites,
    setNotifyOnlyFavorites,
    triggerTestNotification,
    setActiveQuickViewToast,
    simulateScoreChange,
    sendWebhookUpdate,
    refreshNotificationFeed,
  } = useScoreNotifications();

  const { isFavoriteTeam, navigateToGame, language, setIsSettingsOpen } = useApp();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');
  const [showWebhookTester, setShowWebhookTester] = useState<boolean>(false);
  const [testGameId, setTestGameId] = useState<string>('gm-snb-01');
  const [testSide, setTestSide] = useState<'home' | 'away'>('home');
  const [testRuns, setTestRuns] = useState<number>(1);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter items
  const filteredHistory = history.filter((item) => {
    if (filterMode === 'favorites') {
      return isFavoriteTeam(item.homeTeam.id) || isFavoriteTeam(item.awayTeam.id);
    }
    return true;
  });

  const handleTestAlert = async () => {
    setIsTriggering(true);
    try {
      await triggerTestNotification();
    } finally {
      setTimeout(() => setIsTriggering(false), 600);
    }
  };

  const handleSendCustomWebhook = async () => {
    setIsTriggering(true);
    try {
      await sendWebhookUpdate({
        gameId: testGameId,
        scoringTeamSide: testSide,
        runs: testRuns,
        title: testRuns > 1 ? `¡EXTRABASE DE ${testRuns} CARRERAS!` : '¡SENCILLO OPORTUNO!',
        playDescription: `Webhook simulado: +${testRuns} carrera(s) para el equipo ${testSide === 'home' ? 'local' : 'visitante'}.`,
      });
    } finally {
      setTimeout(() => setIsTriggering(false), 600);
    }
  };

  // Format relative time
  const formatTimeAgo = (timestamp: number): string => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 10) return language === 'es' ? 'Ahora mismo' : 'Just now';
    if (diffSec < 60) return language === 'es' ? `Hace ${diffSec}s` : `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return language === 'es' ? `Hace ${diffMin}m` : `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return language === 'es' ? `Hace ${diffHr}h` : `${diffHr}h ago`;
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Bell Trigger Button */}
      <button
        id="notification-center-trigger-btn"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next && unreadCount > 0) {
            // Keep badges visible or mark after inspecting
          }
        }}
        className={`relative p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
        }`}
        title="Alertas y Notificaciones de Marcador en Tiempo Real"
        aria-label="Notificaciones de carreras en vivo"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4 text-slate-300 group-hover:text-white" />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Connection status mini indicator dot */}
        <span
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-950 ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500'
              : connectionStatus === 'polling'
              ? 'bg-amber-400'
              : connectionStatus === 'connecting'
              ? 'bg-blue-400 animate-ping'
              : 'bg-red-500'
          }`}
          title={`Estado de conexión: ${connectionStatus}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          id="notification-center-panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl shadow-black/90 backdrop-blur-xl z-50 text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          role="dialog"
          aria-label="Panel de notificaciones"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5 leading-tight">
                  <span>{language === 'es' ? 'Alertas de Marcador' : 'Score Alerts'}</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30">
                      {unreadCount} {language === 'es' ? 'nuevas' : 'new'}
                    </span>
                  )}
                </h3>
                {/* Connection Status Pill */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      connectionStatus === 'connected'
                        ? 'bg-emerald-400 animate-pulse'
                        : connectionStatus === 'polling'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}
                  />
                  <span>
                    {connectionStatus === 'connected'
                      ? language === 'es'
                        ? 'Stream en vivo (SSE)'
                        : 'Live Stream (SSE)'
                      : connectionStatus === 'polling'
                      ? language === 'es'
                        ? `Sondeo (${pollingIntervalMs / 1000}s)`
                        : `Polling (${pollingIntervalMs / 1000}s)`
                      : language === 'es'
                      ? 'Reconectando...'
                      : 'Reconnecting...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title={language === 'es' ? 'Marcar todas como leídas' : 'Mark all as read'}
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearHistory}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title={language === 'es' ? 'Borrar historial' : 'Clear history'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                title={language === 'es' ? 'Ajustes de Notificación' : 'Notification Settings'}
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Filter Pill Bar */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800/80 bg-slate-950/30 text-xs">
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {language === 'es' ? 'Todas' : 'All'} ({history.length})
              </button>
              <button
                onClick={() => setFilterMode('favorites')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filterMode === 'favorites'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
                <span>{language === 'es' ? 'Favoritos' : 'Favorites'}</span>
              </button>
            </div>

            {/* Quick Test Alert Button */}
            <button
              onClick={handleTestAlert}
              disabled={isTriggering}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[11px] border border-emerald-500/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Disparar notificación y sonido de prueba"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isTriggering ? 'Probando...' : language === 'es' ? 'Probar' : 'Test'}</span>
            </button>
          </div>

          {/* Notifications Scrollable List */}
          <div className="max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-1">
            {filteredHistory.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-400 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500 text-lg">
                  ⚾
                </div>
                <p className="text-xs font-semibold text-slate-300">
                  {language === 'es'
                    ? filterMode === 'favorites'
                      ? 'Sin alertas de tus equipos favoritos aún.'
                      : 'No hay alertas de carreras en este momento.'
                    : 'No score alerts recorded yet.'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  {language === 'es'
                    ? 'Cuando cambie el marcador de un partido en vivo, recibirás alertas aquí, avisos en el navegador y campanas de estadio.'
                    : 'When a live game score updates, alerts with sound will appear here in real-time.'}
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleTestAlert}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{language === 'es' ? 'Generar Alerta de Prueba' : 'Generate Test Alert'}</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredHistory.map((item) => {
                const isFav = isFavoriteTeam(item.homeTeam.id) || isFavoriteTeam(item.awayTeam.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      // Open quick view
                      setActiveQuickViewToast(item);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer group hover:bg-slate-800/60 ${
                      !item.read ? 'bg-emerald-950/20 border-l-2 border-emerald-500' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Scoring badge */}
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-mono font-black text-[10px] tracking-tight">
                          +{item.runsScored} {item.scoringTeam.shortName}
                        </span>

                        {/* Inning */}
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">
                          {item.inning}ª {item.isTopInning ? '▲' : '▼'}
                        </span>

                        {isFav && (
                          <span
                            className="text-amber-400 text-[11px]"
                            title="Partido de equipo favorito"
                          >
                            ⭐
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>

                    {/* Headline */}
                    <div className="font-bold text-xs text-slate-200 group-hover:text-emerald-300 transition-colors line-clamp-1 mb-1">
                      {item.title || `${item.scoringTeam.name} anota carrera`}
                    </div>

                    {/* Score summary line */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-950/40 px-2 py-1 rounded-md border border-slate-800/80 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span>{item.awayTeam.logo}</span>
                        <span className="font-bold text-slate-200">{item.awayTeam.shortName}</span>
                        <span className="text-emerald-400 font-bold">{item.awayScore}</span>
                        <span className="text-slate-600">-</span>
                        <span className="text-emerald-400 font-bold">{item.homeScore}</span>
                        <span className="font-bold text-slate-200">{item.homeTeam.shortName}</span>
                        <span>{item.homeTeam.logo}</span>
                      </div>

                      <span className="text-[10px] text-slate-500">
                        {item.outs} {item.outs === 1 ? 'out' : 'outs'}
                      </span>
                    </div>

                    {/* Description preview */}
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Action links */}
                    <div className="mt-2 flex items-center justify-end gap-2 pt-1 border-t border-slate-800/40 text-[10px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveQuickViewToast(item);
                          setIsOpen(false);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{language === 'es' ? 'Vista Rápida' : 'Quick View'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToGame(item.gameId);
                          setIsOpen(false);
                        }}
                        className="text-slate-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Box Score</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Webhook Simulator Collapsible */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/70">
            <button
              onClick={() => setShowWebhookTester(!showWebhookTester)}
              className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-emerald-400 font-semibold transition-colors cursor-pointer py-0.5"
            >
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'es' ? 'Webhook & Disparador en Vivo' : 'Webhook & Live Trigger'}</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showWebhookTester ? 'rotate-180' : ''}`}
              />
            </button>

            {showWebhookTester && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-2 text-xs">
                <p className="text-[11px] text-slate-400 leading-normal">
                  {language === 'es'
                    ? 'Simula una carrera como si un webhook externo hubiera enviado la actualización:'
                    : 'Simulate a run update as if pushed via an external sports webhook:'}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                      {language === 'es' ? 'Equipo que anota' : 'Scoring Side'}
                    </label>
                    <select
                      value={testSide}
                      onChange={(e) => setTestSide(e.target.value as 'home' | 'away')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="home">Equipo Local (Home)</option>
                      <option value="away">Equipo Visitante (Away)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                      {language === 'es' ? 'Carreras (+)' : 'Runs (+)'}
                    </label>
                    <select
                      value={testRuns}
                      onChange={(e) => setTestRuns(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="1">+1 Carrera (Sencillo / Jonrón)</option>
                      <option value="2">+2 Carreras (Doblete)</option>
                      <option value="3">+3 Carreras (Triplete)</option>
                      <option value="4">+4 Carreras (Grand Slam)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={handleSendCustomWebhook}
                    disabled={isTriggering}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isTriggering ? 'Disparando...' : language === 'es' ? 'Enviar Webhook' : 'Send Webhook'}</span>
                  </button>
                </div>

                <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-slate-400 break-all">
                  POST /api/webhooks/score-update
                </div>
              </div>
            )}
          </div>

          {/* Quick Preferences Bar (Bottom) */}
          <div className="p-2.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2 text-xs">
            {/* Desktop notifications quick button */}
            <button
              onClick={async () => {
                if (browserPermission !== 'granted') {
                  await requestBrowserPermission();
                } else {
                  setDesktopNotificationsEnabled(!desktopNotificationsEnabled);
                }
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                desktopNotificationsEnabled && browserPermission === 'granted'
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
              title={
                browserPermission !== 'granted'
                  ? 'Activar notificaciones de escritorio en el navegador'
                  : desktopNotificationsEnabled
                  ? 'Desactivar notificaciones de escritorio'
                  : 'Activar notificaciones de escritorio'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  browserPermission === 'granted' && desktopNotificationsEnabled
                    ? 'bg-emerald-400'
                    : 'bg-slate-500'
                }`}
              />
              <span>
                {browserPermission !== 'granted'
                  ? language === 'es'
                    ? 'Permitir Avisos'
                    : 'Allow Desktop'
                  : desktopNotificationsEnabled
                  ? language === 'es'
                    ? 'Avisos: ON'
                    : 'Desktop: ON'
                  : language === 'es'
                  ? 'Avisos: OFF'
                  : 'Desktop: OFF'}
              </span>
            </button>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                soundEnabled
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
              title={soundEnabled ? 'Silenciar sonidos de estadio' : 'Activar sonido de carreras'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Sonido: ON' : 'Sonido: OFF'}</span>
            </button>

            {/* Connection mode toggle (Stream vs Polling) */}
            <button
              onClick={() => setConnectionMode(connectionMode === 'stream' ? 'polling' : 'stream')}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
              title={
                connectionMode === 'stream'
                  ? 'Cambiar a modo sondeo (Polling)'
                  : 'Cambiar a modo Stream en tiempo real (SSE)'
              }
            >
              <Radio className="w-3 h-3 text-emerald-400" />
              <span className="uppercase">{connectionMode}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
