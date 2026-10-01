import React from 'react';
import { Game } from '../types/index.ts';
import { useApp } from '../context/AppContext.tsx';
import { useScoreNotifications } from '../context/ScoreNotificationContext.tsx';
import { ChevronRight, Star, Bell, BellRing, ListOrdered, Activity, Flame, Shield } from 'lucide-react';
import { TeamLogo } from './TeamLogo.tsx';

interface GameCardProps {
  game: Game;
  compact?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ game, compact = false }) => {
  const { openGameComparison, navigateToGame, t, isFavoriteTeam } = useApp();
  const { isGameSubscribed, toggleGameSubscription } = useScoreNotifications();

  const isSubscribed = isGameSubscribed(game.id);

  const statusLower = (game.status || '').toLowerCase();
  const isLive = statusLower === 'live';
  const isFinal = statusLower === 'final';
  const isScheduled = statusLower === 'scheduled';

  // Live Lineup & Batter/Pitcher Resolution
  const battingLineup = game.isTopInning ? game.lineups?.away : game.lineups?.home;
  const pitchingLineup = game.isTopInning ? game.lineups?.home : game.lineups?.away;
  const currentBatter = battingLineup?.battingOrder?.[0];
  const currentPitcher = pitchingLineup?.startingPitcher;

  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold text-[11px] border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
          <span>
            {game.currentInning}ª {game.isTopInning ? '▲ Alta' : '▼ Baja'} ({game.outs || 0} out)
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
      onClick={() => navigateToGame(game.id)}
      className="group relative flex flex-col justify-between bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 transition-all cursor-pointer shadow-md hover:shadow-xl hover:shadow-black/40 min-w-[260px]"
    >
      {/* Top Header info */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80 text-xs">
        <span className="text-[11px] text-slate-400 truncate max-w-[120px]" title={game.stadium}>
          {game.stadium || 'Estadio Nacional'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {getStatusBadge()}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleGameSubscription(game.id);
            }}
            title={
              isSubscribed
                ? 'Notificaciones push en vivo activadas para este partido (clic para desactivar)'
                : 'Suscribirse a notificaciones push en vivo de este partido'
            }
            aria-label={
              isSubscribed
                ? `Desactivar notificaciones push para ${game.awayTeam.shortName} vs ${game.homeTeam.shortName}`
                : `Activar notificaciones push para ${game.awayTeam.shortName} vs ${game.homeTeam.shortName}`
            }
            className={`p-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1 relative ${
              isSubscribed
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750 border border-slate-700/80'
            }`}
          >
            {isSubscribed ? (
              <>
                <BellRing className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                <span className="text-[10px] font-bold text-amber-300 hidden sm:inline">Push ON</span>
                <span className="sm:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900 animate-ping" />
                <span className="sm:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] text-slate-400 hidden sm:inline">Alertas</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Teams & Scores */}
      <div className="space-y-2 py-1">
        {/* Away Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.name} className="w-full h-full text-xl" />
            </div>
            <div>
              <span className="font-bold text-slate-100 text-sm group-hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                <span>{game.awayTeam.shortName}</span>
                {isFavoriteTeam(game.awayTeam.id) && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                )}
                {isLive && game.isTopInning && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold ml-1">
                    AL BATE
                  </span>
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
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.name} className="w-full h-full text-xl" />
            </div>
            <div>
              <span className="font-bold text-slate-100 text-sm group-hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                <span>{game.homeTeam.shortName}</span>
                {isFavoriteTeam(game.homeTeam.id) && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                )}
                {isLive && !game.isTopInning && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold ml-1">
                    AL BATE
                  </span>
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

      {/* LIVE GAME STATS & LINEUP STRIP (when match is LIVE) */}
      {isLive && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 bg-slate-950/50 rounded-xl p-2.5 space-y-2">
          {/* Diamond & Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Mini SVG Diamond */}
              <div className="relative w-5 h-5 flex items-center justify-center">
                <div
                  className={`absolute top-0 w-2 h-2 rounded-xs transform rotate-45 transition-colors ${
                    game.bases?.second ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-slate-700'
                  }`}
                  title="2da Base"
                />
                <div
                  className={`absolute left-0 w-2 h-2 rounded-xs transform rotate-45 transition-colors ${
                    game.bases?.third ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-slate-700'
                  }`}
                  title="3ra Base"
                />
                <div
                  className={`absolute right-0 w-2 h-2 rounded-xs transform rotate-45 transition-colors ${
                    game.bases?.first ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-slate-700'
                  }`}
                  title="1ra Base"
                />
              </div>

              {/* Count */}
              <span className="text-[11px] font-mono font-bold text-slate-300">
                Conteo: <span className="text-sky-400">{game.balls || 0}B</span> -{' '}
                <span className="text-amber-400">{game.strikes || 0}S</span>
              </span>
            </div>

            <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>En Progreso</span>
            </span>
          </div>

          {/* Current Lineup Batter & Pitcher info */}
          <div className="text-[11px] text-slate-300 space-y-1">
            {currentBatter && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1 truncate">
                  <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-slate-400">Al Bate:</span>{' '}
                  <strong className="text-white truncate">
                    {currentBatter.name} ({currentBatter.position})
                  </strong>
                </span>
                <span className="font-mono text-emerald-400 text-[10px] shrink-0 font-bold">
                  AVG {currentBatter.avg || '.300'}
                </span>
              </div>
            )}

            {currentPitcher && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1 truncate">
                  <Shield className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="text-slate-400">Lanzador:</span>{' '}
                  <strong className="text-white truncate">{currentPitcher.name}</strong>
                </span>
                <span className="font-mono text-slate-400 text-[10px] shrink-0">
                  {currentPitcher.era || '3.20'} PCL • {currentPitcher.so || 4} K
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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

        <div className="flex items-center gap-2">
          {/* Quick Lineups Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateToGame(game.id);
            }}
            className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
            title="Ver alineaciones titulares oficiales y jugada a jugada"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Alineaciones</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openGameComparison(game.id);
            }}
            className="flex items-center gap-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Ver comparativa cara a cara H2H"
          >
            <span>H2H</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
