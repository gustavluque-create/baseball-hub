import React, { useState } from 'react';
import {
  X,
  Save,
  Calendar,
  Clock,
  MapPin,
  Shield,
  ArrowLeftRight,
  AlertCircle,
} from 'lucide-react';
import { Game, GameStatus, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

interface GameEditModalProps {
  game: Game;
  teams: Team[];
  onClose: () => void;
  onGameUpdated: (updatedGame: Game) => void;
}

export const GameEditModal: React.FC<GameEditModalProps> = ({
  game,
  teams,
  onClose,
  onGameUpdated,
}) => {
  const [awayTeamId, setAwayTeamId] = useState(game.awayTeam.id);
  const [homeTeamId, setHomeTeamId] = useState(game.homeTeam.id);
  const [date, setDate] = useState(game.date);
  const [time, setTime] = useState(game.time || '14:00');
  const [stadium, setStadium] = useState(game.stadium || '');
  const [status, setStatus] = useState<GameStatus>(game.status);
  const [homeScore, setHomeScore] = useState(game.homeScore || 0);
  const [awayScore, setAwayScore] = useState(game.awayScore || 0);
  const [homeHits, setHomeHits] = useState(game.homeHits || 0);
  const [awayHits, setAwayHits] = useState(game.awayHits || 0);
  const [homeErrors, setHomeErrors] = useState(game.homeErrors || 0);
  const [awayErrors, setAwayErrors] = useState(game.awayErrors || 0);
  const [umpire, setUmpire] = useState(game.umpires?.[0] || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwapTeams = () => {
    const temp = awayTeamId;
    setAwayTeamId(homeTeamId);
    setHomeTeamId(temp);

    const tempScore = awayScore;
    setAwayScore(homeScore);
    setHomeScore(tempScore);

    const tempHits = awayHits;
    setAwayHits(homeHits);
    setHomeHits(tempHits);

    const targetHome = teams.find((t) => t.id === awayTeamId);
    if (targetHome && targetHome.stadium) {
      setStadium(targetHome.stadium);
    }
  };

  const handleHomeTeamChange = (newHomeId: string) => {
    setHomeTeamId(newHomeId);
    const targetTeam = teams.find((t) => t.id === newHomeId);
    if (targetTeam && targetTeam.stadium && !stadium) {
      setStadium(targetTeam.stadium);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (awayTeamId === homeTeamId) {
      setError('El equipo visitante y el equipo local no pueden ser el mismo.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updates: any = {
        awayTeamId,
        homeTeamId,
        date,
        time,
        stadium: stadium.trim() || undefined,
        status,
        awayScore,
        homeScore,
        awayHits,
        homeHits,
        awayErrors,
        homeErrors,
        umpires: umpire.trim() ? [umpire.trim()] : undefined,
      };

      const updated = await ApiClient.updateAdminGame(game.id, updates);
      onGameUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el partido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Calendar className="w-4 h-4" />
            </span>
            <h3 className="text-white font-black text-sm tracking-wide">
              Editar Datos del Partido ({game.awayTeam.shortName} vs {game.homeTeam.shortName})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Teams Selection & Swap */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Equipos y Localía
              </span>
              <button
                type="button"
                onClick={handleSwapTeams}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                title="Invertir condición de Local / Visitante"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Permutar Localía</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Equipo Visitante (Away)
                </label>
                <select
                  value={awayTeamId}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName} - {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Equipo Home Club (Local)
                </label>
                <select
                  value={homeTeamId}
                  onChange={(e) => handleHomeTeamChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName} - {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Date, Time, Venue, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Fecha del Encuentro
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Hora de Inicio
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Estadio / Sede
              </label>
              <input
                type="text"
                value={stadium}
                onChange={(e) => setStadium(e.target.value)}
                placeholder="Ej. Estadio Victoria de Girón"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Estado Oficial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GameStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="SCHEDULED">Programado</option>
                <option value="LIVE">🔴 En Vivo</option>
                <option value="FINAL">Finalizado</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </div>
          </div>

          {/* Scores, Hits, Errors */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Marcador y Estadísticas Básicas
            </span>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Carreras (R)</span>
                <div className="flex gap-1.5 mt-1">
                  <input
                    type="number"
                    min={0}
                    value={awayScore}
                    onChange={(e) => setAwayScore(parseInt(e.target.value, 10) || 0)}
                    placeholder="Vis."
                    className="w-full py-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-400"
                    title="Carreras Visitante"
                  />
                  <input
                    type="number"
                    min={0}
                    value={homeScore}
                    onChange={(e) => setHomeScore(parseInt(e.target.value, 10) || 0)}
                    placeholder="Loc."
                    className="w-full py-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-400"
                    title="Carreras Local"
                  />
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Hits (H)</span>
                <div className="flex gap-1.5 mt-1">
                  <input
                    type="number"
                    min={0}
                    value={awayHits}
                    onChange={(e) => setAwayHits(parseInt(e.target.value, 10) || 0)}
                    placeholder="Vis."
                    className="w-full py-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-200"
                  />
                  <input
                    type="number"
                    min={0}
                    value={homeHits}
                    onChange={(e) => setHomeHits(parseInt(e.target.value, 10) || 0)}
                    placeholder="Loc."
                    className="w-full py-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-200"
                  />
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Errores (E)</span>
                <div className="flex gap-1.5 mt-1">
                  <input
                    type="number"
                    min={0}
                    value={awayErrors}
                    onChange={(e) => setAwayErrors(parseInt(e.target.value, 10) || 0)}
                    placeholder="Vis."
                    className="w-full py-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-200"
                  />
                  <input
                    type="number"
                    min={0}
                    value={homeErrors}
                    onChange={(e) => setHomeErrors(parseInt(e.target.value, 10) || 0)}
                    placeholder="Loc."
                    className="w-full py-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Arbitraje / Umpire */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              Árbitro Principal (Home Plate Umpire)
            </label>
            <input
              type="text"
              value={umpire}
              onChange={(e) => setUmpire(e.target.value)}
              placeholder="Ej. Elber Ibarra"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Guardando...' : 'Actualizar Partido'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
