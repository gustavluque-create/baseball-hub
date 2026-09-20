import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  BarChart2,
  LineChart as LineChartIcon,
  Flame,
  Zap,
  ShieldAlert,
  Award,
  Sparkles,
  Layers,
} from 'lucide-react';
import { BattingStats, PitchingStats } from '../types/index.ts';
import { useApp } from '../context/AppContext.tsx';

interface PlayerPerformanceChartsProps {
  statType: 'batting' | 'pitching' | 'advanced';
  battingData: BattingStats[];
  pitchingData: PitchingStats[];
  onSelectPlayer?: (playerId: string) => void;
}

export const PlayerPerformanceCharts: React.FC<PlayerPerformanceChartsProps> = ({
  statType,
  battingData,
  pitchingData,
  onSelectPlayer,
}) => {
  const { theme } = useApp();
  const gridColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';
  const axisColor = theme === 'dark' ? '#64748b' : '#94a3b8';

  // Bar Chart Metric state
  const [battingBarMetric, setBattingBarMetric] = useState<'production' | 'slash' | 'warOps'>('production');
  const [pitchingBarMetric, setPitchingBarMetric] = useState<'strikeouts' | 'control'>('strikeouts');

  // Line Chart Metric state
  const [battingLineMetric, setBattingLineMetric] = useState<'slashCurve' | 'powerTrend' | 'bbSoRatio'>('slashCurve');
  const [pitchingLineMetric, setPitchingLineMetric] = useState<'eraWhip' | 'kVsIp'>('eraWhip');

  const isPitching = statType === 'pitching';

  // Prepare top 8 Batters for charts
  const topBatters = [...battingData]
    .sort((a, b) => {
      if (battingBarMetric === 'warOps') return (b.war ?? 0) - (a.war ?? 0);
      if (battingBarMetric === 'slash') return b.ops - a.ops;
      return b.hr !== a.hr ? b.hr - a.hr : b.rbi - a.rbi;
    })
    .slice(0, 8)
    .map((b) => ({
      playerId: b.playerId,
      name: b.playerName.split(' ').slice(0, 2).join(' '),
      fullName: b.playerName,
      team: b.teamShort,
      pos: b.position,
      h: b.h,
      hr: b.hr,
      rbi: b.rbi,
      r: b.r,
      doubles: b.doubles,
      triples: b.triples,
      bb: b.bb,
      so: b.so,
      avg: Number(b.avg.toFixed(3)),
      obp: Number(b.obp.toFixed(3)),
      slg: Number(b.slg.toFixed(3)),
      ops: Number(b.ops.toFixed(3)),
      war: Number((b.war ?? 0).toFixed(1)),
    }));

  // Prepare top 8 Pitchers for charts
  const topPitchers = [...pitchingData]
    .sort((a, b) => {
      if (pitchingBarMetric === 'control') return a.era - b.era;
      return b.so - a.so;
    })
    .slice(0, 8)
    .map((p) => ({
      playerId: p.playerId,
      name: p.playerName.split(' ').slice(0, 2).join(' '),
      fullName: p.playerName,
      team: p.teamShort,
      pos: p.position,
      so: p.so,
      ip: p.ip,
      w: p.wins ?? p.w ?? 0,
      bb: p.bb,
      er: p.er,
      era: Number(p.era.toFixed(2)),
      whip: Number(p.whip.toFixed(2)),
    }));

  // Custom Tooltip with Dynamic Theme Support
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[170px] z-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
            <span className="font-bold text-slate-100 truncate">{dataItem.fullName || label}</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
              {dataItem.team} • {dataItem.pos}
            </span>
          </div>
          <div className="space-y-1 pt-1 font-mono">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}:
                </span>
                <span className="font-bold text-slate-100">{entry.value}</span>
              </div>
            ))}
          </div>
          {onSelectPlayer && (
            <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80 italic text-center">
              Haz clic para ver el perfil completo
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Top Banner introducing the Visualizer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/20 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">
                Visualización de Rendimiento
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase">
                Recharts Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Análisis comparativo de los mejores exponentes en{' '}
              <span className="text-emerald-400 font-semibold">
                {isPitching ? 'Pitcheo y Efectividad' : 'Bateo y Sabermetría'}
              </span>
            </p>
          </div>
        </div>

        {/* Quick leader badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
          <Award className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="text-slate-400 text-[11px] block">Líder Destacado:</span>
            <span className="font-bold text-slate-200">
              {isPitching
                ? topPitchers[0]?.fullName || 'Lanzador'
                : topBatters[0]?.fullName || 'Bateador'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Two Responsive Recharts: Bar Chart & Line Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* =========================================
            CHART 1: BAR CHART (Gráfico de Barras)
           ========================================= */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs uppercase font-bold tracking-wider text-slate-200">
                Gráfico de Barras: Comparativa de Producción
              </h4>
            </div>

            {/* Metric Selector for Bar Chart */}
            {!isPitching ? (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setBattingBarMetric('production')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    battingBarMetric === 'production'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  HR / CI / Hits
                </button>
                <button
                  onClick={() => setBattingBarMetric('slash')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    battingBarMetric === 'slash'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AVG / OBP / SLG
                </button>
                <button
                  onClick={() => setBattingBarMetric('warOps')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    battingBarMetric === 'warOps'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  WAR &amp; OPS
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setPitchingBarMetric('strikeouts')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    pitchingBarMetric === 'strikeouts'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ponches &amp; Entradas
                </button>
                <button
                  onClick={() => setPitchingBarMetric('control')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    pitchingBarMetric === 'control'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Control (K vs BB)
                </button>
              </div>
            )}
          </div>

          {/* Recharts Bar Chart Body */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {!isPitching ? (
                <BarChart
                  data={topBatters}
                  margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0] && onSelectPlayer) {
                      onSelectPlayer(e.activePayload[0].payload.playerId);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis stroke={axisColor} fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                  />

                  {battingBarMetric === 'production' && (
                    <>
                      <Bar dataKey="h" name="Hits (H)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="hr" name="Jonrones (HR)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rbi" name="Impulsadas (CI)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </>
                  )}

                  {battingBarMetric === 'slash' && (
                    <>
                      <Bar dataKey="avg" name="Promedio (AVG)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="obp" name="En Base (OBP)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="slg" name="Slugging (SLG)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </>
                  )}

                  {battingBarMetric === 'warOps' && (
                    <>
                      <Bar dataKey="war" name="WAR (Victorias)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="ops" name="OPS (OBP + SLG)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </>
                  )}
                </BarChart>
              ) : (
                <BarChart
                  data={topPitchers}
                  margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0] && onSelectPlayer) {
                      onSelectPlayer(e.activePayload[0].payload.playerId);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis stroke={axisColor} fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                  />

                  {pitchingBarMetric === 'strikeouts' ? (
                    <>
                      <Bar dataKey="so" name="Ponches (K/SO)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="ip" name="Entradas (IP)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="w" name="J. Ganados (JG)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="so" name="Ponches (K)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bb" name="Boletos (BB)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="er" name="Carreras Limpias (CL)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </>
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
            <span className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Haz clic en cualquier barra para abrir el perfil del jugador
            </span>
            <span className="font-mono text-slate-500">Muestra: Top 8</span>
          </div>
        </div>

        {/* =========================================
            CHART 2: LINE CHART (Gráfico de Líneas)
           ========================================= */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs uppercase font-bold tracking-wider text-slate-200">
                Gráfico de Líneas: Curva de Rendimiento
              </h4>
            </div>

            {/* Metric Selector for Line Chart */}
            {!isPitching ? (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setBattingLineMetric('slashCurve')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    battingLineMetric === 'slashCurve'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Slash Line (AVG/OBP/SLG)
                </button>
                <button
                  onClick={() => setBattingLineMetric('powerTrend')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    battingLineMetric === 'powerTrend'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Poder (2B / 3B / HR)
                </button>
                <button
                  onClick={() => setBattingLineMetric('bbSoRatio')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    battingLineMetric === 'bbSoRatio'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Disciplina (BB vs K)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setPitchingLineMetric('eraWhip')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    pitchingLineMetric === 'eraWhip'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Efectividad (PCL) vs. WHIP
                </button>
                <button
                  onClick={() => setPitchingLineMetric('kVsIp')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    pitchingLineMetric === 'kVsIp'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ponches vs. Entradas
                </button>
              </div>
            )}
          </div>

          {/* Recharts Line Chart Body */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {!isPitching ? (
                <LineChart
                  data={topBatters}
                  margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0] && onSelectPlayer) {
                      onSelectPlayer(e.activePayload[0].payload.playerId);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis stroke={axisColor} fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                  />

                  {battingLineMetric === 'slashCurve' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="avg"
                        name="Promedio (AVG)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="obp"
                        name="En Base (OBP)"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ fill: '#0ea5e9', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="slg"
                        name="Slugging (SLG)"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        dot={{ fill: '#a855f7', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </>
                  )}

                  {battingLineMetric === 'powerTrend' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="hr"
                        name="Jonrones (HR)"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ fill: '#f59e0b', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="doubles"
                        name="Dobles (2B)"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ fill: '#0ea5e9', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="r"
                        name="Anotadas (C)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </>
                  )}

                  {battingLineMetric === 'bbSoRatio' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="bb"
                        name="Boletos (BB)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="so"
                        name="Ponches (K/SO)"
                        stroke="#f43f5e"
                        strokeWidth={2.5}
                        dot={{ fill: '#f43f5e', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </>
                  )}
                </LineChart>
              ) : (
                <LineChart
                  data={topPitchers}
                  margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0] && onSelectPlayer) {
                      onSelectPlayer(e.activePayload[0].payload.playerId);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis stroke={axisColor} fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                  />

                  {pitchingLineMetric === 'eraWhip' ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="era"
                        name="Efectividad (PCL/ERA)"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ fill: '#0ea5e9', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="whip"
                        name="WHIP"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </>
                  ) : (
                    <>
                      <Line
                        type="monotone"
                        dataKey="so"
                        name="Ponches (K)"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ fill: '#f59e0b', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ip"
                        name="Entradas (IP)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </>
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
              Tendencia continua y gradientes de dispersión
            </span>
            <span className="font-mono text-slate-500">Muestra: Top 8</span>
          </div>
        </div>
      </div>
    </div>
  );
};
