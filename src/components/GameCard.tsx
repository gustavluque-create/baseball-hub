import React from 'react';
import { Game } from '../types/index.ts';
import { useApp } from '../context/AppContext.tsx';
import { ChevronRight, Star } from 'lucide-react';

interface GameCardProps {
  game: Game;
  compact?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ game, compact = false }) => {
  const { openGameComparison, navigateToGame, t, isFavoriteTeam } = useApp();

  const statusLower = (game.status || '').toLowerCase();
  const isLive = statusLower === 'live';
  const isFinal = statusLower === 'final';
  const isScheduled = statusLower === 'scheduled';

  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold text-[11px] border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
          <span>
            {game.currentInning}ª {game.isTopInning ? '▲ Alta' : '▼ Baja'} ({game.outs} out)
          </span>
        </span>
      );
    }
    if (isFinal) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-[11px] border border-slate-700">
          {t('home.final')}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium text-[11px]">
        {game.time} hrs
      </span>
    );
  };

  return (
    <div
      onClick={() => openGameComparison(game.id)}
      className="group relative flex flex-col justify-between bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 transition-all cursor-pointer shadow-md hover:shadow-xl hover:shadow-black/40 min-w-[260px]"
    >
      {/* Top Header info */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80 text-xs">
        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
          {game.stadium}
        </span>
        {getStatusBadge()}
      </div>

      {/* Teams & Scores */}
      <div className="space-y-2 py-1">
        {/* Away Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{game.awayTeam.logo}</span>
            <div>
              <span className="font-bold text-slate-100 text-sm group-hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                <span>{game.awayTeam.shortName}</span>
                {isFavoriteTeam(game.awayTeam.id) && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                )}
              </span>
              <span className="hidden sm:inline text-xs text-slate-400 ml-1.5">
                {game.awayTeam.nickname}
              </span>
            </div>
          </div>
          <span
            className={`font-mono text-lg font-black ${
              isScheduled
                ? 'text-slate-600'
                : game.awayScore > game.homeScore
                ? 'text-white'
                : 'text-slate-400'
            }`}
          >
            {isScheduled ? '-' : game.awayScore}
          </span>
        </div>

        {/* Home Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{game.homeTeam.logo}</span>
            <div>
              <span className="font-bold text-slate-100 text-sm group-hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                <span>{game.homeTeam.shortName}</span>
                {isFavoriteTeam(game.homeTeam.id) && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                )}
              </span>
              <span className="hidden sm:inline text-xs text-slate-400 ml-1.5">
                {game.homeTeam.nickname}
              </span>
            </div>
          </div>
          <span
            className={`font-mono text-lg font-black ${
              isScheduled
                ? 'text-slate-600'
                : game.homeScore > game.awayScore
                ? 'text-white'
                : 'text-slate-400'
            }`}
          >
            {isScheduled ? '-' : game.homeScore}
          </span>
        </div>
      </div>

      {/* Footer Details: Hits/Errors or Pitchers */}
      <div className="pt-2 mt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        {!isScheduled ? (
          <div className="flex items-center gap-3">
            <span>
              H: <strong className="text-slate-300">{game.awayHits}-{game.homeHits}</strong>
            </span>
            <span>
              E: <strong className="text-slate-300">{game.awayErrors}-{game.homeErrors}</strong>
            </span>
          </div>
        ) : (
          <span className="text-slate-500">Fecha: {game.date}</span>
        )}

        <div className="flex items-center gap-1 text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
          <span>Comparativa & Box</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
