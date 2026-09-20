import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Team, TeamAggregatedStats, Standing } from '../../types/index.ts';

export interface TeamRadarChartProps {
  awayTeam: Team;
  homeTeam: Team;
  awayStats: TeamAggregatedStats;
  homeStats: TeamAggregatedStats;
  awayStanding?: Standing;
  homeStanding?: Standing;
}

export const TeamRadarChart: React.FC<TeamRadarChartProps> = ({
  awayTeam,
  homeTeam,
  awayStats,
  homeStats,
  awayStanding,
  homeStanding,
}) => {
  const awayColor = awayTeam.colors?.primary || awayTeam.primaryColor || '#3b82f6';
  const homeColor = homeTeam.colors?.primary || homeTeam.primaryColor || '#10b981';

  // Normalize stats to 0-100 scale for intuitive radar comparison
  // 1. Bateo (.AVG): league range ~ .220 to .340
  const normAVG = (avg: number) => Math.max(10, Math.min(100, ((avg - 0.2) / 0.15) * 100));

  // 2. Poder (HR / SLG):
  const normPower = (slg: number) => Math.max(10, Math.min(100, ((slg - 0.3) / 0.25) * 100));

  // 3. Efectividad (ERA): lower is better -> invert! Range ~ 1.50 to 5.50
  const normERA = (era: number) => Math.max(10, Math.min(100, ((5.5 - era) / 4.0) * 100));

  // 4. Dominio (WHIP): lower is better -> invert! Range ~ 0.85 to 1.70
  const normWHIP = (whip: number) => Math.max(10, Math.min(100, ((1.7 - whip) / 0.85) * 100));

  // 5. Ponches (K/9): Range ~ 4.0 to 11.0
  const normK = (k9: number) => Math.max(10, Math.min(100, ((k9 - 4.0) / 7.0) * 100));

  // 6. Récord (PCT): Range 0.250 to 0.850
  const normPCT = (pct: number) => Math.max(10, Math.min(100, ((pct - 0.25) / 0.6) * 100));

  const radarData = [
    {
      subject: 'Contacto (.AVG)',
      awayValue: Math.round(normAVG(awayStats.batting.avg)),
      homeValue: Math.round(normAVG(homeStats.batting.avg)),
      awayRaw: awayStats.batting.avg.toFixed(3).replace(/^0/, ''),
      homeRaw: homeStats.batting.avg.toFixed(3).replace(/^0/, ''),
    },
    {
      subject: 'Poder (.SLG)',
      awayValue: Math.round(normPower(awayStats.batting.slg)),
      homeValue: Math.round(normPower(homeStats.batting.slg)),
      awayRaw: awayStats.batting.slg.toFixed(3).replace(/^0/, ''),
      homeRaw: homeStats.batting.slg.toFixed(3).replace(/^0/, ''),
    },
    {
      subject: 'Pitcheo (PCL)',
      awayValue: Math.round(normERA(awayStats.pitching.era)),
      homeValue: Math.round(normERA(homeStats.pitching.era)),
      awayRaw: awayStats.pitching.era.toFixed(2),
      homeRaw: homeStats.pitching.era.toFixed(2),
    },
    {
      subject: 'Control (WHIP)',
      awayValue: Math.round(normWHIP(awayStats.pitching.whip)),
      homeValue: Math.round(normWHIP(homeStats.pitching.whip)),
      awayRaw: awayStats.pitching.whip.toFixed(2),
      homeRaw: homeStats.pitching.whip.toFixed(2),
    },
    {
      subject: 'Ponches (K/9)',
      awayValue: Math.round(normK(awayStats.pitching.k9)),
      homeValue: Math.round(normK(homeStats.pitching.k9)),
      awayRaw: awayStats.pitching.k9.toFixed(1),
      homeRaw: homeStats.pitching.k9.toFixed(1),
    },
    {
      subject: 'Victoria (PCT)',
      awayValue: Math.round(normPCT(awayStanding?.pct || awayTeam.record?.pct || 0.5)),
      homeValue: Math.round(normPCT(homeStanding?.pct || homeTeam.record?.pct || 0.5)),
      awayRaw: `${((awayStanding?.pct || awayTeam.record?.pct || 0.5) * 100).toFixed(1)}%`,
      homeRaw: `${((homeStanding?.pct || homeTeam.record?.pct || 0.5) * 100).toFixed(1)}%`,
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700/90 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 z-50">
          <p className="font-bold text-white border-b border-slate-800 pb-1">{data.subject}</p>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: awayColor }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: awayColor }} />
              {awayTeam.shortName}:
            </span>
            <span className="font-mono font-bold text-white">{data.awayRaw}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: homeColor }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: homeColor }} />
              {homeTeam.shortName}:
            </span>
            <span className="font-mono font-bold text-white">{data.homeRaw}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72 sm:h-80 flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
          <PolarGrid stroke="#334155" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={false} />
          <Radar
            name={awayTeam.name}
            dataKey="awayValue"
            stroke={awayColor}
            fill={awayColor}
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <Radar
            name={homeTeam.name}
            dataKey="homeValue"
            stroke={homeColor}
            fill={homeColor}
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 10, fontSize: 12 }}
            formatter={(value) => <span className="text-slate-300 font-semibold">{value}</span>}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
