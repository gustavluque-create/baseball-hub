import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Shield, Swords, ArrowLeftRight, X, Check, Sparkles, Camera } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { PlayersGridSkeleton, Skeleton } from '../components/LoadingSkeleton.tsx';
import { Player, Team } from '../types/index.ts';
import { PlayerComparisonView } from '../components/PlayerComparisonView.tsx';
import { PlayerImageEditorModal } from '../components/admin/PlayerImageEditorModal.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';

export const PlayersView: React.FC = () => {
  const { navigateToPlayer, activeCompetitionId, dataVersion, triggerDataRefresh } = useApp();
  const { isAdminAuthenticated } = useAdminAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [selectedTeamId, setSelectedTeamId] = useState('ALL');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Player comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [comparePlayerAId, setComparePlayerAId] = useState<string | null>(null);
  const [comparePlayerBId, setComparePlayerBId] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getTeams(activeCompetitionId).then(setTeams).catch(console.error);
  }, [activeCompetitionId]);

  useEffect(() => {
    setLoading(true);
    ApiClient.getPlayers({
      search: search || undefined,
      position: selectedPosition === 'ALL' ? undefined : selectedPosition,
      teamId: selectedTeamId === 'ALL' ? undefined : selectedTeamId,
      limit: 100,
    })
      .then((res) => {
        setPlayers(res.items);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [search, selectedPosition, selectedTeamId, dataVersion]);

  // Handle player selection for comparison
  const handleToggleComparePlayer = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();

    if (comparePlayerAId === playerId) {
      setComparePlayerAId(null);
      return;
    }
    if (comparePlayerBId === playerId) {
      setComparePlayerBId(null);
      return;
    }

    if (!comparePlayerAId) {
      setComparePlayerAId(playerId);
    } else if (!comparePlayerBId) {
      setComparePlayerBId(playerId);
      setShowComparison(true);
    } else {
      // Both are set, replace slot B
      setComparePlayerBId(playerId);
      setShowComparison(true);
    }
  };

  const handleOpenDefaultComparison = () => {
    if (!comparePlayerAId && players.length > 0) {
      setComparePlayerAId(players[0].id);
    }
    if (!comparePlayerBId && players.length > 1) {
      setComparePlayerBId(players[1].id);
    }
    setShowComparison(true);
  };

  const handleClearComparison = () => {
    setComparePlayerAId(null);
    setComparePlayerBId(null);
    setShowComparison(false);
  };

  const playerA = players.find((p) => p.id === comparePlayerAId);
  const playerB = players.find((p) => p.id === comparePlayerBId);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            Directorio Oficial de Jugadores
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm text-slate-400">
              Busca y explora fichas biométricas, posiciones y trayectorias de todos los atletas de la liga.
            </p>
            {loading && players.length === 0 ? (
              <Skeleton className="h-4 w-20 rounded-md inline-block" />
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-emerald-400 border border-slate-700">
                {players.length} {players.length === 1 ? 'atleta' : 'atletas'}
              </span>
            )}
          </div>
        </div>

        {/* Toggle Compare Button */}
        <button
          onClick={() => {
            if (showComparison) {
              setShowComparison(false);
            } else {
              handleOpenDefaultComparison();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
            showComparison
              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 hover:border-emerald-400'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>{showComparison ? 'Ocultar Comparador' : 'Comparar Jugadores'}</span>
          {(comparePlayerAId || comparePlayerBId) && (
            <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 text-[10px] flex items-center justify-center font-bold">
              {[comparePlayerAId, comparePlayerBId].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* COMPARATIVE PANEL (Active view) */}
      {showComparison && players.length > 0 && (
        <div className="transition-all animate-fadeIn">
          <PlayerComparisonView
            allPlayers={players}
            initialPlayerAId={comparePlayerAId || players[0]?.id}
            initialPlayerBId={comparePlayerBId || players[1]?.id}
            onClose={() => setShowComparison(false)}
          />
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Position Selector */}
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="bg-slate-900 text-slate-300 text-xs px-3 py-2 rounded-xl border border-slate-800 cursor-pointer focus:outline-none"
          >
            <option value="ALL">Todas las posiciones</option>
            <option value="C">Receptor (C)</option>
            <option value="1B">Primera Base (1B)</option>
            <option value="2B">Segunda Base (2B)</option>
            <option value="3B">Tercera Base (3B)</option>
            <option value="SS">Campocorto (SS)</option>
            <option value="OF">Jardineros (OF)</option>
            <option value="P">Lanzadores (P)</option>
            <option value="BD">Bateador Designado (BD)</option>
          </select>

          {/* Team Selector */}
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="bg-slate-900 text-slate-300 text-xs px-3 py-2 rounded-xl border border-slate-800 cursor-pointer focus:outline-none"
          >
            <option value="ALL">Todos los equipos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Players Grid */}
      {loading ? (
        <PlayersGridSkeleton count={12} />
      ) : players.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800">
          <p className="text-base font-semibold text-slate-300">No se encontraron jugadores.</p>
          <p className="text-xs text-slate-500 mt-1">Prueba cambiando los filtros o el término de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {players.map((player) => {
            const isPlayerA = comparePlayerAId === player.id;
            const isPlayerB = comparePlayerBId === player.id;
            const isSelected = isPlayerA || isPlayerB;

            return (
              <div
                key={player.id}
                onClick={() => navigateToPlayer(player.id)}
                className={`group relative p-4 rounded-2xl transition-all shadow-sm hover:shadow-xl flex items-center gap-3.5 cursor-pointer ${
                  isSelected
                    ? isPlayerA
                      ? 'bg-emerald-950/40 border-2 border-emerald-500 shadow-emerald-500/10'
                      : 'bg-amber-950/40 border-2 border-amber-500 shadow-amber-500/10'
                    : 'bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="relative group/avatar shrink-0">
                  <img
                    src={player.photo}
                    alt={player.fullName}
                    className={`w-14 h-14 rounded-full object-cover border shrink-0 group-hover:scale-105 transition-transform ${
                      isPlayerA
                        ? 'border-emerald-500'
                        : isPlayerB
                        ? 'border-amber-500'
                        : 'border-slate-700'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                  {isAdminAuthenticated && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPlayer(player);
                      }}
                      className="absolute -bottom-1 -left-1 p-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow border border-slate-900 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                      title="Editar foto del jugador (Admin)"
                    >
                      <Camera className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {isSelected && (
                    <span
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-slate-950 shadow-md ${
                        isPlayerA ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    >
                      {isPlayerA ? '1' : '2'}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 truncate transition-colors">
                      {player.fullName}
                    </h3>
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      #{player.jerseyNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {player.position} • {player.teamShort}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{player.age} años</span>
                      <span>•</span>
                      <span>{player.bats}/{player.throws}</span>
                    </div>

                    {/* Compare Check/Button */}
                    <button
                      onClick={(e) => handleToggleComparePlayer(e, player.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? isPlayerA
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                      title={isSelected ? 'Quitar de la comparativa' : 'Añadir a la comparativa'}
                    >
                      {isSelected ? 'Elegido' : '+ Comparar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FLOATING COMPARISON DOCK */}
      {(comparePlayerAId || comparePlayerBId) && !showComparison && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3 animate-slideUp">
          <div className="flex items-center gap-2 min-w-0">
            {/* Slot A Mini Preview */}
            {playerA ? (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-emerald-500/50">
                <img
                  src={playerA.photo}
                  alt={playerA.fullName}
                  className="w-6 h-6 rounded-full object-cover border border-emerald-400"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs font-bold text-white truncate max-w-[100px]">
                  {playerA.fullName.split(' ')[0]}
                </span>
                <button
                  onClick={() => setComparePlayerAId(null)}
                  className="text-slate-500 hover:text-slate-300 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic px-2">Jugador 1...</span>
            )}

            <span className="text-xs font-black text-slate-400 font-mono">VS</span>

            {/* Slot B Mini Preview */}
            {playerB ? (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-amber-500/50">
                <img
                  src={playerB.photo}
                  alt={playerB.fullName}
                  className="w-6 h-6 rounded-full object-cover border border-amber-400"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs font-bold text-white truncate max-w-[100px]">
                  {playerB.fullName.split(' ')[0]}
                </span>
                <button
                  onClick={() => setComparePlayerBId(null)}
                  className="text-slate-500 hover:text-slate-300 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic px-2">Jugador 2...</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowComparison(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Ver Comparativa</span>
            </button>
            <button
              onClick={handleClearComparison}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Limpiar selección"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Player Photo Editor Modal (Restricted to authenticated admin) */}
      {isAdminAuthenticated && editingPlayer && (
        <PlayerImageEditorModal
          player={editingPlayer}
          isOpen={Boolean(editingPlayer)}
          onClose={() => setEditingPlayer(null)}
          onSavePhoto={(newPhoto, updatedPlayer) => {
            if (updatedPlayer) {
              setPlayers((prev) =>
                prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p))
              );
            } else {
              setPlayers((prev) =>
                prev.map((p) =>
                  p.id === editingPlayer.id ? { ...p, photo: newPhoto } : p
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

