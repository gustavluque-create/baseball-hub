import React, { useState, useEffect } from 'react';
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
  Shield,
} from 'lucide-react';
import { Player, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

export const AdminPlayersManager: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New player form fields
  const [fullName, setFullName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState(23);
  const [position, setPosition] = useState('OF');
  const [bats, setBats] = useState<'R' | 'L' | 'S'>('R');
  const [throws, setThrows] = useState<'R' | 'L'>('R');
  const [isStar, setIsStar] = useState(false);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [fetchedPlayersRes, fetchedTeams] = await Promise.all([
        ApiClient.getPlayers(),
        ApiClient.getTeams(),
      ]);
      setPlayers(fetchedPlayersRes.items);
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
  }, []);

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !teamId) {
      alert('Ingrese el nombre del jugador y seleccione un equipo.');
      return;
    }

    try {
      const newPlayer = await ApiClient.createAdminPlayer({
        fullName,
        teamId,
        jerseyNumber: Number(jerseyNumber),
        position: position as any,
        bats,
        throws,
      } as any);

      setPlayers((prev) => [newPlayer, ...prev]);
      setIsCreating(false);
      setFullName('');
      showMessage(`Jugador ${newPlayer.fullName} creado exitosamente.`);
    } catch (err: any) {
      alert(`Error al crear jugador: ${err.message}`);
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

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-1 items-center gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, posición o equipo..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-semibold focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Todos los Equipos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInitialData}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Recargar jugadores"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Jugador</span>
          </button>
        </div>
      </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ej. Yurisbel Gracial"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Equipo</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Número &amp; Posición</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={jerseyNumber}
                  onChange={(e) => setJerseyNumber(Number(e.target.value))}
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
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Jugador</span>
            </button>
          </div>
        </form>
      )}

      {/* Players Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 text-xs font-bold text-slate-400 flex items-center justify-between">
          <span>Listado Oficial de Roster ({filtered.length} jugadores)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Jugador</th>
                <th className="py-2.5 px-3">Equipo</th>
                <th className="py-2.5 px-3">Posición</th>
                <th className="py-2.5 px-3">B/L</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((player) => (
                <tr key={player.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                    #{player.jerseyNumber}
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
                    <button
                      onClick={() => handleDeletePlayer(player.id, player.fullName)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
                      title="Dar de baja jugador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
