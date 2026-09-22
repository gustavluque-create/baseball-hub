import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  RefreshCw,
  X,
  Save,
  FileSpreadsheet,
  Camera,
  Edit3,
  Sliders,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { Player, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { playerCreateSchema, validateWithSchema } from '../../schemas/adminSchemas.ts';
import { PlayerImageEditorModal, BASEBALL_PHOTO_PRESETS } from './PlayerImageEditorModal.tsx';
import { AdminPlayerImportModal } from './AdminPlayerImportModal.tsx';
import { PlayerEditModal } from './PlayerEditModal.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const AdminPlayersManager: React.FC = () => {
  const { dataVersion } = useApp();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modals state
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [imageEditingPlayer, setImageEditingPlayer] = useState<Player | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateImageEditorOpen, setIsCreateImageEditorOpen] = useState(false);

  // New player form fields
  const [fullName, setFullName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState(23);
  const [position, setPosition] = useState('OF');
  const [bats, setBats] = useState<'R' | 'L' | 'S'>('R');
  const [throws, setThrows] = useState<'R' | 'L'>('R');
  const [photo, setPhoto] = useState(BASEBALL_PHOTO_PRESETS[0].url);
  const [isStar, setIsStar] = useState(false);
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createFirstError, setCreateFirstError] = useState<string | null>(null);

  // Compute roster count per team (Serie Nacional limit: maximum 40 players per team)
  const teamRosterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((p) => {
      counts[p.teamId] = (counts[p.teamId] || 0) + 1;
    });
    return counts;
  }, [players]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [fetchedPlayersRes, fetchedTeams] = await Promise.all([
        ApiClient.getPlayers({ limit: 1000 }),
        ApiClient.getTeams(),
      ]);
      // Deduplicate fetched players by ID to avoid any double entries in the UI
      const uniquePlayers: Player[] = [];
      const seenIds = new Set<string>();
      for (const p of fetchedPlayersRes.items) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          uniquePlayers.push(p);
        }
      }
      setPlayers(uniquePlayers);
      setTeams(fetchedTeams);
      if (fetchedTeams.length > 0 && !teamId) {
        setTeamId(fetchedTeams[0].id);
      }
    } catch (err: any) {
      console.error('Error loading players:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [dataVersion]);

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setCreateErrors({});
    setCreateFirstError(null);

    // 1. Enforce 40 players maximum roster limit per team
    const currentTeamCount = teamRosterCounts[teamId] || 0;
    if (currentTeamCount >= 40) {
      const teamObj = teams.find((t) => t.id === teamId);
      setCreateFirstError(
        `El equipo ${teamObj?.name || 'seleccionado'} ya cuenta con el límite reglamentario máximo de 40 jugadores.`
      );
      return;
    }

    // 2. Prevent duplicate player with the same name in the same team
    const normalizedName = fullName.trim().toLowerCase();
    const alreadyExists = players.some(
      (p) => p.teamId === teamId && p.fullName.trim().toLowerCase() === normalizedName
    );
    if (alreadyExists) {
      setCreateFirstError(
        `Ya existe un jugador registrado con el nombre "${fullName.trim()}" en este equipo.`
      );
      return;
    }

    const validationResult = validateWithSchema(playerCreateSchema, {
      fullName: fullName.trim(),
      teamId,
      jerseyNumber: Number(jerseyNumber),
      position,
      bats,
      throws,
      photo,
      bio: bio.trim(),
      isStar,
    });

    if (!validationResult.success) {
      setCreateErrors(validationResult.errors);
      setCreateFirstError(validationResult.firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      const newPlayer = await ApiClient.createAdminPlayer(validationResult.data as any);

      // Add to state avoiding duplicate copies
      setPlayers((prev) => {
        const clean = prev.filter(
          (p) =>
            p.id !== newPlayer.id &&
            !(p.teamId === newPlayer.teamId && p.fullName.trim().toLowerCase() === newPlayer.fullName.trim().toLowerCase())
        );
        return [newPlayer, ...clean];
      });
      setIsCreating(false);
      setFullName('');
      setBio('');
      setCreateErrors({});
      setCreateFirstError(null);
      showMessage(`Jugador ${newPlayer.fullName} registrado exitosamente.`);
    } catch (err: any) {
      setCreateFirstError(`Error al crear jugador: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de que desea retirar del roster a ${name}?`)) return;
    try {
      await ApiClient.deleteAdminPlayer(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      showMessage(`Jugador ${name} eliminado del sistema.`);
    } catch (err: any) {
      alert(`Error al eliminar jugador: ${err.message}`);
    }
  };

  const handleUpdatePlayerSuccess = (updatedPlayer: Player) => {
    // Strictly update the player in-place by unique ID to preserve roster order and avoid duplicates
    setPlayers((prev) => {
      const exists = prev.some((p) => p.id === updatedPlayer.id);
      if (exists) {
        return prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p));
      }
      return [updatedPlayer, ...prev.filter((p) => p.id !== updatedPlayer.id)];
    });
    showMessage(`Datos y fotografía de ${updatedPlayer.fullName} actualizados.`);
  };

  const handlePhotoUpdated = (newPhotoUrl: string, updatedPlayer?: Player) => {
    if (updatedPlayer) {
      handleUpdatePlayerSuccess(updatedPlayer);
    } else if (imageEditingPlayer) {
      // Direct local update if returned without full player payload
      setPlayers((prev) =>
        prev.map((p) => (p.id === imageEditingPlayer.id ? { ...p, photo: newPhotoUrl } : p))
      );
      showMessage(`Fotografía de ${imageEditingPlayer.fullName} actualizada.`);
    }
    setImageEditingPlayer(null);
  };

  const handleImportSuccess = (count: number, message: string) => {
    fetchInitialData();
    showMessage(message);
  };

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  const filtered = players.filter((p) => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.teamName.toLowerCase().includes(search.toLowerCase()) ||
      p.position.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = teamFilter === 'all' || p.teamId === teamFilter;
    return matchesSearch && matchesTeam;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-lg w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, posición o equipo..."
              className="w-full pl-9 pr-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-semibold focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Todos los Equipos ({players.length})</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName} ({teamRosterCounts[t.id] || 0}/40)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
          <button
            onClick={fetchInitialData}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Recargar jugadores"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Import Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-lg bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            title="Cargar rosters completos vía CSV o JSON"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar Roster</span>
          </button>

          {/* New Player Button */}
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Jugador</span>
          </button>
        </div>
      </div>

      {/* Team Roster Status Banner */}
      {teamFilter !== 'all' && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-slate-200">
              Nómina Oficial: {teams.find((t) => t.id === teamFilter)?.name}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                (teamRosterCounts[teamFilter] || 0) >= 40
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : (teamRosterCounts[teamFilter] || 0) >= 35
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {teamRosterCounts[teamFilter] || 0} / 40 jugadores
              {(teamRosterCounts[teamFilter] || 0) >= 40 ? ' • Roster Completo' : ''}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
            Serie Nacional: Límite máximo 40 peloteros
          </span>
        </div>
      )}

      {/* Create Player Modal/Form */}
      {isCreating && (
        <form
          onSubmit={handleCreatePlayer}
          className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Alta de Jugador en Base de Datos</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Zod Validation Error Banner */}
          {createFirstError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{createFirstError}</span>
            </div>
          )}

          {/* Photo picker row in create form */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="relative group">
              <div className={`w-16 h-16 rounded-xl overflow-hidden border bg-slate-900 ${createErrors.photo ? 'border-red-500' : 'border-emerald-500/50'}`}>
                <img
                  src={photo}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsCreateImageEditorOpen(true)}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white transition-opacity"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1">
              <span className="text-xs font-bold text-slate-200 block">Fotografía del Jugador</span>
              <p className="text-[11px] text-slate-400">
                Sube un archivo de imagen, recorta, aplica filtros o elige una foto de la galería oficial.
              </p>
              {createErrors.photo && (
                <p className="text-[10px] text-red-400 font-semibold mt-0.5">{createErrors.photo}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCreateImageEditorOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Subir / Elegir Foto</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre Completo *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (createErrors.fullName) {
                    setCreateErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.fullName;
                      return updated;
                    });
                  }
                }}
                placeholder="ej. Yurisbel Gracial"
                className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 focus:outline-none transition-colors ${
                  createErrors.fullName
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
              {createErrors.fullName && (
                <p className="text-[10px] text-red-400 font-semibold mt-1">{createErrors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Equipo *</label>
              <select
                value={teamId}
                onChange={(e) => {
                  setTeamId(e.target.value);
                  if (createErrors.teamId) {
                    setCreateErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.teamId;
                      return updated;
                    });
                  }
                }}
                className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 font-semibold focus:outline-none transition-colors ${
                  createErrors.teamId
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              >
                {teams.map((t) => {
                  const count = teamRosterCounts[t.id] || 0;
                  const isFull = count >= 40;
                  return (
                    <option key={t.id} value={t.id} disabled={isFull}>
                      {t.name} ({t.shortName}) — {count}/40 {isFull ? '• [Lleno]' : ''}
                    </option>
                  );
                })}
              </select>
              {(teamRosterCounts[teamId] || 0) >= 40 && (
                <p className="text-[10px] text-red-400 font-semibold mt-1 flex items-center gap-1">
                  <span>⚠️ Roster completo: Este equipo alcanzó el tope de 40 jugadores.</span>
                </p>
              )}
              {createErrors.teamId && (
                <p className="text-[10px] text-red-400 font-semibold mt-1">{createErrors.teamId}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Número &amp; Posición</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={jerseyNumber}
                  onChange={(e) => {
                    setJerseyNumber(Number(e.target.value));
                    if (createErrors.jerseyNumber) {
                      setCreateErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.jerseyNumber;
                        return updated;
                      });
                    }
                  }}
                  placeholder="#"
                  className={`w-16 px-2 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 font-mono focus:outline-none transition-colors ${
                    createErrors.jerseyNumber
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="flex-1 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="P">P (Lanzador)</option>
                  <option value="C">C (Receptor)</option>
                  <option value="1B">1B (Primera Base)</option>
                  <option value="2B">2B (Segunda Base)</option>
                  <option value="3B">3B (Tercera Base)</option>
                  <option value="SS">SS (Torpedero)</option>
                  <option value="OF">OF (Jardinero)</option>
                  <option value="DH">DH (Designado)</option>
                </select>
              </div>
              {createErrors.jerseyNumber && (
                <p className="text-[10px] text-red-400 font-semibold mt-1">{createErrors.jerseyNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Batea / Lanza / Estrella</label>
              <div className="flex items-center gap-2">
                <select
                  value={bats}
                  onChange={(e) => setBats(e.target.value as any)}
                  className="px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="R">B: Der</option>
                  <option value="L">B: Zur</option>
                  <option value="S">B: Amb</option>
                </select>
                <select
                  value={throws}
                  onChange={(e) => setThrows(e.target.value as any)}
                  className="px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="R">L: Der</option>
                  <option value="L">L: Zur</option>
                </select>
                <label className="flex items-center gap-1 text-[11px] text-amber-400 cursor-pointer pl-1">
                  <input
                    type="checkbox"
                    checked={isStar}
                    onChange={(e) => setIsStar(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0"
                  />
                  <span>Estrella</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (teamRosterCounts[teamId] || 0) >= 40}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Jugador'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Players Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 text-xs font-bold text-slate-400 flex items-center justify-between">
          <span>Listado Oficial de Roster ({filtered.length} jugadores)</span>
          <span className="text-[11px] text-slate-500">
            Haz clic en la foto o en el botón editar para actualizar imagen y datos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Foto</th>
                <th className="py-2.5 px-3">Jugador</th>
                <th className="py-2.5 px-3">Equipo</th>
                <th className="py-2.5 px-3">Posición</th>
                <th className="py-2.5 px-3">B/L</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((player) => (
                <tr key={player.id} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                    #{player.jerseyNumber}
                  </td>

                  {/* Player Photo with interactive trigger */}
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => setImageEditingPlayer(player)}
                      className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-700 hover:border-emerald-400 shadow-sm group/photo cursor-pointer transition-all"
                      title="Haz clic para subir o editar la foto"
                    >
                      <img
                        src={player.photo}
                        alt={player.fullName}
                        className="w-full h-full object-cover group-hover/photo:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Camera className="w-3.5 h-3.5 text-emerald-300" />
                      </div>
                    </button>
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{player.fullName}</span>
                      {(player as any).isStar && (
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-300">
                    {player.teamShort} - {player.teamName}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono font-bold">
                      {player.position}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                    {player.bats}/{player.throws}
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit Photo Quick Button */}
                      <button
                        onClick={() => setImageEditingPlayer(player)}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 border border-slate-800 transition-colors cursor-pointer"
                        title="Subir / Editar fotografía"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Player Full Button */}
                      <button
                        onClick={() => setEditingPlayer(player)}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-blue-500/20 text-slate-400 hover:text-blue-300 border border-slate-800 transition-colors cursor-pointer"
                        title="Editar datos del jugador"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Player Button */}
                      <button
                        onClick={() => handleDeletePlayer(player.id, player.fullName)}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
                        title="Dar de baja jugador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Image Editor for an Existing Player */}
      {imageEditingPlayer && (
        <PlayerImageEditorModal
          player={imageEditingPlayer}
          isOpen={true}
          onClose={() => setImageEditingPlayer(null)}
          onSavePhoto={handlePhotoUpdated}
        />
      )}

      {/* Modal 2: Image Editor for the New Player Form */}
      {isCreateImageEditorOpen && (
        <PlayerImageEditorModal
          initialImageUrl={photo}
          isOpen={true}
          onClose={() => setIsCreateImageEditorOpen(false)}
          onSavePhoto={(newPhotoUrl) => {
            setPhoto(newPhotoUrl);
          }}
        />
      )}

      {/* Modal 3: Full Player Edit Modal */}
      {editingPlayer && (
        <PlayerEditModal
          player={editingPlayer}
          teams={teams}
          allPlayers={players}
          isOpen={true}
          onClose={() => setEditingPlayer(null)}
          onSaveSuccess={handleUpdatePlayerSuccess}
        />
      )}

      {/* Modal 4: Batch Import Players Modal */}
      {isImportModalOpen && (
        <AdminPlayerImportModal
          isOpen={true}
          teams={teams}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
};
