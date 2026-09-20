import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Moon,
  Sun,
  Laptop,
  Check,
  Globe,
  Sliders,
  Database,
  Layers,
  Sparkles,
  ArrowRight,
  Shield,
  RotateCcw,
  Bell,
  Volume2,
  VolumeX,
  Radio,
  Star,
  Send,
} from 'lucide-react';
import { useApp, ThemeMode, TableDensity } from '../context/AppContext.tsx';
import { useScoreNotifications } from '../context/ScoreNotificationContext.tsx';

export const SettingsMenuModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    theme,
    themeMode,
    setThemeMode,
    toggleTheme,
    language,
    setLanguage,
    density,
    setDensity,
    activeCompetitionId,
    setActiveCompetitionId,
    activeSeasonId,
    setActiveSeasonId,
    setActiveTab,
    t,
  } = useApp();

  const {
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
    triggerTestNotification,
  } = useScoreNotifications();

  const [testAlertTriggered, setTestAlertTriggered] = useState(false);

  const handleTriggerTest = async () => {
    setTestAlertTriggered(true);
    try {
      await triggerTestNotification();
    } finally {
      setTimeout(() => setTestAlertTriggered(false), 800);
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, setIsSettingsOpen]);

  if (!isSettingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={() => setIsSettingsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-menu-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="settings-menu-title"
                className="text-lg font-bold text-slate-100 flex items-center gap-2"
              >
                {t('settings.title') || 'Configuración de la Plataforma'}
              </h2>
              <p className="text-xs text-slate-400">
                {t('settings.themeDescription') || 'Personaliza el tema visual y las preferencias de la aplicación.'}
              </p>
            </div>
          </div>
          <button
            id="close-settings-btn"
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={t('settings.close') || 'Cerrar'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* SECTION: Dark / Light Mode Swap */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {t('settings.appearance') || 'Apariencia y Tema Visual'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Alterna instantáneamente entre paleta nocturna y diurna en toda la interfaz con Tailwind CSS.
                </p>
              </div>

              {/* Quick Toggle Switch */}
              <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-full border border-slate-800">
                <button
                  id="theme-quick-light"
                  onClick={() => setThemeMode('light')}
                  className={`p-1.5 rounded-full transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-amber-500/20 text-amber-500 shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Activar Modo Claro"
                >
                  <Sun className="w-4 h-4" />
                </button>
                <button
                  id="theme-quick-dark"
                  onClick={() => setThemeMode('dark')}
                  className={`p-1.5 rounded-full transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Activar Modo Oscuro"
                >
                  <Moon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visual 3-Option Theme Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Dark Mode Card */}
              <button
                id="theme-option-dark"
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`group relative p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  themeMode === 'dark'
                    ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                {/* Mini Preview Swatch */}
                <div className="w-full h-14 rounded-lg bg-slate-950 border border-slate-800 p-2 flex flex-col justify-between mb-3 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-2 rounded bg-emerald-500/80" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-3/4 h-1.5 rounded bg-slate-800" />
                    <div className="w-1/2 h-1.5 rounded bg-slate-800/60" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5 text-emerald-400" />
                      {t('settings.dark') || 'Modo Oscuro'}
                    </span>
                    {themeMode === 'dark' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {t('settings.darkDesc') || 'Fondo carbón con acentos esmeralda para baja luz.'}
                  </p>
                </div>
              </button>

              {/* Light Mode Card */}
              <button
                id="theme-option-light"
                type="button"
                onClick={() => setThemeMode('light')}
                className={`group relative p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  themeMode === 'light'
                    ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                {/* Mini Preview Swatch */}
                <div className="w-full h-14 rounded-lg bg-slate-100 border border-slate-300 p-2 flex flex-col justify-between mb-3 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-2 rounded bg-emerald-600" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-3/4 h-1.5 rounded bg-slate-300" />
                    <div className="w-1/2 h-1.5 rounded bg-slate-300/80" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      {t('settings.light') || 'Modo Claro'}
                    </span>
                    {themeMode === 'light' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {t('settings.lightDesc') || 'Fondo níveo de alto contraste para lectura diurna.'}
                  </p>
                </div>
              </button>

              {/* System Theme Card */}
              <button
                id="theme-option-system"
                type="button"
                onClick={() => setThemeMode('system')}
                className={`group relative p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  themeMode === 'system'
                    ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                {/* Mini Preview Swatch */}
                <div className="w-full h-14 rounded-lg bg-gradient-to-r from-slate-950 via-slate-900 to-slate-200 border border-slate-700 p-2 flex flex-col justify-between mb-3 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-2 rounded bg-emerald-500/80" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-3/4 h-1.5 rounded bg-slate-700" />
                    <div className="w-1/2 h-1.5 rounded bg-slate-600" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-sky-400" />
                      {t('settings.system') || 'Sistema'}
                    </span>
                    {themeMode === 'system' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {t('settings.systemDesc') || 'Sincroniza con el modo de tu sistema operativo.'}
                  </p>
                </div>
              </button>
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs">
              <span className="text-slate-400">
                Estado visual activo:
              </span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {theme === 'dark' ? 'Modo Oscuro (Dark)' : 'Modo Claro (Light)'}
                {themeMode === 'system' && ' • Vía Sistema'}
              </span>
            </div>
          </section>

          {/* SECTION: Language Selector */}
          <section className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              {t('settings.language') || 'Idioma de la Interfaz'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="language-btn-es"
                onClick={() => setLanguage('es')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  language === 'es'
                    ? 'bg-slate-800/90 border-emerald-500 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-200">Español</div>
                  <div className="text-[11px] text-slate-400">Latinoamérica &amp; Caribe</div>
                </div>
                {language === 'es' && <Check className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                id="language-btn-en"
                onClick={() => setLanguage('en')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  language === 'en'
                    ? 'bg-slate-800/90 border-emerald-500 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-200">English</div>
                  <div className="text-[11px] text-slate-400">International Baseball</div>
                </div>
                {language === 'en' && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </section>

          {/* SECTION: Density Preference */}
          <section className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              {t('settings.density') || 'Densidad de Tablas y Datos'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="density-comfortable-btn"
                onClick={() => setDensity('comfortable')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  density === 'comfortable'
                    ? 'bg-slate-800/90 border-emerald-500 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-200">
                    {t('settings.comfortable') || 'Cómoda'}
                  </div>
                  <div className="text-[11px] text-slate-400">Espaciado amplio para lectura</div>
                </div>
                {density === 'comfortable' && <Check className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                id="density-compact-btn"
                onClick={() => setDensity('compact')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  density === 'compact'
                    ? 'bg-slate-800/90 border-emerald-500 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-200">
                    {t('settings.compact') || 'Compacta'}
                  </div>
                  <div className="text-[11px] text-slate-400">Máxima densidad sabermétrica</div>
                </div>
                {density === 'compact' && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </section>

          {/* SECTION: Real-Time Score Notifications & Webhooks */}
          <section className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
                <span>Notificaciones en Tiempo Real (Webhooks &amp; Polling)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura cómo quieres recibir las alertas de cambios de marcador, jonrones y jugadas clave durante los partidos.
              </p>
            </div>

            {/* Notification Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Browser Desktop Notifications */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Notificaciones de Escritorio</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        browserPermission === 'granted'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : browserPermission === 'denied'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {browserPermission === 'granted'
                        ? 'Permitido'
                        : browserPermission === 'denied'
                        ? 'Bloqueado'
                        : 'No solicitado'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Recibe avisos del sistema operativo aunque tengas la pestaña en segundo plano.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {browserPermission !== 'granted' ? (
                    <button
                      onClick={requestBrowserPermission}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                    >
                      Solicitar Permiso
                    </button>
                  ) : (
                    <button
                      onClick={() => setDesktopNotificationsEnabled(!desktopNotificationsEnabled)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        desktopNotificationsEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {desktopNotificationsEnabled ? 'Activado (ON)' : 'Desactivado (OFF)'}
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Stadium Audio Chimes */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      {soundEnabled ? (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>Chimes de Estadio (Audio)</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        soundEnabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {soundEnabled ? 'Activo' : 'Mudo'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Emite tonos armónicos sintetizados de béisbol cuando se anota una carrera.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      soundEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {soundEnabled ? 'Sonido Activado' : 'Silenciado'}
                  </button>
                </div>
              </div>

              {/* Option 3: Filter Only Favorite Teams */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                      <span>Solo Mis Equipos Favoritos</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        notifyOnlyFavorites
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {notifyOnlyFavorites ? 'Solo Favoritos' : 'Todos'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Silencia avisos sonoros y toasts de equipos que no tengas marcados con estrella.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setNotifyOnlyFavorites(!notifyOnlyFavorites)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      notifyOnlyFavorites
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {notifyOnlyFavorites ? 'Filtro Activado' : 'Mostrar Todos'}
                  </button>
                </div>
              </div>

              {/* Option 4: Real-time Transport Mode (SSE Stream vs Polling) */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Transporte en Tiempo Real</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
                      {connectionMode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {connectionMode === 'stream'
                      ? 'Stream push instantáneo usando Server-Sent Events (SSE).'
                      : `Sondeo periódico adaptativo cada ${pollingIntervalMs / 1000}s.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setConnectionMode('stream')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      connectionMode === 'stream'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Stream (SSE)
                  </button>
                  <button
                    onClick={() => setConnectionMode('polling')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      connectionMode === 'polling'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Polling
                  </button>
                </div>
              </div>
            </div>

            {/* Test Notification Trigger Bar */}
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-slate-200 block">Probar canal de alertas:</span>
                <span className="text-[11px] text-slate-400">
                  Verifica que el toast flotante, el chime de audio y el aviso de escritorio funcionen.
                </span>
              </div>
              <button
                onClick={handleTriggerTest}
                disabled={testAlertTriggered}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm disabled:opacity-50 active:scale-95"
              >
                {testAlertTriggered ? 'Emitiendo...' : 'Probar Alerta'}
              </button>
            </div>
          </section>

          {/* SECTION: Quick Admin / ETL Tool link */}
          <section className="pt-2 border-t border-slate-800">
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {t('settings.adminLink') || 'Ingesta & Auditoría de Datos (ETL)'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Importa estadísticas desde CSV o JSON con validación
                  </div>
                </div>
              </div>
              <button
                id="settings-to-admin-btn"
                onClick={() => {
                  setIsSettingsOpen(false);
                  setActiveTab('admin');
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
              >
                <span>Abrir</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preferencias guardadas automáticamente</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            {t('settings.close') || 'Listo'}
          </button>
        </div>
      </div>
    </div>
  );
};
