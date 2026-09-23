import React from 'react';
import { Star, MapPin, Calendar, Trophy, Swords, Shield } from 'lucide-react';
import { Team, Standing, Game } from '../../types/index.ts';
import { TeamLogo } from '../TeamLogo.tsx';

export interface TeamComparisonHeaderProps {
  game: Game;
  awayTeam: Team;
  homeTeam: Team;
  awayStanding?: Standing;
  homeStanding?: Standing;
  isFavoriteTeam?: (id: string) => boolean;
  onToggleFavorite?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
}

export const TeamComparisonHeader: React.FC<TeamComparisonHeaderProps> = ({
  game,
  awayTeam,
  homeTeam,
  awayStanding,
  homeStanding,
  isFavoriteTeam,
  onToggleFavorite,
  onSelectTeam,
}) => {
  const awayColor = awayTeam.colors?.primary || awayTeam.primaryColor || '#3b82f6';
  const homeColor = homeTeam.colors?.primary || homeTeam.primaryColor || '#10b981';

  const isLive = game.status === 'LIVE';
  const isFinal = game.status === 'FINAL';

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-2xl">
      {/* Background Duel Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20 flex">
        <div
          className="flex-1"
          style={{
            background: `radial-gradient(circle at 10% 50%, ${awayColor}, transparent 70%)`,
          }}
        />
        <div
          className="flex-1"
          style={{
            background: `radial-gradient(circle at 90% 50%, ${homeColor}, transparent 70%)`,
          }}
        />
      </div>

      {/* Main Grid: Away Team | Matchup Center | Home Team */}
      <div className="relative z-10 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
        {/* Away Team (Col 1-4) */}
        <div className="md:col-span-4 flex items-center justify-between md:justify-start gap-4 p-3 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-3.5">
            {/* Logo */}
            <div
              onClick={() => onSelectTeam?.(awayTeam.id)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center p-2 shadow-lg border border-slate-700/80 shrink-0 cursor-pointer hover:scale-105 transition-transform"
              style={{ backgroundColor: `${awayColor}25` }}
              title={`Ver perfil de ${awayTeam.name}`}
            >
              <TeamLogo logo={awayTeam.logo} name={awayTeam.name} className="w-full h-full text-3xl sm:text-4xl" />
            </div>

            {/* Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  Visitante
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400">
                  {awayTeam.shortName}
                </span>
              </div>

              <h2
                onClick={() => onSelectTeam?.(awayTeam.id)}
                className="text-lg sm:text-xl font-black text-white hover:text-emerald-400 transition-colors cursor-pointer leading-tight"
              >
                {awayTeam.name}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {awayTeam.nickname || awayTeam.city}
              </p>

              {/* Record & Standing */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="font-mono font-bold text-slate-200">
                  {awayStanding ? `${awayStanding.wins}-${awayStanding.losses}` : `${awayTeam.record?.wins || 0}-${awayTeam.record?.losses || 0}`}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">
                  {awayStanding
                    ? `${(awayStanding.pct).toFixed(3)} PCT`
                    : awayTeam.record?.pct
                    ? `${awayTeam.record.pct.toFixed(3)} PCT`
                    : ''}
                </span>
                {awayStanding && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-amber-400 font-semibold text-[11px]">
                      {awayStanding.rank ? `${awayStanding.rank}º` : ''} {awayStanding.division}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Favorite toggle */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(awayTeam.id)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
              title={isFavoriteTeam?.(awayTeam.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            >
              <Star
                className={`w-4 h-4 ${
                  isFavoriteTeam?.(awayTeam.id) ? 'fill-amber-400 text-amber-400' : ''
                }`}
              />
            </button>
          )}
        </div>

        {/* Center Matchup Context (Col 5-7) */}
        <div className="md:col-span-3 text-center flex flex-col items-center justify-center py-2 px-1">
          {/* Status badge */}
          {isLive ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-black text-xs uppercase tracking-wider animate-pulse mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>EN VIVO • INN {game.currentInning || '1'}</span>
            </div>
          ) : isFinal ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider mb-2">
              <span>FINALIZADO</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
              <span>PROGRAMADO</span>
            </div>
          )}

          {/* Score if live/final, or VS badge */}
          {isLive || isFinal ? (
            <div className="flex items-center justify-center gap-3 my-1">
              <span className="font-mono text-3xl sm:text-4xl font-black text-white">
                {game.awayScore ?? 0}
              </span>
              <span className="text-slate-600 text-xl font-black">-</span>
              <span className="font-mono text-3xl sm:text-4xl font-black text-white">
                {game.homeScore ?? 0}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center my-1">
              <span className="w-10 h-10 rounded-full bg-slate-850 border border-slate-700 flex items-center justify-center text-amber-400 font-black text-sm shadow-inner">
                VS
              </span>
            </div>
          )}

          {/* Stadium & Time */}
          <div className="space-y-1 text-center mt-1">
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[180px]">{game.stadium || homeTeam.stadium}</span>
            </div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{game.date} • {game.time}</span>
            </div>
          </div>
        </div>

        {/* Home Team (Col 8-11) */}
        <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-4 p-3 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          {/* Favorite toggle on mobile / left of home card */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(homeTeam.id)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors shrink-0 cursor-pointer order-last md:order-first"
              title={isFavoriteTeam?.(homeTeam.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            >
              <Star
                className={`w-4 h-4 ${
                  isFavoriteTeam?.(homeTeam.id) ? 'fill-amber-400 text-amber-400' : ''
                }`}
              />
            </button>
          )}

          <div className="flex items-center gap-3.5 md:text-right">
            {/* Info */}
            <div className="space-y-1 order-2 md:order-1">
              <div className="flex items-center md:justify-end gap-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400">
                  {homeTeam.shortName}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  Local
                </span>
              </div>

              <h2
                onClick={() => onSelectTeam?.(homeTeam.id)}
                className="text-lg sm:text-xl font-black text-white hover:text-emerald-400 transition-colors cursor-pointer leading-tight"
              >
                {homeTeam.name}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {homeTeam.nickname || homeTeam.city}
              </p>

              {/* Record & Standing */}
              <div className="flex items-center md:justify-end gap-2 pt-1 text-xs">
                {homeStanding && (
                  <>
                    <span className="text-amber-400 font-semibold text-[11px]">
                      {homeStanding.rank ? `${homeStanding.rank}º` : ''} {homeStanding.division}
                    </span>
                    <span className="text-slate-500">•</span>
                  </>
                )}
                <span className="font-mono font-bold text-slate-200">
                  {homeStanding ? `${homeStanding.wins}-${homeStanding.losses}` : `${homeTeam.record?.wins || 0}-${homeTeam.record?.losses || 0}`}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">
                  {homeStanding
                    ? `${(homeStanding.pct).toFixed(3)} PCT`
                    : homeTeam.record?.pct
                    ? `${homeTeam.record.pct.toFixed(3)} PCT`
                    : ''}
                </span>
              </div>
            </div>

            {/* Logo */}
            <div
              onClick={() => onSelectTeam?.(homeTeam.id)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center p-2 shadow-lg border border-slate-700/80 shrink-0 cursor-pointer hover:scale-105 transition-transform order-1 md:order-2"
              style={{ backgroundColor: `${homeColor}25` }}
              title={`Ver perfil de ${homeTeam.name}`}
            >
              <TeamLogo logo={homeTeam.logo} name={homeTeam.name} className="w-full h-full text-3xl sm:text-4xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
