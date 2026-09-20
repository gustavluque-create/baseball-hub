import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Radio,
  Play,
  CheckCircle2,
  Trash2,
  Edit2,
  RefreshCw,
  Zap,
  Clock,
  Shield,
  AlertCircle,
  Save,
  X,
} from 'lucide-react';
import { Game, GameStatus, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { useScoreNotifications } from '../../context/ScoreNotificationContext.tsx';

export const AdminGamesManager: React.FC = () => {
  const { simulateScoreChange } = useScoreNotifications();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'scheduled' | 'final'>('all');
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New game form state
  const [newAwayTeamId, setNewAwayTeamId] = useState('');
  const [newHomeTeamId, setNewHomeTeamId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('14:00');
  const [newVenue, setNewVenue] = useState('');
  const [newStatus, setNewStatus] = useState<GameStatus>('SCHEDULED');

  const fetchGamesAndTeams = async () => {
    setLoading(true);
    try {
      const [fetchedGames, fetchedTeams] = await Promise.all([
        ApiClient.getGames(),
        ApiClient.getTeams(),
      ]);
      setGames(fetchedGames);
      setTeams(fetchedTeams);
      if (fetchedTeams.length >= 2 && !newAwayTeamId) {
        setNewAwayTeamId(fetchedTeams[0].id);
        setNewHomeTeamId(fetchedTeams[1].id);
      }
    } catch (err: any) {
      console.error('Error loading games in admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGamesAndTeams();
  }, []);

  const handleUpdateScore = async (game: Game, side: 'home' | 'away', delta: number) => {
    const currentScore = side === 'home' ? game.homeScore : game.awayScore;
    const newScore = Math.max(0, currentScore + delta);

    const updates: Partial<Game> = {
      [side === 'home' ? 'homeScore' : 'awayScore']: newScore,
    };

    try {
      const updated = await ApiClient.updateAdminGame(game.id, updates);
      setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      showMessage(`Marcador de ${side === 'home' ? game.homeTeam.shortName : game.awayTeam.shortName} actualizado a ${newScore}`);
    } catch (err: any) {
      alert(`Error al actualizar marcador: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (gameId: string, status: GameStatus) => {
    try {
      const updated = await ApiClient.updateAdminGame(gameId, { status });
      setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      showMessage(`Estado cambiado a: ${status}`);
    } catch (err: any) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const handleUpdateInning = async (game: Game, delta: number) => {
    const newInning = Math.max(1, (game.currentInning || 1) + delta);
    try {
      const updated = await ApiClient.updateAdminGame(game.id, { currentInning: newInning });
      setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch (err: any) {
      alert(`Error al cambiar entrada: ${err.message}`);
    }
  };

  const handleToggleHalfInning = async (game: Game) => {
    try {
      const updated = await ApiClient.updateAdminGame(game.id, { isTopInning: !game.isTopInning });
      setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch (err: any) {
      alert(`Error al cambiar mitad de entrada: ${err.message}`);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este partido del calendario?')) return;
    try {
      await ApiClient.deleteAdminGame(gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
      showMessage('Partido eliminado correctamente.');
    } catch (err: any) {
      alert(`Error al eliminar partido: ${err.message}`);
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAwayTeamId || !newHomeTeamId || newAwayTeamId === newHomeTeamId) {
      alert('Seleccione dos equipos diferentes.');
      return;
    }

    try {
      const created = await ApiClient.createAdminGame({
        awayTeamId: newAwayTeamId,
        homeTeamId: newHomeTeamId,
        date: newDate,
        time: newTime,
        stadium: newVenue || undefined,
        status: newStatus,
        homeScore: 0,
        awayScore: 0,
        currentInning: 1,
        isTopInning: true,
        outs: 0,
      } as any);
      setGames((prev) => [created, ...prev]);
      setIsCreatingGame(false);
      showMessage('Nuevo partido programado en el sistema.');
    } catch (err: any) {
      alert(`Error al crear partido: ${err.message}`);
    }
  };

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const filteredGames = games.filter((g) => {
    if (filter === 'live') return g.status === 'LIVE';
    if (filter === 'scheduled') return g.status === 'SCHEDULED';
    if (filter === 'final') return g.status === 'FINAL';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Action Message Toast */}
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

      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Todos ({games.length})
          </button>
          <button
            onClick={() => setFilter('live')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'live'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span>En Vivo ({games.filter((g) => g.status === 'LIVE').length})</span>
          </button>
          <button
            onClick={() => setFilter('scheduled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'scheduled'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Programados
          </button>
          <button
            onClick={() => setFilter('final')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'final'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Finalizados
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchGamesAndTeams}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Recargar partidos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreatingGame(!isCreatingGame)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Programar Partido</span>
          </button>
        </div>
      </div>

      {/* New Game Form Modal/Drawer */}
      {isCreatingGame && (
        <form
          onSubmit={handleCreateGame}
          className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Programar Nuevo Partido de Béisbol</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsCreatingGame(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Equipo Visitante (Away)</label>
              <select
                value={newAwayTeamId}
                onChange={(e) => setNewAwayTeamId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Equipo Home Club (Local)</label>
              <select
                value={newHomeTeamId}
                onChange={(e) => setNewHomeTeamId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Fecha</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Hora &amp; Estado</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-24 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                />
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as GameStatus)}
                  className="flex-1 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="SCHEDULED">Programado</option>
                  <option value="LIVE">En Vivo</option>
                  <option value="FINAL">Finalizado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingGame(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar y Publicar Partido</span>
            </button>
          </div>
        </form>
      )}

      {/* Games List & Admin Controls */}
      <div className="space-y-3">
        {filteredGames.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
            No se encontraron partidos con el filtro seleccionado.
          </div>
        ) : (
          filteredGames.map((game) => (
            <div
              key={game.id}
              className={`p-4 rounded-2xl border transition-all ${
                game.status === 'LIVE'
                  ? 'bg-slate-900 border-red-500/40 shadow-lg shadow-red-950/20 ring-1 ring-red-500/20'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Game Information & Teams */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-mono">{game.date} • {game.time}</span>
                    <span>•</span>
                    <span className="truncate">{game.stadium || 'Estadio Principal'}</span>
                    <span>•</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        game.status === 'LIVE'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : game.status === 'FINAL'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {game.status === 'LIVE' ? '🔴 EN VIVO' : game.status}
                    </span>
                  </div>

                  {/* Score Board View */}
                  <div className="flex items-center gap-6">
                    {/* Away Team */}
                    <div className="flex items-center gap-3">
                      <span className="font-black text-base text-slate-100">{game.awayTeam.shortName}</span>
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                        <span className="font-mono text-lg font-black text-amber-400">{game.awayScore}</span>
                        {game.status === 'LIVE' && (
                          <div className="flex flex-col ml-1">
                            <button
                              onClick={() => handleUpdateScore(game, 'away', 1)}
                              className="text-[9px] px-1 bg-slate-800 hover:bg-emerald-600 text-white rounded font-mono"
                              title="+1 carrera"
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleUpdateScore(game, 'away', -1)}
                              className="text-[9px] px-1 bg-slate-800 hover:bg-red-600 text-white rounded font-mono mt-0.5"
                              title="-1 carrera"
                            >
                              -
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="text-slate-600 font-bold text-xs">VS</span>

                    {/* Home Team */}
                    <div className="flex items-center gap-3">
                      <span className="font-black text-base text-slate-100">{game.homeTeam.shortName}</span>
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                        <span className="font-mono text-lg font-black text-emerald-400">{game.homeScore}</span>
                        {game.status === 'LIVE' && (
                          <div className="flex flex-col ml-1">
                            <button
                              onClick={() => handleUpdateScore(game, 'home', 1)}
                              className="text-[9px] px-1 bg-slate-800 hover:bg-emerald-600 text-white rounded font-mono"
                              title="+1 carrera"
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleUpdateScore(game, 'home', -1)}
                              className="text-[9px] px-1 bg-slate-800 hover:bg-red-600 text-white rounded font-mono mt-0.5"
                              title="-1 carrera"
                            >
                              -
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inning details for LIVE game */}
                  {game.status === 'LIVE' && (
                    <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        <span className="text-slate-300 font-bold">Entrada:</span>
                        <button
                          onClick={() => handleToggleHalfInning(game)}
                          className="text-amber-400 font-bold hover:underline cursor-pointer"
                        >
                          {game.isTopInning ? '▲ Alta' : '▼ Baja'}
                        </button>
                        <span className="font-mono font-bold text-white">{game.currentInning}</span>
                        <button
                          onClick={() => handleUpdateInning(game, 1)}
                          className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 ml-1"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleUpdateInning(game, -1)}
                          className="px-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                        >
                          -
                        </button>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        <span>Outs:</span>
                        <span className="font-mono font-bold text-amber-400">{game.outs}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status & Operational Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Quick State Toggle Buttons */}
                  <select
                    value={game.status}
                    onChange={(e) => handleUpdateStatus(game.id, e.target.value as GameStatus)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="SCHEDULED">Programado</option>
                    <option value="LIVE">Poner En Vivo</option>
                    <option value="FINAL">Finalizar Juego</option>
                    <option value="SUSPENDED">Suspender</option>
                  </select>

                  {/* Simulate run (SSE broadcast test) */}
                  {game.status === 'LIVE' && (
                    <button
                      onClick={() => simulateScoreChange(game.id, Math.random() > 0.5 ? 'home' : 'away')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Simular carrera y emitir notificación en tiempo real a los navegadores"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Simular Jugada</span>
                    </button>
                  )}

                  {/* Delete Game */}
                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
                    title="Eliminar partido"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
