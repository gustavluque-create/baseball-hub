import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Award,
  Activity,
  TrendingUp,
  Shield,
  Camera,
  Layers,
  Sparkles,
  BarChart2,
  Table as TableIcon,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Player, BattingStats, PitchingStats, PlayerDetailResponse, Team } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { PlayerProfileSkeleton } from './LoadingSkeleton.tsx';
import { PlayerImageEditorModal } from './admin/PlayerImageEditorModal.tsx';
import { PlayerHistoricalStatsModal } from './admin/PlayerHistoricalStatsModal.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';
import { resolvePlayerPhoto, handlePlayerImgError } from '../utils/playerPhoto.ts';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

interface PlayerProfileModalProps {
  playerId: string | null;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ playerId, onClose }) => {
  const { navigateToTeam, dataVersion, triggerDataRefresh } = useApp();
  const { isAdminAuthenticated } = useAdminAuth();
  const [data, setData] = useState<PlayerDetailResponse | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'evolution'>('current');
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [isHistoricalStatsOpen, setIsHistoricalStatsOpen] = useState(false);

  const fetchPlayerDetails = async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const [playerRes, teamsRes] = await Promise.all([
        ApiClient.getPlayerDetail(playerId),
        ApiClient.getTeams().catch(() => [] as Team[]),
      ]);
      setData(playerRes);
      setTeams(teamsRes);
    } catch (err) {
      console.error('Error fetching player detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayerDetails();
  }, [playerId, dataVersion]);

  if (!playerId) return null;

  const player = data?.player;
  const batting = data?.batting;
  const pitching = data?.pitching;
  const careerBatting = data?.careerBatting || [];
  const careerPitching = data?.careerPitching || [];
  const careerTotals = data?.careerTotals;

  const isPitcher = player?.position === 'SP' || player?.position === 'RP';

  // Evolution chart data from historical seasons
  const battingChartData = careerBatting.map((b) => ({
    season: String(b.seasonYear || b.seasonId || ''),
    avg: Number((b.avg || 0).toFixed(3)),
    ops: Number((b.ops || 0).toFixed(3)),
    hr: b.hr || 0,
    h: b.h || 0,
    rbi: b.rbi || 0,
  }));

  const pitchingChartData = careerPitching.map((p) => ({
    season: String(p.seasonYear || p.seasonId || ''),
    era: Number((p.era || 0).toFixed(2)),
    whip: Number((p.whip || 0).toFixed(2)),
    so: p.so || 0,
    w: p.w ?? p.wins ?? 0,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Award className="w-4 h-4" />
            </span>
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
              Ficha Oficial del Pelotero
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdminAuthenticated && player && (
              <button
                type="button"
                onClick={() => setIsHistoricalStatsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 text-xs font-bold transition-all cursor-pointer"
                title="Administrar temporadas y estadísticas históricas"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Historial Estadístico</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {loading || !data || !player ? (
            <PlayerProfileSkeleton />
          ) : (
            <>
              {/* Player Hero Section */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800">
                <div className="relative group shrink-0">
                  <img
                    src={resolvePlayerPhoto(player)}
                    alt={player.fullName}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xl"
                    referrerPolicy="no-referrer"
                    onError={(e) => handlePlayerImgError(e, player)}
                  />
                  {isAdminAuthenticated && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsImageEditorOpen(true)}
                        className="absolute -bottom-2 -right-2 p-2 sm:p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg border-2 border-slate-900 flex items-center justify-center cursor-pointer transition-all z-10"
                        title="Subir o cambiar fotografía del jugador (Admin)"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsImageEditorOpen(true)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl hidden sm:flex flex-col items-center justify-center text-white text-[11px] font-bold transition-opacity cursor-pointer gap-1"
                        title="Subir o cambiar fotografía del jugador (Admin)"
                      >
                        <Camera className="w-5 h-5 text-emerald-400" />
                        <span>Cambiar Foto</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2.5 w-full">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {player.fullName}
                    </span>
                    <span className="font-mono text-xl font-bold text-emerald-400">
                      #{player.jerseyNumber}
                    </span>
                  </div>

                  {/* Team & Position */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-sm">
                    <button
                      onClick={() => {
                        onClose();
                        navigateToTeam(player.teamId);
                      }}
                      className="flex items-center gap-1.5 font-bold text-slate-200 hover:text-emerald-400 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>{player.teamName} ({player.teamShort})</span>
                    </button>
                    <span className="text-slate-600">•</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700 font-mono">
                      {player.position}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 font-bold text-xs border border-emerald-800/40">
                      {player.status === 'active' ? 'En Activo' : player.status === 'injured' ? 'Lesionado' : 'Reserva'}
                    </span>
                  </div>

                  {/* Biometric & Bio details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">Edad</span>
                      <strong className="text-slate-200">{player.age || 25} años</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Origen / Nac.</span>
                      <strong className="text-slate-200 truncate block" title={player.birthPlace || 'Cuba'}>
                        {player.birthPlace || 'Cuba'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Estatura / Peso</span>
                      <strong className="text-slate-200">{player.height || '1.85 m'} • {player.weight || '85 kg'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Batea / Lanza</span>
                      <strong className="text-slate-200 font-mono">{player.bats || 'R'} / {player.throws || 'R'}</strong>
                    </div>
                  </div>

                  {player.bio && (
                    <p className="text-xs text-slate-400 italic pt-1 line-clamp-2">
                      "{player.bio}"
                    </p>
                  )}
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('current')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'current'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Temporada Actual</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Historial por Temporadas{' '}
                    <span className="text-[10px] font-mono opacity-80">
                      ({isPitcher ? careerPitching.length : careerBatting.length})
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('evolution')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'evolution'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Trayectoria &amp; Gráfica</span>
                </button>
              </div>

              {/* TAB 1: CURRENT SEASON & CAREER TOTALS */}
              {activeTab === 'current' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Current Season Batting Card */}
                  {batting && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          Estadísticas de Bateo (Temporada Actual: {batting.seasonYear || '2026'})
                        </h4>
                        <span className="text-xs text-slate-400 font-mono">WAR: {batting.war || '0.0'}</span>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">AVG</span>
                          <span className="font-mono text-xl font-black text-white">{(batting.avg || 0).toFixed(3)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">OBP</span>
                          <span className="font-mono text-xl font-black text-slate-200">{(batting.obp || 0).toFixed(3)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">SLG</span>
                          <span className="font-mono text-xl font-black text-slate-200">{(batting.slg || 0).toFixed(3)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">OPS</span>
                          <span className="font-mono text-xl font-black text-emerald-400">{(batting.ops || 0).toFixed(3)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">HR</span>
                          <span className="font-mono text-xl font-black text-amber-400">{batting.hr}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">CI (RBI)</span>
                          <span className="font-mono text-xl font-black text-white">{batting.rbi}</span>
                        </div>
                      </div>

                      {/* Secondary Batting Table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-1">
                        <table className="w-full text-center text-xs font-mono">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-800">
                              <th className="py-2 px-2">JJ</th>
                              <th className="px-2">AP</th>
                              <th className="px-2">VB</th>
                              <th className="px-2">C</th>
                              <th className="px-2">H</th>
                              <th className="px-2">2B</th>
                              <th className="px-2">3B</th>
                              <th className="px-2">BB</th>
                              <th className="px-2">K</th>
                              <th className="px-2">BR</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-2 px-2">{batting.games}</td>
                              <td className="px-2">{batting.pa}</td>
                              <td className="px-2">{batting.ab}</td>
                              <td className="px-2">{batting.r}</td>
                              <td className="px-2 font-bold text-white">{batting.h}</td>
                              <td className="px-2">{batting.doubles}</td>
                              <td className="px-2">{batting.triples}</td>
                              <td className="px-2">{batting.bb}</td>
                              <td className="px-2">{batting.so}</td>
                              <td className="px-2">{batting.sb}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Current Season Pitching Card */}
                  {pitching && (() => {
                    const wins = pitching.wins ?? pitching.w ?? 0;
                    const losses = pitching.losses ?? pitching.l ?? 0;
                    const saves = pitching.saves ?? pitching.sv ?? 0;

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs uppercase font-bold tracking-wider text-sky-400 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" />
                            Estadísticas de Pitcheo (Temporada Actual: {pitching.seasonYear || '2026'})
                          </h4>
                          <span className="text-xs text-slate-400 font-mono">
                            Récord: {wins}-{losses} • WAR: {pitching.war || '0.0'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                            <span className="text-[10px] text-slate-400 font-bold block">PCL (ERA)</span>
                            <span className="font-mono text-xl font-black text-sky-400">{(pitching.era || 0).toFixed(2)}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                            <span className="text-[10px] text-slate-400 font-bold block">WHIP</span>
                            <span className="font-mono text-xl font-black text-slate-200">{(pitching.whip || 0).toFixed(2)}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                            <span className="text-[10px] text-slate-400 font-bold block">PONCHES (SO)</span>
                            <span className="font-mono text-xl font-black text-white">{pitching.so}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                            <span className="text-[10px] text-slate-400 font-bold block">ENTRADAS (IP)</span>
                            <span className="font-mono text-xl font-black text-slate-200">{pitching.ip}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                            <span className="text-[10px] text-slate-400 font-bold block">J. GANADOS</span>
                            <span className="font-mono text-xl font-black text-emerald-400">{wins}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                            <span className="text-[10px] text-slate-400 font-bold block">SALVADOS</span>
                            <span className="font-mono text-xl font-black text-purple-400">{saves}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Career Totals Banner */}
                  {(careerTotals?.batting || careerTotals?.pitching) && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Totales de Por Vida (Carrera en Serie Nacional)
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('history')}
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ver Desglose Completo</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {careerTotals?.batting && !isPitcher && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center text-xs">
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Temporadas</span>
                            <strong className="text-white text-sm font-mono">{careerTotals.batting.seasons}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Juegos (JJ)</span>
                            <strong className="text-white text-sm font-mono">{careerTotals.batting.games}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Hits (H)</span>
                            <strong className="text-white text-sm font-mono">{careerTotals.batting.h}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Jonrones (HR)</span>
                            <strong className="text-amber-400 text-sm font-mono">{careerTotals.batting.hr}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Impulsadas (CI)</span>
                            <strong className="text-emerald-400 text-sm font-mono">{careerTotals.batting.rbi}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">AVG Carrera</span>
                            <strong className="text-emerald-400 text-sm font-mono">{(careerTotals.batting.avg || 0).toFixed(3)}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">OPS Carrera</span>
                            <strong className="text-amber-400 text-sm font-mono">{(careerTotals.batting.ops || 0).toFixed(3)}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Total WAR</span>
                            <strong className="text-sky-400 text-sm font-mono">{(careerTotals.batting.war || 0).toFixed(1)}</strong>
                          </div>
                        </div>
                      )}

                      {careerTotals?.pitching && isPitcher && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center text-xs">
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Temporadas</span>
                            <strong className="text-white text-sm font-mono">{careerTotals.pitching.seasons}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Juegos (JJ)</span>
                            <strong className="text-white text-sm font-mono">{careerTotals.pitching.games}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Victorias (JG)</span>
                            <strong className="text-emerald-400 text-sm font-mono">{careerTotals.pitching.w}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Salvados (JS)</span>
                            <strong className="text-purple-400 text-sm font-mono">{careerTotals.pitching.sv}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">PCL (ERA)</span>
                            <strong className="text-sky-400 text-sm font-mono">{(careerTotals.pitching.era || 0).toFixed(2)}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Entradas (IP)</span>
                            <strong className="text-white text-sm font-mono">{careerTotals.pitching.ip}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Ponches (SO)</span>
                            <strong className="text-white text-sm font-mono">{careerTotals.pitching.so}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Total WAR</span>
                            <strong className="text-sky-400 text-sm font-mono">{(careerTotals.pitching.war || 0).toFixed(1)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!batting && !pitching && (
                    <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-2">
                      <p className="text-slate-300 text-sm font-semibold">
                        No hay estadísticas registradas para la temporada actual.
                      </p>
                      <p className="text-xs text-slate-500">
                        Puedes consultar el historial por temporadas o ingresar nuevas estadísticas desde el panel de administración.
                      </p>
                      {isAdminAuthenticated && (
                        <button
                          type="button"
                          onClick={() => setIsHistoricalStatsOpen(true)}
                          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Añadir Estadísticas</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HISTORICAL SEASONS TABLE */}
              {activeTab === 'history' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span>Historial Detallado por Temporadas ({player.fullName})</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Registro oficial de cada temporada jugada en la Serie Nacional de Béisbol.
                      </p>
                    </div>

                    {isAdminAuthenticated && (
                      <button
                        type="button"
                        onClick={() => setIsHistoricalStatsOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir / Editar Temporadas</span>
                      </button>
                    )}
                  </div>

                  {/* Batting Historical Table */}
                  {careerBatting.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Estadísticas de Bateo por Temporada
                      </h5>
                      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                        <table className="w-full text-xs font-mono text-left">
                          <thead>
                            <tr className="text-slate-400 bg-slate-900 border-b border-slate-800 uppercase font-sans text-[11px]">
                              <th className="py-2.5 px-3">Temporada</th>
                              <th className="py-2.5 px-2 text-center">Equipo</th>
                              <th className="py-2.5 px-2 text-right">JJ</th>
                              <th className="py-2.5 px-2 text-right">VB</th>
                              <th className="py-2.5 px-2 text-right">C</th>
                              <th className="py-2.5 px-2 text-right">H</th>
                              <th className="py-2.5 px-2 text-right">2B</th>
                              <th className="py-2.5 px-2 text-right">3B</th>
                              <th className="py-2.5 px-2 text-right font-bold text-amber-400">HR</th>
                              <th className="py-2.5 px-2 text-right font-bold text-emerald-400">CI</th>
                              <th className="py-2.5 px-2 text-right">BB</th>
                              <th className="py-2.5 px-2 text-right">K</th>
                              <th className="py-2.5 px-2 text-right">BR</th>
                              <th className="py-2.5 px-2.5 text-right font-black text-emerald-400">AVG</th>
                              <th className="py-2.5 px-2 text-right">OBP</th>
                              <th className="py-2.5 px-2 text-right">SLG</th>
                              <th className="py-2.5 px-2.5 text-right font-black text-amber-400">OPS</th>
                              <th className="py-2.5 px-3 text-right font-bold text-sky-400">WAR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {careerBatting.map((stat) => (
                              <tr key={stat.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-3 font-sans font-bold text-white">
                                  {stat.seasonYear || stat.seasonId}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-slate-300">
                                  {stat.teamShort || stat.teamId}
                                </td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.games}</td>
                                <td className="py-2.5 px-2 text-right text-slate-300">{stat.ab}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.r}</td>
                                <td className="py-2.5 px-2 text-right font-bold text-white">{stat.h}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.doubles}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.triples}</td>
                                <td className="py-2.5 px-2 text-right font-black text-amber-400">{stat.hr}</td>
                                <td className="py-2.5 px-2 text-right font-black text-emerald-400">{stat.rbi}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.bb}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.so}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.sb}</td>
                                <td className="py-2.5 px-2.5 text-right font-black text-emerald-400">
                                  {(stat.avg || 0).toFixed(3)}
                                </td>
                                <td className="py-2.5 px-2 text-right text-slate-300">{(stat.obp || 0).toFixed(3)}</td>
                                <td className="py-2.5 px-2 text-right text-slate-300">{(stat.slg || 0).toFixed(3)}</td>
                                <td className="py-2.5 px-2.5 text-right font-black text-amber-400">
                                  {(stat.ops || 0).toFixed(3)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-sky-400">
                                  {stat.war || '0.0'}
                                </td>
                              </tr>
                            ))}

                            {/* Batting Career Totals Row */}
                            {careerTotals?.batting && (
                              <tr className="bg-emerald-950/25 font-bold border-t-2 border-emerald-500/40 text-emerald-300">
                                <td className="py-3 px-3 font-sans uppercase tracking-wider text-emerald-400">
                                  Totales ({careerTotals.batting.seasons} temp.)
                                </td>
                                <td className="py-3 px-2 text-center text-slate-400">—</td>
                                <td className="py-3 px-2 text-right">{careerTotals.batting.games}</td>
                                <td className="py-3 px-2 text-right text-white">{careerTotals.batting.ab}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.batting.r}</td>
                                <td className="py-3 px-2 text-right text-white font-black">{careerTotals.batting.h}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.batting.doubles}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.batting.triples}</td>
                                <td className="py-3 px-2 text-right text-amber-400 font-black">{careerTotals.batting.hr}</td>
                                <td className="py-3 px-2 text-right text-emerald-400 font-black">{careerTotals.batting.rbi}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.batting.bb}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.batting.so}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.batting.sb}</td>
                                <td className="py-3 px-2.5 text-right text-emerald-400 font-black">
                                  {(careerTotals.batting.avg || 0).toFixed(3)}
                                </td>
                                <td className="py-3 px-2 text-right">{(careerTotals.batting.obp || 0).toFixed(3)}</td>
                                <td className="py-3 px-2 text-right">{(careerTotals.batting.slg || 0).toFixed(3)}</td>
                                <td className="py-3 px-2.5 text-right text-amber-400 font-black">
                                  {(careerTotals.batting.ops || 0).toFixed(3)}
                                </td>
                                <td className="py-3 px-3 text-right text-sky-400">{careerTotals.batting.war}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Pitching Historical Table */}
                  {careerPitching.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                        Estadísticas de Pitcheo por Temporada
                      </h5>
                      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                        <table className="w-full text-xs font-mono text-left">
                          <thead>
                            <tr className="text-slate-400 bg-slate-900 border-b border-slate-800 uppercase font-sans text-[11px]">
                              <th className="py-2.5 px-3">Temporada</th>
                              <th className="py-2.5 px-2 text-center">Equipo</th>
                              <th className="py-2.5 px-2 text-right">JJ</th>
                              <th className="py-2.5 px-2 text-right">JI</th>
                              <th className="py-2.5 px-2 text-right font-bold text-emerald-400">JG</th>
                              <th className="py-2.5 px-2 text-right font-bold text-rose-400">JP</th>
                              <th className="py-2.5 px-2 text-right font-bold text-purple-400">JS</th>
                              <th className="py-2.5 px-2.5 text-right font-black text-sky-400">PCL</th>
                              <th className="py-2.5 px-2 text-right">INN</th>
                              <th className="py-2.5 px-2 text-right">H</th>
                              <th className="py-2.5 px-2 text-right">C</th>
                              <th className="py-2.5 px-2 text-right">CL</th>
                              <th className="py-2.5 px-2 text-right">BB</th>
                              <th className="py-2.5 px-2 text-right font-bold text-white">SO</th>
                              <th className="py-2.5 px-2.5 text-right font-black text-emerald-400">WHIP</th>
                              <th className="py-2.5 px-3 text-right font-bold text-sky-400">WAR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {careerPitching.map((stat) => (
                              <tr key={stat.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-3 font-sans font-bold text-white">
                                  {stat.seasonYear || stat.seasonId}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-slate-300">
                                  {stat.teamShort || stat.teamId}
                                </td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.games}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.gs}</td>
                                <td className="py-2.5 px-2 text-right font-bold text-emerald-400">{stat.w ?? stat.wins ?? 0}</td>
                                <td className="py-2.5 px-2 text-right font-bold text-rose-400">{stat.l ?? stat.losses ?? 0}</td>
                                <td className="py-2.5 px-2 text-right font-bold text-purple-400">{stat.sv ?? stat.saves ?? 0}</td>
                                <td className="py-2.5 px-2.5 text-right font-black text-sky-400">
                                  {(stat.era || 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-2 text-right text-slate-300">{stat.ip}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.h}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.r}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.er}</td>
                                <td className="py-2.5 px-2 text-right text-slate-400">{stat.bb}</td>
                                <td className="py-2.5 px-2 text-right font-bold text-white">{stat.so}</td>
                                <td className="py-2.5 px-2.5 text-right font-black text-emerald-400">
                                  {(stat.whip || 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-sky-400">
                                  {stat.war || '0.0'}
                                </td>
                              </tr>
                            ))}

                            {/* Pitching Career Totals Row */}
                            {careerTotals?.pitching && (
                              <tr className="bg-sky-950/25 font-bold border-t-2 border-sky-500/40 text-sky-300">
                                <td className="py-3 px-3 font-sans uppercase tracking-wider text-sky-400">
                                  Totales ({careerTotals.pitching.seasons} temp.)
                                </td>
                                <td className="py-3 px-2 text-center text-slate-400">—</td>
                                <td className="py-3 px-2 text-right">{careerTotals.pitching.games}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.pitching.gs}</td>
                                <td className="py-3 px-2 text-right text-emerald-400 font-black">{careerTotals.pitching.w}</td>
                                <td className="py-3 px-2 text-right text-rose-400 font-black">{careerTotals.pitching.l}</td>
                                <td className="py-3 px-2 text-right text-purple-400 font-black">{careerTotals.pitching.sv}</td>
                                <td className="py-3 px-2.5 text-right text-sky-400 font-black">
                                  {(careerTotals.pitching.era || 0).toFixed(2)}
                                </td>
                                <td className="py-3 px-2 text-right text-white font-bold">{careerTotals.pitching.ip}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.pitching.h}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.pitching.r}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.pitching.er}</td>
                                <td className="py-3 px-2 text-right">{careerTotals.pitching.bb}</td>
                                <td className="py-3 px-2 text-right text-white font-black">{careerTotals.pitching.so}</td>
                                <td className="py-3 px-2.5 text-right text-emerald-400 font-black">
                                  {(careerTotals.pitching.whip || 0).toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-right text-sky-400">{careerTotals.pitching.war}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {careerBatting.length === 0 && careerPitching.length === 0 && (
                    <div className="py-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-3">
                      <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-slate-300 text-sm font-semibold">
                        No hay temporadas históricas registradas para este pelotero.
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Los administradores pueden registrar temporadas anteriores de la Serie Nacional para visualizar la trayectoria histórica.
                      </p>
                      {isAdminAuthenticated && (
                        <button
                          type="button"
                          onClick={() => setIsHistoricalStatsOpen(true)}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Registrar Primera Temporada</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CAREER PROGRESSION & CHARTS */}
              {activeTab === 'evolution' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span>Curva de Rendimiento Histórico ({player.fullName})</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Evolución temporada por temporada de las métricas clave del atleta.
                      </p>
                    </div>
                  </div>

                  {/* Batting Charts */}
                  {!isPitcher && battingChartData.length > 0 && (
                    <div className="space-y-5">
                      {/* Chart 1: AVG & OPS */}
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-emerald-400" />
                            Evolución de Promedio (AVG) &amp; OPS por Temporada
                          </h5>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {battingChartData.length} {battingChartData.length === 1 ? 'temporada' : 'temporadas'}
                          </span>
                        </div>
                        <div className="h-52 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={battingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="season" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" domain={['auto', 'auto']} fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderColor: '#334155',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                }}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="avg"
                                name="AVG (Promedio)"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                dot={{ fill: '#10b981', r: 4 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="ops"
                                name="OPS (Productividad)"
                                stroke="#38bdf8"
                                strokeWidth={2.5}
                                dot={{ fill: '#38bdf8', r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Chart 2: Hits & Jonrones */}
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                            Producción de Poder: Hits (H), Jonrones (HR) e Impulsadas (CI)
                          </h5>
                        </div>
                        <div className="h-52 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={battingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="season" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderColor: '#334155',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                }}
                              />
                              <Legend />
                              <Bar dataKey="h" name="Hits (H)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="hr" name="Jonrones (HR)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="rbi" name="Impulsadas (CI)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pitching Charts */}
                  {isPitcher && pitchingChartData.length > 0 && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-sky-400" />
                            Evolución de Efectividad (PCL) &amp; WHIP por Temporada
                          </h5>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {pitchingChartData.length} {pitchingChartData.length === 1 ? 'temporada' : 'temporadas'}
                          </span>
                        </div>
                        <div className="h-52 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={pitchingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="season" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" domain={['auto', 'auto']} fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderColor: '#334155',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                }}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="era"
                                name="PCL (ERA)"
                                stroke="#38bdf8"
                                strokeWidth={2.5}
                                dot={{ fill: '#38bdf8', r: 4 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="whip"
                                name="WHIP"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                dot={{ fill: '#10b981', r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                            Ponches (SO) y Victorias (JG) por Temporada
                          </h5>
                        </div>
                        <div className="h-52 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pitchingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="season" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderColor: '#334155',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                }}
                              />
                              <Legend />
                              <Bar dataKey="so" name="Ponches (SO)" fill="#10b981" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="w" name="Juegos Ganados (JG)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {((!isPitcher && battingChartData.length === 0) || (isPitcher && pitchingChartData.length === 0)) && (
                    <div className="py-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-3">
                      <BarChart2 className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-slate-300 text-sm font-semibold">
                        Se requieren al menos 1 o 2 temporadas históricas para trazar la curva gráfica.
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Añade registros históricos de este atleta para generar automáticamente sus gráficos de evolución.
                      </p>
                      {isAdminAuthenticated && (
                        <button
                          type="button"
                          onClick={() => setIsHistoricalStatsOpen(true)}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Añadir Temporadas Históricas</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Historical Stats Modal (Admin) */}
      {isAdminAuthenticated && isHistoricalStatsOpen && player && (
        <PlayerHistoricalStatsModal
          player={player}
          teams={teams}
          isOpen={true}
          onClose={() => setIsHistoricalStatsOpen(false)}
          onStatsUpdated={() => {
            fetchPlayerDetails();
            triggerDataRefresh();
          }}
        />
      )}

      {/* Player Photo Editor Modal (Admin) */}
      {isAdminAuthenticated && isImageEditorOpen && player && (
        <PlayerImageEditorModal
          player={player}
          isOpen={true}
          onClose={() => setIsImageEditorOpen(false)}
          onSavePhoto={(newPhoto, updatedP) => {
            if (updatedP) {
              setData((prev) => (prev ? { ...prev, player: updatedP } : prev));
            } else {
              setData((prev) => (prev ? { ...prev, player: { ...prev.player, photo: newPhoto } } : prev));
            }
            triggerDataRefresh();
          }}
        />
      )}
    </div>
  );
};
