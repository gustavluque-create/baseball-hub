import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Save,
  Activity,
  Award,
  Calendar,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Shield,
  Layers,
  FileCode,
} from 'lucide-react';
import { Player, BattingStats, PitchingStats, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { AdminStatsImportModal } from './AdminStatsImportModal.tsx';
import { SeasonBadge } from '../../utils/seasonIndicator.tsx';

interface PlayerHistoricalStatsModalProps {
  player: Player | null;
  teams: Team[];
  isOpen: boolean;
  onClose: () => void;
  onStatsUpdated?: () => void;
}

export const PlayerHistoricalStatsModal: React.FC<PlayerHistoricalStatsModalProps> = ({
  player,
  teams,
  isOpen,
  onClose,
  onStatsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'batting' | 'pitching'>('batting');
  const [careerBatting, setCareerBatting] = useState<BattingStats[]>([]);
  const [careerPitching, setCareerPitching] = useState<PitchingStats[]>([]);
  const [careerTotals, setCareerTotals] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form mode: null = list, 'create' = new season, 'edit' = edit season
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportJsonModalOpen, setIsImportJsonModalOpen] = useState(false);
  const [statToDelete, setStatToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batting form state
  const [battingForm, setBattingForm] = useState({
    seasonYear: new Date().getFullYear(),
    seasonId: 'snb-65',
    teamId: '',
    teamShort: '',
    games: 0,
    ab: 0,
    r: 0,
    h: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    rbi: 0,
    bb: 0,
    so: 0,
    sb: 0,
    war: 0,
  });

  // Pitching form state
  const [pitchingForm, setPitchingForm] = useState({
    seasonYear: new Date().getFullYear(),
    seasonId: 'snb-65',
    teamId: '',
    teamShort: '',
    games: 0,
    gs: 0,
    w: 0,
    l: 0,
    sv: 0,
    ip: 0,
    h: 0,
    r: 0,
    er: 0,
    bb: 0,
    so: 0,
    hr: 0,
    war: 0,
  });

  // Load player details including historical stats on open
  const fetchStats = async () => {
    if (!player) return;
    setLoading(true);
    try {
      const res = await ApiClient.getPlayerDetail(player.id);
      setCareerBatting(res.careerBatting || []);
      setCareerPitching(res.careerPitching || []);
      setCareerTotals(res.careerTotals || null);

      // Auto-select tab based on player position
      if (player.position === 'SP' || player.position === 'RP') {
        setActiveTab('pitching');
      } else {
        setActiveTab('batting');
      }
    } catch (err: any) {
      console.error('Error fetching historical stats:', err);
      setFeedback({ type: 'error', message: 'No se pudieron cargar las estadísticas históricas.' });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && player) {
      setFormMode(null);
      setEditingStatId(null);
      setFeedback(null);
      fetchStats();
    }
  }, [isOpen, player?.id]);

  if (!isOpen || !player) return null;

  // Real-time calculated batting rates for form
  const calcAvg = battingForm.ab > 0 ? (battingForm.h / battingForm.ab).toFixed(3) : '.000';
  const calcObp =
    battingForm.ab + battingForm.bb > 0
      ? ((battingForm.h + battingForm.bb) / (battingForm.ab + battingForm.bb)).toFixed(3)
      : '.000';
  const singles = Math.max(0, battingForm.h - battingForm.doubles - battingForm.triples - battingForm.hr);
  const calcSlg =
    battingForm.ab > 0
      ? (
          (singles + battingForm.doubles * 2 + battingForm.triples * 3 + battingForm.hr * 4) /
          battingForm.ab
        ).toFixed(3)
      : '.000';
  const calcOps = (parseFloat(calcObp) + parseFloat(calcSlg)).toFixed(3);

  // Real-time calculated pitching rates for form
  const calcEra = pitchingForm.ip > 0 ? ((pitchingForm.er * 9) / pitchingForm.ip).toFixed(2) : '0.00';
  const calcWhip =
    pitchingForm.ip > 0 ? ((pitchingForm.bb + pitchingForm.h) / pitchingForm.ip).toFixed(2) : '0.00';

  const handleStartCreate = () => {
    const currentYear = new Date().getFullYear();
    const defaultTeam = teams.find((t) => t.id === player.teamId) || teams[0];

    if (activeTab === 'batting') {
      setBattingForm({
        seasonYear: currentYear,
        seasonId: `snb-${currentYear}`,
        teamId: defaultTeam ? defaultTeam.id : player.teamId,
        teamShort: defaultTeam ? defaultTeam.shortName : player.teamShort,
        games: 0,
        ab: 0,
        r: 0,
        h: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        rbi: 0,
        bb: 0,
        so: 0,
        sb: 0,
        war: 0,
      });
    } else {
      setPitchingForm({
        seasonYear: currentYear,
        seasonId: `snb-${currentYear}`,
        teamId: defaultTeam ? defaultTeam.id : player.teamId,
        teamShort: defaultTeam ? defaultTeam.shortName : player.teamShort,
        games: 0,
        gs: 0,
        w: 0,
        l: 0,
        sv: 0,
        ip: 0,
        h: 0,
        r: 0,
        er: 0,
        bb: 0,
        so: 0,
        hr: 0,
        war: 0,
      });
    }
    setEditingStatId(null);
    setFormMode('create');
  };

  const handleStartEdit = (stat: BattingStats | PitchingStats) => {
    setEditingStatId(stat.id);
    setFormMode('edit');

    if (activeTab === 'batting') {
      const b = stat as BattingStats;
      setBattingForm({
        seasonYear: b.seasonYear || 2026,
        seasonId: b.seasonId || `snb-${b.seasonYear || 2026}`,
        teamId: b.teamId || player.teamId,
        teamShort: b.teamShort || player.teamShort,
        games: b.games || 0,
        ab: b.ab || 0,
        r: b.r || 0,
        h: b.h || 0,
        doubles: b.doubles || 0,
        triples: b.triples || 0,
        hr: b.hr || 0,
        rbi: b.rbi || 0,
        bb: b.bb || 0,
        so: b.so || 0,
        sb: b.sb || 0,
        war: b.war || 0,
      });
    } else {
      const p = stat as PitchingStats;
      setPitchingForm({
        seasonYear: p.seasonYear || 2026,
        seasonId: p.seasonId || `snb-${p.seasonYear || 2026}`,
        teamId: p.teamId || player.teamId,
        teamShort: p.teamShort || player.teamShort,
        games: p.games || 0,
        gs: p.gs || 0,
        w: p.w ?? p.wins ?? 0,
        l: p.l ?? p.losses ?? 0,
        sv: p.sv ?? p.saves ?? 0,
        ip: p.ip || 0,
        h: p.h || 0,
        r: p.r || 0,
        er: p.er || 0,
        bb: p.bb || 0,
        so: p.so || 0,
        hr: p.hr || 0,
        war: p.war || 0,
      });
    }
  };

  const handleSaveStat = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (activeTab === 'batting') {
        const teamObj = teams.find((t) => t.id === battingForm.teamId);
        const payload: Partial<BattingStats> = {
          id: editingStatId || undefined,
          seasonYear: Number(battingForm.seasonYear),
          seasonId: battingForm.seasonId || `snb-${battingForm.seasonYear}`,
          teamId: battingForm.teamId,
          teamShort: teamObj ? teamObj.shortName : battingForm.teamShort,
          games: Number(battingForm.games),
          ab: Number(battingForm.ab),
          r: Number(battingForm.r),
          h: Number(battingForm.h),
          doubles: Number(battingForm.doubles),
          triples: Number(battingForm.triples),
          hr: Number(battingForm.hr),
          rbi: Number(battingForm.rbi),
          bb: Number(battingForm.bb),
          so: Number(battingForm.so),
          sb: Number(battingForm.sb),
          war: Number(battingForm.war),
        };

        const res = await ApiClient.savePlayerSeasonBatting(player.id, payload);
        setCareerBatting(res.historical.careerBatting);
        setCareerTotals(res.historical.careerTotals);
        setFeedback({
          type: 'success',
          message: `Temporada ${battingForm.seasonYear} guardada exitosamente.`,
        });
      } else {
        const teamObj = teams.find((t) => t.id === pitchingForm.teamId);
        const payload: Partial<PitchingStats> = {
          id: editingStatId || undefined,
          seasonYear: Number(pitchingForm.seasonYear),
          seasonId: pitchingForm.seasonId || `snb-${pitchingForm.seasonYear}`,
          teamId: pitchingForm.teamId,
          teamShort: teamObj ? teamObj.shortName : pitchingForm.teamShort,
          games: Number(pitchingForm.games),
          gs: Number(pitchingForm.gs),
          w: Number(pitchingForm.w),
          l: Number(pitchingForm.l),
          sv: Number(pitchingForm.sv),
          wins: Number(pitchingForm.w),
          losses: Number(pitchingForm.l),
          saves: Number(pitchingForm.sv),
          ip: Number(pitchingForm.ip),
          h: Number(pitchingForm.h),
          r: Number(pitchingForm.r),
          er: Number(pitchingForm.er),
          bb: Number(pitchingForm.bb),
          so: Number(pitchingForm.so),
          hr: Number(pitchingForm.hr),
          war: Number(pitchingForm.war),
        };

        const res = await ApiClient.savePlayerSeasonPitching(player.id, payload);
        setCareerPitching(res.historical.careerPitching);
        setCareerTotals(res.historical.careerTotals);
        setFeedback({
          type: 'success',
          message: `Temporada ${pitchingForm.seasonYear} guardada exitosamente.`,
        });
      }

      setFormMode(null);
      setEditingStatId(null);
      if (onStatsUpdated) onStatsUpdated();
    } catch (err: any) {
      console.error('Error saving player season stats:', err);
      setFeedback({ type: 'error', message: err.message || 'Error al guardar la estadística.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStat = (statId: string) => {
    setStatToDelete(statId);
  };

  const confirmDeleteStat = async () => {
    if (!statToDelete || !player) return;
    setIsDeleting(true);
    try {
      const res = await ApiClient.deletePlayerSeasonStat(player.id, statToDelete, activeTab);
      if (activeTab === 'batting') {
        setCareerBatting(res.historical.careerBatting);
      } else {
        setCareerPitching(res.historical.careerPitching);
      }
      setCareerTotals(res.historical.careerTotals);
      setFeedback({ type: 'success', message: 'Registro de temporada eliminado correctamente.' });
      if (onStatsUpdated) onStatsUpdated();
    } catch (err: any) {
      console.error('Error deleting player stat:', err);
      setFeedback({ type: 'error', message: 'No se pudo eliminar el registro histórico.' });
    } finally {
      setIsDeleting(false);
      setStatToDelete(null);
    }
  };

  const cancelDeleteStat = () => {
    setStatToDelete(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>Historial de Estadísticas: {player.fullName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  #{player.jerseyNumber} • {player.position}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Gestión temporada por temporada y cálculo automático de totales de por vida (Carrera).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-b border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sub-header Controls */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 flex-wrap gap-3">
          {/* Batting vs Pitching tab */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('batting');
                setFormMode(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'batting'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Bateo ({careerBatting.length} temp.)</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('pitching');
                setFormMode(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'pitching'
                  ? 'bg-sky-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Pitcheo ({careerPitching.length} temp.)</span>
            </button>
          </div>

          {/* Action button */}
          {!formMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImportJsonModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                title="Importar temporadas anteriores de este pelotero desde archivo o texto JSON"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-200" />
                <span>Importar JSON</span>
              </button>
              <button
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Temporada Histórica</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setFormMode(null);
                setEditingStatId(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar Formulario</span>
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {formMode ? (
            /* CREATE OR EDIT FORM */
            <form onSubmit={handleSaveStat} className="space-y-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>
                    {formMode === 'create'
                      ? `Registrar Nueva Temporada de ${activeTab === 'batting' ? 'Bateo' : 'Pitcheo'}`
                      : `Editar Registro de Temporada (${activeTab === 'batting' ? battingForm.seasonYear : pitchingForm.seasonYear})`}
                  </span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  Las métricas avanzadas (AVG, OBP, SLG, OPS o ERA, WHIP) se recalculan automáticamente.
                </span>
              </div>

              {/* Season & Team metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Año de Temporada</label>
                  <input
                    type="number"
                    min="1960"
                    max="2035"
                    required
                    value={activeTab === 'batting' ? battingForm.seasonYear : pitchingForm.seasonYear}
                    onChange={(e) => {
                      const yr = parseInt(e.target.value, 10) || new Date().getFullYear();
                      if (activeTab === 'batting') {
                        setBattingForm({ ...battingForm, seasonYear: yr, seasonId: `snb-${yr}` });
                      } else {
                        setPitchingForm({ ...pitchingForm, seasonYear: yr, seasonId: `snb-${yr}` });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      { label: 'SNB 65 (2026-27) [Actual]', yr: 2027, sid: 'snb-65' },
                      { label: 'SNB 64 (2025-26) [Anterior]', yr: 2026, sid: 'snb-64' },
                      { label: 'SNB 63 (2024-25)', yr: 2024, sid: 'snb-63' },
                      { label: 'SNB 56 (2016-17) [Histórica]', yr: 2017, sid: 'snb-56' },
                      { label: '3ra LEBC (2026)', yr: 2026, sid: 'lebc-2026' },
                    ].map((preset) => (
                      <button
                        key={preset.sid}
                        type="button"
                        onClick={() => {
                          if (activeTab === 'batting') {
                            setBattingForm({ ...battingForm, seasonYear: preset.yr, seasonId: preset.sid });
                          } else {
                            setPitchingForm({ ...pitchingForm, seasonYear: preset.yr, seasonId: preset.sid });
                          }
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-500/20 text-[10px] text-slate-300 hover:text-emerald-300 border border-slate-700 cursor-pointer transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Live Season Badge Preview */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold">
                      Indicativo visual oficial generado:
                    </span>
                    <SeasonBadge
                      stat={{
                        seasonYear: activeTab === 'batting' ? battingForm.seasonYear : pitchingForm.seasonYear,
                        seasonId: activeTab === 'batting' ? battingForm.seasonId : pitchingForm.seasonId,
                      }}
                      size="sm"
                      showStatusTag={true}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Equipo Representado</label>
                  <select
                    value={activeTab === 'batting' ? battingForm.teamId : pitchingForm.teamId}
                    onChange={(e) => {
                      const tId = e.target.value;
                      const tObj = teams.find((t) => t.id === tId);
                      if (activeTab === 'batting') {
                        setBattingForm({
                          ...battingForm,
                          teamId: tId,
                          teamShort: tObj ? tObj.shortName : '',
                        });
                      } else {
                        setPitchingForm({
                          ...pitchingForm,
                          teamId: tId,
                          teamShort: tObj ? tObj.shortName : '',
                        });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Selecciona un equipo</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.shortName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">WAR (Victorias sobre reemplazo)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={activeTab === 'batting' ? battingForm.war : pitchingForm.war}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (activeTab === 'batting') {
                        setBattingForm({ ...battingForm, war: val });
                      } else {
                        setPitchingForm({ ...pitchingForm, war: val });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* BATTING INPUTS */}
              {activeTab === 'batting' && (
                <div className="space-y-4">
                  <h5 className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                    Línea Ofensiva de la Temporada
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Juegos (JJ)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.games}
                        onChange={(e) => setBattingForm({ ...battingForm, games: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Veces al Bate (VB)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.ab}
                        onChange={(e) => setBattingForm({ ...battingForm, ab: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Carreras (C)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.r}
                        onChange={(e) => setBattingForm({ ...battingForm, r: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Hits (H)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.h}
                        onChange={(e) => setBattingForm({ ...battingForm, h: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Dobles (2B)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.doubles}
                        onChange={(e) => setBattingForm({ ...battingForm, doubles: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Triples (3B)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.triples}
                        onChange={(e) => setBattingForm({ ...battingForm, triples: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Jonrones (HR)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.hr}
                        onChange={(e) => setBattingForm({ ...battingForm, hr: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Impulsadas (CI)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.rbi}
                        onChange={(e) => setBattingForm({ ...battingForm, rbi: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Boletos (BB)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.bb}
                        onChange={(e) => setBattingForm({ ...battingForm, bb: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Ponches (K)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.so}
                        onChange={(e) => setBattingForm({ ...battingForm, so: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Bases Robadas (BR)</label>
                      <input
                        type="number"
                        min="0"
                        value={battingForm.sb}
                        onChange={(e) => setBattingForm({ ...battingForm, sb: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Real-time rates preview */}
                  <div className="grid grid-cols-4 gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">AVG Calculado</span>
                      <span className="font-mono text-base font-black text-emerald-400">{calcAvg}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">OBP Calculado</span>
                      <span className="font-mono text-base font-black text-slate-200">{calcObp}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">SLG Calculado</span>
                      <span className="font-mono text-base font-black text-slate-200">{calcSlg}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">OPS Calculado</span>
                      <span className="font-mono text-base font-black text-amber-400">{calcOps}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PITCHING INPUTS */}
              {activeTab === 'pitching' && (
                <div className="space-y-4">
                  <h5 className="text-xs uppercase font-bold text-sky-400 tracking-wider">
                    Línea de Pitcheo de la Temporada
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Juegos (JJ)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.games}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, games: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Iniciados (JI)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.gs}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, gs: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Victorias (G)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.w}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, w: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Derrotas (P)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.l}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, l: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-rose-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Salvados (JS)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.sv}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, sv: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-purple-400 font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Innings (IL)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={pitchingForm.ip}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, ip: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Hits Permitidos</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.h}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, h: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Carreras Limpias (CL)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.er}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, er: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Boletos (BB)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.bb}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, bb: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Ponches (K)</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.so}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, so: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Jonrones Permitidos</label>
                      <input
                        type="number"
                        min="0"
                        value={pitchingForm.hr}
                        onChange={(e) => setPitchingForm({ ...pitchingForm, hr: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Real-time rates preview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">PCL (ERA) Calculado</span>
                      <span className="font-mono text-base font-black text-sky-400">{calcEra}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">WHIP Calculado</span>
                      <span className="font-mono text-base font-black text-emerald-400">{calcWhip}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Récord</span>
                      <span className="font-mono text-base font-bold text-white">
                        {pitchingForm.w}-{pitchingForm.l}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Innings / K</span>
                      <span className="font-mono text-base font-bold text-amber-400">
                        {pitchingForm.ip} IL / {pitchingForm.so} K
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setFormMode(null);
                    setEditingStatId(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Guardando...' : 'Guardar Temporada'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* HISTORICAL TABLE VIEW */
            <div className="space-y-6">
              {activeTab === 'batting' ? (
                /* BATTING SEASONS */
                <div className="space-y-4">
                  {careerBatting.length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-6 space-y-3">
                      <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                      <h4 className="text-sm font-bold text-slate-200">No hay temporadas de bateo registradas</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Agrega las temporadas históricas del jugador (JJ, VB, H, HR, CI, etc.) para armar su hoja de vida y estadísticas de carrera.
                      </p>
                      <button
                        onClick={handleStartCreate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir Primera Temporada</span>
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                      <table className="w-full text-xs font-mono text-left">
                        <thead>
                          <tr className="text-slate-400 bg-slate-900 border-b border-slate-800 uppercase font-sans text-[11px]">
                            <th className="py-3 px-3">Temporada</th>
                            <th className="py-3 px-2 text-center">Equipo</th>
                            <th className="py-3 px-2 text-right">JJ</th>
                            <th className="py-3 px-2 text-right">VB</th>
                            <th className="py-3 px-2 text-right">C</th>
                            <th className="py-3 px-2 text-right">H</th>
                            <th className="py-3 px-2 text-right">2B</th>
                            <th className="py-3 px-2 text-right">3B</th>
                            <th className="py-3 px-2 text-right font-bold text-amber-400">HR</th>
                            <th className="py-3 px-2 text-right font-bold text-emerald-400">CI</th>
                            <th className="py-3 px-2 text-right">BB</th>
                            <th className="py-3 px-2 text-right">K</th>
                            <th className="py-3 px-2 text-right">BR</th>
                            <th className="py-3 px-2.5 text-right font-black text-emerald-400">AVG</th>
                            <th className="py-3 px-2 text-right">OBP</th>
                            <th className="py-3 px-2 text-right">SLG</th>
                            <th className="py-3 px-2.5 text-right font-black text-amber-400">OPS</th>
                            <th className="py-3 px-2 text-right font-bold text-sky-400">WAR</th>
                            <th className="py-3 px-3 text-center font-sans">Acciones</th>
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
                                {stat.avg.toFixed(3)}
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-300">{stat.obp.toFixed(3)}</td>
                              <td className="py-2.5 px-2 text-right text-slate-300">{stat.slg.toFixed(3)}</td>
                              <td className="py-2.5 px-2.5 text-right font-black text-amber-400">
                                {stat.ops.toFixed(3)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold text-sky-400">
                                {stat.war || '0.0'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleStartEdit(stat)}
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                                    title="Editar temporada"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStat(stat.id)}
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                    title="Eliminar temporada"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Career Totals Row */}
                          {careerTotals?.batting && (
                            <tr className="bg-emerald-950/20 font-bold border-t-2 border-emerald-500/40 text-emerald-300">
                              <td className="py-3 px-3 font-sans uppercase tracking-wider text-emerald-400">
                                Totales ({careerTotals.batting.seasons} temp.)
                              </td>
                              <td className="py-3 px-2 text-center text-slate-400">—</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.games}</td>
                              <td className="py-3 px-2 text-right text-white">{careerTotals.batting.ab}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.r}</td>
                              <td className="py-3 px-2 text-right text-white">{careerTotals.batting.h}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.doubles}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.triples}</td>
                              <td className="py-3 px-2 text-right text-amber-400">{careerTotals.batting.hr}</td>
                              <td className="py-3 px-2 text-right text-emerald-300">{careerTotals.batting.rbi}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.bb}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.so}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.sb}</td>
                              <td className="py-3 px-2.5 text-right text-emerald-400 font-black">
                                {careerTotals.batting.avg.toFixed(3)}
                              </td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.obp.toFixed(3)}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.batting.slg.toFixed(3)}</td>
                              <td className="py-3 px-2.5 text-right text-amber-400 font-black">
                                {careerTotals.batting.ops.toFixed(3)}
                              </td>
                              <td className="py-3 px-2 text-right text-sky-400">{careerTotals.batting.war}</td>
                              <td className="py-3 px-3 text-center text-slate-500 font-sans text-[11px]">
                                Por vida
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* PITCHING SEASONS */
                <div className="space-y-4">
                  {careerPitching.length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-6 space-y-3">
                      <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                      <h4 className="text-sm font-bold text-slate-200">No hay temporadas de pitcheo registradas</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Agrega las temporadas de pitcheo del lanzador (JJ, JI, G, P, JS, PCL, IL, K, etc.) para armar su historial de carrera.
                      </p>
                      <button
                        onClick={handleStartCreate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir Primera Temporada de Pitcheo</span>
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                      <table className="w-full text-xs font-mono text-left">
                        <thead>
                          <tr className="text-slate-400 bg-slate-900 border-b border-slate-800 uppercase font-sans text-[11px]">
                            <th className="py-3 px-3">Temporada</th>
                            <th className="py-3 px-2 text-center">Equipo</th>
                            <th className="py-3 px-2 text-right">JJ</th>
                            <th className="py-3 px-2 text-right">JI</th>
                            <th className="py-3 px-2 text-right font-bold text-emerald-400">G</th>
                            <th className="py-3 px-2 text-right font-bold text-rose-400">P</th>
                            <th className="py-3 px-2 text-right font-bold text-purple-400">JS</th>
                            <th className="py-3 px-2.5 text-right font-black text-sky-400">PCL (ERA)</th>
                            <th className="py-3 px-2 text-right">IL</th>
                            <th className="py-3 px-2 text-right">H</th>
                            <th className="py-3 px-2 text-right">CL</th>
                            <th className="py-3 px-2 text-right">BB</th>
                            <th className="py-3 px-2 text-right font-bold text-white">K</th>
                            <th className="py-3 px-2.5 text-right font-black text-emerald-400">WHIP</th>
                            <th className="py-3 px-2 text-right font-bold text-sky-400">WAR</th>
                            <th className="py-3 px-3 text-center font-sans">Acciones</th>
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
                              <td className="py-2.5 px-2 text-right text-slate-400">{stat.gs || 0}</td>
                              <td className="py-2.5 px-2 text-right font-bold text-emerald-400">
                                {stat.w ?? stat.wins ?? 0}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold text-rose-400">
                                {stat.l ?? stat.losses ?? 0}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold text-purple-400">
                                {stat.sv ?? stat.saves ?? 0}
                              </td>
                              <td className="py-2.5 px-2.5 text-right font-black text-sky-400">
                                {stat.era.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-300">{stat.ip}</td>
                              <td className="py-2.5 px-2 text-right text-slate-400">{stat.h}</td>
                              <td className="py-2.5 px-2 text-right text-slate-400">{stat.er}</td>
                              <td className="py-2.5 px-2 text-right text-slate-400">{stat.bb}</td>
                              <td className="py-2.5 px-2 text-right font-bold text-white">{stat.so}</td>
                              <td className="py-2.5 px-2.5 text-right font-black text-emerald-400">
                                {stat.whip.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold text-sky-400">
                                {stat.war || '0.0'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleStartEdit(stat)}
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                                    title="Editar temporada"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStat(stat.id)}
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                    title="Eliminar temporada"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Pitching Career Totals Row */}
                          {careerTotals?.pitching && (
                            <tr className="bg-sky-950/20 font-bold border-t-2 border-sky-500/40 text-sky-300">
                              <td className="py-3 px-3 font-sans uppercase tracking-wider text-sky-400">
                                Totales ({careerTotals.pitching.seasons} temp.)
                              </td>
                              <td className="py-3 px-2 text-center text-slate-400">—</td>
                              <td className="py-3 px-2 text-right">{careerTotals.pitching.games}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.pitching.gs}</td>
                              <td className="py-3 px-2 text-right text-emerald-400">{careerTotals.pitching.w}</td>
                              <td className="py-3 px-2 text-right text-rose-400">{careerTotals.pitching.l}</td>
                              <td className="py-3 px-2 text-right text-purple-400">{careerTotals.pitching.sv}</td>
                              <td className="py-3 px-2.5 text-right text-sky-400 font-black">
                                {careerTotals.pitching.era.toFixed(2)}
                              </td>
                              <td className="py-3 px-2 text-right text-white">{careerTotals.pitching.ip}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.pitching.h}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.pitching.er}</td>
                              <td className="py-3 px-2 text-right">{careerTotals.pitching.bb}</td>
                              <td className="py-3 px-2 text-right text-white">{careerTotals.pitching.so}</td>
                              <td className="py-3 px-2.5 text-right text-emerald-400 font-black">
                                {careerTotals.pitching.whip.toFixed(2)}
                              </td>
                              <td className="py-3 px-2 text-right text-sky-400">{careerTotals.pitching.war}</td>
                              <td className="py-3 px-3 text-center text-slate-500 font-sans text-[11px]">
                                Por vida
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* IN-MODAL DELETE CONFIRMATION DIALOG */}
      {statToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <span className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-white">¿Eliminar Registro de Temporada?</h4>
                <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente este registro histórico de{' '}
              <strong className="text-white">{activeTab === 'batting' ? 'bateo' : 'pitcheo'}</strong>?
              Los totales de por vida se recalcularán automáticamente.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={cancelDeleteStat}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteStat}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-rose-950/40 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Player Historical Stats JSON */}
      {isImportJsonModalOpen && player && (
        <AdminStatsImportModal
          isOpen={true}
          teams={teams}
          players={[player]}
          targetPlayerId={player.id}
          onClose={() => setIsImportJsonModalOpen(false)}
          onImportSuccess={(_count, msg) => {
            setFeedback({ type: 'success', message: msg });
            fetchStats();
            if (onStatsUpdated) onStatsUpdated();
          }}
        />
      )}
    </div>
  );
};
