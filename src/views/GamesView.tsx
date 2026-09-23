import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar,
  Zap,
  Volume2,
  VolumeX,
  History,
  Radio,
  RefreshCw,
  Play,
  Pause,
  Bell,
  X,
  ExternalLink,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { GameCard } from '../components/GameCard.tsx';
import { LiveGamesDashboard } from '../components/LiveGamesDashboard.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';
import {
  GameCardSkeleton,
  GamesGridSkeleton,
  ChartCardSkeleton,
  SimulateLoadButton,
} from '../components/LoadingSkeleton.tsx';
import { Game } from '../types/index.ts';
import {
  ScoreChangeToastContainer,
  ScoreToastEvent,
} from '../components/ScoreChangeToast.tsx';
import { PlayByPlayQuickViewModal } from '../components/PlayByPlayQuickViewModal.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import {
  playBaseballScoreChime,
  getRandomPlayDescription,
} from '../utils/scoreNotification.ts';

export const GamesView: React.FC = () => {
  const { activeCompetitionId, navigateToGame } = useApp();
  const { isAdminAuthenticated } = useAdminAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'FINAL' | 'SCHEDULED'>('ALL');
  const [loading, setLoading] = useState(true);

  // Toast Notifications State
  const [toasts, setToasts] = useState<ScoreToastEvent[]>([]);
  const [scoringHistory, setScoringHistory] = useState<ScoreToastEvent[]>([]);
  const [selectedQuickViewToast, setSelectedQuickViewToast] = useState<ScoreToastEvent | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [autoSimulate, setAutoSimulate] = useState(false);

  // Sound preference state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_toast_sound');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('baseball_hub_toast_sound', String(next));
      }
      if (next) {
        playBaseballScoreChime(true);
      }
      return next;
    });
  };

  // Track previous scores to detect changes
  const prevGamesMapRef = useRef<Map<string, { homeScore: number; awayScore: number }>>(new Map());

  // Function to add a toast notification
  const addScoreToast = useCallback(
    (event: Omit<ScoreToastEvent, 'id' | 'timestamp'>) => {
      const newToast: ScoreToastEvent = {
        ...event,
        id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep up to 4 toasts
      setScoringHistory((prev) => [newToast, ...prev]);

      if (soundEnabled) {
        playBaseballScoreChime(true);
      }
    },
    [soundEnabled]
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  // Fetch games and detect score differences
  const fetchGames = useCallback(
    async (isBackgroundUpdate = false) => {
      if (!isBackgroundUpdate) setLoading(true);
      try {
        const res = await ApiClient.getGames({
          competition: activeCompetitionId,
          status: statusFilter,
        });

        // Detect score changes in live games
        if (prevGamesMapRef.current.size > 0) {
          res.forEach((newGame) => {
            if (newGame.status === 'LIVE') {
              const prev = prevGamesMapRef.current.get(newGame.id);
              if (prev) {
                // Home score increased
                if (newGame.homeScore > prev.homeScore) {
                  const runs = newGame.homeScore - prev.homeScore;
                  const recentPlay = newGame.plays?.find((p) => p.isScoringPlay);
                  const generated = getRandomPlayDescription(newGame.homeTeam.shortName, runs);

                  addScoreToast({
                    gameId: newGame.id,
                    homeTeam: newGame.homeTeam,
                    awayTeam: newGame.awayTeam,
                    scoringTeam: newGame.homeTeam,
                    scoringTeamSide: 'home',
                    runsScored: runs,
                    homeScore: newGame.homeScore,
                    awayScore: newGame.awayScore,
                    inning: newGame.currentInning || 8,
                    isTopInning: Boolean(newGame.isTopInning),
                    outs: newGame.outs ?? 1,
                    title: runs > 1 ? `¡${runs} CARRERAS ANOTADAS!` : '¡CARRERA ANOTADA!',
                    description: recentPlay?.description || generated.description,
                    playType: recentPlay?.description.toLowerCase().includes('jonrón') ? 'homerun' : generated.playType,
                    autoDismissMs: 6500,
                  });
                }

                // Away score increased
                if (newGame.awayScore > prev.awayScore) {
                  const runs = newGame.awayScore - prev.awayScore;
                  const recentPlay = newGame.plays?.find((p) => p.isScoringPlay);
                  const generated = getRandomPlayDescription(newGame.awayTeam.shortName, runs);

                  addScoreToast({
                    gameId: newGame.id,
                    homeTeam: newGame.homeTeam,
                    awayTeam: newGame.awayTeam,
                    scoringTeam: newGame.awayTeam,
                    scoringTeamSide: 'away',
                    runsScored: runs,
                    homeScore: newGame.homeScore,
                    awayScore: newGame.awayScore,
                    inning: newGame.currentInning || 8,
                    isTopInning: Boolean(newGame.isTopInning),
                    outs: newGame.outs ?? 1,
                    title: runs > 1 ? `¡${runs} CARRERAS ANOTADAS!` : '¡CARRERA ANOTADA!',
                    description: recentPlay?.description || generated.description,
                    playType: recentPlay?.description.toLowerCase().includes('jonrón') ? 'homerun' : generated.playType,
                    autoDismissMs: 6500,
                  });
                }
              }
            }
          });
        }

        // Update score map
        const newMap = new Map<string, { homeScore: number; awayScore: number }>();
        res.forEach((g) => {
          newMap.set(g.id, { homeScore: g.homeScore, awayScore: g.awayScore });
        });
        prevGamesMapRef.current = newMap;

        setGames(res);
      } catch (err) {
        console.warn('[GamesView] Error cargando partidos:', err);
      } finally {
        if (!isBackgroundUpdate) setLoading(false);
      }
    },
    [activeCompetitionId, statusFilter, addScoreToast]
  );

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Handler to simulate data reload with realistic skeleton animation
  const handleSimulateLoading = () => {
    setLoading(true);
    setTimeout(() => {
      fetchGames();
    }, 1200);
  };

  // Handler to manually simulate a run in a live game
  const handleSimulateRun = async (forcedGameId?: string, forcedSide?: 'home' | 'away') => {
    if (isSimulating) return;
    setIsSimulating(true);

    try {
      // Find candidate live game
      const liveGames = games.filter((g) => g.status === 'LIVE');
      const targetGame = forcedGameId
        ? liveGames.find((g) => g.id === forcedGameId) || liveGames[0]
        : liveGames[Math.floor(Math.random() * liveGames.length)];

      if (!targetGame) {
        // If no live game under current filter, fetch all games or notify
        setStatusFilter('ALL');
        setIsSimulating(false);
        return;
      }

      // Call the simulation API
      const result = await ApiClient.simulateGameRun({
        gameId: targetGame.id,
        side: forcedSide,
      });

      // Update games in state immediately
      setGames((prev) =>
        prev.map((g) => (g.id === result.game.id ? result.game : g))
      );

      // Update tracking map
      prevGamesMapRef.current.set(result.game.id, {
        homeScore: result.game.homeScore,
        awayScore: result.game.awayScore,
      });

      // Trigger Toast notification
      addScoreToast({
        gameId: result.game.id,
        homeTeam: result.game.homeTeam,
        awayTeam: result.game.awayTeam,
        scoringTeam: result.scoringTeam,
        scoringTeamSide: result.scoringSide,
        runsScored: result.runsScored,
        homeScore: result.game.homeScore,
        awayScore: result.game.awayScore,
        inning: result.game.currentInning || 8,
        isTopInning: Boolean(result.game.isTopInning),
        outs: result.game.outs ?? 1,
        title: result.title,
        description: result.playDescription,
        playType: result.playType,
        autoDismissMs: 6500,
      });
    } catch (err) {
      console.error('Error simulando carrera:', err);
      // Client-side fallback if server simulation failed
      const liveGames = games.filter((g) => g.status === 'LIVE');
      if (liveGames.length > 0) {
        const game = liveGames[0];
        const side = Math.random() > 0.5 ? 'home' : 'away';
        const scoringTeam = side === 'home' ? game.homeTeam : game.awayTeam;
        const newHome = side === 'home' ? game.homeScore + 1 : game.homeScore;
        const newAway = side === 'away' ? game.awayScore + 1 : game.awayScore;
        const generated = getRandomPlayDescription(scoringTeam.shortName, 1);

        const updatedGame: Game = {
          ...game,
          homeScore: newHome,
          awayScore: newAway,
          homeHits: side === 'home' ? game.homeHits + 1 : game.homeHits,
          awayHits: side === 'away' ? game.awayHits + 1 : game.awayHits,
        };

        setGames((prev) => prev.map((g) => (g.id === game.id ? updatedGame : g)));
        prevGamesMapRef.current.set(game.id, { homeScore: newHome, awayScore: newAway });

        addScoreToast({
          gameId: game.id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          scoringTeam,
          scoringTeamSide: side,
          runsScored: 1,
          homeScore: newHome,
          awayScore: newAway,
          inning: game.currentInning || 8,
          isTopInning: Boolean(game.isTopInning),
          outs: game.outs ?? 1,
          title: generated.title,
          description: generated.description,
          playType: generated.playType,
          autoDismissMs: 6500,
        });
      }
    } finally {
      setTimeout(() => setIsSimulating(false), 400);
    }
  };

  // Automatic ticker simulation loop
  useEffect(() => {
    if (!autoSimulate) return;

    const timer = setInterval(() => {
      handleSimulateRun();
    }, 11000);

    return () => clearInterval(timer);
  }, [autoSimulate, games]);

  const liveCount = games.filter((g) => g.status === 'LIVE').length;
  const finalCount = games.filter((g) => g.status === 'FINAL').length;
  const scheduledCount = games.filter((g) => g.status === 'SCHEDULED').length;

  return (
    <div className="space-y-6 pb-12 relative">
      {/* Toast Notification Container */}
      <ScoreChangeToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onClearAll={clearAllToasts}
        onViewGame={navigateToGame}
        onQuickView={(toast) => setSelectedQuickViewToast(toast)}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            Calendario y Resultados de Partidos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sigue los encuentros en tiempo real, consulta los marcadores oficiales y recibe avisos de carreras anotadas.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'LIVE', label: `En Vivo (${liveCount})` },
            { id: 'FINAL', label: `Finalizados (${finalCount})` },
            { id: 'SCHEDULED', label: `Programados (${scheduledCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === f.id
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE TOAST & SCORE ALERT CONTROL BAR */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-lg text-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                Sistema de Alertas en Vivo (Toast de Marcador)
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                ACTIVO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Notificaciones emergentes automáticas con cada carrera anotada, bateador y Box Score.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto">
          {/* Simulate Run Button (Restricted to authenticated admin) */}
          {isAdminAuthenticated && (
            <button
              id="simulate-run-btn"
              onClick={() => handleSimulateRun()}
              disabled={isSimulating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Genera una carrera en un partido en vivo para ver la notificación toast (Admin)"
            >
              <Zap className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Anotando carrera...' : 'Simular Carrera (Test Toast)'}</span>
            </button>
          )}

          {/* Auto-simulation Ticker Toggle (Restricted to authenticated admin) */}
          {isAdminAuthenticated && (
            <button
              id="auto-simulation-toggle"
              onClick={() => setAutoSimulate((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                autoSimulate
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
              title="Activa o desactiva la simulación de carreras periódicas cada 11 segundos (Admin)"
            >
              {autoSimulate ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5" />}
              <span>{autoSimulate ? 'Auto-Carreras: ON (11s)' : 'Auto-Carreras: OFF'}</span>
            </button>
          )}

          {/* Audio Chime Toggle */}
          <button
            id="sound-alert-toggle"
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 border-emerald-500/50 text-emerald-400 hover:bg-slate-700'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={soundEnabled ? 'Sonido de estadio activado' : 'Sonido silenciado'}
            aria-label={soundEnabled ? 'Silenciar sonidos de carrera' : 'Activar sonido de carrera'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Scoring History Drawer Trigger */}
          <button
            id="scoring-history-btn"
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            title="Ver registro de carreras anotadas en esta sesión"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Historial ({scoringHistory.length})</span>
          </button>

          {/* Simulate Loading Button (Restricted to authenticated admin) */}
          {isAdminAuthenticated && (
            <SimulateLoadButton
              onSimulate={handleSimulateLoading}
              isLoading={loading}
              label="Simular Carga Partidos"
            />
          )}
        </div>
      </div>

      {/* Live Games Dashboard Visualization (Recharts) */}
      {loading ? (
        <div className="space-y-4">
          <ChartCardSkeleton />
        </div>
      ) : games.length > 0 ? (
        <LiveGamesDashboard games={games} onNavigateToGame={navigateToGame} />
      ) : null}

      {/* Content Grid */}
      {loading ? (
        <GamesGridSkeleton count={6} />
      ) : games.length === 0 ? (
        <div className="py-16 text-center text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-300">
            No hay partidos con el filtro seleccionado.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Prueba seleccionando &ldquo;Todos&rdquo; para ver el calendario completo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* MODAL: HISTORIAL DE CARRERAS DE LA SESIÓN */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">
                  Historial de Carreras Notificadas
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scoringHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Flame className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  Aún no se han registrado carreras en esta sesión.
                </p>
                <p className="text-xs text-slate-500">
                  Usa el botón &ldquo;Simular Carrera (Test Toast)&rdquo; para disparar una anotación instantánea.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {scoringHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 space-y-2 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                          <TeamLogo logo={item.scoringTeam.logo} name={item.scoringTeam.name} className="w-full h-full" />
                        </div>
                        <span className="font-bold text-xs text-emerald-400">
                          {item.scoringTeam.name} (+{item.runsScored})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {item.inning}ª {item.isTopInning ? '▲' : '▼'} •{' '}
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                      <span className="font-mono text-slate-400 text-[11px]">
                        Marcador: {item.awayTeam.shortName} {item.awayScore} - {item.homeScore} {item.homeTeam.shortName}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsHistoryOpen(false);
                            setSelectedQuickViewToast(item);
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span>Vista Rápida</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsHistoryOpen(false);
                            navigateToGame(item.gameId);
                          }}
                          className="text-slate-400 hover:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Box Score</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Total: {scoringHistory.length} anotaciones
              </span>
              <div className="flex gap-2">
                {scoringHistory.length > 0 && (
                  <button
                    onClick={() => setScoringHistory([])}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Borrar Historial
                  </button>
                )}
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Condensed Play-by-Play Quick View Modal */}
      <PlayByPlayQuickViewModal
        toast={selectedQuickViewToast}
        onClose={() => setSelectedQuickViewToast(null)}
        onNavigateToBoxScore={navigateToGame}
        onSimulateRun={() => handleSimulateRun()}
      />
    </div>
  );
};

