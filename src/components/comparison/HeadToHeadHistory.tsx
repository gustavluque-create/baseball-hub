import React from 'react';
import { Swords, Calendar, Trophy, ChevronRight } from 'lucide-react';
import { Game, Team } from '../../types/index.ts';

export interface HeadToHeadHistoryProps {
  awayTeam: Team;
  homeTeam: Team;
  games: Game[];
  onSelectGame?: (gameId: string) => void;
}

export const HeadToHeadHistory: React.FC<HeadToHeadHistoryProps> = ({
  awayTeam,
  homeTeam,
  games,
  onSelectGame,
}) => {
  // Filter games completed between these two teams
  const finishedGames = games.filter(
    (g) =>
      g.status === 'FINAL' &&
      ((g.homeTeam.id === awayTeam.id && g.awayTeam.id === homeTeam.id) ||
        (g.homeTeam.id === homeTeam.id && g.awayTeam.id === awayTeam.id))
  );

  let awayWins = 0;
  let homeWins = 0;

  finishedGames.forEach((g) => {
    const isAwayVisiting = g.awayTeam.id === awayTeam.id;
    const awayScore = isAwayVisiting ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
    const homeScore = isAwayVisiting ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
    if (awayScore > homeScore) awayWins++;
    else if (homeScore > awayScore) homeWins++;
  });

  const awayColor = awayTeam.colors?.primary || awayTeam.primaryColor || '#3b82f6';
  const homeColor = homeTeam.colors?.primary || homeTeam.primaryColor || '#10b981';

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Historial de Enfrentamientos Directos 2026
          </h4>
        </div>
        <div className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
          Serie:{' '}
          <span style={{ color: awayColor }}>
            {awayTeam.shortName} {awayWins}
          </span>{' '}
          -{' '}
          <span style={{ color: homeColor }}>
            {homeWins} {homeTeam.shortName}
          </span>
        </div>
      </div>

      {/* List of head-to-head games */}
      {finishedGames.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400">
          <p className="font-semibold text-slate-300">Primer enfrentamiento directo de la serie</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Estos dos equipos no se han medido previamente en lo que va de temporada.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {finishedGames.map((g) => {
            const isAwayVisitor = g.awayTeam.id === awayTeam.id;
            const scoreAway = isAwayVisitor ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
            const scoreHome = isAwayVisitor ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
            const isAwayWinner = scoreAway > scoreHome;

            return (
              <div
                key={g.id}
                onClick={() => onSelectGame?.(g.id)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3 h-3" />
                    {g.date}
                  </span>
                  <span className="text-slate-600">•</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span
                      className={`font-bold ${
                        isAwayWinner ? 'text-emerald-400 font-black' : 'text-slate-400'
                      }`}
                    >
                      {awayTeam.shortName} {scoreAway}
                    </span>
                    <span className="text-slate-600">-</span>
                    <span
                      className={`font-bold ${
                        !isAwayWinner ? 'text-emerald-400 font-black' : 'text-slate-400'
                      }`}
                    >
                      {scoreHome} {homeTeam.shortName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                    {g.stadium || 'Estadio Oficial'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
