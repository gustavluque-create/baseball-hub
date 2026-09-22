import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  Trophy,
  MapPin,
  UserCheck,
  Sparkles,
  Zap,
  Building2,
  Palette,
  Users,
  Eye,
  Download,
  Calendar,
} from 'lucide-react';
import { Team, Player } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { teamCreateSchema, validateWithSchema } from '../../schemas/adminSchemas.ts';
import { TeamLogo } from '../TeamLogo.tsx';
import { TEAM_EMOJI_PRESETS } from './TeamLogoEditorModal.tsx';
import { useApp } from '../../context/AppContext.tsx';

interface AdminTeamsManagerProps {
  onTeamsChange?: () => void;
}

const REGIONS: Record<'occidente' | 'centro' | 'oriente', { label: string; codes: string[] }> = {
  occidente: { label: 'Occidente', codes: ['PRI', 'ART', 'IND', 'MAY', 'MTZ', 'IJV'] },
  centro: { label: 'Centro', codes: ['CFG', 'VCL', 'SSP', 'CAV', 'CMG'] },
  oriente: { label: 'Oriente', codes: ['LTU', 'HOL', 'GRA', 'SCU', 'GTM'] },
};

export const AdminTeamsManager: React.FC<AdminTeamsManagerProps> = ({ onTeamsChange }) => {
  const { triggerDataRefresh } = useApp();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<'all' | 'occidente' | 'centro' | 'oriente'>('all');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inspector / Read Modal state
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    nickname: '',
    shortName: '',
    city: '',
    stadium: '',
    capacity: 15000,
    manager: '',
    foundedYear: 1977,
    championships: 0,
    primaryColor: '#10B981',
    secondaryColor: '#1E293B',
    textColor: '#FFFFFF',
    logo: '⚾',
  });

  // Edit modal state
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState({
    name: '',
    nickname: '',
    shortName: '',
    city: '',
    stadium: '',
    capacity: 15000,
    manager: '',
    foundedYear: 1977,
    championships: 0,
    primaryColor: '#10B981',
    secondaryColor: '#1E293B',
    textColor: '#FFFFFF',
    logo: '⚾',
  });

  // Delete modal state
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Quick Seed 16 teams state
  const [isSeeding16, setIsSeeding16] = useState(false);

  // Fetch teams and players
  const fetchTeamsAndPlayers = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [fetchedTeams, playersRes] = await Promise.all([
        ApiClient.getTeams(),
        ApiClient.getPlayers({ limit: 1000 }),
      ]);
      setTeams(fetchedTeams);
      setPlayers(playersRes.items);
    } catch (err: any) {
      console.error('Error fetching teams:', err);
      setErrorMessage(err.message || 'Error al cargar los equipos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamsAndPlayers();
  }, []);

  // Compute roster count per team
  const rosterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((p) => {
      counts[p.teamId] = (counts[p.teamId] || 0) + 1;
    });
    return counts;
  }, [players]);

  // Compute region counts
  const regionCounts = useMemo(() => {
    const counts = { all: teams.length, occidente: 0, centro: 0, oriente: 0 };
    teams.forEach((t) => {
      const code = t.shortName.toUpperCase();
      if (REGIONS.occidente.codes.includes(code)) counts.occidente++;
      else if (REGIONS.centro.codes.includes(code)) counts.centro++;
      else if (REGIONS.oriente.codes.includes(code)) counts.oriente++;
    });
    return counts;
  }, [teams]);

  // Filtered teams
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (selectedRegion !== 'all') {
        const allowed = REGIONS[selectedRegion].codes;
        if (!allowed.includes(t.shortName.toUpperCase())) {
          return false;
        }
      }
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.nickname.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.stadium.toLowerCase().includes(q) ||
        t.manager.toLowerCase().includes(q)
      );
    });
  }, [teams, search, selectedRegion]);

  // Export handlers
  const handleExport = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const jsonStr = JSON.stringify(teams, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `equipos_serie_nacional_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['ID', 'Nombre', 'Apodo', 'Sigla', 'Ciudad', 'Estadio', 'Capacidad', 'Manager', 'Fundacion', 'Titulos'];
      const rows = teams.map((t) => [
        t.id,
        `"${t.name}"`,
        `"${t.nickname}"`,
        t.shortName,
        `"${t.city}"`,
        `"${t.stadium}"`,
        t.capacity || t.stadiumCapacity || '',
        `"${t.manager}"`,
        t.foundedYear || '',
        typeof t.championships === 'number' ? t.championships : (t.championships?.length || 0),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `equipos_serie_nacional_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Open Edit Modal with team data
  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setEditErrors({});
    setEditForm({
      name: team.name,
      nickname: team.nickname,
      shortName: team.shortName,
      city: team.city,
      stadium: team.stadium,
      capacity: team.capacity || team.stadiumCapacity || 15000,
      manager: team.manager,
      foundedYear: team.foundedYear || 1977,
      championships: typeof team.championships === 'number' ? team.championships : team.championships?.length || 0,
      primaryColor: team.colors?.primary || team.primaryColor || '#10B981',
      secondaryColor: team.colors?.secondary || '#1E293B',
      textColor: team.colors?.text || '#FFFFFF',
      logo: team.logo || '⚾',
    });
  };

  // Submit Create Team
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrors({});
    setErrorMessage(null);

    const validation = validateWithSchema(teamCreateSchema, createForm);
    if (!validation.success) {
      setCreateErrors(validation.errors);
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const payload: Partial<Team> = {
        name: createForm.name.trim(),
        nickname: createForm.nickname.trim(),
        shortName: createForm.shortName.trim().toUpperCase(),
        city: createForm.city.trim(),
        stadium: createForm.stadium.trim(),
        capacity: Number(createForm.capacity),
        manager: createForm.manager.trim(),
        foundedYear: Number(createForm.foundedYear),
        championships: Number(createForm.championships),
        colors: {
          primary: createForm.primaryColor,
          secondary: createForm.secondaryColor,
          text: createForm.textColor,
        },
        primaryColor: createForm.primaryColor,
        logo: createForm.logo.trim(),
      };

      const newTeam = await ApiClient.createAdminTeam(payload);
      setTeams((prev) => [...prev, newTeam]);
      setIsCreateModalOpen(false);
      setActionMessage(`¡Equipo "${newTeam.name}" (${newTeam.shortName}) registrado exitosamente!`);
      setTimeout(() => setActionMessage(null), 5000);

      // Reset form
      setCreateForm({
        name: '',
        nickname: '',
        shortName: '',
        city: '',
        stadium: '',
        capacity: 15000,
        manager: '',
        foundedYear: 1977,
        championships: 0,
        primaryColor: '#10B981',
        secondaryColor: '#1E293B',
        textColor: '#FFFFFF',
        logo: '⚾',
      });

      triggerDataRefresh();
      if (onTeamsChange) onTeamsChange();
    } catch (err: any) {
      console.error('Error creating team:', err);
      setErrorMessage(err.message || 'Error al registrar el equipo.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Submit Edit Team
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setEditErrors({});
    setErrorMessage(null);

    const validation = validateWithSchema(teamCreateSchema, editForm);
    if (!validation.success) {
      setEditErrors(validation.errors);
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const payload: Partial<Team> = {
        name: editForm.name.trim(),
        nickname: editForm.nickname.trim(),
        shortName: editForm.shortName.trim().toUpperCase(),
        city: editForm.city.trim(),
        stadium: editForm.stadium.trim(),
        capacity: Number(editForm.capacity),
        manager: editForm.manager.trim(),
        foundedYear: Number(editForm.foundedYear),
        championships: Number(editForm.championships),
        colors: {
          primary: editForm.primaryColor,
          secondary: editForm.secondaryColor,
          text: editForm.textColor,
        },
        primaryColor: editForm.primaryColor,
        logo: editForm.logo.trim(),
      };

      const updated = await ApiClient.updateAdminTeam(editingTeam.id, payload);
      setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTeam(null);
      setActionMessage(`¡Equipo "${updated.name}" actualizado correctamente!`);
      setTimeout(() => setActionMessage(null), 5000);

      triggerDataRefresh();
      if (onTeamsChange) onTeamsChange();
    } catch (err: any) {
      console.error('Error updating team:', err);
      setErrorMessage(err.message || 'Error al modificar el equipo.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Team
  const handleDeleteConfirm = async () => {
    if (!deletingTeam) return;
    setIsSubmittingDelete(true);
    setErrorMessage(null);

    try {
      await ApiClient.deleteAdminTeam(deletingTeam.id);
      setTeams((prev) => prev.filter((t) => t.id !== deletingTeam.id));
      setActionMessage(`El equipo "${deletingTeam.name}" ha sido eliminado del sistema.`);
      setTimeout(() => setActionMessage(null), 5000);
      setDeletingTeam(null);

      triggerDataRefresh();
      if (onTeamsChange) onTeamsChange();
    } catch (err: any) {
      console.error('Error deleting team:', err);
      setErrorMessage(err.message || 'Error al eliminar el equipo.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Seed All 16 Cuban Teams
  const handleSeedAll16 = async () => {
    setIsSeeding16(true);
    setErrorMessage(null);
    try {
      const res = await ApiClient.seedAll16Teams();
      setTeams(res.teams);
      setActionMessage('¡Los 16 equipos provinciales oficiales de la Serie Nacional han sido cargados exitosamente!');
      setTimeout(() => setActionMessage(null), 6000);
      triggerDataRefresh();
      if (onTeamsChange) onTeamsChange();
    } catch (err: any) {
      console.error('Error seeding 16 teams:', err);
      setErrorMessage(err.message || 'Error al cargar los 16 equipos.');
    } finally {
      setIsSeeding16(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Equipos de la Liga</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {teams.length} {teams.length === 16 ? '(16 Oficiales SNB)' : 'Registrados'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Administra los clubes, estadios, directores técnicos, insignias y colores de la Serie Nacional.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {teams.length < 16 ? (
            <button
              onClick={handleSeedAll16}
              disabled={isSeeding16}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs transition-all shadow-md shadow-orange-950/40 cursor-pointer disabled:opacity-50"
              title="Cargar automáticamente los 16 equipos provinciales oficiales de Cuba"
            >
              <Zap className={`w-3.5 h-3.5 ${isSeeding16 ? 'animate-spin' : ''}`} />
              <span>{isSeeding16 ? 'Cargando 16 equipos...' : 'Completar los 16 Equipos'}</span>
            </button>
          ) : (
            <button
              onClick={handleSeedAll16}
              disabled={isSeeding16}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Sincronizar metadatos oficiales de los 16 equipos de la Serie Nacional"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-400 ${isSeeding16 ? 'animate-spin' : ''}`} />
              <span>{isSeeding16 ? 'Sincronizando...' : 'Sincronizar 16 Oficiales'}</span>
            </button>
          )}

          <button
            onClick={() => {
              setCreateErrors({});
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Nuevo Equipo</span>
          </button>

          <button
            onClick={fetchTeamsAndPlayers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Refrescar listado"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action and Error Feedback Alerts */}
      {actionMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre de equipo, apodo, sigla (ej: ART, MTZ, IND), ciudad o estadio..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Region Filter Chips and Export Tools */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setSelectedRegion('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedRegion === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Todos ({regionCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRegion('occidente')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedRegion === 'occidente'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Occidente ({regionCounts.occidente})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRegion('centro')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedRegion === 'centro'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Centro ({regionCounts.centro})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRegion('oriente')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedRegion === 'oriente'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Oriente ({regionCounts.oriente})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              title="Exportar nómina de equipos a formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              title="Exportar configuración de equipos a formato JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Teams Grid Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <p>Cargando información de los equipos...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 p-8 space-y-3">
          <Shield className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">No se encontraron equipos</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search
              ? 'No hay equipos que coincidan con el término de búsqueda ingresado.'
              : 'Aún no hay equipos registrados. Puedes registrarlos manualmente o cargar los 16 equipos oficiales.'}
          </p>
          {!search && (
            <button
              onClick={handleSeedAll16}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Cargar los 16 Equipos de la Serie Nacional</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => {
            const currentRosterCount = rosterCounts[team.id] || 0;
            const primaryColor = team.colors?.primary || team.primaryColor || '#10B981';

            return (
              <div
                key={team.id}
                className="group relative flex flex-col justify-between p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
              >
                {/* Header with badge, names, code, and color bar */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md relative overflow-hidden"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <TeamLogo logo={team.logo} name={team.name} size="md" />
                      </div>
                      <div className="cursor-pointer" onClick={() => setViewingTeam(team)}>
                        <div className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                          <span className="font-bold text-white text-sm line-clamp-1">{team.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                            style={{
                              backgroundColor: `${primaryColor}25`,
                              color: primaryColor,
                              border: `1px solid ${primaryColor}40`,
                            }}
                          >
                            {team.shortName}
                          </span>
                          <span className="text-xs text-slate-400">{team.nickname}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingTeam(team)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Ver ficha completa y plantilla de jugadores"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(team)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Modificar datos del equipo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTeam(team)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        title="Eliminar equipo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Team Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] py-2 border-y border-slate-800/60 my-2">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate" title={team.stadium}>{team.stadium}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate" title={team.city}>{team.city}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate" title={team.manager}>DT: {team.manager}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {typeof team.championships === 'number'
                          ? `${team.championships} Títulos`
                          : `${team.championships?.length || 0} Títulos`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer with Roster Status and Cap */}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Roster:</span>
                    <span className="font-bold text-slate-200">
                      {currentRosterCount} / 40
                    </span>
                    <span className="text-[10px] text-slate-500">jugadores</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full border border-slate-700"
                      style={{ backgroundColor: team.colors?.primary || team.primaryColor || '#10B981' }}
                      title="Color Primario"
                    />
                    <span
                      className="w-3 h-3 rounded-full border border-slate-700"
                      style={{ backgroundColor: team.colors?.secondary || '#1E293B' }}
                      title="Color Secundario"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW TEAM DOSSIER MODAL (READ OPERATION) */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 my-8 animate-in fade-in zoom-in-95">
            {/* Banner with club colors */}
            <div
              className="h-28 relative flex items-end p-6"
              style={{
                background: `linear-gradient(135deg, ${viewingTeam.colors?.primary || viewingTeam.primaryColor || '#10B981'}, ${viewingTeam.colors?.secondary || '#0f172a'} 85%)`,
              }}
            >
              <button
                type="button"
                onClick={() => setViewingTeam(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-950/40 hover:bg-slate-950/70 text-white backdrop-blur-sm transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4 translate-y-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl border-2 border-slate-900 overflow-hidden text-2xl"
                  style={{ backgroundColor: viewingTeam.colors?.primary || viewingTeam.primaryColor || '#10B981' }}
                >
                  <TeamLogo logo={viewingTeam.logo} name={viewingTeam.name} size="lg" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white drop-shadow-md">{viewingTeam.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-black uppercase bg-slate-950/60 text-white backdrop-blur-sm border border-white/20">
                      {viewingTeam.shortName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-medium drop-shadow">{viewingTeam.nickname}</p>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="pt-10 p-6 space-y-6">
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Estadio</span>
                  </div>
                  <p className="text-xs font-bold text-white truncate" title={viewingTeam.stadium}>
                    {viewingTeam.stadium}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Aforo: {(viewingTeam.capacity || viewingTeam.stadiumCapacity || 15000).toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Provincia / Sede</span>
                  </div>
                  <p className="text-xs font-bold text-white truncate">{viewingTeam.city}</p>
                  <p className="text-[10px] text-slate-400">Cuba</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Director Técnico</span>
                  </div>
                  <p className="text-xs font-bold text-white truncate" title={viewingTeam.manager}>
                    {viewingTeam.manager}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Fundado: {viewingTeam.foundedYear || 1977}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Campeonatos</span>
                  </div>
                  <p className="text-xs font-bold text-amber-300">
                    {typeof viewingTeam.championships === 'number'
                      ? `${viewingTeam.championships} Títulos`
                      : `${viewingTeam.championships?.length || 0} Títulos`}
                  </p>
                  <p className="text-[10px] text-slate-400">Serie Nacional</p>
                </div>
              </div>

              {/* Official Colors Dossier */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">Colores Oficiales:</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span
                      className="w-4 h-4 rounded-full border border-slate-700"
                      style={{ backgroundColor: viewingTeam.colors?.primary || viewingTeam.primaryColor || '#10B981' }}
                    />
                    <span className="font-mono text-[11px] text-slate-400">
                      {viewingTeam.colors?.primary || viewingTeam.primaryColor || '#10B981'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span
                      className="w-4 h-4 rounded-full border border-slate-700"
                      style={{ backgroundColor: viewingTeam.colors?.secondary || '#1E293B' }}
                    />
                    <span className="font-mono text-[11px] text-slate-400">
                      {viewingTeam.colors?.secondary || '#1E293B'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plantilla / Roster Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Plantilla Oficial de Jugadores
                    </h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      (rosterCounts[viewingTeam.id] || 0) >= 40
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {rosterCounts[viewingTeam.id] || 0} / 40 Jugadores
                  </span>
                </div>

                {(() => {
                  const teamPlayers = players.filter((p) => p.teamId === viewingTeam.id);
                  if (teamPlayers.length === 0) {
                    return (
                      <div className="py-8 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-800 text-slate-400 text-xs">
                        No hay jugadores registrados en la plantilla de este equipo.
                      </div>
                    );
                  }

                  return (
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="p-2.5 pl-3 w-12 text-center">#</th>
                            <th className="p-2.5">Pelotero</th>
                            <th className="p-2.5">Posición</th>
                            <th className="p-2.5 text-right pr-3">B/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {teamPlayers.map((player) => (
                            <tr key={player.id} className="hover:bg-slate-900/60 transition-colors">
                              <td className="p-2.5 pl-3 text-center font-bold text-slate-400">
                                {player.jerseyNumber}
                              </td>
                              <td className="p-2.5 font-medium text-white">
                                {player.fullName || `${player.firstName} ${player.lastName}`}
                              </td>
                              <td className="p-2.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                  {player.position}
                                </span>
                              </td>
                              <td className="p-2.5 text-right pr-3 text-slate-400 text-[11px]">
                                {player.bats}/{player.throws}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewingTeam(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = viewingTeam;
                    setViewingTeam(null);
                    handleOpenEdit(t);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modificar Datos</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Registrar Nuevo Equipo</h3>
                  <p className="text-xs text-slate-400">Agrega un club de la Serie Nacional de Béisbol</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              {/* Row 1: Name and Nickname */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nombre Oficial <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Ej: Cazadores de Artemisa"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {createErrors.name && (
                    <p className="text-[11px] text-red-400 mt-1">{createErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Apodo / Sobrenombre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.nickname}
                    onChange={(e) => setCreateForm({ ...createForm, nickname: e.target.value })}
                    placeholder="Ej: Cazadores"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {createErrors.nickname && (
                    <p className="text-[11px] text-red-400 mt-1">{createErrors.nickname}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Short Code & City/Province */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sigla / Código (2-4 letras) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={createForm.shortName}
                    onChange={(e) => setCreateForm({ ...createForm, shortName: e.target.value.toUpperCase() })}
                    placeholder="Ej: ART"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                  />
                  {createErrors.shortName && (
                    <p className="text-[11px] text-red-400 mt-1">{createErrors.shortName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Provincia / Sede <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    placeholder="Ej: Artemisa"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {createErrors.city && (
                    <p className="text-[11px] text-red-400 mt-1">{createErrors.city}</p>
                  )}
                </div>
              </div>

              {/* Row 3: Stadium & Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estadio Principal <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.stadium}
                    onChange={(e) => setCreateForm({ ...createForm, stadium: e.target.value })}
                    placeholder="Ej: Estadio 26 de Julio"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {createErrors.stadium && (
                    <p className="text-[11px] text-red-400 mt-1">{createErrors.stadium}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Capacidad del Estadio
                  </label>
                  <input
                    type="number"
                    min={500}
                    max={120000}
                    value={createForm.capacity}
                    onChange={(e) => setCreateForm({ ...createForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 4: Manager & Championships */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Director Técnico (Mánager) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.manager}
                    onChange={(e) => setCreateForm({ ...createForm, manager: e.target.value })}
                    placeholder="Ej: Yulieski González"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {createErrors.manager && (
                    <p className="text-[11px] text-red-400 mt-1">{createErrors.manager}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Títulos Ganados en Serie Nacional
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={createForm.championships}
                    onChange={(e) => setCreateForm({ ...createForm, championships: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 5: Colors and Logo/Mascot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Color Primario
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={createForm.primaryColor}
                      onChange={(e) => setCreateForm({ ...createForm, primaryColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={createForm.primaryColor}
                      onChange={(e) => setCreateForm({ ...createForm, primaryColor: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Color Secundario
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={createForm.secondaryColor}
                      onChange={(e) => setCreateForm({ ...createForm, secondaryColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={createForm.secondaryColor}
                      onChange={(e) => setCreateForm({ ...createForm, secondaryColor: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Logo / Mascota (Emoji o URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={createForm.logo}
                      onChange={(e) => setCreateForm({ ...createForm, logo: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                      placeholder="🏹, 🦁, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Emoji quick presets */}
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5">Mascotas y Emojis Oficiales de Serie Nacional:</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-xl bg-slate-950 border border-slate-800">
                  {TEAM_EMOJI_PRESETS.map((p) => (
                    <button
                      key={p.emoji}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, logo: p.emoji })}
                      className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
                        createForm.logo === p.emoji
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                      title={p.name}
                    >
                      <span>{p.emoji}</span>
                      <span className="text-[10px] hidden sm:inline">{p.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmittingCreate ? 'Guardando...' : 'Registrar Equipo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow"
                  style={{ backgroundColor: editForm.primaryColor }}
                >
                  <TeamLogo logo={editForm.logo} name={editingTeam.name} size="sm" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Modificar Equipo</h3>
                  <p className="text-xs text-slate-400">Actualiza los datos oficiales de {editingTeam.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTeam(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              {/* Row 1: Name and Nickname */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nombre Oficial <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {editErrors.name && (
                    <p className="text-[11px] text-red-400 mt-1">{editErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Apodo / Sobrenombre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nickname}
                    onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {editErrors.nickname && (
                    <p className="text-[11px] text-red-400 mt-1">{editErrors.nickname}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Short Code & City/Province */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sigla / Código (2-4 letras) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={editForm.shortName}
                    onChange={(e) => setEditForm({ ...editForm, shortName: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                  />
                  {editErrors.shortName && (
                    <p className="text-[11px] text-red-400 mt-1">{editErrors.shortName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Provincia / Sede <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {editErrors.city && (
                    <p className="text-[11px] text-red-400 mt-1">{editErrors.city}</p>
                  )}
                </div>
              </div>

              {/* Row 3: Stadium & Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estadio Principal <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.stadium}
                    onChange={(e) => setEditForm({ ...editForm, stadium: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {editErrors.stadium && (
                    <p className="text-[11px] text-red-400 mt-1">{editErrors.stadium}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Capacidad del Estadio
                  </label>
                  <input
                    type="number"
                    min={500}
                    max={120000}
                    value={editForm.capacity}
                    onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 4: Manager & Championships */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Director Técnico (Mánager) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.manager}
                    onChange={(e) => setEditForm({ ...editForm, manager: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {editErrors.manager && (
                    <p className="text-[11px] text-red-400 mt-1">{editErrors.manager}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Títulos Ganados en Serie Nacional
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={editForm.championships}
                    onChange={(e) => setEditForm({ ...editForm, championships: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 5: Colors and Logo/Mascot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Color Primario
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editForm.primaryColor}
                      onChange={(e) => setEditForm({ ...editForm, primaryColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={editForm.primaryColor}
                      onChange={(e) => setEditForm({ ...editForm, primaryColor: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Color Secundario
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editForm.secondaryColor}
                      onChange={(e) => setEditForm({ ...editForm, secondaryColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={editForm.secondaryColor}
                      onChange={(e) => setEditForm({ ...editForm, secondaryColor: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Logo / Mascota
                  </label>
                  <input
                    type="text"
                    value={editForm.logo}
                    onChange={(e) => setEditForm({ ...editForm, logo: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* Emoji quick presets */}
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5">Seleccionar Mascota / Emoji:</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-xl bg-slate-950 border border-slate-800">
                  {TEAM_EMOJI_PRESETS.map((p) => (
                    <button
                      key={p.emoji}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, logo: p.emoji })}
                      className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
                        editForm.logo === p.emoji
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                      title={p.name}
                    >
                      <span>{p.emoji}</span>
                      <span className="text-[10px] hidden sm:inline">{p.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmittingEdit ? 'Actualizando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">¿Eliminar Equipo?</h3>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                Estás a punto de eliminar a <strong className="text-white">{deletingTeam.name}</strong> ({deletingTeam.shortName}).
              </p>
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Este equipo cuenta con {rosterCounts[deletingTeam.id] || 0} jugadores en su roster que quedarán desvinculados.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTeam(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmittingDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-red-950/40"
              >
                {isSubmittingDelete ? 'Eliminando...' : 'Sí, Eliminar Equipo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
