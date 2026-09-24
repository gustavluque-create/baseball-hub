import React, { useState, useEffect } from 'react';
import {
  Swords,
  ArrowLeftRight,
  Trophy,
  Star,
  Activity,
  BarChart2,
  Radar as RadarIcon,
  Flame,
  Shield,
  MapPin,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Team, TeamDirectComparisonData } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { TeamLogo } from '../TeamLogo.tsx';
import { TeamRadarChart } from './TeamRadarChart.tsx';
import { TeamBarComparisonChart } from './TeamBarComparisonChart.tsx';
import { StatComparisonBar } from './StatComparisonBar.tsx';
import { HeadToHeadHistory } from './HeadToHeadHistory.tsx';
import { TeamLeadersComparison } from './TeamLeadersComparison.tsx';
import { useApp } from '../../context/AppContext.tsx';

export interface TeamComparisonSectionProps {
  initialTeamAId?: string;
  initialTeamBId?: string;
  allTeams: Team[];
  onSelectTeam?: (teamId: string) => void;
  onSelectPlayer?: (playerId: string) => void;
}

export const TeamComparisonSection: React.FC<TeamComparisonSectionProps> = ({
  initialTeamAId,
  initialTeamBId,
  allTeams,
  onSelectTeam,
  onSelectPlayer,
}) => {
  const { navigateToGame, isFavoriteTeam, toggleFavoriteTeam } = useApp();

  // Selected teams state
  const [teamAId, setTeamAId] = useState<string>(() => {
    if (initialTeamAId) return initialTeamAId;
    if (allTeams.length > 0) return allTeams[0].id;
    return 'ind';
  });

  const [teamBId, setTeamBId] = useState<string>(() => {
    if (initialTeamBId && initialTeamBId !== initialTeamAId) return initialTeamBId;
    if (allTeams.length > 1) return allTeams[1].id;
    return 'mtz';
  });

  // Visualization Mode
  const [viewMode, setViewMode] = useState<'radar' | 'bars' | 'metrics' | 'h2h' | 'leaders'>('radar');

  // Comparison Data
  const [comparison, setComparison] = useState<TeamDirectComparisonData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync if initial props change
  useEffect(() => {
    if (initialTeamAId && initialTeamAId !== teamAId) {
      setTeamAId(initialTeamAId);
    }
  }, [initialTeamAId]);

  useEffect(() => {
    if (initialTeamBId && initialTeamBId !== teamBId) {
      setTeamBId(initialTeamBId);
    }
  }, [initialTeamBId]);

  // Fetch comparison data when teamAId or teamBId changes
  useEffect(() => {
    if (!teamAId || !teamBId) return;

    // Prevent comparing same team
    if (teamAId === teamBId) {
      const alternate = allTeams.find((t) => t.id !== teamAId);
      if (alternate) {
        setTeamBId(alternate.id);
        return;
      }
    }

    setLoading(true);
    setError(null);

    ApiClient.getTeamComparison(teamAId, teamBId)
      .then((res) => {
        setComparison(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[TeamComparison] Error loading comparison:', err);
        setError('No se pudieron cargar los datos estadísticos para esta comparativa.');
        setLoading(false);
      });
  }, [teamAId, teamBId, allTeams]);

  // Swap Teams
  const handleSwap = () => {
    const temp = teamAId;
    setTeamAId(teamBId);
    setTeamBId(temp);
  };

  // Quick Preset Handlers
  const handlePreset = (idA: string, idB: string) => {
    const validA = allTeams.find((t) => t.id === idA || t.shortName.toLowerCase() === idA.toLowerCase())?.id || idA;
    const validB = allTeams.find((t) => t.id === idB || t.shortName.toLowerCase() === idB.toLowerCase())?.id || idB;
    setTeamAId(validA);
    setTeamBId(validB);
  };

  const teamA = comparison?.teamA || allTeams.find((t) => t.id === teamAId);
  const teamB = comparison?.teamB || allTeams.find((t) => t.id === teamBId);

  const colorA = teamA?.colors?.primary || teamA?.primaryColor || '#3b82f6';
  const colorB = teamB?.colors?.primary || teamB?.primaryColor || '#10b981';

  return (
    <div className="space-y-6">
      {/* Top Selector Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle dual gradient backdrop */}
        <div className="absolute inset-0 pointer-events-none opacity-15 flex">
          <div
            className="flex-1"
            style={{
              background: `radial-gradient(circle at 10% 50%, ${colorA}, transparent 70%)`,
            }}
          />
          <div
            className="flex-1"
            style={{
              background: `radial-gradient(circle at 90% 50%, ${colorB}, transparent 70%)`,
            }}
          />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
                <Swords className="w-5 h-5 text-emerald-400" />
                <span>Comparador Cara a Cara de Franquicias</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecciona dos equipos de la Serie Nacional para contrastar su rendimiento colectivo, ofensiva, pitcheo y serie particular.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Clásicos:
              </span>
              <button
                type="button"
                onClick={() => handlePreset('ind', 'scu')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
              >
                IND vs SCU
              </button>
              <button
                type="button"
                onClick={() => handlePreset('ind', 'mtz')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
              >
                IND vs MTZ
              </button>
              <button
                type="button"
                onClick={() => handlePreset('pri', 'ind')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
              >
                PRI vs IND
              </button>
              <button
                type="button"
                onClick={() => handlePreset('ltu', 'gra')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
              >
                LTU vs GRA
              </button>
            </div>
          </div>

          {/* Team Selectors Row */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 sm:gap-4 items-center pt-2">
            {/* Team A Selector */}
            <div className="md:col-span-5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Equipo A</span>
                {teamA && (
                  <span className="font-mono text-emerald-400">
                    Posición #{teamA.record?.position || 1}
                  </span>
                )}
              </label>

              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center p-1.5 shrink-0 border border-slate-700/80"
                  style={{ backgroundColor: `${colorA}20` }}
                >
                  {teamA && <TeamLogo logo={teamA.logo} name={teamA.name} className="w-full h-full text-2xl" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <select
                      value={teamAId}
                      onChange={(e) => setTeamAId(e.target.value)}
                      className="w-full appearance-none bg-slate-900 hover:bg-slate-850 text-white font-bold text-sm px-3 py-2 pr-8 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {allTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === teamBId}>
                          {t.name} ({t.shortName}) - {t.record?.wins || 0}G - {t.record?.losses || 0}P
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {teamA && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      {teamA.stadium} • Mánager: <strong className="text-slate-300">{teamA.manager}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Swap Button (Col 6 in md) */}
            <div className="md:col-span-1 flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                className="p-3 rounded-full bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 border border-slate-700 transition-all shadow-md active:scale-90 cursor-pointer group"
                title="Intercambiar equipos (⇄)"
                aria-label="Intercambiar orden de comparación"
              >
                <ArrowLeftRight className="w-4 h-4 transition-transform group-hover:rotate-180 duration-300" />
              </button>
            </div>

            {/* Team B Selector */}
            <div className="md:col-span-5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Equipo B</span>
                {teamB && (
                  <span className="font-mono text-emerald-400">
                    Posición #{teamB.record?.position || 2}
                  </span>
                )}
              </label>

              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center p-1.5 shrink-0 border border-slate-700/80"
                  style={{ backgroundColor: `${colorB}20` }}
                >
                  {teamB && <TeamLogo logo={teamB.logo} name={teamB.name} className="w-full h-full text-2xl" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <select
                      value={teamBId}
                      onChange={(e) => setTeamBId(e.target.value)}
                      className="w-full appearance-none bg-slate-900 hover:bg-slate-850 text-white font-bold text-sm px-3 py-2 pr-8 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {allTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === teamAId}>
                          {t.name} ({t.shortName}) - {t.record?.wins || 0}G - {t.record?.losses || 0}P
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {teamB && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      {teamB.stadium} • Mánager: <strong className="text-slate-300">{teamB.manager}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-12 text-center space-y-4 animate-pulse">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-semibold">
            Calculando métricas multidimensionales y comparativa en vivo...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-950/30 border border-red-800/60 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-red-300">{error}</p>
          <button
            onClick={() => setTeamBId(allTeams.find((t) => t.id !== teamAId)?.id || 'mtz')}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-white font-bold hover:bg-slate-700 cursor-pointer"
          >
            Reintentar con otro equipo
          </button>
        </div>
      ) : comparison && teamA && teamB ? (
        <div className="space-y-6">
          {/* Quick Metrics Key Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Record */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Récord &amp; PCT
              </span>
              <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold">
                <span style={{ color: colorA }}>
                  {comparison.standingA?.wins ?? teamA.record.wins}-{comparison.standingA?.losses ?? teamA.record.losses}
                </span>
                <span className="text-slate-600">vs</span>
                <span style={{ color: colorB }}>
                  {comparison.standingB?.wins ?? teamB.record.wins}-{comparison.standingB?.losses ?? teamB.record.losses}
                </span>
              </div>
            </div>

            {/* Differential */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Dif. de Carreras
              </span>
              <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold">
                <span
                  style={{ color: colorA }}
                  className={
                    (comparison.standingA?.runDiff ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {(comparison.standingA?.runDiff ?? 0) >= 0 ? '+' : ''}
                  {comparison.standingA?.runDiff ?? 0}
                </span>
                <span className="text-slate-600">vs</span>
                <span
                  style={{ color: colorB }}
                  className={
                    (comparison.standingB?.runDiff ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {(comparison.standingB?.runDiff ?? 0) >= 0 ? '+' : ''}
                  {comparison.standingB?.runDiff ?? 0}
                </span>
              </div>
            </div>

            {/* AVG Colectivo */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Bateo (.AVG)
              </span>
              <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold">
                <span style={{ color: colorA }}>
                  {comparison.statsA.batting.avg.toFixed(3).replace(/^0/, '')}
                </span>
                <span className="text-slate-600">vs</span>
                <span style={{ color: colorB }}>
                  {comparison.statsB.batting.avg.toFixed(3).replace(/^0/, '')}
                </span>
              </div>
            </div>

            {/* ERA / PCL Colectivo */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Efectividad (PCL)
              </span>
              <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold">
                <span style={{ color: colorA }}>{comparison.statsA.pitching.era.toFixed(2)}</span>
                <span className="text-slate-600">vs</span>
                <span style={{ color: colorB }}>{comparison.statsB.pitching.era.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Visualization Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <button
                type="button"
                onClick={() => setViewMode('radar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'radar'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <RadarIcon className="w-3.5 h-3.5" />
                <span>Gráfico Radar Multidimensional</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('bars')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'bars'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Gráficos de Barras (Recharts)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('metrics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'metrics'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Cara a Cara Métrica a Métrica</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('h2h')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'h2h'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Serie Particular ({comparison.headToHeadGames.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('leaders')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'leaders'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Líderes Individuales</span>
              </button>
            </div>

            {/* Quick Profile Nav Links */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onSelectTeam?.(teamA.id)}
                className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Perfil {teamA.shortName}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <span className="text-slate-700">|</span>
              <button
                type="button"
                onClick={() => onSelectTeam?.(teamB.id)}
                className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Perfil {teamB.shortName}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Visualization Content Panels */}
          {viewMode === 'radar' && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <RadarIcon className="w-4 h-4 text-emerald-400" />
                    <span>Balance Multidimensional (Gráfico Radar)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Representación normalizada (0-100) en 6 ejes cruciales: Contacto (.AVG), Poder (.SLG), Efectividad (ERA invertido), Control (WHIP invertido), Dominio de Ponches (K/9) y % de Victorias (PCT).
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorA }} />
                    <span className="text-slate-200">{teamA.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorB }} />
                    <span className="text-slate-200">{teamB.name}</span>
                  </div>
                </div>
              </div>

              {/* Radar Chart */}
              <TeamRadarChart
                teamA={teamA}
                teamB={teamB}
                statsA={comparison.statsA}
                statsB={comparison.statsB}
                standingA={comparison.standingA}
                standingB={comparison.standingB}
              />

              {/* Explanatory cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <strong className="text-emerald-400 block mb-1">Eje Ofensivo</strong>
                  <p className="text-slate-400 text-[11px]">
                    Evalúa la capacidad de contacto colectivo (AVG) y la fuerza para extrabases y jonrones (SLG).
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <strong className="text-sky-400 block mb-1">Eje de Pitcheo</strong>
                  <p className="text-slate-400 text-[11px]">
                    El PCL (ERA) y WHIP están invertidos para que un área mayor en el polígono represente un pitcheo superior.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <strong className="text-amber-400 block mb-1">Eje de Victoria</strong>
                  <p className="text-slate-400 text-[11px]">
                    Mide el porcentaje acumulado de victorias de la temporada y el dominio en ponches por 9 entradas (K/9).
                  </p>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'bars' && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  <span>Comparativa en Barras Paralelas (Recharts)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compara los totales acumulados y promedios directamente entre ambos equipos con visualización de diferencias.
                </p>
              </div>

              <TeamBarComparisonChart
                teamA={teamA}
                teamB={teamB}
                statsA={comparison.statsA}
                statsB={comparison.statsB}
              />
            </div>
          )}

          {viewMode === 'metrics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Offense Metric Bars */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Estadísticas Ofensivas
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span style={{ color: colorA }}>{teamA.shortName}</span>
                    <span className="text-slate-600">vs</span>
                    <span style={{ color: colorB }}>{teamB.shortName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <StatComparisonBar
                    label="Promedio de Bateo"
                    valueA={comparison.statsA.batting.avg}
                    valueB={comparison.statsB.batting.avg}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="avg"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Porcentaje de Embasado (OBP)"
                    valueA={comparison.statsA.batting.obp}
                    valueB={comparison.statsB.batting.obp}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="avg"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Slugging (SLG)"
                    valueA={comparison.statsA.batting.slg}
                    valueB={comparison.statsB.batting.slg}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="avg"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="OPS (OBP + SLG)"
                    valueA={comparison.statsA.batting.ops}
                    valueB={comparison.statsB.batting.ops}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="avg"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Carreras Anotadas (R)"
                    valueA={comparison.statsA.batting.runs}
                    valueB={comparison.statsB.batting.runs}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Hits Conectados (H)"
                    valueA={comparison.statsA.batting.hits}
                    valueB={comparison.statsB.batting.hits}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Jonrones (HR)"
                    valueA={comparison.statsA.batting.homeRuns}
                    valueB={comparison.statsB.batting.homeRuns}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Dobles (2B)"
                    valueA={comparison.statsA.batting.doubles}
                    valueB={comparison.statsB.batting.doubles}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Boletos Recibidos (BB)"
                    valueA={comparison.statsA.batting.walks}
                    valueB={comparison.statsB.batting.walks}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Bases Robadas (BR)"
                    valueA={comparison.statsA.batting.stolenBases}
                    valueB={comparison.statsB.batting.stolenBases}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                </div>
              </div>

              {/* Pitching Metric Bars */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Estadísticas de Pitcheo
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span style={{ color: colorA }}>{teamA.shortName}</span>
                    <span className="text-slate-600">vs</span>
                    <span style={{ color: colorB }}>{teamB.shortName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <StatComparisonBar
                    label="Efectividad / PCL (ERA)"
                    valueA={comparison.statsA.pitching.era}
                    valueB={comparison.statsB.pitching.era}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="era"
                    higherIsBetter={false}
                  />
                  <StatComparisonBar
                    label="WHIP (Boletos + Hits / Inn)"
                    valueA={comparison.statsA.pitching.whip}
                    valueB={comparison.statsB.pitching.whip}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="whip"
                    higherIsBetter={false}
                  />
                  <StatComparisonBar
                    label="Ponches Propinados (SO)"
                    valueA={comparison.statsA.pitching.strikeouts}
                    valueB={comparison.statsB.pitching.strikeouts}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Ponches por 9 Inn (K/9)"
                    valueA={comparison.statsA.pitching.k9}
                    valueB={comparison.statsB.pitching.k9}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="decimal"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Boletos por 9 Inn (BB/9)"
                    valueA={comparison.statsA.pitching.bb9}
                    valueB={comparison.statsB.pitching.bb9}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="decimal"
                    higherIsBetter={false}
                  />
                  <StatComparisonBar
                    label="Juegos Salvados (SV)"
                    valueA={comparison.statsA.pitching.saves}
                    valueB={comparison.statsB.pitching.saves}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={true}
                  />
                  <StatComparisonBar
                    label="Carreras Permitidas (RA)"
                    valueA={comparison.statsA.pitching.runsAllowed}
                    valueB={comparison.statsB.pitching.runsAllowed}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={false}
                  />
                  <StatComparisonBar
                    label="Carreras Limpias (ER)"
                    valueA={comparison.statsA.pitching.earnedRuns}
                    valueB={comparison.statsB.pitching.earnedRuns}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={false}
                  />
                  <StatComparisonBar
                    label="Hits Permitidos (HA)"
                    valueA={comparison.statsA.pitching.hitsAllowed}
                    valueB={comparison.statsB.pitching.hitsAllowed}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={false}
                  />
                  <StatComparisonBar
                    label="Jonrones Permitidos (HRA)"
                    valueA={comparison.statsA.pitching.homeRunsAllowed}
                    valueB={comparison.statsB.pitching.homeRunsAllowed}
                    teamAColor={colorA}
                    teamBColor={colorB}
                    format="number"
                    higherIsBetter={false}
                  />
                </div>
              </div>
            </div>
          )}

          {viewMode === 'h2h' && (
            <HeadToHeadHistory
              awayTeam={teamA}
              homeTeam={teamB}
              games={comparison.headToHeadGames}
              onSelectGame={navigateToGame}
            />
          )}

          {viewMode === 'leaders' && (
            <TeamLeadersComparison
              awayTeam={teamA}
              homeTeam={teamB}
              awayTopBatter={comparison.topBatterA}
              homeTopBatter={comparison.topBatterB}
              awayTopPitcher={comparison.topPitcherA}
              homeTopPitcher={comparison.topPitcherB}
              onSelectPlayer={onSelectPlayer}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};
