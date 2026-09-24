import React, { useState, useEffect } from 'react';
import { Shield, MapPin, Users, Trophy, Star, Camera, Swords, ArrowLeftRight, LayoutGrid } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { TeamsGridSkeleton } from '../components/LoadingSkeleton.tsx';
import { Team } from '../types/index.ts';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { TeamLogoEditorModal } from '../components/admin/TeamLogoEditorModal.tsx';
import { TeamComparisonSection } from '../components/comparison/TeamComparisonSection.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';

export const TeamsView: React.FC = () => {
  const {
    activeCompetitionId,
    navigateToTeam,
    navigateToPlayer,
    favoriteTeamIds,
    toggleFavoriteTeam,
    dataVersion,
    triggerDataRefresh,
  } = useApp();
  const { isAdminAuthenticated } = useAdminAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'compare'>('list');
  const [comparisonTeamA, setComparisonTeamA] = useState<string>('ind');
  const [comparisonTeamB, setComparisonTeamB] = useState<string>('mtz');
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [selectedLogoTeam, setSelectedLogoTeam] = useState<Team | null>(null);

  useEffect(() => {
    setLoading(true);
    ApiClient.getTeams(activeCompetitionId)
      .then((res) => {
        setTeams(res);
        if (res.length >= 2) {
          // If favorite teams exist, default comparison to them
          const favs = res.filter((t) => favoriteTeamIds.includes(t.id));
          if (favs.length >= 2) {
            setComparisonTeamA(favs[0].id);
            setComparisonTeamB(favs[1].id);
          } else if (favs.length === 1) {
            setComparisonTeamA(favs[0].id);
            const other = res.find((t) => t.id !== favs[0].id);
            if (other) setComparisonTeamB(other.id);
          } else {
            setComparisonTeamA(res[0].id);
            setComparisonTeamB(res[1].id);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[TeamsView] Could not load teams:', err?.message || err);
        setLoading(false);
      });
  }, [activeCompetitionId, dataVersion]);

  const displayedTeams = filterFavoritesOnly
    ? teams.filter((t) => favoriteTeamIds.includes(t.id))
    : teams;

  const favoriteCount = teams.filter((t) => favoriteTeamIds.includes(t.id)).length;

  const handleStartCompare = (teamId: string) => {
    setComparisonTeamA(teamId);
    // Select a good rival for Team B
    const alternate = teams.find((t) => t.id !== teamId);
    if (alternate && comparisonTeamB === teamId) {
      setComparisonTeamB(alternate.id);
    }
    setActiveTab('compare');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-emerald-400" />
            Equipos y Franquicias Participantes
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Explora las franquicias de la Serie Nacional, analiza duelos cara a cara con gráficos interactivos y gestiona tus favoritos.
          </p>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Main View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Lista de Equipos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>Comparador H2H</span>
            </button>
          </div>

          {/* Favorites Filter (only in list mode) */}
          {activeTab === 'list' && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setFilterFavoritesOnly(false)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  !filterFavoritesOnly
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({teams.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterFavoritesOnly(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterFavoritesOnly
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${filterFavoritesOnly ? 'fill-slate-950' : 'text-amber-400'}`} />
                <span>Favoritos ({favoriteCount})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'compare' ? (
        <div className="space-y-4">
          <TeamComparisonSection
            initialTeamAId={comparisonTeamA}
            initialTeamBId={comparisonTeamB}
            allTeams={teams}
            onSelectTeam={navigateToTeam}
            onSelectPlayer={navigateToPlayer}
          />
        </div>
      ) : loading ? (
        <TeamsGridSkeleton count={8} />
      ) : displayedTeams.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 space-y-3">
          <Star className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No tienes equipos favoritos guardados</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Haz clic en la estrella de cualquier equipo para agregarlo a tus favoritos y acceder rápidamente a sus marcadores en la portada.
          </p>
          <button
            onClick={() => setFilterFavoritesOnly(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
          >
            Ver todos los equipos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayedTeams.map((team) => {
            const primaryColor = team.colors?.primary || team.primaryColor || '#10b981';
            const isFav = favoriteTeamIds.includes(team.id);

            return (
              <div
                key={team.id}
                onClick={() => navigateToTeam(team.id)}
                className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 cursor-pointer transition-all shadow-md hover:shadow-xl hover:shadow-black/50 flex flex-col justify-between relative"
                style={{
                  borderTop: `4px solid ${primaryColor}`,
                }}
              >
                {/* Header & Logo with Favorite Star */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative group/logo shrink-0">
                      <div
                        className="w-13 h-13 rounded-2xl flex items-center justify-center text-3xl shadow-lg border border-slate-700 p-1 overflow-hidden"
                        style={{ backgroundColor: `${primaryColor}25` }}
                      >
                        <TeamLogo logo={team.logo} name={team.name} className="w-full h-full" />
                      </div>
                      {isAdminAuthenticated && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogoTeam(team);
                          }}
                          className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow border border-slate-900 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                          title="Editar logo del equipo (Admin)"
                        >
                          <Camera className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-white group-hover:text-emerald-400 transition-colors truncate">
                        {team.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium truncate">
                        {team.nickname} • {team.city}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                          {team.shortName}
                        </span>
                        {isAdminAuthenticated && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLogoTeam(team);
                            }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline font-semibold cursor-pointer"
                          >
                            Editar Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Favorite Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteTeam(team.id);
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                      isFav
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-slate-750'
                    }`}
                    title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                    aria-label={`Favorito ${team.name}`}
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                  </button>
                </div>

                {/* Stadium & Manager */}
                <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{team.stadium}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span>Mánager:</span>
                    <strong className="text-slate-200">{team.manager}</strong>
                  </div>
                </div>

                {/* Record Footer & Action Buttons */}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Récord</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {team.record.wins}-{team.record.losses} ({team.record.pct.toFixed(3)})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Compare Quick Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCompare(team.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-xs font-bold transition-all flex items-center gap-1 border border-slate-700/80 cursor-pointer"
                      title={`Comparar ${team.shortName} con otro equipo`}
                    >
                      <ArrowLeftRight className="w-3 h-3 text-emerald-400 group-hover:text-slate-950" />
                      <span className="hidden sm:inline">Comparar</span>
                    </button>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                    >
                      Roster
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team Logo Editor Modal */}
      {selectedLogoTeam && (
        <TeamLogoEditorModal
          team={selectedLogoTeam}
          isOpen={Boolean(selectedLogoTeam)}
          onClose={() => setSelectedLogoTeam(null)}
          onSaveLogo={(newLogo, updatedTeam) => {
            if (updatedTeam) {
              setTeams((prev) =>
                prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t))
              );
            } else {
              setTeams((prev) =>
                prev.map((t) =>
                  t.id === selectedLogoTeam.id ? { ...t, logo: newLogo } : t
                )
              );
            }
            triggerDataRefresh();
          }}
        />
      )}
    </div>
  );
};

