import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  CheckSquare,
  Square,
  MinusSquare,
  ArrowRight,
  Download,
  Upload,
  HardDrive,
  ShieldAlert,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import { Player, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { resolvePlayerPhoto, handlePlayerImgError } from '../../utils/playerPhoto.ts';
import { playerCreateSchema, validateWithSchema } from '../../schemas/adminSchemas.ts';
import { PlayerImageEditorModal, BASEBALL_PHOTO_PRESETS } from './PlayerImageEditorModal.tsx';
import { AdminPlayerImportModal } from './AdminPlayerImportModal.tsx';
import { PlayerEditModal } from './PlayerEditModal.tsx';
import { useApp } from '../../context/AppContext.tsx';

const LOCAL_STORAGE_BACKUP_KEY = 'baseball_hub_players_backup_v2';

export const AdminPlayersManager: React.FC = () => {
  const { dataVersion } = useApp();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetTeamId, setBulkTargetTeamId] = useState<string>('');
  const [bulkTargetPosition, setBulkTargetPosition] = useState<string>('P');
  const [isBulkOperating, setIsBulkOperating] = useState<boolean>(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Data persistence backup prompt
  const [backupOffer, setBackupOffer] = useState<{ count: number; savedAt: string; players: Player[] } | null>(null);
  const [isPersistingToDisk, setIsPersistingToDisk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load data & verify offline/local storage backup
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [fetchedPlayersRes, fetchedTeams] = await Promise.all([
        ApiClient.getPlayers({ limit: 1000 }),
        ApiClient.getTeams(),
      ]);

      // Deduplicate fetched players by ID
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
      if (fetchedTeams.length > 0) {
        if (!teamId) setTeamId(fetchedTeams[0].id);
        if (!bulkTargetTeamId) setBulkTargetTeamId(fetchedTeams[0].id);
      }

      // Check if browser has a saved backup with more players (e.g. server restarted or wiped)
      try {
        const localRaw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (
            parsed &&
            Array.isArray(parsed.players) &&
            parsed.players.length > uniquePlayers.length
          ) {
            setBackupOffer({
              count: parsed.players.length,
              savedAt: parsed.savedAt || new Date().toISOString(),
              players: parsed.players,
            });
          }
        }
      } catch (err) {
        console.warn('Could not read local backup', err);
      }

      // Save latest snapshot to localStorage to protect user modifications
      if (uniquePlayers.length > 0) {
        saveSnapshotLocally(uniquePlayers);
      }
    } catch (err: any) {
      console.error('Error loading players:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSnapshotLocally = (playerList: Player[]) => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_BACKUP_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          players: playerList,
        })
      );
    } catch (e) {
      console.warn('LocalStorage full or quota reached', e);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [dataVersion]);

  // Filtered players
  const filtered = useMemo(() => {
    return players.filter((p) => {
      const matchesSearch =
        p.fullName.toLowerCase().includes(search.toLowerCase()) ||
        p.teamName.toLowerCase().includes(search.toLowerCase()) ||
        p.position.toLowerCase().includes(search.toLowerCase());
      const matchesTeam = teamFilter === 'all' || p.teamId === teamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [players, search, teamFilter]);

  // Multi-selection calculations
  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const isAllSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const isSomeSelected =
    filtered.some((p) => selectedIds.has(p.id)) && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectPlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const invertSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Restore from Local Storage Backup
  const handleRestoreFromLocalBackup = async () => {
    if (!backupOffer) return;
    setIsBulkOperating(true);
    try {
      const res = await ApiClient.syncClientBackup({ players: backupOffer.players });
      showMessage(`¡Restauración exitosa! ${res.message}`);
      setBackupOffer(null);
      await fetchInitialData();
    } catch (err: any) {
      alert(`Error al restaurar respaldo: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Force Persist database to disk
  const handleForcePersist = async () => {
    setIsPersistingToDisk(true);
    try {
      await ApiClient.forcePersistDatabase();
      showMessage('Base de datos y cambios guardados a disco permanentemente.');
    } catch (err: any) {
      alert(`Error al persistir a disco: ${err.message}`);
    } finally {
      setIsPersistingToDisk(false);
    }
  };

  // Export entire DB backup JSON
  const handleExportFullBackup = async () => {
    try {
      const db = await ApiClient.exportDatabaseBackup();
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `baseball_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showMessage('Respaldo descargado exitosamente.');
    } catch (err: any) {
      alert(`Error al exportar respaldo: ${err.message}`);
    }
  };

  // Import DB backup JSON
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const res = await ApiClient.restoreDatabaseBackup(parsed);
        showMessage(`Base de datos restaurada: ${res.counts?.players || 0} jugadores.`);
        fetchInitialData();
      } catch (err: any) {
        alert(`Error al leer archivo JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkOperating(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await ApiClient.bulkDeleteAdminPlayers(ids);
      setPlayers((prev) => {
        const updated = prev.filter((p) => !selectedIds.has(p.id));
        saveSnapshotLocally(updated);
        return updated;
      });
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      showMessage(`Se dieron de baja exitosamente ${res.deletedCount} jugadores.`);
    } catch (err: any) {
      alert(`Error en baja masiva: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkChangeTeam = async () => {
    if (selectedIds.size === 0 || !bulkTargetTeamId) return;
    const targetTeam = teams.find((t) => t.id === bulkTargetTeamId);
    if (!targetTeam) return;

    // Check roster limit
    const currentCount = teamRosterCounts[bulkTargetTeamId] || 0;
    const playersToTransfer = players.filter((p) => selectedIds.has(p.id) && p.teamId !== bulkTargetTeamId);
    if (currentCount + playersToTransfer.length > 40) {
      alert(
        `No se pueden transferir ${playersToTransfer.length} jugadores: el equipo ${targetTeam.name} excedería el límite reglamentario de 40 jugadores (actualmente tiene ${currentCount}).`
      );
      return;
    }

    setIsBulkOperating(true);
    try {
      const ids = Array.from(selectedIds);
      await ApiClient.bulkUpdateAdminPlayers(ids, {
        teamId: targetTeam.id,
        teamName: targetTeam.name,
        teamShort: targetTeam.shortName,
      });

      setPlayers((prev) => {
        const updated = prev.map((p) =>
          selectedIds.has(p.id)
            ? {
                ...p,
                teamId: targetTeam.id,
                teamName: targetTeam.name,
                teamShort: targetTeam.shortName,
              }
            : p
        );
        saveSnapshotLocally(updated);
        return updated;
      });

      showMessage(`${selectedIds.size} jugadores transferidos a ${targetTeam.name}.`);
      clearSelection();
    } catch (err: any) {
      alert(`Error al transferir equipo: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkChangePosition = async () => {
    if (selectedIds.size === 0 || !bulkTargetPosition) return;
    setIsBulkOperating(true);
    try {
      const ids = Array.from(selectedIds);
      await ApiClient.bulkUpdateAdminPlayers(ids, { position: bulkTargetPosition as any });
      setPlayers((prev) => {
        const updated = prev.map((p) =>
          selectedIds.has(p.id) ? { ...p, position: bulkTargetPosition as any } : p
        );
        saveSnapshotLocally(updated);
        return updated;
      });
      showMessage(`Posición "${bulkTargetPosition}" asignada a ${selectedIds.size} jugadores.`);
      clearSelection();
    } catch (err: any) {
      alert(`Error al actualizar posiciones: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkToggleStar = async (starValue: boolean) => {
    if (selectedIds.size === 0) return;
    setIsBulkOperating(true);
    try {
      const ids = Array.from(selectedIds);
      await ApiClient.bulkUpdateAdminPlayers(ids, { isStar: starValue } as any);
      setPlayers((prev) => {
        const updated = prev.map((p) =>
          selectedIds.has(p.id) ? { ...p, isStar: starValue } : p
        );
        saveSnapshotLocally(updated);
        return updated;
      });
      showMessage(`${selectedIds.size} jugadores marcados como ${starValue ? 'Estrella ⭐' : 'Regular'}.`);
      clearSelection();
    } catch (err: any) {
      alert(`Error al actualizar estrellas: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleExportSelectedCsv = () => {
    const selectedPlayers = players.filter((p) => selectedIds.has(p.id));
    if (selectedPlayers.length === 0) return;
    const headers = ['ID', 'Nombre', 'Equipo', 'Siglas', 'Posición', 'Número', 'Batea', 'Lanza', 'Estrella'];
    const rows = selectedPlayers.map((p) => [
      p.id,
      `"${p.fullName.replace(/"/g, '""')}"`,
      `"${p.teamName.replace(/"/g, '""')}"`,
      p.teamShort,
      p.position,
      p.jerseyNumber,
      p.bats,
      p.throws,
      (p as any).isStar ? 'Sí' : 'No',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `peloteros_seleccionados_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage(`Exportados ${selectedPlayers.length} jugadores en CSV.`);
  };

  const handleExportSelectedJson = () => {
    const selectedPlayers = players.filter((p) => selectedIds.has(p.id));
    if (selectedPlayers.length === 0) return;
    const blob = new Blob([JSON.stringify(selectedPlayers, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `peloteros_seleccionados_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage(`Exportados ${selectedPlayers.length} jugadores en JSON.`);
  };

  // Single player create
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
      setPlayers((prev) => {
        const clean = prev.filter(
          (p) =>
            p.id !== newPlayer.id &&
            !(p.teamId === newPlayer.teamId && p.fullName.trim().toLowerCase() === newPlayer.fullName.trim().toLowerCase())
        );
        const updated = [newPlayer, ...clean];
        saveSnapshotLocally(updated);
        return updated;
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
      setPlayers((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        saveSnapshotLocally(updated);
        return updated;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showMessage(`Jugador ${name} eliminado del sistema.`);
    } catch (err: any) {
      alert(`Error al eliminar jugador: ${err.message}`);
    }
  };

  const handleUpdatePlayerSuccess = (updatedPlayer: Player) => {
    setPlayers((prev) => {
      const exists = prev.some((p) => p.id === updatedPlayer.id);
      const updated = exists
        ? prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p))
        : [updatedPlayer, ...prev.filter((p) => p.id !== updatedPlayer.id)];
      saveSnapshotLocally(updated);
      return updated;
    });
    showMessage(`Datos y fotografía de ${updatedPlayer.fullName} actualizados.`);
  };

  const handlePhotoUpdated = (newPhotoUrl: string, updatedPlayer?: Player) => {
    if (updatedPlayer) {
      handleUpdatePlayerSuccess(updatedPlayer);
    } else if (imageEditingPlayer) {
      setPlayers((prev) => {
        const updated = prev.map((p) =>
          p.id === imageEditingPlayer.id ? { ...p, photo: newPhotoUrl } : p
        );
        saveSnapshotLocally(updated);
        return updated;
      });
      showMessage(`Fotografía de ${imageEditingPlayer.fullName} actualizada.`);
    }
    setImageEditingPlayer(null);
  };

  const handleImportSuccess = (count: number, message: string) => {
    fetchInitialData();
    showMessage(message);
  };

  // Selected player objects for dialogs
  const selectedPlayersList = useMemo(() => {
    return players.filter((p) => selectedIds.has(p.id));
  }, [players, selectedIds]);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Persistence & Local Backup Notice */}
      {backupOffer && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300">
                Respaldo Local Detectado ({backupOffer.count} jugadores guardados)
              </p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                El servidor actualmente tiene {players.length} jugadores. Tienes un respaldo guardado localmente de tu sesión previa ({new Date(backupOffer.savedAt).toLocaleDateString()} {new Date(backupOffer.savedAt).toLocaleTimeString()}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => setBackupOffer(null)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Descartar
            </button>
            <button
              onClick={handleRestoreFromLocalBackup}
              disabled={isBulkOperating}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBulkOperating ? 'animate-spin' : ''}`} />
              <span>Restaurar {backupOffer.count} Peloteros al Servidor</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Filter, Search and Actions Header */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search and Team Filter */}
          <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, posición o equipo..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los Equipos ({players.length})</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName} ({teamRosterCounts[t.id] || 0}/40)
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
            <button
              onClick={fetchInitialData}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
              title="Recargar datos del servidor"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Force save to disk button */}
            <button
              onClick={handleForcePersist}
              disabled={isPersistingToDisk}
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Forzar guardado seguro permanente a disco"
            >
              <HardDrive className={`w-3.5 h-3.5 text-emerald-400 ${isPersistingToDisk ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Guardar en Disco</span>
            </button>

            {/* Full Backup Export */}
            <button
              onClick={handleExportFullBackup}
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Descargar copia de seguridad completa JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Copia JSON</span>
            </button>

            {/* Hidden file input for restore */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restaurar base de datos desde archivo JSON"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Cargar JSON</span>
            </button>

            {/* Import Roster Modal Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
              title="Cargar rosters completos vía CSV o JSON"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Importar Roster</span>
            </button>

            {/* New Player Button */}
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Jugador</span>
            </button>
          </div>
        </div>
      </div>

      {/* Roster Limit Status Banner for Selected Team */}
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

      {/* BULK ACTION TOOLBAR (Appears when players are selected) */}
      {selectedIds.size > 0 && (
        <div className="sticky top-20 z-30 p-3.5 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/60 backdrop-blur-md shadow-2xl animate-in slide-in-from-top-3 duration-200 space-y-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Selection info & basic toggles */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow">
                <CheckSquare className="w-4 h-4" />
                <span>{selectedIds.size} seleccionados</span>
              </span>

              <button
                onClick={invertSelection}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                title="Invertir selección actual"
              >
                Invertir
              </button>

              <button
                onClick={clearSelection}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
              >
                Deseleccionar todo
              </button>
            </div>

            {/* Quick Bulk Operations */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
              {/* Batch Transfer to Team */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <select
                  value={bulkTargetTeamId}
                  onChange={(e) => setBulkTargetTeamId(e.target.value)}
                  className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-semibold focus:outline-none"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      Mover a {t.shortName} ({teamRosterCounts[t.id] || 0}/40)
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkChangeTeam}
                  disabled={isBulkOperating}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Transferir todos los jugadores seleccionados al equipo elegido"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Transferir</span>
                </button>
              </div>

              {/* Batch Change Position */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <select
                  value={bulkTargetPosition}
                  onChange={(e) => setBulkTargetPosition(e.target.value)}
                  className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-semibold focus:outline-none"
                >
                  <option value="P">P (Lanzador)</option>
                  <option value="C">C (Receptor)</option>
                  <option value="1B">1B (1ra Base)</option>
                  <option value="2B">2B (2da Base)</option>
                  <option value="3B">3B (3ra Base)</option>
                  <option value="SS">SS (Torpedero)</option>
                  <option value="OF">OF (Jardinero)</option>
                  <option value="DH">DH (Designado)</option>
                </select>
                <button
                  onClick={handleBulkChangePosition}
                  disabled={isBulkOperating}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Asignar Posición
                </button>
              </div>

              {/* Toggle Star */}
              <button
                onClick={() => handleBulkToggleStar(true)}
                disabled={isBulkOperating}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1 transition-colors"
                title="Marcar como Estrella"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>Estrella</span>
              </button>

              {/* Export Selected to CSV / JSON */}
              <button
                onClick={handleExportSelectedCsv}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                title="Exportar selección a CSV"
              >
                <Download className="w-4 h-4 text-emerald-400" />
              </button>

              {/* Bulk Delete Button */}
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={isBulkOperating}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dar de baja ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW PLAYER FORM */}
      {isCreating && (
        <form
          onSubmit={handleCreatePlayer}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Plus className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm text-slate-100">Registrar Nuevo Jugador</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {createFirstError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createFirstError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Player Photo with trigger */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-emerald-500/50 mb-2 group shadow-md">
                <img
                  src={photo}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsCreateImageEditorOpen(true)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                  title="Cambiar o subir foto"
                >
                  <Camera className="w-5 h-5 text-emerald-300" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateImageEditorOpen(true)}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
              >
                Subir / Cambiar Foto
              </button>
            </div>

            {/* Name and Bio */}
            <div className="md:col-span-3 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Nombre Completo *
                </label>
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
                  placeholder="Ej. Alfredo Despaigne"
                  className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors ${
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
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Biografía / Trayectoria (Opcional)
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ej. Bateador destacado con experiencia en Series Nacionales y Selección Nacional."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <p className="text-[10px] text-red-400 font-semibold mt-1">
                  ⚠️ Roster completo: Este equipo alcanzó el tope de 40 jugadores.
                </p>
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
                  className="w-16 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
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

      {/* PLAYERS TABLE WITH MULTI-SELECTION */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 text-xs font-bold text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Listado Oficial de Roster ({filtered.length} jugadores)</span>
            {selectedIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-mono">
                {selectedIds.size} seleccionados
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            Marca las casillas para aplicar acciones masivas o haz clic en editar
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs text-slate-300 min-w-[650px]">
            <thead className="bg-slate-950/90 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                {/* Master checkbox */}
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    title={isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos los visibles'}
                  />
                </th>
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No se encontraron jugadores que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((player) => {
                  const isRowSelected = selectedIds.has(player.id);
                  return (
                    <tr
                      key={player.id}
                      className={`transition-colors group ${
                        isRowSelected
                          ? 'bg-emerald-950/25 border-l-2 border-emerald-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Row checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleSelectPlayer(player.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                        #{player.jerseyNumber}
                      </td>

                      {/* Photo */}
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => setImageEditingPlayer(player)}
                          className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-700 hover:border-emerald-400 shadow-sm group/photo cursor-pointer transition-all"
                          title="Haz clic para subir o editar la foto"
                        >
                          <img
                            src={resolvePlayerPhoto(player)}
                            alt={player.fullName}
                            className="w-full h-full object-cover group-hover/photo:scale-110 transition-transform"
                            referrerPolicy="no-referrer"
                            onError={(e) => handlePlayerImgError(e, player)}
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Camera className="w-3.5 h-3.5 text-emerald-300" />
                          </div>
                        </button>
                      </td>

                      {/* Name & Star */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{player.fullName}</span>
                          {(player as any).isStar && (
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* Team */}
                      <td className="py-2.5 px-3 font-semibold text-slate-300">
                        {player.teamShort} - {player.teamName}
                      </td>

                      {/* Position */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono font-bold">
                          {player.position}
                        </span>
                      </td>

                      {/* Bats/Throws */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {player.bats}/{player.throws}
                      </td>

                      {/* Row Actions */}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Bulk Delete Confirmation */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <span className="p-2 rounded-xl bg-red-500/15">
                <Trash2 className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-base text-slate-100">
                Confirmar Baja Masiva
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Está seguro de que desea retirar del roster y eliminar permanentemente a los{' '}
              <strong className="text-white">{selectedIds.size} jugadores</strong> seleccionados? Esta acción no se puede deshacer.
            </p>

            {/* Selected names preview */}
            <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              {selectedPlayersList.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span>{p.fullName}</span>
                  <span className="font-mono text-slate-500">{p.teamShort} - #{p.jerseyNumber}</span>
                </div>
              ))}
              {selectedPlayersList.length > 10 && (
                <p className="text-slate-500 italic pt-1">
                  ...y {selectedPlayersList.length - 10} más.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkOperating}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkOperating}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBulkOperating ? 'Eliminando...' : `Eliminar ${selectedIds.size} Jugadores`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
