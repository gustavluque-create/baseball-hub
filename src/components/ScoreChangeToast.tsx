import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Volume2, VolumeX, Flame, Bell, Trash2, Check, Eye, Zap } from 'lucide-react';
import { Team } from '../types/index.ts';
import { TeamLogo } from './TeamLogo.tsx';

export interface ScoreToastEvent {
  id: string;
  gameId: string;
  timestamp: number;
  homeTeam: Team;
  awayTeam: Team;
  scoringTeam: Team;
  scoringTeamSide: 'home' | 'away';
  runsScored: number;
  homeScore: number;
  awayScore: number;
  inning: number;
  isTopInning: boolean;
  outs: number;
  title?: string;
  description: string;
  playType?: 'homerun' | 'hit' | 'sacrifice' | 'walk' | 'standard';
  autoDismissMs?: number;
}

interface ScoreChangeToastItemProps {
  toast: ScoreToastEvent;
  onDismiss: (id: string) => void;
  onViewGame: (gameId: string) => void;
  onQuickView?: (toast: ScoreToastEvent) => void;
}

export const ScoreChangeToastItem: React.FC<ScoreChangeToastItemProps> = ({
  toast,
  onDismiss,
  onViewGame,
  onQuickView,
}) => {
  const duration = toast.autoDismissMs || 6500;
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const interval = 50;
    startTimeRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentRemaining = Math.max(0, remainingTimeRef.current - elapsed);
      setProgress((currentRemaining / duration) * 100);

      if (currentRemaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onDismiss(toast.id);
      }
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
      }
    };
  }, [isHovered, duration, onDismiss, toast.id]);

  const isHomeScoring = toast.scoringTeamSide === 'home';
  const isHomeWinner = toast.homeScore > toast.awayScore;
  const isAwayWinner = toast.awayScore > toast.homeScore;

  const handleCardClick = () => {
    if (onQuickView) {
      onQuickView(toast);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.92, x: 20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.88, x: 50, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      className="pointer-events-auto relative overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 border-2 border-emerald-500/80 shadow-2xl shadow-black/80 backdrop-blur-xl text-slate-100 p-4 transition-all hover:border-emerald-400 group cursor-pointer hover:shadow-emerald-500/10"
      role="alert"
      aria-live="assertive"
    >
      {/* Top Accent Gradient Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          {/* Live Pulsing Dot */}
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black border border-red-500/30 uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            EN VIVO
          </span>

          {/* Inning Indicator */}
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-mono font-semibold border border-slate-700">
            {toast.inning}ª {toast.isTopInning ? '▲ Alta' : '▼ Baja'} ({toast.outs} {toast.outs === 1 ? 'out' : 'outs'})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Subtle Quick View Hint Chip */}
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
            <Zap className="w-3 h-3 text-emerald-400" />
            Vista Rápida
          </span>

          {/* Dismiss Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Descartar notificación"
            aria-label="Cerrar notificación de carrera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Notification Headline with Baseball Ball Icon */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg shrink-0 shadow-inner">
          {toast.playType === 'homerun' ? '🔥' : '⚾'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              {toast.title || (toast.runsScored > 1 ? `¡${toast.runsScored} CARRERAS ANOTADAS!` : '¡CARRERA ANOTADA!')}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-black text-[10px] uppercase font-mono">
              +{toast.runsScored} {toast.scoringTeam.shortName}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 truncate font-semibold">
            {toast.scoringTeam.name}
          </p>
        </div>
      </div>

      {/* Mini Scoreboard Box */}
      <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/90 mb-2.5 shadow-inner">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Away Team */}
          <div
            className={`flex items-center justify-between p-1.5 rounded-lg border transition-colors ${
              !isHomeScoring
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900/50 border-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                <TeamLogo logo={toast.awayTeam.logo} name={toast.awayTeam.name} className="w-full h-full" />
              </div>
              <span className="font-bold truncate">{toast.awayTeam.shortName}</span>
            </div>
            <span
              className={`font-mono text-base font-black ${
                isAwayWinner ? 'text-emerald-400' : 'text-slate-100'
              }`}
            >
              {toast.awayScore}
            </span>
          </div>

          {/* Home Team */}
          <div
            className={`flex items-center justify-between p-1.5 rounded-lg border transition-colors ${
              isHomeScoring
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900/50 border-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                <TeamLogo logo={toast.homeTeam.logo} name={toast.homeTeam.name} className="w-full h-full" />
              </div>
              <span className="font-bold truncate">{toast.homeTeam.shortName}</span>
            </div>
            <span
              className={`font-mono text-base font-black ${
                isHomeWinner ? 'text-emerald-400' : 'text-slate-100'
              }`}
            >
              {toast.homeScore}
            </span>
          </div>
        </div>
      </div>

      {/* Play Description */}
      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 mb-3 line-clamp-2">
        {toast.description}
      </p>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/70">
        <span className="text-[10px] text-slate-400">
          {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onQuickView && (
            <button
              type="button"
              onClick={() => onQuickView(toast)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700 hover:border-emerald-500/50 shadow-sm"
              title="Abrir popup con feed condensado de jugadas"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Vista Rápida</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onViewGame(toast.gameId);
              onDismiss(toast.id);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
          >
            <span>Box Score</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Countdown Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
        <div
          className="h-full bg-emerald-500 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

interface ScoreChangeToastContainerProps {
  toasts: ScoreToastEvent[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onViewGame: (gameId: string) => void;
  onQuickView?: (toast: ScoreToastEvent) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const ScoreChangeToastContainer: React.FC<ScoreChangeToastContainerProps> = ({
  toasts,
  onDismiss,
  onClearAll,
  onViewGame,
  onQuickView,
  soundEnabled,
  onToggleSound,
}) => {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notificaciones de carreras en vivo"
      className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-3 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none"
    >
      {/* Container Mini-Toolbar if multiple toasts */}
      {toasts.length > 1 && (
        <div className="pointer-events-auto flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 backdrop-blur-md shadow-lg mb-1">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200">
              {toasts.length} cambios en marcador
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSound}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer font-medium"
            >
              <Trash2 className="w-3 h-3" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>
      )}

      {/* List of active toasts */}
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ScoreChangeToastItem
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            onViewGame={onViewGame}
            onQuickView={onQuickView}
          />
        ))}
      </AnimatePresence>
    </aside>
  );
};

