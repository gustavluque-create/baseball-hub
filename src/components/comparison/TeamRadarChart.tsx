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
  awayTeam?: Team;
  homeTeam?: Team;
  teamA?: Team;
  teamB?: Team;
  awayStats?: TeamAggregatedStats;
  homeStats?: TeamAggregatedStats;
  statsA?: TeamAggregatedStats;
  statsB?: TeamAggregatedStats;
  awayStanding?: Standing;
  homeStanding?: Standing;
  standingA?: Standing;
  standingB?: Standing;
}

export const TeamRadarChart: React.FC<TeamRadarChartProps> = (props) => {
  const team1 = props.teamA || props.awayTeam;
  const team2 = props.teamB || props.homeTeam;
  const stats1 = props.statsA || props.awayStats;
  const stats2 = props.statsB || props.homeStats;
  const stand1 = props.standingA || props.awayStanding;
  const stand2 = props.standingB || props.homeStanding;

  if (!team1 || !team2 || !stats1 || !stats2) {
    return null;
  }

  const team1Color = team1.colors?.primary || team1.primaryColor || '#3b82f6';
  const team2Color = team2.colors?.primary || team2.primaryColor || '#10b981';

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
      team1Value: Math.round(normAVG(stats1.batting.avg)),
      team2Value: Math.round(normAVG(stats2.batting.avg)),
      team1Raw: stats1.batting.avg.toFixed(3).replace(/^0/, ''),
      team2Raw: stats2.batting.avg.toFixed(3).replace(/^0/, ''),
    },
    {
      subject: 'Poder (.SLG)',
      team1Value: Math.round(normPower(stats1.batting.slg)),
      team2Value: Math.round(normPower(stats2.batting.slg)),
      team1Raw: stats1.batting.slg.toFixed(3).replace(/^0/, ''),
      team2Raw: stats2.batting.slg.toFixed(3).replace(/^0/, ''),
    },
    {
      subject: 'Pitcheo (PCL)',
      team1Value: Math.round(normERA(stats1.pitching.era)),
      team2Value: Math.round(normERA(stats2.pitching.era)),
      team1Raw: stats1.pitching.era.toFixed(2),
      team2Raw: stats2.pitching.era.toFixed(2),
    },
    {
      subject: 'Control (WHIP)',
      team1Value: Math.round(normWHIP(stats1.pitching.whip)),
      team2Value: Math.round(normWHIP(stats2.pitching.whip)),
      team1Raw: stats1.pitching.whip.toFixed(2),
      team2Raw: stats2.pitching.whip.toFixed(2),
    },
    {
      subject: 'Ponches (K/9)',
      team1Value: Math.round(normK(stats1.pitching.k9)),
      team2Value: Math.round(normK(stats2.pitching.k9)),
      team1Raw: stats1.pitching.k9.toFixed(1),
      team2Raw: stats2.pitching.k9.toFixed(1),
    },
    {
      subject: 'Victoria (PCT)',
      team1Value: Math.round(normPCT(stand1?.pct || team1.record?.pct || 0.5)),
      team2Value: Math.round(normPCT(stand2?.pct || team2.record?.pct || 0.5)),
      team1Raw: `${((stand1?.pct || team1.record?.pct || 0.5) * 100).toFixed(1)}%`,
      team2Raw: `${((stand2?.pct || team2.record?.pct || 0.5) * 100).toFixed(1)}%`,
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700/90 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 z-50">
          <p className="font-bold text-white border-b border-slate-800 pb-1">{data.subject}</p>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: team1Color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team1Color }} />
              {team1.shortName}:
            </span>
            <span className="font-mono font-bold text-white">{data.team1Raw}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: team2Color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team2Color }} />
              {team2.shortName}:
            </span>
            <span className="font-mono font-bold text-white">{data.team2Raw}</span>
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
            name={team1.name}
            dataKey="team1Value"
            stroke={team1Color}
            fill={team1Color}
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <Radar
            name={team2.name}
            dataKey="team2Value"
            stroke={team2Color}
            fill={team2Color}
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
