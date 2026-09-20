import React, { useState, useEffect } from 'react';
import { X, MapPin, Trophy, Users, Shield, Calendar, Award, Star } from 'lucide-react';
import { Team, Player, Game } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { TeamProfileSkeleton } from './LoadingSkeleton.tsx';

interface TeamProfileModalProps {
  teamId: string | null;
  onClose: () => void;
}

export const TeamProfileModal: React.FC<TeamProfileModalProps> = ({ teamId, onClose }) => {
  const { navigateToPlayer, navigateToGame, favoriteTeamIds, toggleFavoriteTeam, isFavoriteTeam } = useApp();
  const [data, setData] = useState<{
    team: Team;
    roster: Player[];
    games: Game[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roster' | 'games' | 'info'>('roster');

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    ApiClient.getTeamDetail(teamId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [teamId]);

  if (!teamId) return null;

  // Group roster by position
  const groupRoster = (players: Player[]) => {
    const catchers = players.filter((p) => p.position === 'C');
    const infielders = players.filter((p) => ['1B', '2B', '3B', 'SS', 'IF'].includes(p.position));
    const outfielders = players.filter((p) => ['LF', 'CF', 'RF', 'OF', 'BD'].includes(p.position));
    const pitchers = players.filter((p) => ['P', 'L', 'RP', 'SP'].includes(p.position));
    return { catchers, infielders, outfielders, pitchers };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
              Perfil Oficial del Equipo
            </span>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button
                type="button"
                onClick={() => toggleFavoriteTeam(data.team.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  isFavoriteTeam(data.team.id)
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-750'
                }`}
                title={isFavoriteTeam(data.team.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              >
                <Star className={`w-3.5 h-3.5 ${isFavoriteTeam(data.team.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                <span>{isFavoriteTeam(data.team.id) ? 'Favorito' : 'Seguir Equipo'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading || !data ? (
            <TeamProfileSkeleton />
          ) : (
            <>
              {/* Team Hero Card */}
              {(() => {
                const primaryColor = data.team.colors?.primary || data.team.primaryColor || '#10b981';
                const capacity = data.team.capacity || data.team.stadiumCapacity || 25000;
                const championshipsCount = typeof data.team.championships === 'number' ? data.team.championships : (Array.isArray(data.team.championships) ? data.team.championships.length : 0);

                return (
                  <div
                    className="p-6 rounded-2xl border border-slate-800 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}22 0%, #090d16 100%)`,
                    }}
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div
                        className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shadow-xl border border-slate-700"
                        style={{ backgroundColor: `${primaryColor}33` }}
                      >
                        {data.team.logo}
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-1.5">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <h2 className="text-2xl sm:text-3xl font-black text-white">{data.team.name}</h2>
                          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                            {data.team.shortName}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 font-medium">
                          {data.team.nickname} • {data.team.city}, Cuba
                        </p>

                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            {data.team.stadium} (Cap. {capacity.toLocaleString()})
                          </span>
                          <span>•</span>
                          <span>Mánager: <strong className="text-slate-200">{data.team.manager}</strong></span>
                          <span>•</span>
                          <span>Fundado: {data.team.foundedYear}</span>
                        </div>
                      </div>

                      {/* Record badge */}
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-[130px]">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Récord 2026</span>
                        <span className="font-mono text-2xl font-black text-emerald-400">
                          {data.team.record.wins}-{data.team.record.losses}
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          {data.team.record.pct.toFixed(3)} PCT
                        </span>
                      </div>
                    </div>

                    {/* Championships */}
                    {championshipsCount > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs">
                        <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-slate-300 font-semibold">Títulos de Serie Nacional:</span>
                        <span className="text-amber-400 font-bold">{championshipsCount} coronas</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800">
                <button
                  onClick={() => setActiveTab('roster')}
                  className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'roster'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Róster de Jugadores ({data.roster.length})
                </button>
                <button
                  onClick={() => setActiveTab('games')}
                  className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'games'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Calendario y Resultados ({data.games.length})
                </button>
              </div>

              {/* TAB: ROSTER */}
              {activeTab === 'roster' && (
                <div className="space-y-6">
                  {(() => {
                    const groups = groupRoster(data.roster);
                    const sections = [
                      { title: 'Receptores (Catchers)', list: groups.catchers },
                      { title: 'Jugadores de Cuadro (Infielders)', list: groups.infielders },
                      { title: 'Jardineros (Outfielders)', list: groups.outfielders },
                      { title: 'Cuerpo de Lanzadores (Pitchers)', list: groups.pitchers },
                    ];

                    return sections.map((sec) => (
                      <div key={sec.title} className="space-y-2">
                        <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">
                          {sec.title} ({sec.list.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {sec.list.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                onClose();
                                navigateToPlayer(p.id);
                              }}
                              className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
                            >
                              <img
                                src={p.photo}
                                alt={p.fullName}
                                className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 truncate transition-colors">
                                  {p.fullName}
                                </p>
                                <p className="text-xs text-slate-400">
                                  #{p.jerseyNumber} • {p.position} • {p.age} años
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* TAB: GAMES */}
              {activeTab === 'games' && (
                <div className="space-y-2">
                  {data.games.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => {
                        onClose();
                        navigateToGame(g.id);
                      }}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-500">{g.date}</span>
                        <span className="font-bold text-slate-200">
                          {g.awayTeam.shortName} {g.status !== 'SCHEDULED' ? g.awayScore : ''} vs{' '}
                          {g.homeTeam.shortName} {g.status !== 'SCHEDULED' ? g.homeScore : ''}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {g.status === 'FINAL' ? 'FINAL' : g.status === 'LIVE' ? 'EN VIVO' : g.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
