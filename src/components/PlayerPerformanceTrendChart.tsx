import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  Award,
  Calendar,
  BarChart2,
  ChevronRight,
  Shield,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Player, PlayerGameLogItem, BattingStats, PitchingStats } from '../types/index.ts';

interface PlayerPerformanceTrendChartProps {
  player: Player;
  recentGames?: PlayerGameLogItem[];
  batting?: BattingStats;
  pitching?: PitchingStats;
  isPitcher: boolean;
  className?: string;
  showDetailsList?: boolean;
}

export const PlayerPerformanceTrendChart: React.FC<PlayerPerformanceTrendChartProps> = ({
  player,
  recentGames,
  batting,
  pitching,
  isPitcher,
  className = '',
  showDetailsList = true,
}) => {
  const [selectedView, setSelectedView] = useState<'trend' | 'breakdown'>('trend');
  const [selectedGameIndex, setSelectedGameIndex] = useState<number | null>(null);

  // Fallback generator to guarantee 10 games if none provided
  const games: PlayerGameLogItem[] = useMemo(() => {
    if (recentGames && recentGames.length > 0) {
      return recentGames.slice(0, 10).map((g, idx) => ({
        ...g,
        gameNumber: idx + 1,
      }));
    }

    // Client-side fallback generation consistent with player profile
    const limit = 10;
    let seed = 0;
    for (let i = 0; i < player.id.length; i++) {
      seed = (seed * 31 + player.id.charCodeAt(i)) >>> 0;
    }
    const pseudoRand = (offset: number) => {
      const x = Math.sin(seed + offset * 7919) * 10000;
      return x - Math.floor(x);
    };

    const oppShorts = ['IND', 'MTZ', 'PRI', 'LTU', 'SCU', 'GRA', 'VCL', 'CAV'];
    const oppNames: Record<string, string> = {
      IND: 'Industriales',
      MTZ: 'Matanzas',
      PRI: 'Pinar del Río',
      LTU: 'Las Tunas',
      SCU: 'Santiago de Cuba',
      GRA: 'Granma',
      VCL: 'Villa Clara',
      CAV: 'Ciego de Ávila',
    };

    const targetAvg = batting?.avg ?? 0.320;
    const targetEra = pitching?.era ?? (isPitcher ? 2.85 : 3.50);

    const generated: PlayerGameLogItem[] = [];

    if (!isPitcher) {
      let runHits = Math.round(targetAvg * 32);
      let runAb = 32;

      for (let i = 0; i < limit; i++) {
        const r1 = pseudoRand(i * 3 + 1);
        const r2 = pseudoRand(i * 3 + 2);
        const r3 = pseudoRand(i * 3 + 3);

        const filteredOpps = oppShorts.filter((s) => s !== player.teamShort);
        const oppShort = filteredOpps[Math.floor(r1 * filteredOpps.length)] || 'IND';
        const isHome = r2 > 0.45;
        const result: 'W' | 'L' = r3 > 0.4 ? 'W' : 'L';
        const teamScore = result === 'W' ? 4 + Math.floor(r1 * 5) : 1 + Math.floor(r1 * 3);
        const oppScore = result === 'W' ? Math.max(0, teamScore - (1 + Math.floor(r2 * 3))) : teamScore + 1 + Math.floor(r2 * 3);

        const ab = 3 + (r1 > 0.7 ? 1 : 0) + (r2 > 0.85 ? 1 : 0);
        let h = 0;
        const hitProb = targetAvg * 1.05;
        if (r3 < hitProb * 0.35) h = 2;
        else if (r3 < hitProb * 0.85) h = 1;
        else if (r3 < hitProb * 0.98) h = 3;
        else h = 0;
        h = Math.min(h, ab);

        const r = h > 0 ? (r1 > 0.5 ? 1 : r1 > 0.85 ? 2 : 0) : 0;
        const hr = (batting?.hr || 0) > 3 ? (r2 > 0.78 && h > 0 ? 1 : 0) : 0;
        const doubles = hr === 0 && h > 1 ? 1 : (r3 > 0.7 && h > 0 ? 1 : 0);
        const rbi = hr > 0 ? 1 + (r1 > 0.5 ? 1 : 0) : (h > 0 && r2 > 0.4 ? 1 + (r3 > 0.8 ? 1 : 0) : 0);
        const bb = r1 > 0.65 ? 1 : (r2 > 0.9 ? 2 : 0);
        const so = r3 > 0.55 ? 1 : 0;

        runHits += h;
        runAb += ab;
        const rollingAvg = Number((runHits / runAb).toFixed(3));
        const gameAvg = ab > 0 ? Number((h / ab).toFixed(3)) : 0;

        const day = 10 + i;
        const dateStr = `2026-09-${day < 10 ? '0' + day : day}`;

        generated.push({
          id: `gl_local_${player.id}_${i + 1}`,
          gameId: `g_loc_${i + 1}`,
          gameNumber: i + 1,
          date: dateStr,
          formattedDate: `${day} Sep`,
          opponentId: oppShort.toLowerCase(),
          opponentShort: oppShort,
          opponentName: oppNames[oppShort] || oppShort,
          isHome,
          score: `${teamScore}-${oppScore}`,
          teamScore,
          opponentScore: oppScore,
          result,
          ab,
          h,
          r,
          doubles,
          triples: 0,
          hr,
          rbi,
          bb,
          so,
          sb: r1 > 0.8 ? 1 : 0,
          gameAvg,
          rollingAvg,
          rollingOps: Number((rollingAvg + 0.52).toFixed(3)),
        });
      }
    } else {
      let runEr = Math.round((targetEra * 42) / 9);
      let runIp = 42.0;

      for (let i = 0; i < limit; i++) {
        const r1 = pseudoRand(i * 4 + 1);
        const r2 = pseudoRand(i * 4 + 2);
        const r3 = pseudoRand(i * 4 + 3);

        const filteredOpps = oppShorts.filter((s) => s !== player.teamShort);
        const oppShort = filteredOpps[Math.floor(r1 * filteredOpps.length)] || 'IND';
        const isHome = r2 > 0.48;
        const result: 'W' | 'L' = r3 > 0.35 ? 'W' : 'L';
        const teamScore = result === 'W' ? 4 + Math.floor(r1 * 4) : 1 + Math.floor(r1 * 3);
        const oppScore = result === 'W' ? Math.max(0, teamScore - (1 + Math.floor(r2 * 3))) : teamScore + 1 + Math.floor(r2 * 2);

        const isReliever = player.position === 'RP';
        const ipDecimal = isReliever ? 1.0 + (r1 > 0.5 ? 0.33 : r1 > 0.8 ? 0.67 : 0) : 5.0 + Math.floor(r1 * 3) + (r2 > 0.5 ? 0.33 : 0);
        let er = 0;
        if (targetEra < 2.0) {
          er = r3 > 0.7 ? 1 : r3 > 0.9 ? 2 : 0;
        } else if (targetEra < 3.5) {
          er = r3 > 0.5 ? 1 : r3 > 0.8 ? 2 : r3 > 0.95 ? 3 : 0;
        } else {
          er = r3 > 0.35 ? 1 : r3 > 0.65 ? 2 : r3 > 0.85 ? 3 : 0;
        }

        const hAllowed = er + Math.floor(r2 * 4);
        const bbPitcher = Math.floor(r1 * 3);
        const soPitcher = isReliever ? 1 + Math.floor(r3 * 3) : 4 + Math.floor(r3 * 6);

        let decision: 'W' | 'L' | 'S' | 'ND' = 'ND';
        if (isReliever) {
          if (result === 'W' && r2 > 0.5) decision = 'S';
          else if (result === 'W' && r1 > 0.7) decision = 'W';
          else if (result === 'L' && er > 1) decision = 'L';
        } else {
          if (result === 'W' && ipDecimal >= 5.0) decision = 'W';
          else if (result === 'L') decision = 'L';
        }

        runEr += er;
        runIp += ipDecimal;
        const rollingEra = Number(((runEr * 9) / runIp).toFixed(2));
        const gameEra = Number(((er * 9) / Math.max(ipDecimal, 0.33)).toFixed(2));

        const day = 10 + i;
        const dateStr = `2026-09-${day < 10 ? '0' + day : day}`;

        const ipWhole = Math.floor(ipDecimal);
        const ipFrac = ipDecimal - ipWhole;
        const ipString = ipFrac > 0.6 ? `${ipWhole}.2` : ipFrac > 0.3 ? `${ipWhole}.1` : `${ipWhole}.0`;

        generated.push({
          id: `gl_local_${player.id}_${i + 1}`,
          gameId: `g_loc_${i + 1}`,
          gameNumber: i + 1,
          date: dateStr,
          formattedDate: `${day} Sep`,
          opponentId: oppShort.toLowerCase(),
          opponentShort: oppShort,
          opponentName: oppNames[oppShort] || oppShort,
          isHome,
          score: `${teamScore}-${oppScore}`,
          teamScore,
          opponentScore: oppScore,
          result,
          decision,
          ip: ipString,
          ipDecimal: Number(ipDecimal.toFixed(2)),
          er,
          rAllowed: er + (r1 > 0.7 ? 1 : 0),
          hAllowed,
          bbPitcher,
          soPitcher,
          hrAllowed: er > 0 && r2 > 0.6 ? 1 : 0,
          gameEra,
          rollingEra,
          rollingWhip: Number(((bbPitcher + hAllowed) / ipDecimal).toFixed(2)),
        });
      }
    }

    return generated;
  }, [recentGames, player, isPitcher, batting, pitching]);

  // Aggregate stats across the last 10 games
  const summary = useMemo(() => {
    if (!isPitcher) {
      const totalAb = games.reduce((sum, g) => sum + (g.ab || 0), 0);
      const totalH = games.reduce((sum, g) => sum + (g.h || 0), 0);
      const totalHr = games.reduce((sum, g) => sum + (g.hr || 0), 0);
      const totalRbi = games.reduce((sum, g) => sum + (g.rbi || 0), 0);
      const totalBb = games.reduce((sum, g) => sum + (g.bb || 0), 0);
      const totalR = games.reduce((sum, g) => sum + (g.r || 0), 0);
      const l10Avg = totalAb > 0 ? Number((totalH / totalAb).toFixed(3)) : 0;
      const seasonAvg = batting?.avg ?? l10Avg;
      const diff = Number((l10Avg - seasonAvg).toFixed(3));

      // Calculate current hit streak in last games
      let hitStreak = 0;
      for (let i = games.length - 1; i >= 0; i--) {
        if ((games[i].h || 0) > 0) hitStreak++;
        else break;
      }

      return {
        totalAb,
        totalH,
        totalHr,
        totalRbi,
        totalBb,
        totalR,
        l10Metric: l10Avg,
        l10MetricLabel: 'AVG (Últimos 10 JJ)',
        formattedL10Metric: l10Avg.toFixed(3),
        seasonMetric: seasonAvg,
        formattedSeasonMetric: seasonAvg.toFixed(3),
        diff,
        isPositive: diff >= 0,
        hitStreak,
      };
    } else {
      const totalIp = games.reduce((sum, g) => sum + (g.ipDecimal || 0), 0);
      const totalEr = games.reduce((sum, g) => sum + (g.er || 0), 0);
      const totalSo = games.reduce((sum, g) => sum + (g.soPitcher || 0), 0);
      const totalBb = games.reduce((sum, g) => sum + (g.bbPitcher || 0), 0);
      const wins = games.filter((g) => g.decision === 'W').length;
      const losses = games.filter((g) => g.decision === 'L').length;
      const saves = games.filter((g) => g.decision === 'S').length;
      const l10Era = totalIp > 0 ? Number(((totalEr * 9) / totalIp).toFixed(2)) : 0;
      const seasonEra = pitching?.era ?? l10Era;
      const diff = Number((l10Era - seasonEra).toFixed(2));

      return {
        totalIp: Number(totalIp.toFixed(1)),
        totalEr,
        totalSo,
        totalBb,
        wins,
        losses,
        saves,
        l10Metric: l10Era,
        l10MetricLabel: 'PCL / ERA (Últimos 10 JJ)',
        formattedL10Metric: l10Era.toFixed(2),
        seasonMetric: seasonEra,
        formattedSeasonMetric: seasonEra.toFixed(2),
        diff,
        isPositive: diff <= 0, // Lower ERA is better for pitchers
      };
    }
  }, [games, isPitcher, batting, pitching]);

  // Chart data formatting
  const chartData = useMemo(() => {
    return games.map((g) => {
      const label = `J${g.gameNumber} vs ${g.opponentShort}`;
      if (!isPitcher) {
        return {
          id: g.id,
          gameNumber: g.gameNumber,
          label,
          shortLabel: `J${g.gameNumber}`,
          date: g.formattedDate,
          opponent: g.opponentShort,
          opponentName: g.opponentName,
          result: g.result,
          score: g.score,
          isHome: g.isHome,
          // Batting values
          rollingAvg: g.rollingAvg,
          gameAvg: g.gameAvg ?? (g.ab ? Number(((g.h || 0) / g.ab).toFixed(3)) : 0),
          h: g.h || 0,
          ab: g.ab || 0,
          hr: g.hr || 0,
          rbi: g.rbi || 0,
          bb: g.bb || 0,
          so: g.so || 0,
          seasonBaseline: summary.seasonMetric,
        };
      } else {
        return {
          id: g.id,
          gameNumber: g.gameNumber,
          label,
          shortLabel: `J${g.gameNumber}`,
          date: g.formattedDate,
          opponent: g.opponentShort,
          opponentName: g.opponentName,
          result: g.result,
          score: g.score,
          isHome: g.isHome,
          decision: g.decision,
          // Pitching values
          rollingEra: g.rollingEra,
          gameEra: g.gameEra,
          ip: g.ip,
          ipDecimal: g.ipDecimal,
          er: g.er || 0,
          so: g.soPitcher || 0,
          bb: g.bbPitcher || 0,
          seasonBaseline: summary.seasonMetric,
        };
      }
    });
  }, [games, isPitcher, summary.seasonMetric]);

  // Y-axis domains
  const yDomain = useMemo(() => {
    if (!isPitcher) {
      const avgs = chartData.map((d: any) => d.rollingAvg);
      const min = Math.max(0.1, Math.min(...avgs, summary.seasonMetric) - 0.03);
      const max = Math.min(0.5, Math.max(...avgs, summary.seasonMetric) + 0.03);
      return [Number(min.toFixed(3)), Number(max.toFixed(3))];
    } else {
      const eras = chartData.map((d: any) => d.rollingEra);
      const min = Math.max(0, Math.min(...eras, summary.seasonMetric) - 0.5);
      const max = Math.max(...eras, summary.seasonMetric) + 0.8;
      return [Number(min.toFixed(2)), Number(max.toFixed(2))];
    }
  }, [chartData, isPitcher, summary.seasonMetric]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[200px] text-xs space-y-2 z-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-emerald-400">
                Juego {data.gameNumber}
              </span>
              <span>{data.isHome ? 'vs' : '@'} {data.opponentName || data.opponent}</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                data.result === 'W'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {data.result === 'W' ? 'Victoria' : 'Derrota'} ({data.score})
            </span>
          </div>

          <div className="text-[11px] text-slate-300">
            <span className="text-slate-500 block text-[10px]">Fecha: {data.date}</span>
            {!isPitcher ? (
              <div className="mt-1 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Labor en el juego:</span>
                  <span className="font-bold font-mono text-white">
                    {data.h} H en {data.ab} VB
                    {data.hr > 0 && ` (${data.hr} HR)`}
                    {data.rbi > 0 && ` • ${data.rbi} CI`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">AVG del partido:</span>
                  <span className="font-mono text-slate-200">
                    {Number(data.gameAvg).toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    AVG Acumulado:
                  </span>
                  <span className="font-black text-sm font-mono text-emerald-300">
                    {Number(data.rollingAvg).toFixed(3)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-1 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Labor en la salida:</span>
                  <span className="font-bold font-mono text-white">
                    {data.ip} IP, {data.er} CL, {data.so} K
                    {data.decision && data.decision !== 'ND' && ` (${data.decision})`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">PCL del partido:</span>
                  <span className="font-mono text-slate-200">
                    {Number(data.gameEra).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="font-bold text-sky-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    PCL Progresivo:
                  </span>
                  <span className="font-black text-sm font-mono text-sky-300">
                    {Number(data.rollingEra).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const primaryColor = isPitcher ? '#38bdf8' : '#10b981';
  const gradientId = isPitcher ? 'pitcherEraGradient' : 'batterAvgGradient';

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-5 shadow-xl space-y-4 ${className}`}
    >
      {/* Component Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
              isPitcher
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            {isPitcher ? <Activity className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-black text-white tracking-wide">
                Tendencia de Rendimiento ({isPitcher ? 'PCL / ERA' : 'Promedio AVG'})
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300">
                Últimos 10 Juegos
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isPitcher
                ? `Curva de efectividad progresiva a lo largo de las últimas 10 aperturas o relevos oficiales.`
                : `Evolución del promedio de bateo juego a juego con respecto a la media de la temporada.`}
            </p>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setSelectedView('trend')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedView === 'trend'
                ? isPitcher
                  ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold'
                  : 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{isPitcher ? 'Curva de PCL' : 'Curva de AVG'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedView('breakdown')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedView === 'breakdown'
                ? isPitcher
                  ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold'
                  : 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>{isPitcher ? 'K & Entradas' : 'Hits & Turnos'}</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Highlight Cards (L10 Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Metric 1: L10 Metric Value */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 relative overflow-hidden group">
          <div
            className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-xl opacity-20 pointer-events-none ${
              isPitcher ? 'bg-sky-500' : 'bg-emerald-500'
            }`}
          />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            {summary.l10MetricLabel}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-black font-mono tracking-tight ${
                isPitcher ? 'text-sky-400' : 'text-emerald-400'
              }`}
            >
              {summary.formattedL10Metric}
            </span>
            <span
              className={`text-[11px] font-bold font-mono flex items-center gap-0.5 ${
                summary.isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
              title="Comparación con la media global de la temporada"
            >
              {summary.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {summary.diff > 0 ? `+${summary.diff}` : summary.diff}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Temporada: {summary.formattedSeasonMetric}
          </span>
        </div>

        {/* Metric 2: Primary Counting Stats */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            {!isPitcher ? 'Producción de Hits' : 'Entradas Lanzadas'}
          </span>
          <div className="mt-1">
            <span className="text-xl font-black font-mono text-white">
              {!isPitcher ? `${summary.totalH} H / ${summary.totalAb} VB` : `${summary.totalIp} IP`}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {!isPitcher
              ? `${summary.totalR} carreras anotadas`
              : `${summary.totalEr} carreras limpias permitidas`}
          </span>
        </div>

        {/* Metric 3: Power / Strikeouts */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            {!isPitcher ? 'Extrabases & CI' : 'Ponches Recientes'}
          </span>
          <div className="mt-1">
            <span className="text-xl font-black font-mono text-amber-400">
              {!isPitcher ? `${summary.totalHr} HR • ${summary.totalRbi} CI` : `${summary.totalSo} Ponches`}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {!isPitcher
              ? `${summary.totalBb} boletos recibidos`
              : `${summary.totalBb} bases por bolas otorgadas`}
          </span>
        </div>

        {/* Metric 4: Streak / Record */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            {!isPitcher ? 'Racha de Bateo' : 'Balance G - P (L10)'}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            {!isPitcher ? (
              <>
                <Flame
                  className={`w-4 h-4 ${
                    (summary.hitStreak || 0) > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'
                  }`}
                />
                <span className="text-xl font-black font-mono text-white">
                  {(summary.hitStreak || 0) > 0 ? `${summary.hitStreak} juegos` : 'Sin racha activa'}
                </span>
              </>
            ) : (
              <span className="text-xl font-black font-mono text-white">
                {summary.wins}G - {summary.losses}P
                {(summary.saves || 0) > 0 && ` • ${summary.saves}S`}
              </span>
            )}
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
            {!isPitcher
              ? (summary.hitStreak || 0) >= 3
                ? '🔥 Bateador en racha caliente'
                : 'Rendimiento en curso'
              : summary.isPositive
              ? '💎 Dominio desde la lomita'
              : 'En rotación regular'}
          </span>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="p-3 sm:p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="font-bold text-slate-200">
              {selectedView === 'trend'
                ? isPitcher
                  ? 'Efectividad Progresiva (PCL / ERA) por Juego'
                  : 'Promedio de Bateo Acumulado (AVG) por Juego'
                : isPitcher
                ? 'Ponches (SO) y Entradas por Salida'
                : 'Hits (H) y Turnos Oficiales (VB) por Juego'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-500 inline-block border-t border-dashed" />
              <span>Media Temporada ({summary.formattedSeasonMetric})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: primaryColor }}
              />
              <span>Rendimiento L10 ({summary.formattedL10Metric})</span>
            </span>
          </div>
        </div>

        {/* Recharts Chart */}
        <div className="h-64 sm:h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {selectedView === 'trend' ? (
              <AreaChart
                data={chartData}
                margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
                onMouseMove={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined) {
                    setSelectedGameIndex(e.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => setSelectedGameIndex(null)}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  domain={yDomain}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => (!isPitcher ? val.toFixed(3) : val.toFixed(2))}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={summary.seasonMetric}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Media Temporada: ${summary.formattedSeasonMetric}`,
                    position: 'insideTopLeft',
                    fill: '#94a3b8',
                    fontSize: 10,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={!isPitcher ? 'rollingAvg' : 'rollingEra'}
                  name={!isPitcher ? 'Promedio Progresivo' : 'Efectividad Progresiva'}
                  stroke={primaryColor}
                  strokeWidth={3}
                  fill={`url(#${gradientId})`}
                  dot={{
                    fill: '#0f172a',
                    stroke: primaryColor,
                    strokeWidth: 2.5,
                    r: 4.5,
                  }}
                  activeDot={{
                    fill: primaryColor,
                    stroke: '#ffffff',
                    strokeWidth: 2,
                    r: 7,
                  }}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
                onMouseMove={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined) {
                    setSelectedGameIndex(e.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => setSelectedGameIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  iconSize={10}
                />
                {!isPitcher ? (
                  <>
                    <Bar
                      dataKey="ab"
                      name="Turnos al Bate (VB)"
                      fill="#334155"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="h"
                      name="Hits Conectados (H)"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </>
                ) : (
                  <>
                    <Bar
                      dataKey="ipDecimal"
                      name="Entradas (IP)"
                      fill="#334155"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="so"
                      name="Ponches Recetados (K)"
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                    />
                  </>
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 10-Game Chronological Ribbon / Breakdown Strip */}
      {showDetailsList && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Secuencia de los Últimos 10 Juegos
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Cronología: {games[0]?.formattedDate} → {games[games.length - 1]?.formattedDate}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {chartData.map((g: any, idx: number) => {
              const isSelected = selectedGameIndex === idx;
              return (
                <div
                  key={g.id || idx}
                  onMouseEnter={() => setSelectedGameIndex(idx)}
                  onMouseLeave={() => setSelectedGameIndex(null)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500/60 shadow-lg scale-[1.02]'
                      : 'bg-slate-950/60 border-slate-800/70 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800/60">
                    <span className="font-bold text-white font-mono">
                      J{g.gameNumber}
                    </span>
                    <span
                      className={`px-1 rounded text-[9px] font-black ${
                        g.result === 'W'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {g.result === 'W' ? 'G' : 'P'} {g.score}
                    </span>
                  </div>

                  <div className="pt-1.5 space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 truncate" title={g.opponentName}>
                        {g.isHome ? 'vs' : '@'} {g.opponent}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {g.date}
                      </span>
                    </div>

                    {!isPitcher ? (
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {g.h}-{g.ab}
                          {g.hr > 0 && <span className="text-amber-400 text-[10px] ml-0.5">({g.hr}HR)</span>}
                        </span>
                        <span className="font-mono font-black text-xs text-emerald-400">
                          .{String(Math.round(g.rollingAvg * 1000)).padStart(3, '0')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {g.ip} IP, {g.so} K
                        </span>
                        <span className="font-mono font-black text-xs text-sky-400">
                          {Number(g.rollingEra).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
