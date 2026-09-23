import React, { useState, useEffect } from 'react';
import { X, Trophy, Activity, MapPin, Users, Share2, Check } from 'lucide-react';
import { Game } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { BoxScoreSkeleton } from './LoadingSkeleton.tsx';
import { TeamLogo } from './TeamLogo.tsx';

interface BoxScoreModalProps {
  gameId: string | null;
  onClose: () => void;
}

export const BoxScoreModal: React.FC<BoxScoreModalProps> = ({ gameId, onClose }) => {
  const { navigateToPlayer } = useApp();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'box' | 'plays' | 'info'>('box');
  const [selectedTeamTab, setSelectedTeamTab] = useState<'both' | 'away' | 'home'>('both');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    ApiClient.getGameDetail(gameId)
      .then((g) => {
        setGame(g);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [gameId]);

  if (!gameId) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-sm">BOX SCORE OFICIAL</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">ID: {gameId}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Compartir'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading || !game ? (
            <BoxScoreSkeleton />
          ) : (
            <>
              {/* Scoreboard Hero Banner */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Away Team */}
                  <div className="flex items-center gap-4 text-center sm:text-left">
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                      <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.name} className="w-full h-full text-4xl" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-100">{game.awayTeam.name}</h3>
                      <p className="text-xs text-slate-400">{game.awayTeam.city} • Visitante</p>
                    </div>
                  </div>

                  {/* Main Score Display */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-6 font-mono text-4xl sm:text-5xl font-black tracking-wider">
                      <span className={game.awayScore >= game.homeScore ? 'text-white' : 'text-slate-400'}>
                        {game.status === 'SCHEDULED' ? '-' : game.awayScore}
                      </span>
                      <span className="text-slate-600 text-2xl font-sans font-light">vs</span>
                      <span className={game.homeScore >= game.awayScore ? 'text-white' : 'text-slate-400'}>
                        {game.status === 'SCHEDULED' ? '-' : game.homeScore}
                      </span>
                    </div>
                    <div className="mt-2">
                      {game.status === 'LIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-bold text-xs border border-red-500/30">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          EN VIVO — {game.currentInning}ª {game.isTopInning ? 'Alta' : 'Baja'} ({game.outs} outs)
                        </span>
                      ) : game.status === 'FINAL' ? (
                        <span className="px-3 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
                          FINALIZADO
                        </span>
                      ) : (
                        <span className="px-3 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium text-xs">
                          {game.time} hrs • PROGRAMADO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Home Team */}
                  <div className="flex items-center gap-4 text-center sm:text-right flex-row-reverse sm:flex-row">
                    <div>
                      <h3 className="text-lg font-black text-slate-100">{game.homeTeam.name}</h3>
                      <p className="text-xs text-slate-400">{game.homeTeam.city} • Local</p>
                    </div>
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                      <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.name} className="w-full h-full text-4xl" />
                    </div>
                  </div>
                </div>

                {/* Match Meta info */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {game.stadium}
                  </span>
                  <span>•</span>
                  <span>Fecha: {game.date}</span>
                  {game.winningPitcher && (
                    <>
                      <span>•</span>
                      <span>JG: <strong className="text-slate-200">{game.winningPitcher.name}</strong> ({game.winningPitcher.record})</span>
                    </>
                  )}
                  {game.losingPitcher && (
                    <>
                      <span>•</span>
                      <span>JP: <strong className="text-slate-200">{game.losingPitcher.name}</strong> ({game.losingPitcher.record})</span>
                    </>
                  )}
                </div>
              </div>

              {/* Line Score Table by Innings */}
              {game.lineScore && game.lineScore.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-1">
                  <table className="w-full text-center text-xs font-mono">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="text-left py-2 px-3 font-sans uppercase font-bold text-[11px] min-w-[120px]">
                          Equipo
                        </th>
                        {game.lineScore.map((ls) => (
                          <th key={ls.inning} className="px-2.5 py-2 font-bold text-slate-300">
                            {ls.inning}
                          </th>
                        ))}
                        <th className="px-3 py-2 font-bold text-white bg-slate-900 border-l border-slate-800">C</th>
                        <th className="px-3 py-2 font-bold text-slate-300 bg-slate-900">H</th>
                        <th className="px-3 py-2 font-bold text-slate-300 bg-slate-900">E</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {/* Away row */}
                      <tr>
                        <td className="text-left py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-2">
                          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                            <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.name} className="w-full h-full" />
                          </div>
                          <span>{game.awayTeam.shortName}</span>
                        </td>
                        {game.lineScore.map((ls) => (
                          <td key={`away-${ls.inning}`} className="px-2.5 py-2 text-slate-300">
                            {ls.away !== null ? ls.away : '-'}
                          </td>
                        ))}
                        <td className="px-3 py-2 font-bold text-white bg-slate-900 border-l border-slate-800 font-mono text-sm">
                          {game.awayScore}
                        </td>
                        <td className="px-3 py-2 text-slate-300 bg-slate-900">{game.awayHits}</td>
                        <td className="px-3 py-2 text-slate-300 bg-slate-900">{game.awayErrors}</td>
                      </tr>
                      {/* Home row */}
                      <tr>
                        <td className="text-left py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-2">
                          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                            <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.name} className="w-full h-full" />
                          </div>
                          <span>{game.homeTeam.shortName}</span>
                        </td>
                        {game.lineScore.map((ls) => (
                          <td key={`home-${ls.inning}`} className="px-2.5 py-2 text-slate-300">
                            {ls.home !== null ? ls.home : '-'}
                          </td>
                        ))}
                        <td className="px-3 py-2 font-bold text-white bg-slate-900 border-l border-slate-800 font-mono text-sm">
                          {game.homeScore}
                        </td>
                        <td className="px-3 py-2 text-slate-300 bg-slate-900">{game.homeHits}</td>
                        <td className="px-3 py-2 text-slate-300 bg-slate-900">{game.homeErrors}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-tabs Navigation */}
              <div className="flex items-center gap-2 border-b border-slate-800">
                <button
                  onClick={() => setActiveTab('box')}
                  className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'box'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Estadísticas (Box Score)
                </button>
                {game.plays && game.plays.length > 0 && (
                  <button
                    onClick={() => setActiveTab('plays')}
                    className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                      activeTab === 'plays'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Jugada a Jugada ({game.plays.length})
                  </button>
                )}
                {game.umpires && (
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                      activeTab === 'info'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Detalles y Árbitros
                  </button>
                )}
              </div>

              {/* TAB 1: BOX SCORE DETALLADO */}
              {activeTab === 'box' && (
                <div className="space-y-6">
                  {/* BATEO */}
                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400 mb-3">
                      Estadísticas de Bateo
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Away Batters */}
                      <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-3">
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-200 pb-2 mb-2 border-b border-slate-800">
                          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                            <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.name} className="w-full h-full" />
                          </div>
                          <span>{game.awayTeam.name}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs font-mono min-w-[320px]">
                            <thead>
                              <tr className="text-slate-400 text-right">
                                <th className="text-left font-sans font-semibold">Bateador</th>
                                <th className="px-1.5">VB</th>
                                <th className="px-1.5">C</th>
                                <th className="px-1.5">H</th>
                                <th className="px-1.5">CI</th>
                                <th className="px-1.5">BB</th>
                                <th className="px-1.5">K</th>
                                <th className="px-1.5">AVG</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {game.battingBoxScore?.away.map((b) => (
                                <tr key={b.playerId} className="hover:bg-slate-900/60">
                                  <td className="text-left py-1.5 font-sans">
                                    <button
                                      onClick={() => {
                                        onClose();
                                        navigateToPlayer(b.playerId);
                                      }}
                                      className="font-medium text-slate-200 hover:text-emerald-400 transition-colors"
                                    >
                                      {b.name} <span className="text-slate-500 text-[10px]">{b.position}</span>
                                    </button>
                                  </td>
                                  <td className="px-1.5 py-1.5 text-right">{b.ab}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.r}</td>
                                  <td className="px-1.5 py-1.5 text-right font-bold text-white">{b.h}</td>
                                  <td className="px-1.5 py-1.5 text-right text-emerald-400 font-bold">{b.rbi}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.bb}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.so}</td>
                                  <td className="px-1.5 py-1.5 text-right text-slate-400">{b.avg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Home Batters */}
                      <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-3">
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-200 pb-2 mb-2 border-b border-slate-800">
                          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                            <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.name} className="w-full h-full" />
                          </div>
                          <span>{game.homeTeam.name}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs font-mono min-w-[320px]">
                            <thead>
                              <tr className="text-slate-400 text-right">
                                <th className="text-left font-sans font-semibold">Bateador</th>
                                <th className="px-1.5">VB</th>
                                <th className="px-1.5">C</th>
                                <th className="px-1.5">H</th>
                                <th className="px-1.5">CI</th>
                                <th className="px-1.5">BB</th>
                                <th className="px-1.5">K</th>
                                <th className="px-1.5">AVG</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {game.battingBoxScore?.home.map((b) => (
                                <tr key={b.playerId} className="hover:bg-slate-900/60">
                                  <td className="text-left py-1.5 font-sans">
                                    <button
                                      onClick={() => {
                                        onClose();
                                        navigateToPlayer(b.playerId);
                                      }}
                                      className="font-medium text-slate-200 hover:text-emerald-400 transition-colors"
                                    >
                                      {b.name} <span className="text-slate-500 text-[10px]">{b.position}</span>
                                    </button>
                                  </td>
                                  <td className="px-1.5 py-1.5 text-right">{b.ab}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.r}</td>
                                  <td className="px-1.5 py-1.5 text-right font-bold text-white">{b.h}</td>
                                  <td className="px-1.5 py-1.5 text-right text-emerald-400 font-bold">{b.rbi}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.bb}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.so}</td>
                                  <td className="px-1.5 py-1.5 text-right text-slate-400">{b.avg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PITCHEO */}
                  {game.pitchingBoxScore && (
                    <div>
                      <h4 className="text-xs uppercase font-bold tracking-wider text-sky-400 mb-3">
                        Lanzadores (Pitcheo)
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Away Pitchers */}
                        <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-3">
                          <div className="font-bold text-xs text-slate-200 pb-2 mb-2 border-b border-slate-800">
                            Pitcheo: {game.awayTeam.name}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono min-w-[320px]">
                              <thead>
                                <tr className="text-slate-400 text-right">
                                  <th className="text-left font-sans font-semibold">Lanzador</th>
                                  <th className="px-1.5">INN</th>
                                  <th className="px-1.5">H</th>
                                  <th className="px-1.5">C</th>
                                  <th className="px-1.5">CL</th>
                                  <th className="px-1.5">BB</th>
                                  <th className="px-1.5">K</th>
                                  <th className="px-1.5">PCL</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {game.pitchingBoxScore.away.map((p) => (
                                  <tr key={p.playerId} className="hover:bg-slate-900/60">
                                    <td className="text-left py-1.5 font-sans font-medium text-slate-200">
                                      {p.name}
                                    </td>
                                    <td className="px-1.5 py-1.5 text-right">{p.ip}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.h}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.r}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.er}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.bb}</td>
                                    <td className="px-1.5 py-1.5 text-right font-bold text-sky-400">{p.so}</td>
                                    <td className="px-1.5 py-1.5 text-right text-slate-400">{p.era}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Home Pitchers */}
                        <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-3">
                          <div className="font-bold text-xs text-slate-200 pb-2 mb-2 border-b border-slate-800">
                            Pitcheo: {game.homeTeam.name}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono min-w-[320px]">
                              <thead>
                                <tr className="text-slate-400 text-right">
                                  <th className="text-left font-sans font-semibold">Lanzador</th>
                                  <th className="px-1.5">INN</th>
                                  <th className="px-1.5">H</th>
                                  <th className="px-1.5">C</th>
                                  <th className="px-1.5">CL</th>
                                  <th className="px-1.5">BB</th>
                                  <th className="px-1.5">K</th>
                                  <th className="px-1.5">PCL</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {game.pitchingBoxScore.home.map((p) => (
                                  <tr key={p.playerId} className="hover:bg-slate-900/60">
                                    <td className="text-left py-1.5 font-sans font-medium text-slate-200">
                                      {p.name}
                                    </td>
                                    <td className="px-1.5 py-1.5 text-right">{p.ip}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.h}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.r}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.er}</td>
                                    <td className="px-1.5 py-1.5 text-right">{p.bb}</td>
                                    <td className="px-1.5 py-1.5 text-right font-bold text-sky-400">{p.so}</td>
                                    <td className="px-1.5 py-1.5 text-right text-slate-400">{p.era}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PLAY BY PLAY */}
              {activeTab === 'plays' && game.plays && (
                <div className="space-y-2.5">
                  {game.plays.map((play) => (
                    <div
                      key={play.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
                        play.isScoringPlay
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : 'bg-slate-950/40 border-slate-800'
                      }`}
                    >
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                        {play.inning}ª {play.isTop ? 'Alta' : 'Baja'}
                      </span>
                      <div className="flex-1">
                        <p className="text-slate-200 leading-relaxed">{play.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
                          <span>Marcador: {play.scoreAfter}</span>
                          <span>•</span>
                          <span>{play.outs} out(s)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: DETAILS & UMPIRES */}
              {activeTab === 'info' && (
                <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-4 text-xs">
                  <div>
                    <h5 className="font-bold text-slate-300 uppercase tracking-wider mb-2">Cuerpo Arbitral</h5>
                    <ul className="list-disc list-inside text-slate-400 space-y-1">
                      {game.umpires?.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-300 uppercase tracking-wider mb-2">Instalación y Capacidad</h5>
                    <p className="text-slate-400">{game.stadium}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
