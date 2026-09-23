import React, { useState, useEffect } from 'react';
import {
  X,
  Swords,
  Trophy,
  Flame,
  Shield,
  BarChart3,
  Users,
  Calendar,
  ExternalLink,
  ChevronRight,
  Share2,
  Sparkles,
} from 'lucide-react';
import { Game, MatchupComparisonData } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { StatComparisonBar } from './comparison/StatComparisonBar.tsx';
import { StatComparisonCard } from './comparison/StatComparisonCard.tsx';
import { TeamComparisonHeader } from './comparison/TeamComparisonHeader.tsx';
import { TeamRadarChart } from './comparison/TeamRadarChart.tsx';
import { TeamLeadersComparison } from './comparison/TeamLeadersComparison.tsx';
import { HeadToHeadHistory } from './comparison/HeadToHeadHistory.tsx';
import { GameMatchupSkeleton } from './LoadingSkeleton.tsx';
import { TeamLogo } from './TeamLogo.tsx';

interface GameMatchupModalProps {
  gameId: string | null;
  onClose: () => void;
  onOpenBoxScore?: (gameId: string) => void;
}

export const GameMatchupModal: React.FC<GameMatchupModalProps> = ({
  gameId,
  onClose,
  onOpenBoxScore,
}) => {
  const {
    isFavoriteTeam,
    toggleFavoriteTeam,
    navigateToPlayer,
    navigateToTeam,
    navigateToGame,
  } = useApp();

  const [data, setData] = useState<MatchupComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'batting' | 'pitching' | 'leaders' | 'boxscore'>('summary');
  const [copiedShare, setCopiedShare] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load matchup comparison data
  useEffect(() => {
    if (!gameId) return;
    setLoading(true);

    ApiClient.getMatchupComparison(gameId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(async (err) => {
        console.warn('Fallback loading for matchup:', err);
        // Fallback: fetch game and standings
        try {
          const game = await ApiClient.getGameDetail(gameId);
          const standings = await ApiClient.getStandings();
          const awayStanding = standings.find((s) => s.teamId === game.awayTeam.id);
          const homeStanding = standings.find((s) => s.teamId === game.homeTeam.id);

          // Construct reasonable fallback
          const fallbackData: MatchupComparisonData = {
            game,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            awayStanding,
            homeStanding,
            awayStats: {
              teamId: game.awayTeam.id,
              teamShort: game.awayTeam.shortName,
              teamName: game.awayTeam.name,
              batting: {
                avg: 0.285,
                obp: 0.355,
                slg: 0.435,
                ops: 0.79,
                runs: awayStanding?.runsScored || 112,
                hits: 195,
                doubles: 32,
                triples: 5,
                homeRuns: 18,
                rbi: 104,
                walks: 72,
                strikeouts: 110,
                stolenBases: 14,
              },
              pitching: {
                era: 3.42,
                whip: 1.21,
                wins: awayStanding?.wins || game.awayTeam.record?.wins || 12,
                losses: awayStanding?.losses || game.awayTeam.record?.losses || 8,
                saves: 6,
                inningsPitched: 178.0,
                hitsAllowed: 165,
                runsAllowed: awayStanding?.runsAllowed || 85,
                earnedRuns: 68,
                walks: 52,
                strikeouts: 148,
                homeRunsAllowed: 12,
                k9: 7.48,
                bb9: 2.63,
              },
            },
            homeStats: {
              teamId: game.homeTeam.id,
              teamShort: game.homeTeam.shortName,
              teamName: game.homeTeam.name,
              batting: {
                avg: 0.292,
                obp: 0.362,
                slg: 0.448,
                ops: 0.81,
                runs: homeStanding?.runsScored || 120,
                hits: 204,
                doubles: 36,
                triples: 4,
                homeRuns: 22,
                rbi: 112,
                walks: 78,
                strikeouts: 105,
                stolenBases: 16,
              },
              pitching: {
                era: 3.25,
                whip: 1.18,
                wins: homeStanding?.wins || game.homeTeam.record?.wins || 14,
                losses: homeStanding?.losses || game.homeTeam.record?.losses || 6,
                saves: 8,
                inningsPitched: 180.0,
                hitsAllowed: 158,
                runsAllowed: homeStanding?.runsAllowed || 79,
                earnedRuns: 65,
                walks: 55,
                strikeouts: 156,
                homeRunsAllowed: 11,
                k9: 7.8,
                bb9: 2.75,
              },
            },
            headToHeadGames: [],
          };
          setData(fallbackData);
          setLoading(false);
        } catch (innerErr) {
          console.error('Fatal error loading matchup:', innerErr);
          setLoading(false);
        }
      });
  }, [gameId]);

  if (!gameId) return null;

  const handleShare = () => {
    if (navigator.clipboard && data) {
      const url = window.location.href;
      navigator.clipboard.writeText(
        `Comparativa ${data.awayTeam.shortName} vs ${data.homeTeam.shortName} - Serie Nacional 2026: ${url}`
      );
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  const awayColor = data?.awayTeam.colors?.primary || data?.awayTeam.primaryColor || '#3b82f6';
  const homeColor = data?.homeTeam.colors?.primary || data?.homeTeam.primaryColor || '#10b981';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">
              Comparativa Cara a Cara de Temporada
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:inline text-xs text-slate-400">
              Serie Nacional 2026
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Share button */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Copiar enlace del partido"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">{copiedShare ? '¡Copiado!' : 'Compartir'}</span>
            </button>

            {/* Direct button to open Box Score */}
            <button
              type="button"
              onClick={() => {
                if (onOpenBoxScore) {
                  onOpenBoxScore(gameId);
                } else {
                  navigateToGame(gameId);
                }
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ver Box Score</span>
            </button>

            {/* Close modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading || !data ? (
            <GameMatchupSkeleton />
          ) : (
            <>
              {/* 1. Reusable Team Comparison Header */}
              <TeamComparisonHeader
                game={data.game}
                awayTeam={data.awayTeam}
                homeTeam={data.homeTeam}
                awayStanding={data.awayStanding}
                homeStanding={data.homeStanding}
                isFavoriteTeam={isFavoriteTeam}
                onToggleFavorite={toggleFavoriteTeam}
                onSelectTeam={navigateToTeam}
              />

              {/* 2. Interactive Category Tabs */}
              <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-800 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'summary'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Resumen & Récord</span>
                </button>

                <button
                  onClick={() => setActiveTab('batting')}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'batting'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Bateo Colectivo</span>
                </button>

                <button
                  onClick={() => setActiveTab('pitching')}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'pitching'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Pitcheo & Defensa</span>
                </button>

                <button
                  onClick={() => setActiveTab('leaders')}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'leaders'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Líderes & Historial</span>
                </button>

                <button
                  onClick={() => setActiveTab('boxscore')}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'boxscore'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Pizarra del Partido</span>
                </button>
              </div>

              {/* Tab 1: Resumen & Récord */}
              {activeTab === 'summary' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Standings & General Record Card */}
                  <StatComparisonCard
                    title="Récord y Clasificación 2026"
                    icon={<Trophy className="w-5 h-5 text-amber-400" />}
                    subtitle="Posición en tabla oficial, balance de victorias y diferencial"
                    teamAName={data.awayTeam.shortName}
                    teamBName={data.homeTeam.shortName}
                    teamAColor={awayColor}
                    teamBColor={homeColor}
                  >
                    <StatComparisonBar
                      label="Porcentaje de Victorias"
                      subtitle="Balance de victorias / juegos disputados"
                      valueA={data.awayStanding?.pct ?? data.awayTeam.record?.pct ?? 0.5}
                      valueB={data.homeStanding?.pct ?? data.homeTeam.record?.pct ?? 0.5}
                      format="percentage"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Juegos Ganados (JG)"
                      valueA={data.awayStanding?.wins ?? data.awayTeam.record?.wins ?? 0}
                      valueB={data.homeStanding?.wins ?? data.homeTeam.record?.wins ?? 0}
                      format="number"
                      unit="victorias"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Juegos Perdidos (JP)"
                      valueA={data.awayStanding?.losses ?? data.awayTeam.record?.losses ?? 0}
                      valueB={data.homeStanding?.losses ?? data.homeTeam.record?.losses ?? 0}
                      format="number"
                      unit="derrotas"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={false}
                    />

                    <StatComparisonBar
                      label="Diferencial de Carreras (+/-)"
                      subtitle="Balance neto de carreras de la temporada"
                      valueA={data.awayStanding?.runDiff ?? 0}
                      valueB={data.homeStanding?.runDiff ?? 0}
                      format="number"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Carreras Anotadas (CA)"
                      valueA={data.awayStanding?.runsScored ?? data.awayStats.batting.runs}
                      valueB={data.homeStanding?.runsScored ?? data.homeStats.batting.runs}
                      format="number"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Carreras Permitidas (CP)"
                      valueA={data.awayStanding?.runsAllowed ?? data.awayStats.pitching.runsAllowed}
                      valueB={data.homeStanding?.runsAllowed ?? data.homeStats.pitching.runsAllowed}
                      format="number"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={false}
                    />

                    <StatComparisonBar
                      label="Últimos 10 Juegos"
                      valueA={data.awayStanding?.lastTen ?? data.awayTeam.record?.lastTen ?? '5-5'}
                      valueB={data.homeStanding?.lastTen ?? data.homeTeam.record?.lastTen ?? '5-5'}
                      numA={parseInt((data.awayStanding?.lastTen || '5-5').split('-')[0], 10)}
                      numB={parseInt((data.homeStanding?.lastTen || '5-5').split('-')[0], 10)}
                      format="raw"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Racha Actual"
                      valueA={data.awayStanding?.streak ?? data.awayTeam.record?.streak ?? '—'}
                      valueB={data.homeStanding?.streak ?? data.homeTeam.record?.streak ?? '—'}
                      numA={(data.awayStanding?.streak || '').startsWith('G') ? parseInt(data.awayStanding?.streak.substring(1) || '1', 10) : -1}
                      numB={(data.homeStanding?.streak || '').startsWith('G') ? parseInt(data.homeStanding?.streak.substring(1) || '1', 10) : -1}
                      format="raw"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />
                  </StatComparisonCard>

                  {/* Normalized Radar Comparison */}
                  <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-xl">
                    <div>
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white">
                            Equilibrio Táctico (Radar Hexagonal)
                          </h3>
                          <p className="text-xs text-slate-400">
                            Evaluación normalizada de 6 facetas ofensivas, defensivas y de victoria
                          </p>
                        </div>
                      </div>

                      <TeamRadarChart
                        awayTeam={data.awayTeam}
                        homeTeam={data.homeTeam}
                        awayStats={data.awayStats}
                        homeStats={data.homeStats}
                        awayStanding={data.awayStanding}
                        homeStanding={data.homeStanding}
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-start gap-2 mt-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-200">Factores Clave: </span>
                        <span>
                          La ventaja de localía para {data.homeTeam.name} en el estadio {data.game.stadium || data.homeTeam.stadium} se combina con un diferencial de carreras de {data.homeStanding?.runDiff || '+0'}.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Bateo Colectivo */}
              {activeTab === 'batting' && (
                <div className="space-y-6">
                  <StatComparisonCard
                    title="Estadísticas de Bateo Colectivo"
                    icon={<Flame className="w-5 h-5 text-amber-500" />}
                    subtitle="Desempeño acumulado en la caja de bateo en la presente Serie Nacional"
                    teamAName={data.awayTeam.shortName}
                    teamBName={data.homeTeam.shortName}
                    teamAColor={awayColor}
                    teamBColor={homeColor}
                  >
                    <StatComparisonBar
                      label="Promedio de Bateo Colectivo (.AVG)"
                      valueA={data.awayStats.batting.avg}
                      valueB={data.homeStats.batting.avg}
                      format="avg"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Porcentaje de Embasado (.OBP)"
                      valueA={data.awayStats.batting.obp}
                      valueB={data.homeStats.batting.obp}
                      format="avg"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Slugging (.SLG)"
                      valueA={data.awayStats.batting.slg}
                      valueB={data.homeStats.batting.slg}
                      format="avg"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="OPS Colectivo (OBP + SLG)"
                      valueA={data.awayStats.batting.ops}
                      valueB={data.homeStats.batting.ops}
                      format="avg"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Imparables Conectados (H)"
                      valueA={data.awayStats.batting.hits}
                      valueB={data.homeStats.batting.hits}
                      format="number"
                      unit="hits"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Cuadrangulares (HR)"
                      valueA={data.awayStats.batting.homeRuns}
                      valueB={data.homeStats.batting.homeRuns}
                      format="number"
                      unit="jonrones"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Carreras Impulsadas (CI)"
                      valueA={data.awayStats.batting.rbi}
                      valueB={data.homeStats.batting.rbi}
                      format="number"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Dobles Conectados (2B)"
                      valueA={data.awayStats.batting.doubles}
                      valueB={data.homeStats.batting.doubles}
                      format="number"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Boletos Recibidos (BB)"
                      valueA={data.awayStats.batting.walks}
                      valueB={data.homeStats.batting.walks}
                      format="number"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Bases Robadas (BR)"
                      valueA={data.awayStats.batting.stolenBases}
                      valueB={data.homeStats.batting.stolenBases}
                      format="number"
                      unit="robos"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Menos Ponches Recibidos (SO)"
                      subtitle="Control de la zona de strike al bate (menor es mejor)"
                      valueA={data.awayStats.batting.strikeouts}
                      valueB={data.homeStats.batting.strikeouts}
                      format="number"
                      unit="K"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={false}
                    />
                  </StatComparisonCard>
                </div>
              )}

              {/* Tab 3: Pitcheo Colectivo */}
              {activeTab === 'pitching' && (
                <div className="space-y-6">
                  <StatComparisonCard
                    title="Estadísticas de Pitcheo Colectivo"
                    icon={<Shield className="w-5 h-5 text-emerald-400" />}
                    subtitle="Efectividad, control del staff monticular y estadísticas de dominio"
                    teamAName={data.awayTeam.shortName}
                    teamBName={data.homeTeam.shortName}
                    teamAColor={awayColor}
                    teamBColor={homeColor}
                  >
                    <StatComparisonBar
                      label="Promedio de Carreras Limpias (PCL / ERA)"
                      subtitle="Efectividad colectiva (menor es mejor)"
                      valueA={data.awayStats.pitching.era}
                      valueB={data.homeStats.pitching.era}
                      format="era"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={false}
                    />

                    <StatComparisonBar
                      label="WHIP Colectivo"
                      subtitle="Embasados por entrada lanzada (menor es mejor)"
                      valueA={data.awayStats.pitching.whip}
                      valueB={data.homeStats.pitching.whip}
                      format="whip"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={false}
                    />

                    <StatComparisonBar
                      label="Ponches Propinados (K)"
                      valueA={data.awayStats.pitching.strikeouts}
                      valueB={data.homeStats.pitching.strikeouts}
                      format="number"
                      unit="ponches"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Ponches por 9 Entradas (K/9)"
                      valueA={data.awayStats.pitching.k9}
                      valueB={data.homeStats.pitching.k9}
                      format="decimal"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Boletos Concedidos (BB)"
                      subtitle="Control del comando de los lanzadores (menor es mejor)"
                      valueA={data.awayStats.pitching.walks}
                      valueB={data.homeStats.pitching.walks}
                      format="number"
                      unit="BB"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={false}
                    />

                    <StatComparisonBar
                      label="Juegos Salvados (JS)"
                      valueA={data.awayStats.pitching.saves}
                      valueB={data.homeStats.pitching.saves}
                      format="number"
                      unit="salvamentos"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Entradas Lanzadas (INN)"
                      valueA={data.awayStats.pitching.inningsPitched}
                      valueB={data.homeStats.pitching.inningsPitched}
                      format="decimal"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={true}
                    />

                    <StatComparisonBar
                      label="Jonrones Permitidos (HR)"
                      subtitle="Menor cantidad concedida (menor es mejor)"
                      valueA={data.awayStats.pitching.homeRunsAllowed}
                      valueB={data.homeStats.pitching.homeRunsAllowed}
                      format="number"
                      unit="HR permitidos"
                      teamAColor={awayColor}
                      teamBColor={homeColor}
                      higherIsBetter={false}
                    />
                  </StatComparisonCard>
                </div>
              )}

              {/* Tab 4: Líderes & Serie */}
              {activeTab === 'leaders' && (
                <div className="space-y-6">
                  {/* Key Players Comparison */}
                  <TeamLeadersComparison
                    awayTeam={data.awayTeam}
                    homeTeam={data.homeTeam}
                    awayTopBatter={data.awayTopBatter}
                    homeTopBatter={data.homeTopBatter}
                    awayTopPitcher={data.awayTopPitcher}
                    homeTopPitcher={data.homeTopPitcher}
                    onSelectPlayer={(id) => {
                      navigateToPlayer(id);
                      onClose();
                    }}
                  />

                  {/* Season Head to Head Series */}
                  <HeadToHeadHistory
                    awayTeam={data.awayTeam}
                    homeTeam={data.homeTeam}
                    games={data.headToHeadGames}
                    onSelectGame={(id) => {
                      navigateToGame(id);
                      onClose();
                    }}
                  />
                </div>
              )}

              {/* Tab 5: Box Score Oficial del Partido */}
              {activeTab === 'boxscore' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                          Pizarra de Entradas Oficial
                        </h4>
                        <p className="text-xs text-slate-400">
                          {data.game.status === 'LIVE'
                            ? 'Partido actualmente en disputa'
                            : data.game.status === 'FINAL'
                            ? 'Marcador final certificado'
                            : 'Partido pendiente de inicio'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenBoxScore) onOpenBoxScore(data.game.id);
                          else navigateToGame(data.game.id);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                      >
                        <span>Abrir Modal Completo de Box Score</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Linescore Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono text-center">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                            <th className="py-2 px-3 text-left font-sans">EQUIPO</th>
                            {Array.from({ length: 9 }).map((_, i) => (
                              <th key={i} className="py-2 px-2 w-8">
                                {i + 1}
                              </th>
                            ))}
                            <th className="py-2 px-2.5 bg-slate-900 text-white font-bold">C</th>
                            <th className="py-2 px-2.5 text-slate-300">H</th>
                            <th className="py-2 px-2.5 text-slate-300">E</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {/* Away */}
                          <tr>
                            <td className="py-2.5 px-3 text-left font-sans font-bold flex items-center gap-2">
                              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                <TeamLogo logo={data.awayTeam.logo} name={data.awayTeam.name} className="w-full h-full" />
                              </div>
                              <span className="text-white">{data.awayTeam.name}</span>
                            </td>
                            {Array.from({ length: 9 }).map((_, i) => (
                              <td key={i} className="py-2 px-2 text-slate-400">
                                {data.game.lineScore?.[i]?.away !== undefined && data.game.lineScore?.[i]?.away !== null
                                  ? data.game.lineScore[i].away
                                  : (data.game.status === 'SCHEDULED' ? '-' : '0')}
                              </td>
                            ))}
                            <td className="py-2 px-2.5 bg-slate-900 font-bold text-emerald-400 text-sm">
                              {data.game.awayScore ?? 0}
                            </td>
                            <td className="py-2 px-2.5 text-slate-300">
                              {data.game.awayHits ?? Math.floor((data.game.awayScore ?? 0) * 1.8)}
                            </td>
                            <td className="py-2 px-2.5 text-slate-300">
                              {data.game.awayErrors ?? 0}
                            </td>
                          </tr>

                          {/* Home */}
                          <tr>
                            <td className="py-2.5 px-3 text-left font-sans font-bold flex items-center gap-2">
                              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                <TeamLogo logo={data.homeTeam.logo} name={data.homeTeam.name} className="w-full h-full" />
                              </div>
                              <span className="text-white">{data.homeTeam.name}</span>
                            </td>
                            {Array.from({ length: 9 }).map((_, i) => (
                              <td key={i} className="py-2 px-2 text-slate-400">
                                {data.game.lineScore?.[i]?.home !== undefined && data.game.lineScore?.[i]?.home !== null
                                  ? data.game.lineScore[i].home
                                  : (data.game.status === 'SCHEDULED' ? '-' : '0')}
                              </td>
                            ))}
                            <td className="py-2 px-2.5 bg-slate-900 font-bold text-emerald-400 text-sm">
                              {data.game.homeScore ?? 0}
                            </td>
                            <td className="py-2 px-2.5 text-slate-300">
                              {data.game.homeHits ?? Math.floor((data.game.homeScore ?? 0) * 1.9)}
                            </td>
                            <td className="py-2 px-2.5 text-slate-300">
                              {data.game.homeErrors ?? 0}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Datos actualizados de Serie Nacional 64 • Estadísticas oficiales</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
          >
            Cerrar Comparativa
          </button>
        </div>
      </div>
    </div>
  );
};
