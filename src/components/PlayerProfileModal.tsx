import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Award, Activity, TrendingUp, Shield, Camera } from 'lucide-react';
import { Player, BattingStats, PitchingStats } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { PlayerProfileSkeleton } from './LoadingSkeleton.tsx';
import { PlayerImageEditorModal } from './admin/PlayerImageEditorModal.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface PlayerProfileModalProps {
  playerId: string | null;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ playerId, onClose }) => {
  const { navigateToTeam, dataVersion, triggerDataRefresh } = useApp();
  const { isAdminAuthenticated } = useAdminAuth();
  const [data, setData] = useState<{
    player: Player;
    batting?: BattingStats;
    pitching?: PitchingStats;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    ApiClient.getPlayerDetail(playerId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [playerId, dataVersion]);

  if (!playerId) return null;

  // Mock performance trend data for chart
  const trendData = [
    { game: 'G1', avg: 0.312, ops: 0.890 },
    { game: 'G2', avg: 0.325, ops: 0.910 },
    { game: 'G3', avg: 0.340, ops: 0.945 },
    { game: 'G4', avg: 0.338, ops: 0.920 },
    { game: 'G5', avg: 0.355, ops: 0.970 },
    { game: 'G6', avg: 0.364, ops: 1.015 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
              Perfil Oficial del Jugador
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading || !data ? (
            <PlayerProfileSkeleton />
          ) : (
            <>
              {/* Player Hero Section */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800">
                <div className="relative group shrink-0">
                  <img
                    src={data.player.photo}
                    alt={data.player.fullName}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xl"
                    referrerPolicy="no-referrer"
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
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {data.player.fullName}
                    </span>
                    <span className="font-mono text-xl font-bold text-emerald-400">
                      #{data.player.jerseyNumber}
                    </span>
                  </div>

                  {/* Team & Position */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm">
                    <button
                      onClick={() => {
                        onClose();
                        navigateToTeam(data.player.teamId);
                      }}
                      className="flex items-center gap-1.5 font-bold text-slate-200 hover:text-emerald-400 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>{data.player.teamName} ({data.player.teamShort})</span>
                    </button>
                    <span className="text-slate-600">•</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
                      {data.player.position}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsImageEditorOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Camera className="w-3 h-3 text-emerald-400" />
                      <span>Cambiar Foto</span>
                    </button>
                  </div>

                  {/* Physical & Bio details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">Edad / Nac.</span>
                      <strong className="text-slate-200">{data.player.age} años</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Lugar</span>
                      <strong className="text-slate-200">{data.player.birthPlace}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Estatura / Peso</span>
                      <strong className="text-slate-200">{data.player.height} • {data.player.weight}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Batea / Lanza</span>
                      <strong className="text-slate-200">{data.player.bats} / {data.player.throws}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Batting Stats Card */}
              {data.batting && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      Estadísticas de Bateo (Temporada Actual)
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">WAR: {data.batting.war}</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 font-bold block">AVG</span>
                      <span className="font-mono text-xl font-black text-white">{data.batting.avg.toFixed(3)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 font-bold block">OBP</span>
                      <span className="font-mono text-xl font-black text-slate-200">{data.batting.obp.toFixed(3)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 font-bold block">SLG</span>
                      <span className="font-mono text-xl font-black text-slate-200">{data.batting.slg.toFixed(3)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 font-bold block">OPS</span>
                      <span className="font-mono text-xl font-black text-emerald-400">{data.batting.ops.toFixed(3)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 font-bold block">HR</span>
                      <span className="font-mono text-xl font-black text-amber-400">{data.batting.hr}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 font-bold block">CI (RBI)</span>
                      <span className="font-mono text-xl font-black text-white">{data.batting.rbi}</span>
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
                          <td className="py-2 px-2">{data.batting.games}</td>
                          <td className="px-2">{data.batting.pa}</td>
                          <td className="px-2">{data.batting.ab}</td>
                          <td className="px-2">{data.batting.r}</td>
                          <td className="px-2 font-bold text-white">{data.batting.h}</td>
                          <td className="px-2">{data.batting.doubles}</td>
                          <td className="px-2">{data.batting.triples}</td>
                          <td className="px-2">{data.batting.bb}</td>
                          <td className="px-2">{data.batting.so}</td>
                          <td className="px-2">{data.batting.sb}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pitching Stats Card */}
              {data.pitching && (() => {
                const wins = data.pitching.wins ?? data.pitching.w ?? 0;
                const losses = data.pitching.losses ?? data.pitching.l ?? 0;
                const saves = data.pitching.saves ?? data.pitching.sv ?? 0;

                return (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-sky-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        Estadísticas de Pitcheo (Temporada Actual)
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">
                        Récord: {wins}-{losses}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">PCL (ERA)</span>
                        <span className="font-mono text-xl font-black text-sky-400">{data.pitching.era.toFixed(2)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">WHIP</span>
                        <span className="font-mono text-xl font-black text-slate-200">{data.pitching.whip.toFixed(2)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">PONCHES (SO)</span>
                        <span className="font-mono text-xl font-black text-white">{data.pitching.so}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">ENTRADAS (IP)</span>
                        <span className="font-mono text-xl font-black text-slate-200">{data.pitching.ip}</span>
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

              {/* Performance Trend Chart */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Tendencia Reciente (AVG &amp; OPS)
                  </h4>
                  <span className="text-[11px] text-slate-500">Últimos 6 partidos</span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="game" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" domain={['auto', 'auto']} fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        name="Promedio (AVG)"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: '#10b981', r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ops"
                        name="OPS"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ fill: '#38bdf8', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Player Photo Editor Modal (Restricted to authenticated admin) */}
      {isAdminAuthenticated && isImageEditorOpen && data?.player && (
        <PlayerImageEditorModal
          player={data.player}
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
