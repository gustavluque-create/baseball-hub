import React, { useState } from 'react';
import {
  Star,
  Calendar,
  Zap,
  Clock,
  MapPin,
  ChevronRight,
  Plus,
  Check,
  Shield,
  ExternalLink,
  Radio,
  Trophy,
  ArrowRight,
} from 'lucide-react';
import { Team, Game } from '../types/index.ts';
import { useApp } from '../context/AppContext.tsx';
import { MyTeamsSectionSkeleton } from './LoadingSkeleton.tsx';

interface MyTeamsSectionProps {
  teams: Team[];
  games: Game[];
  loading?: boolean;
}

export const MyTeamsSection: React.FC<MyTeamsSectionProps> = ({
  teams,
  games,
  loading = false,
}) => {
  const {
    favoriteTeamIds,
    toggleFavoriteTeam,
    navigateToTeam,
    navigateToGame,
    setActiveTab,
  } = useApp();

  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Filter favorite teams in order
  const favoriteTeams = teams.filter((t) => favoriteTeamIds.includes(t.id));

  // Helper to find the most relevant current/recent game for a team
  const getTeamRecentGame = (teamId: string) => {
    // 1. First priority: Live game
    const liveGame = games.find(
      (g) =>
        g.status === 'LIVE' &&
        (g.homeTeam?.id === teamId || g.awayTeam?.id === teamId)
    );
    if (liveGame) return liveGame;

    // 2. Second priority: Most recent final game
    const finalGames = games.filter(
      (g) =>
        g.status === 'FINAL' &&
        (g.homeTeam?.id === teamId || g.awayTeam?.id === teamId)
    );
    if (finalGames.length > 0) {
      // Return the latest one
      return finalGames[finalGames.length - 1];
    }

    return null;
  };

  // Helper to find the next scheduled game for a team
  const getTeamNextGame = (teamId: string) => {
    const scheduledGames = games.filter(
      (g) =>
        g.status === 'SCHEDULED' &&
        (g.homeTeam?.id === teamId || g.awayTeam?.id === teamId)
    );
    return scheduledGames[0] || null;
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                Mis Equipos Favoritos
              </h2>
              {favoriteTeams.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  {favoriteTeams.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Marcadores al momento, resultados y próximos compromisos en el calendario
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>{isPickerOpen ? 'Ocultar selector' : 'Gestionar equipos'}</span>
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <span>Ver franquicias</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Team Selector / Adder Bar */}
      {isPickerOpen && (
        <div className="p-4 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Selecciona los equipos que deseas seguir en portada:
            </span>
            <span className="text-[11px] text-slate-400">
              {favoriteTeams.length} de {teams.length} favoritos
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => {
              const isFav = favoriteTeamIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleFavoriteTeam(t.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isFav
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                  }`}
                >
                  <span className="text-base">{t.logo}</span>
                  <span>{t.name}</span>
                  {isFav ? (
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 ml-0.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Case 0: Data is loading */}
      {loading ? (
        <MyTeamsSectionSkeleton count={favoriteTeamIds.length > 0 ? Math.min(favoriteTeamIds.length, 4) : 2} />
      ) : favoriteTeams.length === 0 ? (
        /* Case 1: No Favorite Teams Selected (Empty State) */
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <Star className="w-6 h-6 fill-amber-400/30 text-amber-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-slate-200">
              Añade tus equipos favoritos
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Selecciona tus novenas preferidas para consultar al instante sus marcadores en vivo,
              últimos resultados oficiales y próximos juegos en el calendario de la temporada.
            </p>
          </div>

          {/* Quick-Pick Recommendation Pills */}
          <div className="pt-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-3">
              Equipos sugeridos para seguir:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
              {teams.slice(0, 5).map((team) => (
                <button
                  key={team.id}
                  onClick={() => toggleFavoriteTeam(team.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer hover:border-amber-500/40 group"
                >
                  <span className="text-base">{team.logo}</span>
                  <span>{team.name}</span>
                  <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-125 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Case 2: Favorites Grid Cards */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {favoriteTeams.map((team) => {
            const recentGame = getTeamRecentGame(team.id);
            const nextGame = getTeamNextGame(team.id);
            const primaryColor = team.colors?.primary || '#10b981';

            // Determine if team won or lost recent game
            let resultBadge = null;
            if (recentGame) {
              const isHome = recentGame.homeTeam?.id === team.id;
              const teamScore = isHome ? recentGame.homeScore : recentGame.awayScore;
              const oppScore = isHome ? recentGame.awayScore : recentGame.homeScore;
              const oppTeam = isHome ? recentGame.awayTeam : recentGame.homeTeam;
              const isLive = recentGame.status === 'LIVE';

              if (isLive) {
                resultBadge = {
                  type: 'live',
                  text: `EN VIVO • ${recentGame.currentInning}ª ${recentGame.isTopInning ? '▲' : '▼'}`,
                  scoreText: `${team.shortName} ${teamScore} - ${oppScore} ${oppTeam?.shortName}`,
                  isLeading: teamScore > oppScore,
                  isTied: teamScore === oppScore,
                  oppName: oppTeam?.name || 'Rival',
                  oppLogo: oppTeam?.logo || '⚾',
                };
              } else if (recentGame.status === 'FINAL') {
                const won = teamScore > oppScore;
                resultBadge = {
                  type: won ? 'win' : 'loss',
                  text: won ? 'Victoria' : 'Derrota',
                  scoreText: `${teamScore} - ${oppScore}`,
                  isLeading: won,
                  isTied: false,
                  oppName: oppTeam?.name || 'Rival',
                  oppLogo: oppTeam?.logo || '⚾',
                };
              }
            }

            // Next game details
            let nextMatchInfo = null;
            if (nextGame) {
              const isHome = nextGame.homeTeam?.id === team.id;
              const oppTeam = isHome ? nextGame.awayTeam : nextGame.homeTeam;
              nextMatchInfo = {
                oppName: oppTeam?.name || 'Rival',
                oppShort: oppTeam?.shortName || '',
                oppLogo: oppTeam?.logo || '⚾',
                locationType: isHome ? 'En casa' : 'Visitante',
                date: nextGame.date,
                time: nextGame.time,
                stadium: nextGame.stadium,
              };
            }

            return (
              <div
                key={team.id}
                className="group relative rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/90 p-5 shadow-lg hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Accent Top Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: primaryColor }}
                />

                {/* Card Top: Team Info & Favorite Toggle */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      onClick={() => navigateToTeam(team.id)}
                      className="flex items-center gap-3.5 cursor-pointer group/title min-w-0"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border border-slate-700 shadow-md shrink-0 transition-transform group-hover/title:scale-105"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        {team.logo}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-white group-hover/title:text-emerald-400 transition-colors truncate">
                            {team.name}
                          </h3>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                            {team.shortName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {team.city} • {team.stadium}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleFavoriteTeam(team.id)}
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
                        title="Quitar de favoritos"
                        aria-label={`Quitar a ${team.name} de favoritos`}
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </button>
                    </div>
                  </div>

                  {/* Record and Position Pill */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-semibold border border-slate-700">
                      Récord: <strong className="text-emerald-400">{team.record.wins}</strong>-{team.record.losses} ({team.record.pct.toFixed(3)})
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      Lugar #{team.record.position}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        team.record.streak.startsWith('G')
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      Racha: {team.record.streak}
                    </span>
                  </div>

                  {/* Dual Grid: Recent Score vs Next Scheduled Match */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {/* 1. Recent / Live Game */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          {recentGame?.status === 'LIVE' ? (
                            <>
                              <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                              <span className="text-red-400">En Vivo</span>
                            </>
                          ) : (
                            <>
                              <Trophy className="w-3 h-3 text-slate-400" />
                              <span>Último Resultado</span>
                            </>
                          )}
                        </span>
                        {recentGame && (
                          <button
                            onClick={() => navigateToGame(recentGame.id)}
                            className="text-emerald-400 hover:text-emerald-300 font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Box Score</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {recentGame && resultBadge ? (
                        <div
                          onClick={() => navigateToGame(recentGame.id)}
                          className="cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{resultBadge.oppLogo}</span>
                              <span className="text-xs font-semibold text-slate-200 truncate max-w-[110px]">
                                vs {resultBadge.oppName}
                              </span>
                            </div>
                            <span
                              className={`text-xs font-mono font-black px-1.5 py-0.5 rounded ${
                                resultBadge.type === 'live'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : resultBadge.type === 'win'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {resultBadge.text}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1 border-t border-slate-900">
                            <span className="font-mono text-base font-black text-white">
                              {resultBadge.scoreText}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {recentGame.date}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 py-2">
                          Sin partidos disputados recientemente
                        </p>
                      )}
                    </div>

                    {/* 2. Next Scheduled Match */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-sky-400" />
                          <span>Próximo Partido</span>
                        </span>
                        {nextGame && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {nextMatchInfo?.date}
                          </span>
                        )}
                      </div>

                      {nextGame && nextMatchInfo ? (
                        <div
                          onClick={() => navigateToGame(nextGame.id)}
                          className="cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{nextMatchInfo.oppLogo}</span>
                              <div>
                                <span className="text-xs font-bold text-slate-200 block truncate max-w-[120px]">
                                  {nextMatchInfo.oppName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {nextMatchInfo.locationType}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-[11px] font-bold">
                              {nextMatchInfo.time} hrs
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-900 truncate">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{nextMatchInfo.stadium}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 py-2">
                          Calendario por definir para este equipo
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Deep Links */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                  <button
                    onClick={() => navigateToTeam(team.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ver Roster y Estadísticas</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('games')}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-[11px]"
                  >
                    <span>Calendario general</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
