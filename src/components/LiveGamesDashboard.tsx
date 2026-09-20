import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  BarChart2,
  Radio,
  Flame,
  Zap,
  ChevronRight,
  Shield,
  Clock,
  Award,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Swords,
} from 'lucide-react';
import { Game } from '../types/index.ts';
import { useApp } from '../context/AppContext.tsx';

interface LiveGamesDashboardProps {
  games: Game[];
  onNavigateToGame?: (gameId: string) => void;
}

type ChartMode = 'trend' | 'intensity' | 'momentum';

interface InningDataPoint {
  inningLabel: string;
  inningNumber: number;
  homeRuns: number;
  awayRuns: number;
  homeCumulative: number;
  awayCumulative: number;
  margin: number;
  totalInningRuns: number;
  intensityIndex: number;
  isHighRally: boolean;
  playsSummary: string[];
}

export const LiveGamesDashboard: React.FC<LiveGamesDashboardProps> = ({
  games,
  onNavigateToGame,
}) => {
  const { theme, openGameComparison } = useApp();
  const isDark = theme === 'dark';

  // Chart styling based on theme
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#64748b' : '#94a3b8';

  // Filter live games or fallback to active/recent games
  const liveGames = useMemo(() => games.filter((g) => g.status === 'LIVE'), [games]);
  const displayableGames = useMemo(() => {
    if (liveGames.length > 0) return liveGames;
    // Fallback: games with lineScore that have been played
    return games.filter((g) => g.lineScore && g.lineScore.length > 0);
  }, [liveGames, games]);

  // Selected game ID state
  const [selectedGameId, setSelectedGameId] = useState<string>(() => {
    return displayableGames[0]?.id || '';
  });

  // Current selected game
  const selectedGame = useMemo(() => {
    return (
      displayableGames.find((g) => g.id === selectedGameId) ||
      displayableGames[0] ||
      null
    );
  }, [displayableGames, selectedGameId]);

  // Visualization mode
  const [chartMode, setChartMode] = useState<ChartMode>('trend');

  // Process data for the selected game
  const chartData = useMemo<InningDataPoint[]>(() => {
    if (!selectedGame || !selectedGame.lineScore || selectedGame.lineScore.length === 0) {
      return [];
    }

    const homeTeamShort = selectedGame.homeTeam.shortName;
    const awayTeamShort = selectedGame.awayTeam.shortName;
    const plays = selectedGame.plays || [];

    let homeCumulative = 0;
    let awayCumulative = 0;

    const points: InningDataPoint[] = [];

    // Filter innings that have started or completed
    selectedGame.lineScore.forEach((item) => {
      // Only include innings that have non-null score or are within current inning
      const hasAwayScore = item.away !== null;
      const hasHomeScore = item.home !== null;

      if (hasAwayScore || hasHomeScore || (selectedGame.currentInning && item.inning <= selectedGame.currentInning)) {
        const awayRuns = item.away ?? 0;
        const homeRuns = item.home ?? 0;

        awayCumulative += awayRuns;
        homeCumulative += homeRuns;

        const totalInningRuns = awayRuns + homeRuns;
        const margin = homeCumulative - awayCumulative;

        // Inning plays summary
        const inningPlays = plays
          .filter((p) => p.inning === item.inning && p.isScoringPlay)
          .map((p) => p.description);

        // Activity intensity index: runs + scoring plays weight
        // Base value 15 (defensive/batting action), +25 for each run, +10 for scoring hits
        const intensityIndex = Math.min(
          100,
          15 + totalInningRuns * 28 + inningPlays.length * 12
        );

        points.push({
          inningLabel: `E${item.inning}`,
          inningNumber: item.inning,
          homeRuns,
          awayRuns,
          homeCumulative,
          awayCumulative,
          margin,
          totalInningRuns,
          intensityIndex,
          isHighRally: totalInningRuns >= 2,
          playsSummary: inningPlays,
        });
      }
    });

    return points;
  }, [selectedGame]);

  // Derived metrics for game intensity
  const metrics = useMemo(() => {
    if (!selectedGame || chartData.length === 0) {
      return {
        runPace: '0.0',
        scoringInningsPct: 0,
        biggestRally: { runs: 0, inning: '-' },
        leadChanges: 0,
        totalRuns: 0,
      };
    }

    const totalRuns = selectedGame.homeScore + selectedGame.awayScore;
    const inningsPlayed = Math.max(1, chartData.length);
    const pace = ((totalRuns / inningsPlayed) * 9).toFixed(1);

    const scoringInningsCount = chartData.filter((p) => p.totalInningRuns > 0).length;
    const scoringInningsPct = Math.round((scoringInningsCount / inningsPlayed) * 100);

    let maxRuns = 0;
    let maxInning = '-';
    chartData.forEach((p) => {
      if (p.totalInningRuns > maxRuns) {
        maxRuns = p.totalInningRuns;
        maxInning = `Entrada ${p.inningNumber}`;
      }
    });

    // Calculate lead changes
    let leadChanges = 0;
    let lastLeader: 'home' | 'away' | 'tie' = 'tie';
    chartData.forEach((p) => {
      const currentLeader: 'home' | 'away' | 'tie' =
        p.homeCumulative > p.awayCumulative
          ? 'home'
          : p.awayCumulative > p.homeCumulative
          ? 'away'
          : 'tie';

      if (lastLeader !== 'tie' && currentLeader !== 'tie' && currentLeader !== lastLeader) {
        leadChanges++;
      }
      lastLeader = currentLeader;
    });

    return {
      runPace: pace,
      scoringInningsPct,
      biggestRally: { runs: maxRuns, inning: maxInning },
      leadChanges,
      totalRuns,
    };
  }, [selectedGame, chartData]);

  if (!selectedGame) {
    return null;
  }

  // Team colors
  const homeColor = selectedGame.homeTeam.colors?.primary || '#10b981';
  const awayColor = selectedGame.awayTeam.colors?.primary || '#3b82f6';

  return (
    <div
      id="live-games-dashboard"
      className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden transition-all text-slate-100"
    >
      {/* 1. Header Bar with Live Indicator & Game Switcher */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <Radio className="w-5 h-5 animate-pulse text-red-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                Panel de Tendencia y Dinámica en Vivo
              </h2>
              {selectedGame.status === 'LIVE' ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  EN VIVO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold border border-slate-700">
                  {selectedGame.status === 'FINAL' ? 'FINALIZADO' : selectedGame.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualización con Recharts del flujo de carreras acumuladas, intensidad de ofensiva y momentum entrada por entrada.
            </p>
          </div>
        </div>

        {/* Live Match Picker Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 hidden lg:inline">
            Partido:
          </span>
          {displayableGames.map((g) => {
            const isSelected = g.id === selectedGame.id;
            const isLive = g.status === 'LIVE';

            return (
              <button
                key={g.id}
                id={`game-tab-${g.id}`}
                onClick={() => setSelectedGameId(g.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                }`}
              >
                {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                <span className="font-mono text-xs">
                  {g.awayTeam.shortName} {g.awayScore} - {g.homeScore} {g.homeTeam.shortName}
                </span>
                {isLive && g.currentInning && (
                  <span className="text-[10px] text-red-400 font-mono">
                    {g.currentInning}ª {g.isTopInning ? '▲' : '▼'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Matchup Overview Banner */}
      <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Teams and Current Score */}
        <div className="flex items-center justify-around md:justify-start w-full md:w-auto gap-6 sm:gap-10">
          {/* Away Team */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl sm:text-4xl select-none">{selectedGame.awayTeam.logo}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white text-base sm:text-lg">
                  {selectedGame.awayTeam.name}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ({selectedGame.awayTeam.shortName})
                </span>
              </div>
              <span className="text-xs text-slate-400">Visitante</span>
            </div>
            <span className="font-mono text-3xl sm:text-4xl font-black text-white ml-2">
              {selectedGame.awayScore}
            </span>
          </div>

          <span className="text-slate-600 font-black text-xl select-none">VS</span>

          {/* Home Team */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-3xl sm:text-4xl font-black text-white mr-2">
              {selectedGame.homeScore}
            </span>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-black text-white text-base sm:text-lg">
                  {selectedGame.homeTeam.name}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ({selectedGame.homeTeam.shortName})
                </span>
              </div>
              <span className="text-xs text-slate-400">Home Club</span>
            </div>
            <span className="text-3xl sm:text-4xl select-none">{selectedGame.homeTeam.logo}</span>
          </div>
        </div>

        {/* Live Inning State & Boxscore Link */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono flex items-center gap-3">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Entrada</span>
              <span className="font-bold text-slate-200">
                {selectedGame.currentInning ? `${selectedGame.currentInning}ª Entrada` : 'Juego Completo'}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Outs</span>
              <span className="font-bold text-amber-400">{selectedGame.outs ?? 0}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Hits / Errores</span>
              <span className="font-bold text-slate-300">
                {selectedGame.awayHits + selectedGame.homeHits}H • {selectedGame.awayErrors + selectedGame.homeErrors}E
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="dashboard-compare-teams-btn"
              onClick={() => openGameComparison(selectedGame.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-750 text-xs font-bold text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm"
              title="Comparar estadísticas de temporada cara a cara entre estos dos equipos"
            >
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>Comparar Equipos</span>
            </button>

            {onNavigateToGame && (
              <button
                id="dashboard-open-game-btn"
                onClick={() => onNavigateToGame(selectedGame.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-bold text-emerald-400 transition-all cursor-pointer"
              >
                <span>Ver Box Score</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Interactive Chart Controls & View Tabs */}
      <div className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Chart Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-auto">
            <button
              id="chart-mode-trend-btn"
              onClick={() => setChartMode('trend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'trend'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Evolución Acumulada</span>
            </button>

            <button
              id="chart-mode-intensity-btn"
              onClick={() => setChartMode('intensity')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'intensity'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Intensidad por Entrada</span>
            </button>

            <button
              id="chart-mode-momentum-btn"
              onClick={() => setChartMode('momentum')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'momentum'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Margen y Dominio</span>
            </button>
          </div>

          {/* Visual Legend */}
          <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: awayColor }}
              />
              <span>
                {selectedGame.awayTeam.shortName} ({selectedGame.awayScore})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: homeColor }}
              />
              <span>
                {selectedGame.homeTeam.shortName} ({selectedGame.homeScore})
              </span>
            </div>
            {chartMode === 'intensity' && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Índice de Peligro</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. The Recharts Canvas Container */}
        <div className="h-72 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No hay suficientes entradas registradas para graficar este encuentro.
            </div>
          ) : chartMode === 'trend' ? (
            /* Mode 1: Cumulative Runs Progression (AreaChart) */
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="awayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={awayColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={awayColor} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={homeColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={homeColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="inningLabel"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as InningDataPoint;
                      return (
                        <div className="rounded-xl bg-slate-950/95 border border-slate-700 p-3 shadow-2xl text-xs space-y-1.5 min-w-[200px]">
                          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>Entrada {data.inningNumber}</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              +{data.totalInningRuns} en la entrada
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: awayColor }} />
                              {selectedGame.awayTeam.name}:
                            </span>
                            <span className="font-mono font-bold text-white">
                              {data.awayCumulative} (+{data.awayRuns})
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: homeColor }} />
                              {selectedGame.homeTeam.name}:
                            </span>
                            <span className="font-mono font-bold text-white">
                              {data.homeCumulative} (+{data.homeRuns})
                            </span>
                          </div>
                          {data.playsSummary.length > 0 && (
                            <div className="pt-1 mt-1 border-t border-slate-800 text-[11px] text-amber-300/90 italic">
                              ⚾ {data.playsSummary[0]}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="awayCumulative"
                  name={selectedGame.awayTeam.shortName}
                  stroke={awayColor}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#awayGrad)"
                  activeDot={{ r: 6, fill: awayColor, stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="homeCumulative"
                  name={selectedGame.homeTeam.shortName}
                  stroke={homeColor}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#homeGrad)"
                  activeDot={{ r: 6, fill: homeColor, stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : chartMode === 'intensity' ? (
            /* Mode 2: Inning Runs & Attack Intensity (ComposedChart) */
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="inningLabel"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  allowDecimals={false}
                  label={{
                    value: 'Carreras',
                    angle: -90,
                    position: 'insideLeft',
                    fill: axisColor,
                    fontSize: 11,
                    offset: 15,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={axisColor}
                  domain={[0, 100]}
                  tick={{ fill: axisColor, fontSize: 10 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  label={{
                    value: 'Índice Ofensivo',
                    angle: 90,
                    position: 'insideRight',
                    fill: '#f59e0b',
                    fontSize: 10,
                    offset: 10,
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as InningDataPoint;
                      return (
                        <div className="rounded-xl bg-slate-950/95 border border-slate-700 p-3 shadow-2xl text-xs space-y-1.5 min-w-[200px]">
                          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>Entrada {data.inningNumber}</span>
                            {data.isHighRally && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                                🔥 RALLY
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">{selectedGame.awayTeam.shortName}:</span>
                            <span className="font-mono font-bold text-white">{data.awayRuns} carreras</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">{selectedGame.homeTeam.shortName}:</span>
                            <span className="font-mono font-bold text-white">{data.homeRuns} carreras</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-amber-400 font-semibold">
                            <span>Índice de Peligro:</span>
                            <span className="font-mono">{data.intensityIndex} / 100</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="awayRuns"
                  name={selectedGame.awayTeam.shortName}
                  fill={awayColor}
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Bar
                  yAxisId="left"
                  dataKey="homeRuns"
                  name={selectedGame.homeTeam.shortName}
                  fill={homeColor}
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="intensityIndex"
                  name="Índice de Peligro"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f59e0b' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            /* Mode 3: Lead Margin & Momentum (Differential AreaChart) */
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={homeColor} stopOpacity={0.4} />
                    <stop offset="50%" stopColor="#94a3b8" stopOpacity={0.1} />
                    <stop offset="95%" stopColor={awayColor} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="inningLabel"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  allowDecimals={false}
                  label={{
                    value: `Ventaja (${selectedGame.homeTeam.shortName} > 0)`,
                    angle: -90,
                    position: 'insideLeft',
                    fill: axisColor,
                    fontSize: 10,
                    offset: 15,
                  }}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Empate', fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as InningDataPoint;
                      const leader =
                        data.margin > 0
                          ? `${selectedGame.homeTeam.shortName} +${data.margin}`
                          : data.margin < 0
                          ? `${selectedGame.awayTeam.shortName} +${Math.abs(data.margin)}`
                          : 'Empate';

                      return (
                        <div className="rounded-xl bg-slate-950/95 border border-slate-700 p-3 shadow-2xl text-xs space-y-1 min-w-[180px]">
                          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                            Fin de Entrada {data.inningNumber}
                          </div>
                          <div className="text-slate-300">
                            Marcador: {selectedGame.awayTeam.shortName} {data.awayCumulative} - {data.homeCumulative} {selectedGame.homeTeam.shortName}
                          </div>
                          <div className="font-mono font-bold text-emerald-400 pt-0.5">
                            Dominio: {leader}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="margin"
                  name="Diferencial"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  fill="url(#marginGrad)"
                  activeDot={{ r: 6, fill: '#38bdf8' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 5. Key Activity Intensity Metrics KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Ritmo Proyectado
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-lg font-black text-white">{metrics.runPace}</span>
              <span className="text-[11px] text-slate-500">carreras / 9 inn</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Frecuencia Anotadora
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-lg font-black text-emerald-400">
                {metrics.scoringInningsPct}%
              </span>
              <span className="text-[11px] text-slate-500">entradas c/ carrera</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Mayor Rally Ofensivo
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-lg font-black text-amber-400">
                {metrics.biggestRally.runs} C
              </span>
              <span className="text-[11px] text-slate-500">({metrics.biggestRally.inning})</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Cambios de Liderato
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-lg font-black text-sky-400">
                {metrics.leadChanges}
              </span>
              <span className="text-[11px] text-slate-500">alternancias</span>
            </div>
          </div>
        </div>

        {/* 6. Recent Key Plays Ticker */}
        {selectedGame.plays && selectedGame.plays.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Jugadas Decisivas de Anotación en este Partido
              </span>
              <span className="text-[11px] text-slate-500">
                {selectedGame.plays.filter((p) => p.isScoringPlay).length} jugadas clave
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              {selectedGame.plays
                .filter((p) => p.isScoringPlay)
                .slice(0, 4)
                .map((play) => (
                  <div
                    key={play.id}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 min-w-[240px] max-w-[280px] shrink-0 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                        {play.inning}ª {play.isTop ? '▲' : '▼'}
                      </span>
                      <span className="font-mono text-slate-400 font-bold">{play.scoreAfter}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed">
                      {play.description}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
