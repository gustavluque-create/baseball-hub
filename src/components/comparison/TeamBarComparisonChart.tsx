import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Team, TeamAggregatedStats } from '../../types/index.ts';
import { Swords, Zap, Shield, Flame, Activity } from 'lucide-react';

export interface TeamBarComparisonChartProps {
  teamA: Team;
  teamB: Team;
  statsA: TeamAggregatedStats;
  statsB: TeamAggregatedStats;
}

type StatCategory = 'offense' | 'pitching' | 'averages';

export const TeamBarComparisonChart: React.FC<TeamBarComparisonChartProps> = ({
  teamA,
  teamB,
  statsA,
  statsB,
}) => {
  const [activeCategory, setActiveCategory] = useState<StatCategory>('offense');

  const colorA = teamA.colors?.primary || teamA.primaryColor || '#3b82f6';
  const colorB = teamB.colors?.primary || teamB.primaryColor || '#10b981';

  // Build datasets for each category
  const offenseData = [
    {
      metric: 'Carreras (R)',
      [teamA.shortName]: statsA.batting.runs,
      [teamB.shortName]: statsB.batting.runs,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'Hits (H)',
      [teamA.shortName]: statsA.batting.hits,
      [teamB.shortName]: statsB.batting.hits,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'Jonrones (HR)',
      [teamA.shortName]: statsA.batting.homeRuns,
      [teamB.shortName]: statsB.batting.homeRuns,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'Impulsadas (RBI)',
      [teamA.shortName]: statsA.batting.rbi,
      [teamB.shortName]: statsB.batting.rbi,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'Dobles (2B)',
      [teamA.shortName]: statsA.batting.doubles,
      [teamB.shortName]: statsB.batting.doubles,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'Boletos (BB)',
      [teamA.shortName]: statsA.batting.walks,
      [teamB.shortName]: statsB.batting.walks,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'Bases Robadas (BR)',
      [teamA.shortName]: statsA.batting.stolenBases,
      [teamB.shortName]: statsB.batting.stolenBases,
      unit: '',
      higherIsBetter: true,
    },
  ];

  const pitchingData = [
    {
      metric: 'Ponches (SO)',
      [teamA.shortName]: statsA.pitching.strikeouts,
      [teamB.shortName]: statsB.pitching.strikeouts,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'Salvamentos (SV)',
      [teamA.shortName]: statsA.pitching.saves,
      [teamB.shortName]: statsB.pitching.saves,
      unit: '',
      higherIsBetter: true,
    },
    {
      metric: 'C. Permitidas (RA)',
      [teamA.shortName]: statsA.pitching.runsAllowed,
      [teamB.shortName]: statsB.pitching.runsAllowed,
      unit: '',
      higherIsBetter: false,
    },
    {
      metric: 'C. Limpias (ER)',
      [teamA.shortName]: statsA.pitching.earnedRuns,
      [teamB.shortName]: statsB.pitching.earnedRuns,
      unit: '',
      higherIsBetter: false,
    },
    {
      metric: 'Boletos Otorgados (BB)',
      [teamA.shortName]: statsA.pitching.walks,
      [teamB.shortName]: statsB.pitching.walks,
      unit: '',
      higherIsBetter: false,
    },
    {
      metric: 'Hits Permitidos (HA)',
      [teamA.shortName]: statsA.pitching.hitsAllowed,
      [teamB.shortName]: statsB.pitching.hitsAllowed,
      unit: '',
      higherIsBetter: false,
    },
  ];

  const averagesData = [
    {
      metric: 'Bateo (.AVG)',
      [teamA.shortName]: parseFloat(statsA.batting.avg.toFixed(3)),
      [teamB.shortName]: parseFloat(statsB.batting.avg.toFixed(3)),
      displayA: statsA.batting.avg.toFixed(3).replace(/^0/, ''),
      displayB: statsB.batting.avg.toFixed(3).replace(/^0/, ''),
      higherIsBetter: true,
    },
    {
      metric: 'Embasado (.OBP)',
      [teamA.shortName]: parseFloat(statsA.batting.obp.toFixed(3)),
      [teamB.shortName]: parseFloat(statsB.batting.obp.toFixed(3)),
      displayA: statsA.batting.obp.toFixed(3).replace(/^0/, ''),
      displayB: statsB.batting.obp.toFixed(3).replace(/^0/, ''),
      higherIsBetter: true,
    },
    {
      metric: 'Slugging (.SLG)',
      [teamA.shortName]: parseFloat(statsA.batting.slg.toFixed(3)),
      [teamB.shortName]: parseFloat(statsB.batting.slg.toFixed(3)),
      displayA: statsA.batting.slg.toFixed(3).replace(/^0/, ''),
      displayB: statsB.batting.slg.toFixed(3).replace(/^0/, ''),
      higherIsBetter: true,
    },
    {
      metric: 'OPS (.OPS)',
      [teamA.shortName]: parseFloat(statsA.batting.ops.toFixed(3)),
      [teamB.shortName]: parseFloat(statsB.batting.ops.toFixed(3)),
      displayA: statsA.batting.ops.toFixed(3).replace(/^0/, ''),
      displayB: statsB.batting.ops.toFixed(3).replace(/^0/, ''),
      higherIsBetter: true,
    },
    {
      metric: 'PCL / ERA (Efectividad)',
      [teamA.shortName]: parseFloat(statsA.pitching.era.toFixed(2)),
      [teamB.shortName]: parseFloat(statsB.pitching.era.toFixed(2)),
      displayA: statsA.pitching.era.toFixed(2),
      displayB: statsB.pitching.era.toFixed(2),
      higherIsBetter: false,
    },
    {
      metric: 'WHIP (Control)',
      [teamA.shortName]: parseFloat(statsA.pitching.whip.toFixed(2)),
      [teamB.shortName]: parseFloat(statsB.pitching.whip.toFixed(2)),
      displayA: statsA.pitching.whip.toFixed(2),
      displayB: statsB.pitching.whip.toFixed(2),
      higherIsBetter: false,
    },
  ];

  const currentData: any[] =
    activeCategory === 'offense'
      ? offenseData
      : activeCategory === 'pitching'
      ? pitchingData
      : averagesData;

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length >= 2) {
      const valA = payload[0].value;
      const valB = payload[1].value;
      const diff = Math.abs(valA - valB);
      const isDiff = diff > 0.0001;

      return (
        <div className="bg-slate-950 border border-slate-700/90 p-3 rounded-xl shadow-2xl text-xs space-y-2 z-50 min-w-[200px]">
          <div className="font-bold text-white border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>{label}</span>
            {isDiff && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Dif: {diff < 1 ? diff.toFixed(3) : diff.toFixed(0)}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: colorA }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorA }} />
                {teamA.name}:
              </span>
              <span className="font-mono font-bold text-white">
                {typeof valA === 'number' && valA < 1 && valA > 0 ? valA.toFixed(3).replace(/^0/, '') : valA}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: colorB }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorB }} />
                {teamB.name}:
              </span>
              <span className="font-mono font-bold text-white">
                {typeof valB === 'number' && valB < 1 && valB > 0 ? valB.toFixed(3).replace(/^0/, '') : valB}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveCategory('offense')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeCategory === 'offense'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Ofensiva &amp; Bateo</span>
          </button>
          <button
            onClick={() => setActiveCategory('pitching')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeCategory === 'pitching'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Pitcheo &amp; Defensa</span>
          </button>
          <button
            onClick={() => setActiveCategory('averages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeCategory === 'averages'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Promedios &amp; Eficiencia</span>
          </button>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-3 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: colorA }} />
            <span className="text-slate-300">{teamA.shortName}</span>
          </div>
          <span className="text-slate-600">vs</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: colorB }} />
            <span className="text-slate-300">{teamB.shortName}</span>
          </div>
        </div>
      </div>

      {/* Chart Box */}
      <div className="w-full h-80 sm:h-96 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={currentData}
            margin={{ top: 20, right: 20, left: 0, bottom: 25 }}
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="metric"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v) => (activeCategory === 'averages' && v < 1 ? v.toFixed(2) : String(v))}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar
              dataKey={teamA.shortName}
              name={teamA.name}
              fill={colorA}
              radius={[4, 4, 0, 0]}
              maxBarSize={45}
            />
            <Bar
              dataKey={teamB.shortName}
              name={teamB.name}
              fill={colorB}
              radius={[4, 4, 0, 0]}
              maxBarSize={45}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
