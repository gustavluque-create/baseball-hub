import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Radio,
  Zap,
  Flame,
  Trophy,
  MapPin,
  ExternalLink,
  RefreshCw,
  Play,
  Sparkles,
  ChevronRight,
  Filter,
  ArrowDownUp,
  Activity,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { Game, PlayEvent } from '../types/index.ts';
import { TeamLogo } from './TeamLogo.tsx';
import { ApiClient } from '../services/api.ts';
import { ScoreToastEvent } from './ScoreChangeToast.tsx';

interface PlayByPlayQuickViewModalProps {
  toast: ScoreToastEvent | null;
  onClose: () => void;
  onNavigateToBoxScore?: (gameId: string) => void;
  onSimulateRun?: (gameId: string, side?: 'home' | 'away') => void;
}

export const PlayByPlayQuickViewModal: React.FC<PlayByPlayQuickViewModalProps> = ({
  toast,
  onClose,
  onNavigateToBoxScore,
  onSimulateRun,
}) => {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterScoringOnly, setFilterScoringOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isSimulatingInternal, setIsSimulatingInternal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch full game details when toast changes
  const fetchGameDetails = useCallback(async () => {
    if (!toast?.gameId) return;
    try {
      setLoading(true);
      const data = await ApiClient.getGameDetail(toast.gameId);
      setGame(data);
    } catch (err) {
      console.error('Error cargando detalles del partido para Vista Rápida:', err);
    } finally {
      setLoading(false);
    }
  }, [toast?.gameId]);

  useEffect(() => {
    fetchGameDetails();
  }, [fetchGameDetails]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle in-modal simulation
  const handleSimulateMore = async () => {
    if (!toast || isSimulatingInternal) return;
    setIsSimulatingInternal(true);
    try {
      if (onSimulateRun) {
        onSimulateRun(toast.gameId);
      }
      const res = await ApiClient.simulateGameRun({ gameId: toast.gameId });
      setGame(res.game);
    } catch (err) {
      console.error('Error simulando jugada en Vista Rápida:', err);
    } finally {
      setTimeout(() => setIsSimulatingInternal(false), 500);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compile full plays list (combining server plays + toast play if not already present)
  const combinedPlays = useMemo<PlayEvent[]>(() => {
    const serverPlays = game?.plays ? [...game.plays] : [];

    // If no plays yet, generate initial contextual plays based on the lineScore and toast
    if (serverPlays.length === 0 && toast) {
      serverPlays.push({
        id: `toast-play-${toast.id}`,
        inning: toast.inning,
        isTop: toast.isTopInning,
        outs: toast.outs,
        description: toast.description,
        scoreAfter: `${toast.awayTeam.shortName} ${toast.awayScore} - ${toast.homeTeam.shortName} ${toast.homeScore}`,
        isScoringPlay: true,
      });
    } else if (toast) {
      // Check if toast play exists in serverPlays
      const exists = serverPlays.some(
        (p) =>
          p.description.toLowerCase().trim() === toast.description.toLowerCase().trim() ||
          (p.inning === toast.inning && p.isTop === toast.isTopInning && p.isScoringPlay)
      );
      if (!exists) {
        serverPlays.unshift({
          id: `toast-play-${toast.id}`,
          inning: toast.inning,
          isTop: toast.isTopInning,
          outs: toast.outs,
          description: toast.description,
          scoreAfter: `${toast.awayTeam.shortName} ${toast.awayScore} - ${toast.homeTeam.shortName} ${toast.homeScore}`,
          isScoringPlay: true,
        });
      }
    }

    // Filter
    const filtered = filterScoringOnly
      ? serverPlays.filter((p) => p.isScoringPlay)
      : serverPlays;

    // Sort: 'desc' (latest first) or 'asc' (chronological)
    return filtered.sort((a, b) => {
      if (sortOrder === 'desc') {
        if (a.inning !== b.inning) return b.inning - a.inning;
        if (a.isTop !== b.isTop) return a.isTop ? 1 : -1;
        return (b.outs ?? 0) - (a.outs ?? 0);
      } else {
        if (a.inning !== b.inning) return a.inning - b.inning;
        if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
        return (a.outs ?? 0) - (b.outs ?? 0);
      }
    });
  }, [game, toast, filterScoringOnly, sortOrder]);

  if (!toast) return null;

  const currentHomeScore = game ? game.homeScore : toast.homeScore;
  const currentAwayScore = game ? game.awayScore : toast.awayScore;
  const isHomeScoring = toast.scoringTeamSide === 'home';
  const isHomeLeading = currentHomeScore > currentAwayScore;
  const isAwayLeading = currentAwayScore > currentHomeScore;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickview-title"
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="quickview-title" className="text-sm font-black text-white uppercase tracking-wider">
                  Vista Rápida de Jugadas
                </h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black border border-red-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  EN VIVO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Feed condensado de jugadas y evolución del marcador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Compartir enlace"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Compartir'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Cerrar (Esc)"
              aria-label="Cerrar vista rápida"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* MATCH SCOREBOARD HERO BANNER */}
          <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-inner">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
              {/* Away Team */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                  <TeamLogo logo={toast.awayTeam.logo} name={toast.awayTeam.name} className="w-full h-full text-2xl sm:text-3xl" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white truncate">
                    {toast.awayTeam.name}
                  </h3>
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-slate-400">
                    Visitante ({toast.awayTeam.shortName})
                  </span>
                </div>
              </div>

              {/* Central Score Ticker */}
              <div className="flex flex-col items-center justify-center px-2">
                <div className="flex items-center gap-3 sm:gap-4 font-mono text-3xl sm:text-4xl font-black">
                  <span
                    className={`transition-colors ${
                      isAwayLeading ? 'text-emerald-400' : 'text-slate-100'
                    }`}
                  >
                    {currentAwayScore}
                  </span>
                  <span className="text-slate-600 text-lg font-sans font-light">-</span>
                  <span
                    className={`transition-colors ${
                      isHomeLeading ? 'text-emerald-400' : 'text-slate-100'
                    }`}
                  >
                    {currentHomeScore}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 text-[11px] font-mono font-bold border border-slate-700">
                    {game?.currentInning || toast.inning}ª {game ? (game.isTopInning ? '▲ Alta' : '▼ Baja') : (toast.isTopInning ? '▲ Alta' : '▼ Baja')}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {game ? game.outs : toast.outs} outs
                  </span>
                </div>
              </div>

              {/* Home Team */}
              <div className="flex flex-col sm:flex-row-reverse items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-right min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                  <TeamLogo logo={toast.homeTeam.logo} name={toast.homeTeam.name} className="w-full h-full text-2xl sm:text-3xl" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white truncate">
                    {toast.homeTeam.name}
                  </h3>
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-slate-400">
                    Local ({toast.homeTeam.shortName})
                  </span>
                </div>
              </div>
            </div>

            {/* Stadium & Meta */}
            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{game?.stadium || toast.scoringTeam.stadium || 'Estadio Nacional'}</span>
              </span>
              <span className="font-mono text-slate-400 shrink-0">
                H: {game?.awayHits ?? 0} - {game?.homeHits ?? 0} | E: {game?.awayErrors ?? 0} - {game?.homeErrors ?? 0}
              </span>
            </div>
          </div>

          {/* TRIGGERING RUN SPOTLIGHT CARD */}
          <div className="relative overflow-hidden rounded-2xl bg-emerald-950/30 border border-emerald-500/50 p-3.5 text-slate-100 shadow-md">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Última Anotación Notificada
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                +{toast.runsScored} {toast.scoringTeam.shortName}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-snug">
              {toast.description}
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
              <span>
                Entrada: {toast.inning}ª {toast.isTopInning ? '▲ Alta' : '▼ Baja'} ({toast.outs} outs)
              </span>
              <span>
                Notificado: {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {/* CONDENSED INNING LINE SCORE */}
          {game?.lineScore && game.lineScore.length > 0 && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5 overflow-x-auto shadow-sm">
              <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold text-slate-400">
                <span>Pizarra Resumida por Entradas</span>
                <span className="font-mono text-[10px] text-emerald-400">R - H - E</span>
              </div>
              <table className="w-full text-center text-xs font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800/80 text-[10px]">
                    <th className="text-left font-sans pl-1 pb-1">Equipo</th>
                    {game.lineScore.map((ls) => (
                      <th
                        key={ls.inning}
                        className={`w-6 pb-1 ${
                          ls.inning === (game.currentInning || toast.inning)
                            ? 'text-emerald-400 font-black'
                            : ''
                        }`}
                      >
                        {ls.inning}
                      </th>
                    ))}
                    <th className="w-7 text-white font-bold pb-1 border-l border-slate-800">C</th>
                    <th className="w-7 pb-1">H</th>
                    <th className="w-7 pb-1">E</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {/* Away */}
                  <tr>
                    <td className="text-left font-sans font-bold text-slate-300 py-1 pl-1 flex items-center gap-1.5">
                      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                        <TeamLogo logo={toast.awayTeam.logo} name={toast.awayTeam.name} className="w-full h-full" />
                      </div>
                      <span>{toast.awayTeam.shortName}</span>
                    </td>
                    {game.lineScore.map((ls) => (
                      <td
                        key={ls.inning}
                        className={`py-1 ${
                          ls.inning === (game.currentInning || toast.inning)
                            ? 'bg-emerald-500/10 font-bold text-emerald-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {ls.away !== null ? ls.away : '-'}
                      </td>
                    ))}
                    <td className="font-bold text-white py-1 border-l border-slate-800 bg-slate-900/50">
                      {game.awayScore}
                    </td>
                    <td className="text-slate-400 py-1">{game.awayHits}</td>
                    <td className="text-slate-400 py-1">{game.awayErrors}</td>
                  </tr>

                  {/* Home */}
                  <tr>
                    <td className="text-left font-sans font-bold text-slate-300 py-1 pl-1 flex items-center gap-1.5">
                      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                        <TeamLogo logo={toast.homeTeam.logo} name={toast.homeTeam.name} className="w-full h-full" />
                      </div>
                      <span>{toast.homeTeam.shortName}</span>
                    </td>
                    {game.lineScore.map((ls) => (
                      <td
                        key={ls.inning}
                        className={`py-1 ${
                          ls.inning === (game.currentInning || toast.inning)
                            ? 'bg-emerald-500/10 font-bold text-emerald-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {ls.home !== null ? ls.home : '-'}
                      </td>
                    ))}
                    <td className="font-bold text-white py-1 border-l border-slate-800 bg-slate-900/50">
                      {game.homeScore}
                    </td>
                    <td className="text-slate-400 py-1">{game.homeHits}</td>
                    <td className="text-slate-400 py-1">{game.homeErrors}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* PLAY-BY-PLAY CONDENSED FEED HEADER & CONTROLS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Feed de Jugadas ({combinedPlays.length})
              </h4>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
              {/* Filter Scoring Only */}
              <button
                onClick={() => setFilterScoringOnly(!filterScoringOnly)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  filterScoringOnly
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm font-bold'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                <Filter className="w-3 h-3" />
                <span>Solo Anotaciones</span>
              </button>

              {/* Sort Order Toggle */}
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer hover:text-white"
                title="Cambiar orden de jugadas"
              >
                <ArrowDownUp className="w-3 h-3" />
                <span>{sortOrder === 'desc' ? 'Más recientes' : 'Cronológico'}</span>
              </button>
            </div>
          </div>

          {/* CONDENSED PLAY-BY-PLAY FEED LIST */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {combinedPlays.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                No hay jugadas registradas con el filtro actual.
              </div>
            ) : (
              combinedPlays.map((play, idx) => {
                const isHomerun =
                  play.description.toLowerCase().includes('jonrón') ||
                  play.description.toLowerCase().includes('cuadrangular');
                const isHighlight =
                  play.description.toLowerCase().trim() ===
                  toast.description.toLowerCase().trim();

                return (
                  <div
                    key={play.id || idx}
                    className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                      isHighlight
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                        : play.isScoringPlay
                        ? 'bg-slate-900 border-slate-700/80 hover:border-emerald-500/40'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Inning Pill */}
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold text-[11px] border border-slate-700 shrink-0">
                          {play.inning}ª {play.isTop ? '▲ Alta' : '▼ Baja'}
                        </span>

                        {/* Outs count */}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {play.outs ?? 0} out{(play.outs ?? 0) === 1 ? '' : 's'}
                        </span>

                        {/* Scoring badge */}
                        {play.isScoringPlay && (
                          <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                            {isHomerun ? '🔥 JONRÓN' : '⚾ ANOTACIÓN'}
                          </span>
                        )}

                        {/* Target toast badge */}
                        {isHighlight && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            ÚLTIMA ALERTA
                          </span>
                        )}
                      </div>

                      {/* Score after play */}
                      {play.scoreAfter && (
                        <span className="font-mono text-[11px] font-bold text-slate-300 shrink-0">
                          {play.scoreAfter}
                        </span>
                      )}
                    </div>

                    {/* Play Description */}
                    <p className={`leading-relaxed ${isHighlight ? 'text-white font-medium' : 'text-slate-200'}`}>
                      {play.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BOTTOM ACTION TOOLBAR */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          {/* Simulate Action inside Quick View */}
          <button
            onClick={handleSimulateMore}
            disabled={isSimulatingInternal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all border border-slate-700 cursor-pointer active:scale-95 disabled:opacity-50"
            title="Simular otra anotación en este partido"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSimulatingInternal ? 'animate-spin' : ''}`} />
            <span>{isSimulatingInternal ? 'Simulando...' : 'Simular Nueva Jugada'}</span>
          </button>

          <div className="flex items-center gap-2">
            {onNavigateToBoxScore && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToBoxScore(toast.gameId);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <span>Ver Box Score Completo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
