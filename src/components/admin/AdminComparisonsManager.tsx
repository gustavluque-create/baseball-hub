import React, { useState, useEffect } from 'react';
import {
  Swords,
  Shield,
  Calendar,
  TrendingUp,
  Award,
  Sparkles,
  ArrowLeftRight,
  Copy,
  Check,
  CheckCircle2,
  RefreshCw,
  Plus,
  Play,
  Flame,
  FileText,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import {
  Team,
  Game,
  TeamDirectComparisonData,
  MatchupComparisonData,
} from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { TeamLogo } from '../TeamLogo.tsx';

interface AdminComparisonsManagerProps {
  initialTeamAId?: string;
  initialTeamBId?: string;
  initialGameId?: string;
  onNavigateToGames?: () => void;
  onOpenLiveConsole?: (game: Game) => void;
}

export const AdminComparisonsManager: React.FC<AdminComparisonsManagerProps> = ({
  initialTeamAId,
  initialTeamBId,
  initialGameId,
  onNavigateToGames,
  onOpenLiveConsole,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Selected teams for comparison
  const [teamAId, setTeamAId] = useState<string>(initialTeamAId || '');
  const [teamBId, setTeamBId] = useState<string>(initialTeamBId || '');
  const [selectedGameId, setSelectedGameId] = useState<string>(initialGameId || '');

  // Comparison data
  const [comparison, setComparison] = useState<TeamDirectComparisonData | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Subseries quick generator state
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [newGameDate, setNewGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [newGameTime, setNewGameTime] = useState('14:00');
  const [newGameVenue, setNewGameVenue] = useState('');
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [seriesGamesCount, setSeriesGamesCount] = useState(3);

  // Copy report state
  const [copiedReport, setCopiedReport] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Initial load of teams & games
  useEffect(() => {
    const loadData = async () => {
      setLoadingInitial(true);
      try {
        const [fetchedTeams, fetchedGames] = await Promise.all([
          ApiClient.getTeams(),
          ApiClient.getGames(),
        ]);
        setTeams(fetchedTeams);
        setGames(fetchedGames);

        // Set defaults if not provided
        if (!teamAId && fetchedTeams.length >= 2) {
          const defaultA = fetchedTeams[0].id;
          const defaultB = fetchedTeams[1].id;
          setTeamAId(defaultA);
          setTeamBId(defaultB);
        }
      } catch (err: any) {
        console.error('Error fetching comparison metadata:', err);
      } finally {
        setLoadingInitial(false);
      }
    };
    loadData();
  }, []);

  // Fetch comparison whenever teamAId or teamBId change
  useEffect(() => {
    if (!teamAId || !teamBId || teamAId === teamBId) {
      setComparison(null);
      return;
    }

    const fetchComparison = async () => {
      setLoadingComparison(true);
      setComparisonError(null);
      try {
        const data = await ApiClient.compareTeams(teamAId, teamBId);
        setComparison(data);
      } catch (err: any) {
        console.error('Error comparing teams:', err);
        setComparisonError(err.message || 'No se pudo obtener la comparativa entre los equipos.');
      } finally {
        setLoadingComparison(false);
      }
    };

    fetchComparison();
  }, [teamAId, teamBId]);

  // When a game is selected from the dropdown, sync both teams
  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    const targetGame = games.find((g) => g.id === gameId);
    if (targetGame) {
      setTeamAId(targetGame.awayTeam.id);
      setTeamBId(targetGame.homeTeam.id);
    }
  };

  // Swap teams A & B
  const handleSwapTeams = () => {
    const temp = teamAId;
    setTeamAId(teamBId);
    setTeamBId(temp);
  };

  // Quick single game creation
  const handleCreateDirectGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamAId || !teamBId || teamAId === teamBId) return;

    try {
      const created = await ApiClient.createAdminGame({
        awayTeamId: teamAId,
        homeTeamId: teamBId,
        date: newGameDate,
        time: newGameTime,
        stadium: newGameVenue || undefined,
        status: 'SCHEDULED',
      } as any);
      setGames((prev) => [created, ...prev]);
      setIsCreatingGame(false);
      showNotification(`Partido programado: ${created.awayTeam.shortName} vs ${created.homeTeam.shortName}`);
    } catch (err: any) {
      alert(`Error al programar partido: ${err.message}`);
    }
  };

  // Quick series creation
  const handleCreateSubseries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamAId || !teamBId || teamAId === teamBId) return;

    try {
      const created = await ApiClient.createAdminGameSeries({
        awayTeamId: teamAId,
        homeTeamId: teamBId,
        startDate: newGameDate,
        startTime: newGameTime,
        numberOfGames: seriesGamesCount,
        stadium: newGameVenue || undefined,
      });
      setGames((prev) => [...created, ...prev]);
      setIsCreatingSeries(false);
      showNotification(`¡Subserie de ${created.length} partidos creada con éxito!`);
    } catch (err: any) {
      alert(`Error al generar subserie: ${err.message}`);
    }
  };

  // Generate Technical Press Report
  const generatePressReport = (): string => {
    if (!comparison) return '';
    const { teamA, teamB, headToHeadSummary, statsA, statsB, topBatterA, topBatterB, topPitcherA, topPitcherB } = comparison;

    return `BOLETÍN TÉCNICO OFICIAL - DUELO PARTICULAR
==================================================
Partido / Serie: ${teamA.name} (${teamA.shortName}) vs ${teamB.name} (${teamB.shortName})
Fecha de emisión: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

BALANCE HISTÓRICO Y CARA A CARA:
- Total de Juegos Celebrados: ${headToHeadSummary.totalGames}
- Victorias de ${teamA.shortName}: ${headToHeadSummary.teamAWins} (${headToHeadSummary.totalGames > 0 ? ((headToHeadSummary.teamAWins / headToHeadSummary.totalGames) * 100).toFixed(1) : 0}%)
- Victorias de ${teamB.shortName}: ${headToHeadSummary.teamBWins} (${headToHeadSummary.totalGames > 0 ? ((headToHeadSummary.teamBWins / headToHeadSummary.totalGames) * 100).toFixed(1) : 0}%)
- Carreras Totales: ${teamA.shortName} ${headToHeadSummary.teamARuns} - ${headToHeadSummary.teamBRuns} ${teamB.shortName}

COMPARATIVA OFENSIVA COLECTIVA:
- Promedio de Bateo (AVG): ${teamA.shortName} .${Math.round(statsA.batting.avg * 1000)} | ${teamB.shortName} .${Math.round(statsB.batting.avg * 1000)}
- OPS Colectivo: ${teamA.shortName} ${statsA.batting.ops.toFixed(3)} | ${teamB.shortName} ${statsB.batting.ops.toFixed(3)}
- Jonrones (HR): ${teamA.shortName} ${statsA.batting.homeRuns} | ${teamB.shortName} ${statsB.batting.homeRuns}
- Carreras Anotadas: ${teamA.shortName} ${statsA.batting.runs} | ${teamB.shortName} ${statsB.batting.runs}

COMPARATIVA PITCHEO COLECTIVO:
- Efectividad (ERA): ${teamA.shortName} ${statsA.pitching.era.toFixed(2)} | ${teamB.shortName} ${statsB.pitching.era.toFixed(2)}
- WHIP: ${teamA.shortName} ${statsA.pitching.whip.toFixed(2)} | ${teamB.shortName} ${statsB.pitching.whip.toFixed(2)}
- Ponches (SO): ${teamA.shortName} ${statsA.pitching.strikeouts} | ${teamB.shortName} ${statsB.pitching.strikeouts}

FIGURAS DESTACADAS A SEGUIR:
- Bateador Clave (${teamA.shortName}): ${topBatterA?.player.fullName || 'N/A'} (AVG: .${Math.round((topBatterA?.stats.avg || 0) * 1000)}, HR: ${topBatterA?.stats.hr || 0}, CI: ${topBatterA?.stats.rbi || 0})
- Bateador Clave (${teamB.shortName}): ${topBatterB?.player.fullName || 'N/A'} (AVG: .${Math.round((topBatterB?.stats.avg || 0) * 1000)}, HR: ${topBatterB?.stats.hr || 0}, CI: ${topBatterB?.stats.rbi || 0})
- As de la Rotación (${teamA.shortName}): ${topPitcherA?.player.fullName || 'N/A'} (ERA: ${topPitcherA?.stats.era || 0.00})
- As de la Rotación (${teamB.shortName}): ${topPitcherB?.player.fullName || 'N/A'} (ERA: ${topPitcherB?.stats.era || 0.00})
==================================================`;
  };

  const handleCopyReport = () => {
    const text = generatePressReport();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    showNotification('¡Informe técnico copiado al portapapeles!');
    setTimeout(() => setCopiedReport(false), 3000);
  };

  const teamA = teams.find((t) => t.id === teamAId);
  const teamB = teams.find((t) => t.id === teamBId);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        </div>
      )}

      {/* Top Selector Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Swords className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                Estudio de Comparativas y Análisis Cara a Cara
              </h2>
              <p className="text-xs text-slate-400">
                Gestione balances históricos, series particulares y estadísticas avanzadas para partidos
              </p>
            </div>
          </div>

          {/* Quick Matchup From Scheduled Games */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              Cargar desde Partido:
            </label>
            <select
              value={selectedGameId}
              onChange={(e) => handleSelectGame(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-semibold focus:border-emerald-500 focus:outline-none max-w-xs truncate"
            >
              <option value="">-- Seleccionar de la Cartelera --</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.awayTeam.shortName} vs {g.homeTeam.shortName} ({g.date} - {g.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dual Team Pickers with Swap */}
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
          {/* Team A */}
          <div className="md:col-span-5 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center p-2 shrink-0">
              {teamA ? (
                <TeamLogo logo={teamA.logo} name={teamA.name} className="w-full h-full object-contain" />
              ) : (
                <Shield className="w-7 h-7 text-slate-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Equipo A (Visitante / Referencia)
              </label>
              <select
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
              {teamA && (
                <span className="text-[11px] text-slate-400 block pt-1 truncate">
                  {teamA.city} • Estadio {teamA.stadium}
                </span>
              )}
            </div>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwapTeams}
              className="p-3 rounded-full bg-slate-800 hover:bg-emerald-600 active:scale-95 text-slate-300 hover:text-white transition-all shadow-md cursor-pointer border border-slate-700 hover:border-emerald-500"
              title="Invertir equipos de la comparativa"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Team B */}
          <div className="md:col-span-5 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center p-2 shrink-0">
              {teamB ? (
                <TeamLogo logo={teamB.logo} name={teamB.name} className="w-full h-full object-contain" />
              ) : (
                <Shield className="w-7 h-7 text-slate-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Equipo B (Home Club / Rival)
              </label>
              <select
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
              {teamB && (
                <span className="text-[11px] text-slate-400 block pt-1 truncate">
                  {teamB.city} • Estadio {teamB.stadium}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingGame(!isCreatingGame)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Programar Partido Directo</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingSeries(!isCreatingSeries)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Programar Subserie (2 a 5 juegos)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              disabled={!comparison}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Copiar reporte técnico completo del partido para prensa"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedReport ? '¡Copiado!' : 'Copiar Reporte Técnico'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Direct Game Quick Form */}
      {isCreatingGame && (
        <form
          onSubmit={handleCreateDirectGame}
          className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Programar Nuevo Partido: {teamA?.shortName} vs {teamB?.shortName}</span>
            </h4>
            <button type="button" onClick={() => setIsCreatingGame(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Fecha</label>
              <input
                type="date"
                value={newGameDate}
                onChange={(e) => setNewGameDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Hora</label>
              <input
                type="time"
                value={newGameTime}
                onChange={(e) => setNewGameTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Estadio</label>
              <input
                type="text"
                value={newGameVenue}
                onChange={(e) => setNewGameVenue(e.target.value)}
                placeholder={teamB?.stadium || 'Estadio sede'}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingGame(false)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
            >
              Confirmar y Programar Partido
            </button>
          </div>
        </form>
      )}

      {/* Subseries Generator Form */}
      {isCreatingSeries && (
        <form
          onSubmit={handleCreateSubseries}
          className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Programar Subserie Oficial: {teamA?.shortName} vs {teamB?.shortName}</span>
            </h4>
            <button type="button" onClick={() => setIsCreatingSeries(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Fecha de Inicio</label>
              <input
                type="date"
                value={newGameDate}
                onChange={(e) => setNewGameDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Hora Diaria</label>
              <input
                type="time"
                value={newGameTime}
                onChange={(e) => setNewGameTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Número de Partidos en la Subserie
              </label>
              {/* Quick Preset Selector Buttons */}
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {[
                  { count: 2, label: '2 Partidos' },
                  { count: 3, label: '3 Partidos' },
                  { count: 4, label: '⭐ 4 Partidos', highlight: true },
                  { count: 5, label: '5 Partidos (SNB)' },
                ].map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setSeriesGamesCount(item.count)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center border ${
                      seriesGamesCount === item.count
                        ? item.highlight
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                          : 'bg-emerald-600 border-emerald-400 text-white shadow-sm'
                        : item.highlight
                        ? 'bg-slate-900 border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <select
                value={seriesGamesCount}
                onChange={(e) => setSeriesGamesCount(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:border-indigo-500 focus:outline-none"
              >
                <option value={2}>2 Juegos Consecutivos</option>
                <option value={3}>Subserie de 3 Juegos</option>
                <option value={4}>Subserie de 4 Partidos (4 Juegos Consecutivos)</option>
                <option value={5}>Subserie Oficial SNB (5 Juegos)</option>
                <option value={6}>Serie Larga (6 Juegos)</option>
                <option value={7}>Serie Final (7 Juegos)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Estadio Sede</label>
              <input
                type="text"
                value={newGameVenue}
                onChange={(e) => setNewGameVenue(e.target.value)}
                placeholder={teamB?.stadium || 'Estadio sede'}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingSeries(false)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow"
            >
              Generar y Guardar Subserie Completa
            </button>
          </div>
        </form>
      )}

      {/* Comparison Loading or Content */}
      {loadingComparison ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-semibold">
            Calculando métricas cara a cara y estadísticas de la serie...
          </p>
        </div>
      ) : comparisonError ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900 border border-red-500/30 text-red-300 text-xs">
          {comparisonError}
        </div>
      ) : !comparison ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
          Seleccione dos equipos para visualizar la comparativa administrativa.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Head-to-Head Balance Summary Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Balance Histórico y Particular de la Serie</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {comparison.headToHeadSummary.totalGames} partidos disputados entre sí
              </span>
            </div>

            {/* Wins Breakdown Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">{comparison.teamA.shortName}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-mono">
                    {comparison.headToHeadSummary.teamAWins} Victorias
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-mono">
                    {comparison.headToHeadSummary.teamBWins} Victorias
                  </span>
                  <span className="text-indigo-400">{comparison.teamB.shortName}</span>
                </div>
              </div>

              {/* Graphical Percentage Bar */}
              <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex border border-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${
                      comparison.headToHeadSummary.totalGames > 0
                        ? (comparison.headToHeadSummary.teamAWins / comparison.headToHeadSummary.totalGames) * 100
                        : 50
                    }%`,
                  }}
                  title={`${comparison.teamA.shortName}: ${comparison.headToHeadSummary.teamAWins} victorias`}
                />
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{
                    width: `${
                      comparison.headToHeadSummary.totalGames > 0
                        ? (comparison.headToHeadSummary.teamBWins / comparison.headToHeadSummary.totalGames) * 100
                        : 50
                    }%`,
                  }}
                  title={`${comparison.teamB.shortName}: ${comparison.headToHeadSummary.teamBWins} victorias`}
                />
              </div>

              {/* Total Runs Summary */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Carreras Anotadas: <strong className="text-emerald-400">{comparison.headToHeadSummary.teamARuns}</strong></span>
                <span>Diferencial: <strong className="text-slate-200">{Math.abs(comparison.headToHeadSummary.teamARuns - comparison.headToHeadSummary.teamBRuns)}</strong></span>
                <span>Carreras Anotadas: <strong className="text-indigo-400">{comparison.headToHeadSummary.teamBRuns}</strong></span>
              </div>
            </div>

            {/* Recent Matchups List */}
            {comparison.headToHeadGames.length > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Encuentros Recientes Cara a Cara:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {comparison.headToHeadGames.slice(0, 6).map((g) => (
                    <div
                      key={g.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {g.date} • {g.stadium || 'Estadio Principal'}
                        </span>
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span>{g.awayTeam.shortName} {g.awayScore}</span>
                          <span className="text-slate-600">-</span>
                          <span>{g.homeScore} {g.homeTeam.shortName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            g.status === 'LIVE'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {g.status}
                        </span>
                        {onOpenLiveConsole && (
                          <button
                            type="button"
                            onClick={() => onOpenLiveConsole(g)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Abrir en Consola en Vivo"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Statistical Comparative Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Batting Comparison */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Comparativa Ofensiva Colectiva</span>
                </span>
                <div className="flex items-center gap-3 text-xs font-bold font-mono">
                  <span className="text-emerald-400">{comparison.teamA.shortName}</span>
                  <span className="text-slate-600">vs</span>
                  <span className="text-indigo-400">{comparison.teamB.shortName}</span>
                </div>
              </div>

              <div className="space-y-3">
                {/* AVG */}
                <MetricComparisonRow
                  label="Promedio de Bateo (AVG)"
                  valA={comparison.statsA.batting.avg}
                  valB={comparison.statsB.batting.avg}
                  format={(v) => `.${Math.round(v * 1000)}`}
                  higherIsBetter={true}
                />
                {/* OBP */}
                <MetricComparisonRow
                  label="En Base (OBP)"
                  valA={comparison.statsA.batting.obp}
                  valB={comparison.statsB.batting.obp}
                  format={(v) => `.${Math.round(v * 1000)}`}
                  higherIsBetter={true}
                />
                {/* SLG */}
                <MetricComparisonRow
                  label="Slugging (SLG)"
                  valA={comparison.statsA.batting.slg}
                  valB={comparison.statsB.batting.slg}
                  format={(v) => `.${Math.round(v * 1000)}`}
                  higherIsBetter={true}
                />
                {/* OPS */}
                <MetricComparisonRow
                  label="OPS Colectivo"
                  valA={comparison.statsA.batting.ops}
                  valB={comparison.statsB.batting.ops}
                  format={(v) => v.toFixed(3)}
                  higherIsBetter={true}
                />
                {/* HR */}
                <MetricComparisonRow
                  label="Cuadrangulares (HR)"
                  valA={comparison.statsA.batting.homeRuns}
                  valB={comparison.statsB.batting.homeRuns}
                  format={(v) => v.toString()}
                  higherIsBetter={true}
                />
                {/* Runs */}
                <MetricComparisonRow
                  label="Carreras Anotadas (C)"
                  valA={comparison.statsA.batting.runs}
                  valB={comparison.statsB.batting.runs}
                  format={(v) => v.toString()}
                  higherIsBetter={true}
                />
              </div>
            </div>

            {/* Pitching Comparison */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>Comparativa de Pitcheo Colectivo</span>
                </span>
                <div className="flex items-center gap-3 text-xs font-bold font-mono">
                  <span className="text-emerald-400">{comparison.teamA.shortName}</span>
                  <span className="text-slate-600">vs</span>
                  <span className="text-indigo-400">{comparison.teamB.shortName}</span>
                </div>
              </div>

              <div className="space-y-3">
                {/* ERA */}
                <MetricComparisonRow
                  label="Efectividad (PCL / ERA)"
                  valA={comparison.statsA.pitching.era}
                  valB={comparison.statsB.pitching.era}
                  format={(v) => v.toFixed(2)}
                  higherIsBetter={false}
                />
                {/* WHIP */}
                <MetricComparisonRow
                  label="WHIP"
                  valA={comparison.statsA.pitching.whip}
                  valB={comparison.statsB.pitching.whip}
                  format={(v) => v.toFixed(2)}
                  higherIsBetter={false}
                />
                {/* Strikeouts */}
                <MetricComparisonRow
                  label="Ponches Recetados (SO)"
                  valA={comparison.statsA.pitching.strikeouts}
                  valB={comparison.statsB.pitching.strikeouts}
                  format={(v) => v.toString()}
                  higherIsBetter={true}
                />
                {/* K/9 */}
                <MetricComparisonRow
                  label="Ponches por 9 Innings (K/9)"
                  valA={comparison.statsA.pitching.k9}
                  valB={comparison.statsB.pitching.k9}
                  format={(v) => v.toFixed(1)}
                  higherIsBetter={true}
                />
                {/* BB/9 */}
                <MetricComparisonRow
                  label="Bases por Bolas / 9 Innings (BB/9)"
                  valA={comparison.statsA.pitching.bb9}
                  valB={comparison.statsB.pitching.bb9}
                  format={(v) => v.toFixed(1)}
                  higherIsBetter={false}
                />
                {/* Saves */}
                <MetricComparisonRow
                  label="Juegos Salvados (SV)"
                  valA={comparison.statsA.pitching.saves}
                  valB={comparison.statsB.pitching.saves}
                  format={(v) => v.toString()}
                  higherIsBetter={true}
                />
              </div>
            </div>
          </div>

          {/* Key Figures Duel (Batter vs Batter & Pitcher vs Pitcher) */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Duelo de Figuras y Abridores del Partido</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Batters Duel */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Mejores Bateadores:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {/* Batter A */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 block">{comparison.teamA.shortName}</span>
                    <strong className="text-xs text-white block truncate">
                      {comparison.topBatterA?.player.fullName || 'Bateador Destacado'}
                    </strong>
                    <div className="text-[11px] font-mono text-slate-300 space-y-0.5 pt-1">
                      <div>AVG: <strong>.{Math.round((comparison.topBatterA?.stats.avg || 0.300) * 1000)}</strong></div>
                      <div>HR: <strong>{comparison.topBatterA?.stats.hr || 0}</strong> • CI: <strong>{comparison.topBatterA?.stats.rbi || 0}</strong></div>
                    </div>
                  </div>

                  {/* Batter B */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 block">{comparison.teamB.shortName}</span>
                    <strong className="text-xs text-white block truncate">
                      {comparison.topBatterB?.player.fullName || 'Bateador Destacado'}
                    </strong>
                    <div className="text-[11px] font-mono text-slate-300 space-y-0.5 pt-1">
                      <div>AVG: <strong>.{Math.round((comparison.topBatterB?.stats.avg || 0.300) * 1000)}</strong></div>
                      <div>HR: <strong>{comparison.topBatterB?.stats.hr || 0}</strong> • CI: <strong>{comparison.topBatterB?.stats.rbi || 0}</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pitchers Duel */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Abridores / Ases del Montículo:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {/* Pitcher A */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 block">{comparison.teamA.shortName}</span>
                    <strong className="text-xs text-white block truncate">
                      {comparison.topPitcherA?.player.fullName || 'Lanzador Probable'}
                    </strong>
                    <div className="text-[11px] font-mono text-slate-300 space-y-0.5 pt-1">
                      <div>ERA: <strong>{(comparison.topPitcherA?.stats.era || 2.50).toFixed(2)}</strong></div>
                      <div>SO: <strong>{comparison.topPitcherA?.stats.so || 0}</strong> • WHIP: <strong>{(comparison.topPitcherA?.stats.whip || 1.15).toFixed(2)}</strong></div>
                    </div>
                  </div>

                  {/* Pitcher B */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 block">{comparison.teamB.shortName}</span>
                    <strong className="text-xs text-white block truncate">
                      {comparison.topPitcherB?.player.fullName || 'Lanzador Probable'}
                    </strong>
                    <div className="text-[11px] font-mono text-slate-300 space-y-0.5 pt-1">
                      <div>ERA: <strong>{(comparison.topPitcherB?.stats.era || 2.50).toFixed(2)}</strong></div>
                      <div>SO: <strong>{comparison.topPitcherB?.stats.so || 0}</strong> • WHIP: <strong>{(comparison.topPitcherB?.stats.whip || 1.15).toFixed(2)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for individual metric comparison row with comparison bars
interface MetricComparisonRowProps {
  label: string;
  valA: number;
  valB: number;
  format: (v: number) => string;
  higherIsBetter?: boolean;
}

const MetricComparisonRow: React.FC<MetricComparisonRowProps> = ({
  label,
  valA,
  valB,
  format,
  higherIsBetter = true,
}) => {
  const isBetterA = higherIsBetter ? valA > valB : valA < valB;
  const isBetterB = higherIsBetter ? valB > valA : valB < valA;

  const total = (valA || 0) + (valB || 0);
  const pctA = total > 0 ? ((valA || 0) / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span
          className={`font-mono font-bold ${
            isBetterA ? 'text-emerald-400 font-black' : 'text-slate-400'
          }`}
        >
          {format(valA)}
        </span>
        <span className="text-[11px] text-slate-400 font-semibold">{label}</span>
        <span
          className={`font-mono font-bold ${
            isBetterB ? 'text-indigo-400 font-black' : 'text-slate-400'
          }`}
        >
          {format(valB)}
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden flex border border-slate-800/80">
        <div
          className={`h-full transition-all duration-300 ${
            isBetterA ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
          style={{ width: `${pctA}%` }}
        />
        <div
          className={`h-full transition-all duration-300 ${
            isBetterB ? 'bg-indigo-500' : 'bg-slate-700'
          }`}
          style={{ width: `${100 - pctA}%` }}
        />
      </div>
    </div>
  );
};
