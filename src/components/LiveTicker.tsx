import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Play,
  Pause,
  Zap,
  Volume2,
  VolumeX,
  Radio,
  Star,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Game, GameStatus } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { useScoreNotifications } from '../context/ScoreNotificationContext.tsx';
import { playBaseballScoreChime } from '../utils/scoreNotification.ts';
import { LiveTickerItemSkeleton } from './LoadingSkeleton.tsx';

export interface LiveTickerProps {
  /** Filter games by competition ID (defaults to activeCompetitionId from context) */
  competitionId?: string;
  /** Filter games by season ID */
  seasonId?: string;
  /** Polling interval in ms for real-time updates (default: 10000 ms) */
  refreshIntervalMs?: number;
  /** Whether auto-refresh is active by default (default: true) */
  autoRefresh?: boolean;
  /** Custom click handler when a game ticker item is clicked. Defaults to opening game comparison modal */
  onGameClick?: (game: Game) => void;
  /** Additional CSS classes for wrapper container */
  className?: string;
  /** Whether to show header / controls (refresh button, sound toggle, play simulation, filters) */
  showControls?: boolean;
  /** Whether to allow manual/quick run simulation to test real-time updates */
  allowSimulate?: boolean;
  /** Initial filter tab */
  initialFilter?: 'all' | 'live' | 'final' | 'scheduled' | 'favorites';
  /** Compact style mode */
  compact?: boolean;
}

interface ScoreUpdateMeta {
  gameId: string;
  scoringSide: 'home' | 'away';
  runs: number;
  expiresAt: number;
  timestamp: number;
}

/**
 * Visual Diamond Base Representation for Live Inning Status
 */
const DiamondBases: React.FC<{
  bases?: { first: boolean; second: boolean; third: boolean };
}> = ({ bases = { first: false, second: false, third: false } }) => {
  return (
    <div className="relative w-4 h-4 flex items-center justify-center shrink-0" title="Bases ocupadas">
      {/* 2nd base (top) */}
      <div
        className={`absolute top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 transition-colors ${
          bases.second ? 'bg-amber-400 border border-amber-300 shadow-xs' : 'bg-slate-700/60 border border-slate-600/60'
        }`}
      />
      {/* 3rd base (left) */}
      <div
        className={`absolute top-1/2 left-0.5 -translate-y-1/2 w-1.5 h-1.5 rotate-45 transition-colors ${
          bases.third ? 'bg-amber-400 border border-amber-300 shadow-xs' : 'bg-slate-700/60 border border-slate-600/60'
        }`}
      />
      {/* 1st base (right) */}
      <div
        className={`absolute top-1/2 right-0.5 -translate-y-1/2 w-1.5 h-1.5 rotate-45 transition-colors ${
          bases.first ? 'bg-amber-400 border border-amber-300 shadow-xs' : 'bg-slate-700/60 border border-slate-600/60'
        }`}
      />
    </div>
  );
};

/**
 * Outs Indicators (3 dots)
 */
const OutsIndicator: React.FC<{ outs?: number }> = ({ outs = 0 }) => {
  return (
    <div className="flex items-center gap-0.5 shrink-0" title={`${outs} out(s)`}>
      {[0, 1, 2].map((idx) => (
        <span
          key={idx}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            idx < outs ? 'bg-amber-400 shadow-xs' : 'bg-slate-700/70'
          }`}
        />
      ))}
    </div>
  );
};

export const LiveTicker: React.FC<LiveTickerProps> = ({
  competitionId,
  seasonId,
  refreshIntervalMs = 10000,
  autoRefresh = true,
  onGameClick,
  className = '',
  showControls = true,
  allowSimulate = true,
  initialFilter = 'all',
  compact = false,
}) => {
  const {
    activeCompetitionId,
    activeSeasonId,
    openGameComparison,
    navigateToGame,
    isFavoriteTeam,
    language,
    theme,
  } = useApp();

  const compId = competitionId || activeCompetitionId;
  const sId = seasonId || activeSeasonId;

  // Real-time notification context
  const {
    soundEnabled,
    setSoundEnabled,
    lastEventTimestamp,
    connectionMode,
    connectionStatus,
  } = useScoreNotifications();

  // Games state
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState<boolean>(autoRefresh);
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'final' | 'scheduled' | 'favorites'>(initialFilter);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Track recent score updates for flash animations
  const [scoreUpdates, setScoreUpdates] = useState<Record<string, ScoreUpdateMeta>>({});
  const prevGamesMapRef = useRef<Map<string, { homeScore: number; awayScore: number }>>(new Map());

  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  // Check scroll position to toggle scroll arrow visibility/active state
  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scrollBy = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Fetch games with real-time change detection
  const fetchGames = useCallback(
    async (isBackground: boolean = false) => {
      if (!isBackground) {
        setIsRefreshing(true);
      }
      try {
        const fetchedGames = await ApiClient.getGames({
          competition: compId,
          season: sId,
        });

        // Detect score changes if previous state existed
        if (prevGamesMapRef.current.size > 0) {
          const newUpdates: Record<string, ScoreUpdateMeta> = {};
          let hasAnyNewScore = false;

          fetchedGames.forEach((newGame) => {
            const prev = prevGamesMapRef.current.get(newGame.id);
            if (prev) {
              // Home score increased
              if (newGame.homeScore > prev.homeScore) {
                const diff = newGame.homeScore - prev.homeScore;
                newUpdates[newGame.id] = {
                  gameId: newGame.id,
                  scoringSide: 'home',
                  runs: diff,
                  expiresAt: Date.now() + 5000,
                  timestamp: Date.now(),
                };
                hasAnyNewScore = true;
              }
              // Away score increased
              else if (newGame.awayScore > prev.awayScore) {
                const diff = newGame.awayScore - prev.awayScore;
                newUpdates[newGame.id] = {
                  gameId: newGame.id,
                  scoringSide: 'away',
                  runs: diff,
                  expiresAt: Date.now() + 5000,
                  timestamp: Date.now(),
                };
                hasAnyNewScore = true;
              }
            }
          });

          if (hasAnyNewScore) {
            setScoreUpdates((prev) => ({ ...prev, ...newUpdates }));
            if (soundEnabled) {
              playBaseballScoreChime(true);
            }
          }
        }

        // Update tracking map
        const newMap = new Map<string, { homeScore: number; awayScore: number }>();
        fetchedGames.forEach((g) => {
          newMap.set(g.id, { homeScore: g.homeScore, awayScore: g.awayScore });
        });
        prevGamesMapRef.current = newMap;

        setGames(fetchedGames);
        setLastUpdated(new Date());
      } catch (err) {
        console.warn('LiveTicker: error fetching games', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [compId, sId, soundEnabled]
  );

  // Initial load and competition change
  useEffect(() => {
    fetchGames(false);
  }, [fetchGames]);

  // Instantly re-fetch games whenever a real-time score event arrives
  useEffect(() => {
    if (lastEventTimestamp) {
      fetchGames(true);
    }
  }, [lastEventTimestamp, fetchGames]);

  // Periodic polling for real-time scores
  useEffect(() => {
    if (!isAutoRefreshActive) return;

    const interval = setInterval(() => {
      fetchGames(true);
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [isAutoRefreshActive, refreshIntervalMs, fetchGames]);

  // Clean up expired flash highlights every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setScoreUpdates((prev) => {
        let changed = false;
        const next: Record<string, ScoreUpdateMeta> = {};
        Object.entries(prev).forEach(([id, meta]) => {
          if (meta.expiresAt > now) {
            next[id] = meta;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Monitor scroll overflow
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    updateScrollIndicators();
    el.addEventListener('scroll', updateScrollIndicators);
    window.addEventListener('resize', updateScrollIndicators);

    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [games, loading, updateScrollIndicators]);

  // Handler for quick live simulation to demonstrate real-time ticker reaction
  const handleSimulateRun = async (forcedGameId?: string) => {
    if (isSimulating) return;
    setIsSimulating(true);

    try {
      const liveGames = games.filter((g) => g.status === 'LIVE');
      const targetGame = forcedGameId
        ? games.find((g) => g.id === forcedGameId) || liveGames[0]
        : liveGames[Math.floor(Math.random() * liveGames.length)] || games[0];

      if (!targetGame) {
        setIsSimulating(false);
        return;
      }

      // Call API simulate-run
      const side: 'home' | 'away' = Math.random() > 0.5 ? 'home' : 'away';
      const result = await ApiClient.simulateGameRun({
        gameId: targetGame.id,
        side,
      });

      // Update state immediately
      setGames((prev) =>
        prev.map((g) => (g.id === result.game.id ? result.game : g))
      );

      // Flash in ticker
      setScoreUpdates((prev) => ({
        ...prev,
        [result.game.id]: {
          gameId: result.game.id,
          scoringSide: result.scoringSide,
          runs: result.runsScored,
          expiresAt: Date.now() + 5000,
          timestamp: Date.now(),
        },
      }));

      // Update tracking map
      prevGamesMapRef.current.set(result.game.id, {
        homeScore: result.game.homeScore,
        awayScore: result.game.awayScore,
      });

      setLastUpdated(new Date());

      if (soundEnabled) {
        playBaseballScoreChime(true);
      }
    } catch (e) {
      console.error('Error simulating score run in ticker:', e);
      // Client-side fallback if server simulation failed
      const liveCandidates = games.filter((g) => g.status === 'LIVE');
      if (liveCandidates.length > 0) {
        const candidate = liveCandidates[0];
        const side = Math.random() > 0.5 ? 'home' : 'away';
        const newHome = side === 'home' ? candidate.homeScore + 1 : candidate.homeScore;
        const newAway = side === 'away' ? candidate.awayScore + 1 : candidate.awayScore;

        const updated: Game = {
          ...candidate,
          homeScore: newHome,
          awayScore: newAway,
          homeHits: side === 'home' ? candidate.homeHits + 1 : candidate.homeHits,
          awayHits: side === 'away' ? candidate.awayHits + 1 : candidate.awayHits,
        };

        setGames((prev) => prev.map((g) => (g.id === candidate.id ? updated : g)));
        setScoreUpdates((prev) => ({
          ...prev,
          [candidate.id]: {
            gameId: candidate.id,
            scoringSide: side,
            runs: 1,
            expiresAt: Date.now() + 5000,
            timestamp: Date.now(),
          },
        }));
        if (soundEnabled) playBaseballScoreChime(true);
      }
    } finally {
      setTimeout(() => setIsSimulating(false), 400);
    }
  };

  // Counts for filters
  const liveCount = useMemo(() => games.filter((g) => g.status === 'LIVE').length, [games]);
  const finalCount = useMemo(() => games.filter((g) => g.status === 'FINAL').length, [games]);
  const scheduledCount = useMemo(() => games.filter((g) => g.status === 'SCHEDULED').length, [games]);
  const favoriteCount = useMemo(
    () =>
      games.filter((g) => isFavoriteTeam(g.homeTeam.id) || isFavoriteTeam(g.awayTeam.id)).length,
    [games, isFavoriteTeam]
  );

  // Filtered games
  const filteredGames = useMemo(() => {
    // Sort games so LIVE games appear first, then upcoming SCHEDULED, then FINAL
    const sorted = [...games].sort((a, b) => {
      const statusWeight: Record<GameStatus, number> = {
        LIVE: 0,
        SCHEDULED: 1,
        POSTPONED: 2,
        SUSPENDED: 3,
        FINAL: 4,
        CANCELLED: 5,
      };
      const wA = statusWeight[a.status] ?? 3;
      const wB = statusWeight[b.status] ?? 3;
      return wA - wB;
    });

    switch (activeFilter) {
      case 'live':
        return sorted.filter((g) => g.status === 'LIVE');
      case 'final':
        return sorted.filter((g) => g.status === 'FINAL');
      case 'scheduled':
        return sorted.filter((g) => g.status === 'SCHEDULED');
      case 'favorites':
        return sorted.filter((g) => isFavoriteTeam(g.homeTeam.id) || isFavoriteTeam(g.awayTeam.id));
      case 'all':
      default:
        return sorted;
    }
  }, [games, activeFilter, isFavoriteTeam]);

  // Handle card click
  const handleCardClick = (game: Game) => {
    if (onGameClick) {
      onGameClick(game);
    } else {
      openGameComparison(game.id);
    }
  };

  // Format last updated time
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return null;
    return lastUpdated.toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [lastUpdated, language]);

  return (
    <div
      id="live-ticker-container"
      className={`w-full border-b border-slate-800/80 bg-slate-950/95 dark:bg-slate-950/95 transition-colors select-none ${className}`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
        {/* Top Control Bar (Responsive) */}
        {showControls && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-1.5 border-b border-slate-900 text-xs">
            {/* Left: Ticker Title & Status Indicator */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {liveCount > 0 ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  )}
                </span>
                <span className="font-mono text-[11px] font-black tracking-wider uppercase text-white flex items-center gap-1">
                  <span>{language === 'es' ? 'PIZARRA EN VIVO' : 'LIVE TICKER'}</span>
                  {liveCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 font-bold text-[10px] border border-red-500/30 animate-pulse">
                      {liveCount} {language === 'es' ? 'EN JUEGO' : 'LIVE'}
                    </span>
                  )}
                </span>
              </div>

              {/* Filter Tabs Pills */}
              <div className="hidden md:flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    activeFilter === 'all'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {language === 'es' ? 'Todos' : 'All'} ({games.length})
                </button>
                <button
                  onClick={() => setActiveFilter('live')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                    activeFilter === 'live'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {language === 'es' ? 'En Vivo' : 'Live'} ({liveCount})
                </button>
                <button
                  onClick={() => setActiveFilter('scheduled')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    activeFilter === 'scheduled'
                      ? 'bg-slate-800 text-slate-200 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {language === 'es' ? 'Programados' : 'Upcoming'} ({scheduledCount})
                </button>
                <button
                  onClick={() => setActiveFilter('final')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    activeFilter === 'final'
                      ? 'bg-slate-800 text-slate-200 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {language === 'es' ? 'Finales' : 'Final'} ({finalCount})
                </button>
                {favoriteCount > 0 && (
                  <button
                    onClick={() => setActiveFilter('favorites')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                      activeFilter === 'favorites'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    {language === 'es' ? 'Favoritos' : 'Favorites'} ({favoriteCount})
                  </button>
                )}
              </div>
            </div>

            {/* Right: Quick actions (Simulation, Sound, Refresh, Auto-polling status) */}
            <div className="flex items-center gap-2">
              {/* Simulation Trigger Button */}
              {allowSimulate && (
                <button
                  onClick={() => handleSimulateRun()}
                  disabled={isSimulating || games.length === 0}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 transition-colors cursor-pointer text-[11px] font-semibold"
                  title="Simular una carrera/jonrón en vivo para comprobar la animación y sonido del ticker en tiempo real"
                >
                  <Zap className={`w-3 h-3 text-amber-400 ${isSimulating ? 'animate-bounce' : ''}`} />
                  <span>{isSimulating ? 'Anotando...' : '⚡ Simular Carrera'}</span>
                </button>
              )}

              {/* Audio Chime Toggle */}
              <button
                onClick={toggleSound}
                className={`p-1 rounded transition-colors cursor-pointer border ${
                  soundEnabled
                    ? 'bg-slate-900 text-emerald-400 border-slate-800 hover:bg-slate-850'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
                }`}
                title={
                  soundEnabled
                    ? 'Sonido de carreras activado (campana de estadio)'
                    : 'Sonido de carreras silenciado'
                }
                aria-label="Alternar sonido de carreras en vivo"
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Auto-Refresh Toggle */}
              <button
                onClick={() => setIsAutoRefreshActive(!isAutoRefreshActive)}
                className={`p-1 rounded transition-colors cursor-pointer border ${
                  isAutoRefreshActive
                    ? 'bg-slate-900 text-emerald-400 border-slate-800 hover:bg-slate-850'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
                }`}
                title={
                  isAutoRefreshActive
                    ? `Auto-actualización cada ${Math.round(refreshIntervalMs / 1000)}s activada`
                    : 'Auto-actualización pausada'
                }
                aria-label="Pausar o reanudar auto-actualización"
              >
                {isAutoRefreshActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              {/* Manual Refresh Button */}
              <button
                onClick={() => fetchGames(false)}
                disabled={isRefreshing}
                className="p-1 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                title="Actualizar resultados ahora"
                aria-label="Actualizar marcador"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>

              {/* Last update timestamp */}
              {formattedLastUpdated && (
                <span className="hidden xl:inline text-[10px] text-slate-500 font-mono">
                  {formattedLastUpdated}
                </span>
              )}

              {/* Left / Right Scroll navigation chevrons */}
              <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
                <button
                  onClick={() => scrollBy(-280)}
                  disabled={!canScrollLeft}
                  className={`p-1 rounded bg-slate-900 border border-slate-800 transition-colors ${
                    canScrollLeft
                      ? 'text-slate-200 hover:bg-slate-800 cursor-pointer'
                      : 'text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  aria-label="Desplazar ticker a la izquierda"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => scrollBy(280)}
                  disabled={!canScrollRight}
                  className={`p-1 rounded bg-slate-900 border border-slate-800 transition-colors ${
                    canScrollRight
                      ? 'text-slate-200 hover:bg-slate-800 cursor-pointer'
                      : 'text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  aria-label="Desplazar ticker a la derecha"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Horizontal Ticker Strip */}
        <div className="relative group">
          {/* Edge shadow gradients to indicate scrollability */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
          )}

          <div
            ref={scrollContainerRef}
            className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent scroll-smooth items-stretch"
          >
            {loading ? (
              // Skeletons while loading
              Array.from({ length: 6 }).map((_, idx) => (
                <LiveTickerItemSkeleton key={idx} compact={compact} />
              ))
            ) : filteredGames.length === 0 ? (
              // No games matching filter
              <div className="w-full py-3 px-4 rounded-xl bg-slate-900/50 border border-slate-800/80 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500" />
                <span>
                  {activeFilter === 'live'
                    ? (language === 'es' ? 'No hay partidos en curso en este momento.' : 'No games currently live.')
                    : activeFilter === 'favorites'
                    ? (language === 'es' ? 'No hay partidos programados para tus equipos favoritos.' : 'No games for your favorite teams.')
                    : (language === 'es' ? 'No hay partidos para el filtro seleccionado.' : 'No games match selected filter.')}
                </span>
                {activeFilter !== 'all' && (
                  <button
                    onClick={() => setActiveFilter('all')}
                    className="text-emerald-400 hover:underline font-semibold ml-1 cursor-pointer"
                  >
                    {language === 'es' ? 'Ver todos los partidos' : 'Show all games'}
                  </button>
                )}
              </div>
            ) : (
              // Real-time Games Items
              filteredGames.map((game) => {
                const statusLower = (game.status || '').toLowerCase();
                const isLive = statusLower === 'live';
                const isFinal = statusLower === 'final';
                const isScheduled = statusLower === 'scheduled';
                const updateMeta = scoreUpdates[game.id];
                const hasRecentScoreChange = Boolean(updateMeta && updateMeta.expiresAt > Date.now());

                // Determine base runners for live games
                const basesState = {
                  first: isLive ? (game.homeHits + game.awayHits) % 2 === 1 : false,
                  second: isLive ? (game.homeHits + game.awayHits) % 3 === 0 : false,
                  third: isLive ? (game.homeScore + game.awayScore) % 2 === 1 : false,
                };

                return (
                  <div
                    key={game.id}
                    onClick={() => handleCardClick(game)}
                    className={`relative min-w-[220px] sm:min-w-[245px] p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 flex flex-col justify-between ${
                      hasRecentScoreChange
                        ? 'bg-slate-900 border-amber-400/90 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/60'
                        : isLive
                        ? 'bg-slate-900/90 hover:bg-slate-850 border-red-500/30 hover:border-red-500/50 shadow-sm'
                        : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800 hover:border-slate-700 shadow-xs'
                    }`}
                  >
                    {/* Header: Status & Situation */}
                    <div className="flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-slate-800/80 text-[11px]">
                      {isLive ? (
                        <div className="flex items-center gap-1.5 text-red-400 font-bold">
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          <span>
                            {game.currentInning || 8}ª {game.isTopInning ? '▲ Alta' : '▼ Baja'}
                          </span>
                        </div>
                      ) : isFinal ? (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold text-[10px] border border-slate-700/60">
                          {language === 'es' ? 'FINAL' : 'FINAL'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-[10px] flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5 text-slate-500" />
                          <span>{game.time} hrs</span>
                        </span>
                      )}

                      {/* Diamond & Outs (if live) or Stadium (if scheduled/final) */}
                      {isLive ? (
                        <div className="flex items-center gap-1.5">
                          <DiamondBases bases={basesState} />
                          <OutsIndicator outs={game.outs ?? 1} />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 truncate max-w-[100px]" title={game.stadium}>
                          {game.stadium}
                        </span>
                      )}
                    </div>

                    {/* Teams & Scores */}
                    <div className="space-y-1.5 py-0.5">
                      {/* Away Team */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-sm shrink-0">{game.awayTeam.logo}</span>
                          <span className="font-bold text-xs text-slate-100 truncate inline-flex items-center gap-1">
                            <span>{game.awayTeam.shortName}</span>
                            {isFavoriteTeam(game.awayTeam.id) && (
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasRecentScoreChange && updateMeta?.scoringSide === 'away' && (
                            <span className="px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[9px] animate-bounce">
                              +{updateMeta.runs}
                            </span>
                          )}
                          <span
                            className={`font-mono text-sm font-black transition-colors ${
                              isScheduled
                                ? 'text-slate-600'
                                : hasRecentScoreChange && updateMeta?.scoringSide === 'away'
                                ? 'text-amber-300 scale-110'
                                : game.awayScore > game.homeScore
                                ? 'text-emerald-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {isScheduled ? '-' : game.awayScore}
                          </span>
                        </div>
                      </div>

                      {/* Home Team */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-sm shrink-0">{game.homeTeam.logo}</span>
                          <span className="font-bold text-xs text-slate-100 truncate inline-flex items-center gap-1">
                            <span>{game.homeTeam.shortName}</span>
                            {isFavoriteTeam(game.homeTeam.id) && (
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasRecentScoreChange && updateMeta?.scoringSide === 'home' && (
                            <span className="px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[9px] animate-bounce">
                              +{updateMeta.runs}
                            </span>
                          )}
                          <span
                            className={`font-mono text-sm font-black transition-colors ${
                              isScheduled
                                ? 'text-slate-600'
                                : hasRecentScoreChange && updateMeta?.scoringSide === 'home'
                                ? 'text-amber-300 scale-110'
                                : game.homeScore > game.awayScore
                                ? 'text-emerald-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {isScheduled ? '-' : game.homeScore}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Micro Info / Flash Callout */}
                    <div className="pt-1.5 mt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                      {hasRecentScoreChange ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1 animate-pulse truncate">
                          <Zap className="w-2.5 h-2.5" />
                          <span>¡ANOTACIÓN EN VIVO!</span>
                        </span>
                      ) : !isScheduled ? (
                        <span className="truncate">
                          H: {game.awayHits}-{game.homeHits} • E: {game.awayErrors}-{game.homeErrors}
                        </span>
                      ) : (
                        <span>{game.date}</span>
                      )}

                      <span className="text-emerald-400 font-semibold group-hover:underline text-[10px] shrink-0 ml-1">
                        Box &gt;
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
