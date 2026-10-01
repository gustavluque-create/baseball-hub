import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  Activity,
  MapPin,
  Users,
  Share2,
  Check,
  ListOrdered,
  Zap,
  Sparkles,
  Shield,
  Clock,
  Radio,
  Filter,
} from 'lucide-react';
import { Game, TeamLineup, LineupPlayer } from '../types/index.ts';
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
  const [activeTab, setActiveTab] = useState<'box' | 'lineups' | 'plays' | 'info'>('box');
  const [lineupSideTab, setLineupSideTab] = useState<'both' | 'away' | 'home'>('both');
  const [playFilter, setPlayFilter] = useState<'all' | 'scoring' | 'hits'>('all');
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

  // Helper to fallback-generate a clean lineup if not present on older game objects
  const getDisplayLineup = (side: 'away' | 'home'): TeamLineup => {
    if (game?.lineups && game.lineups[side] && game.lineups[side].battingOrder?.length > 0) {
      return game.lineups[side];
    }

    const team = side === 'away' ? game?.awayTeam : game?.homeTeam;
    const boxBatters = side === 'away' ? game?.battingBoxScore?.away : game?.battingBoxScore?.home;
    const boxPitchers = side === 'away' ? game?.pitchingBoxScore?.away : game?.pitchingBoxScore?.home;

    const defaultPositions = ['CF', '2B', 'LF', '1B', 'DH', '3B', 'RF', 'C', 'SS'];
    const battingOrder: LineupPlayer[] = (boxBatters || []).slice(0, 9).map((b, idx) => ({
      order: idx + 1,
      playerId: b.playerId,
      name: b.name,
      position: b.position || defaultPositions[idx] || 'DH',
      jerseyNumber: idx * 5 + 4,
      bats: 'R',
      ab: b.ab,
      r: b.r,
      h: b.h,
      rbi: b.rbi,
      bb: b.bb,
      so: b.so,
      avg: b.avg,
    }));

    // If box score was empty, generate 9 default placeholders
    while (battingOrder.length < 9) {
      const idx = battingOrder.length;
      const pos = defaultPositions[idx];
      battingOrder.push({
        order: idx + 1,
        playerId: `gen_${side}_${idx}`,
        name: `Bateador Titular (${pos})`,
        position: pos,
        jerseyNumber: idx * 6 + 7,
        bats: 'R',
        ab: 3,
        r: idx === 2 ? 1 : 0,
        h: idx % 2 === 0 ? 1 : 0,
        rbi: idx === 3 ? 1 : 0,
        bb: idx === 1 ? 1 : 0,
        so: idx === 7 ? 1 : 0,
        avg: `.2${70 + (idx * 9) % 55}`,
      });
    }

    const pitcherBox = boxPitchers && boxPitchers[0];
    const startingPitcher = {
      name: pitcherBox?.name || `${team?.manager ? 'Abridor de ' + team.name : 'Lanzador Abridor'}`,
      jerseyNumber: 33,
      era: pitcherBox?.era || '3.25',
      ip: pitcherBox?.ip || '5.1',
      h: pitcherBox?.h || 4,
      r: pitcherBox?.r || 2,
      er: pitcherBox?.er || 2,
      bb: pitcherBox?.bb || 2,
      so: pitcherBox?.so || 5,
      throws: 'R' as const,
      pitches: 78,
    };

    return {
      startingPitcher,
      battingOrder,
      bench: [],
    };
  };

  const awayLineup = getDisplayLineup('away');
  const homeLineup = getDisplayLineup('home');

  // Filtered plays
  const filteredPlays = (game?.plays || []).filter((p) => {
    if (playFilter === 'scoring') return p.isScoringPlay || (p.runsScored && p.runsScored > 0);
    if (playFilter === 'hits')
      return (
        p.playType === 'hit' ||
        p.playType === 'double' ||
        p.playType === 'triple' ||
        p.playType === 'homerun' ||
        p.description.toLowerCase().includes('hit') ||
        p.description.toLowerCase().includes('jonrón')
      );
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-sm tracking-wide flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              ENCUENTRO OFICIAL Y ESTADÍSTICAS
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">ID: {gameId}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Compartir'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {loading || !game ? (
            <BoxScoreSkeleton />
          ) : (
            <>
              {/* Scoreboard Hero Banner */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Away Team */}
                  <div className="flex items-center gap-4 text-center sm:text-left">
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
                      <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.name} className="w-full h-full text-4xl" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-100">{game.awayTeam.name}</h3>
                      <p className="text-xs text-slate-400">{game.awayTeam.city} • Visitante</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {game.awayHits} H • {game.awayErrors} E
                      </p>
                    </div>
                  </div>

                  {/* Main Score Display & Live Diamond Indicator */}
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

                    <div className="mt-2 flex items-center gap-2">
                      {game.status === 'LIVE' ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-bold text-xs border border-red-500/30">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            EN VIVO — {game.currentInning}ª {game.isTopInning ? 'Alta' : 'Baja'} ({game.outs || 0} outs)
                          </span>

                          {/* Mini Diamond for Bases if Live */}
                          <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                            <div
                              className={`absolute top-0 w-2.5 h-2.5 rounded-xs transform rotate-45 ${
                                game.bases?.second ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-slate-700'
                              }`}
                              title="2B"
                            />
                            <div
                              className={`absolute left-0 w-2.5 h-2.5 rounded-xs transform rotate-45 ${
                                game.bases?.third ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-slate-700'
                              }`}
                              title="3B"
                            />
                            <div
                              className={`absolute right-0 w-2.5 h-2.5 rounded-xs transform rotate-45 ${
                                game.bases?.first ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-slate-700'
                              }`}
                              title="1B"
                            />
                          </div>

                          {/* Count display */}
                          <span className="font-mono text-xs text-slate-300 font-bold px-2 py-0.5 rounded bg-slate-800">
                            {game.balls || 0}-{game.strikes || 0}
                          </span>
                        </div>
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
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {game.homeHits} H • {game.homeErrors} E
                      </p>
                    </div>
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
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
                      <span>JG: <strong className="text-slate-200">{game.winningPitcher.name}</strong></span>
                    </>
                  )}
                  {game.losingPitcher && (
                    <>
                      <span>•</span>
                      <span>JP: <strong className="text-slate-200">{game.losingPitcher.name}</strong></span>
                    </>
                  )}
                  {game.savePitcher && (
                    <>
                      <span>•</span>
                      <span>JS: <strong className="text-emerald-400">{game.savePitcher.name}</strong></span>
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
                            {ls.away !== null && ls.away !== undefined ? ls.away : '-'}
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
                            {ls.home !== null && ls.home !== undefined ? ls.home : '-'}
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
              <div className="flex items-center gap-3 border-b border-slate-800 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveTab('box')}
                  className={`pb-2 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'box'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Estadísticas (Box Score)
                </button>

                <button
                  onClick={() => setActiveTab('lineups')}
                  className={`pb-2 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'lineups'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Alineaciones Oficiales (Lineups)</span>
                </button>

                <button
                  onClick={() => setActiveTab('plays')}
                  className={`pb-2 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'plays'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Jugada a Jugada ({(game.plays || []).length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('info')}
                  className={`pb-2 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'info'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Detalles y Árbitros
                </button>
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
                              {awayLineup.battingOrder.map((b) => (
                                <tr key={b.playerId} className="hover:bg-slate-900/60">
                                  <td className="text-left py-1.5 font-sans">
                                    <button
                                      onClick={() => {
                                        onClose();
                                        navigateToPlayer(b.playerId);
                                      }}
                                      className="font-medium text-slate-200 hover:text-emerald-400 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                                    >
                                      <span className="text-[10px] font-mono text-slate-500 w-3">{b.order}</span>
                                      <span>{b.name}</span>
                                      <span className="text-slate-500 text-[10px] font-bold px-1 rounded bg-slate-800">
                                        {b.position}
                                      </span>
                                    </button>
                                  </td>
                                  <td className="px-1.5 py-1.5 text-right">{b.ab ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.r ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right font-bold text-white">{b.h ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right text-emerald-400 font-bold">{b.rbi ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.bb ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right text-rose-400">{b.so ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right text-slate-400">{b.avg || '.300'}</td>
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
                              {homeLineup.battingOrder.map((b) => (
                                <tr key={b.playerId} className="hover:bg-slate-900/60">
                                  <td className="text-left py-1.5 font-sans">
                                    <button
                                      onClick={() => {
                                        onClose();
                                        navigateToPlayer(b.playerId);
                                      }}
                                      className="font-medium text-slate-200 hover:text-emerald-400 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                                    >
                                      <span className="text-[10px] font-mono text-slate-500 w-3">{b.order}</span>
                                      <span>{b.name}</span>
                                      <span className="text-slate-500 text-[10px] font-bold px-1 rounded bg-slate-800">
                                        {b.position}
                                      </span>
                                    </button>
                                  </td>
                                  <td className="px-1.5 py-1.5 text-right">{b.ab ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.r ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right font-bold text-white">{b.h ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right text-emerald-400 font-bold">{b.rbi ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right">{b.bb ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right text-rose-400">{b.so ?? 0}</td>
                                  <td className="px-1.5 py-1.5 text-right text-slate-400">{b.avg || '.300'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PITCHEO */}
                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400 mb-3">
                      Estadísticas de Pitcheo
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Away Pitcher */}
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
                              <tr>
                                <td className="text-left py-1.5 font-sans font-medium text-slate-200">
                                  {awayLineup.startingPitcher?.name}
                                </td>
                                <td className="px-1.5 py-1.5 text-right">{awayLineup.startingPitcher?.ip || '5.0'}</td>
                                <td className="px-1.5 py-1.5 text-right">{awayLineup.startingPitcher?.h || 4}</td>
                                <td className="px-1.5 py-1.5 text-right">{awayLineup.startingPitcher?.r || 2}</td>
                                <td className="px-1.5 py-1.5 text-right">{awayLineup.startingPitcher?.er || 2}</td>
                                <td className="px-1.5 py-1.5 text-right">{awayLineup.startingPitcher?.bb || 2}</td>
                                <td className="px-1.5 py-1.5 text-right font-bold text-sky-400">{awayLineup.startingPitcher?.so || 5}</td>
                                <td className="px-1.5 py-1.5 text-right text-slate-400">{awayLineup.startingPitcher?.era || '3.20'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Home Pitcher */}
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
                              <tr>
                                <td className="text-left py-1.5 font-sans font-medium text-slate-200">
                                  {homeLineup.startingPitcher?.name}
                                </td>
                                <td className="px-1.5 py-1.5 text-right">{homeLineup.startingPitcher?.ip || '5.1'}</td>
                                <td className="px-1.5 py-1.5 text-right">{homeLineup.startingPitcher?.h || 3}</td>
                                <td className="px-1.5 py-1.5 text-right">{homeLineup.startingPitcher?.r || 1}</td>
                                <td className="px-1.5 py-1.5 text-right">{homeLineup.startingPitcher?.er || 1}</td>
                                <td className="px-1.5 py-1.5 text-right">{homeLineup.startingPitcher?.bb || 1}</td>
                                <td className="px-1.5 py-1.5 text-right font-bold text-sky-400">{homeLineup.startingPitcher?.so || 6}</td>
                                <td className="px-1.5 py-1.5 text-right text-slate-400">{homeLineup.startingPitcher?.era || '3.10'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ALINEACIONES OFICIALES (LINEUPS) */}
              {activeTab === 'lineups' && (
                <div className="space-y-6">
                  {/* Selector de Vista (Lado a lado, Visitante o Local) */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Alineaciones Titulares para el Encuentro
                    </span>

                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                      <button
                        onClick={() => setLineupSideTab('both')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          lineupSideTab === 'both'
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Ambos Equipos
                      </button>
                      <button
                        onClick={() => setLineupSideTab('away')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          lineupSideTab === 'away'
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {game.awayTeam.shortName}
                      </button>
                      <button
                        onClick={() => setLineupSideTab('home')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          lineupSideTab === 'home'
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {game.homeTeam.shortName}
                      </button>
                    </div>
                  </div>

                  <div className={`grid gap-6 ${lineupSideTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    {/* AWAY LINEUP CARD */}
                    {(lineupSideTab === 'both' || lineupSideTab === 'away') && (
                      <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center p-1">
                              <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.name} className="w-full h-full" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                                <span>{game.awayTeam.name}</span>
                                {game.status === 'LIVE' && game.isTopInning && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                                    AL BATE
                                  </span>
                                )}
                              </h4>
                              <p className="text-[11px] text-slate-400">Visitante • Alineación Oficial</p>
                            </div>
                          </div>
                        </div>

                        {/* Starting Pitcher Spotlight */}
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                              <span>Lanzador Abridor</span>
                              {game.status === 'LIVE' && !game.isTopInning && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 text-[9px] font-bold border border-sky-500/30">
                                  EN LA LOMA
                                </span>
                              )}
                            </span>
                            <span className="font-bold text-xs text-white block mt-0.5">
                              {awayLineup.startingPitcher?.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              #{awayLineup.startingPitcher?.jerseyNumber || 33} • Brazo: {awayLineup.startingPitcher?.throws || 'R'}
                            </span>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <span className="text-slate-200 font-bold block">
                              PCL: {awayLineup.startingPitcher?.era || '3.20'}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {awayLineup.startingPitcher?.ip || '5.0'} IP • {awayLineup.startingPitcher?.so || 4} K • {awayLineup.startingPitcher?.bb || 2} BB
                            </span>
                          </div>
                        </div>

                        {/* Batting Order 1 to 9 */}
                        <div className="space-y-1.5">
                          {awayLineup.battingOrder.map((b, idx) => {
                            const isCurrentlyAtBat = game.status === 'LIVE' && game.isTopInning && idx === 0;
                            return (
                              <div
                                key={b.order}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors text-xs ${
                                  isCurrentlyAtBat
                                    ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                                    : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-5 h-5 rounded-md font-mono font-bold text-[11px] flex items-center justify-center shrink-0 ${
                                    isCurrentlyAtBat ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    {b.order}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          onClose();
                                          navigateToPlayer(b.playerId);
                                        }}
                                        className="font-bold text-slate-100 hover:text-emerald-400 transition-colors cursor-pointer text-left"
                                      >
                                        {b.name}
                                      </button>
                                      {isCurrentlyAtBat && (
                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 animate-pulse">
                                          AL BATE
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                      <span className="font-bold text-emerald-400 px-1 py-0.2 rounded bg-slate-800 border border-slate-700">
                                        {b.position}
                                      </span>
                                      <span>#{b.jerseyNumber || 0}</span>
                                      <span>Batea: {b.bats || 'R'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right font-mono text-[11px]">
                                  <span className="font-bold text-slate-100 block">
                                    {b.h ?? 0}-{b.ab ?? 0} ({b.r ?? 0} C, {b.rbi ?? 0} CI)
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    AVG <strong className="text-emerald-400">{b.avg || '.300'}</strong> • {b.bb ?? 0} BB • {b.so ?? 0} K
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Bench List */}
                        {awayLineup.bench && awayLineup.bench.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5">
                              Banquillo y Reservas ({awayLineup.bench.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {awayLineup.bench.map((res, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                                >
                                  {res.name} ({res.position})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* HOME LINEUP CARD */}
                    {(lineupSideTab === 'both' || lineupSideTab === 'home') && (
                      <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center p-1">
                              <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.name} className="w-full h-full" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                                <span>{game.homeTeam.name}</span>
                                {game.status === 'LIVE' && !game.isTopInning && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                                    AL BATE
                                  </span>
                                )}
                              </h4>
                              <p className="text-[11px] text-slate-400">Local • Alineación Oficial</p>
                            </div>
                          </div>
                        </div>

                        {/* Starting Pitcher Spotlight */}
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                              <span>Lanzador Abridor</span>
                              {game.status === 'LIVE' && game.isTopInning && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 text-[9px] font-bold border border-sky-500/30">
                                  EN LA LOMA
                                </span>
                              )}
                            </span>
                            <span className="font-bold text-xs text-white block mt-0.5">
                              {homeLineup.startingPitcher?.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              #{homeLineup.startingPitcher?.jerseyNumber || 33} • Brazo: {homeLineup.startingPitcher?.throws || 'R'}
                            </span>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <span className="text-slate-200 font-bold block">
                              PCL: {homeLineup.startingPitcher?.era || '3.10'}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {homeLineup.startingPitcher?.ip || '5.1'} IP • {homeLineup.startingPitcher?.so || 6} K • {homeLineup.startingPitcher?.bb || 1} BB
                            </span>
                          </div>
                        </div>

                        {/* Batting Order 1 to 9 */}
                        <div className="space-y-1.5">
                          {homeLineup.battingOrder.map((b, idx) => {
                            const isCurrentlyAtBat = game.status === 'LIVE' && !game.isTopInning && idx === 0;
                            return (
                              <div
                                key={b.order}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors text-xs ${
                                  isCurrentlyAtBat
                                    ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                                    : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-5 h-5 rounded-md font-mono font-bold text-[11px] flex items-center justify-center shrink-0 ${
                                    isCurrentlyAtBat ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    {b.order}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          onClose();
                                          navigateToPlayer(b.playerId);
                                        }}
                                        className="font-bold text-slate-100 hover:text-emerald-400 transition-colors cursor-pointer text-left"
                                      >
                                        {b.name}
                                      </button>
                                      {isCurrentlyAtBat && (
                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 animate-pulse">
                                          AL BATE
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                      <span className="font-bold text-emerald-400 px-1 py-0.2 rounded bg-slate-800 border border-slate-700">
                                        {b.position}
                                      </span>
                                      <span>#{b.jerseyNumber || 0}</span>
                                      <span>Batea: {b.bats || 'R'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right font-mono text-[11px]">
                                  <span className="font-bold text-slate-100 block">
                                    {b.h ?? 0}-{b.ab ?? 0} ({b.r ?? 0} C, {b.rbi ?? 0} CI)
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    AVG <strong className="text-emerald-400">{b.avg || '.300'}</strong> • {b.bb ?? 0} BB • {b.so ?? 0} K
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Bench List */}
                        {homeLineup.bench && homeLineup.bench.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5">
                              Banquillo y Reservas ({homeLineup.bench.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {homeLineup.bench.map((res, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                                >
                                  {res.name} ({res.position})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: PLAY BY PLAY */}
              {activeTab === 'plays' && (
                <div className="space-y-4">
                  {/* Filter pills */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Relato en Vivo Jugada a Jugada
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPlayFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          playFilter === 'all'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Todas ({(game.plays || []).length})
                      </button>
                      <button
                        onClick={() => setPlayFilter('scoring')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          playFilter === 'scoring'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Anotaciones
                      </button>
                      <button
                        onClick={() => setPlayFilter('hits')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          playFilter === 'hits'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Hits
                      </button>
                    </div>
                  </div>

                  {filteredPlays.length === 0 ? (
                    <div className="py-12 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 space-y-2">
                      <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-sm font-semibold text-slate-300">
                        No hay jugadas registradas con el filtro actual.
                      </p>
                      <p className="text-xs text-slate-500">
                        El relato oficial se actualiza en tiempo real a medida que el operador transmite el partido.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredPlays.map((play) => (
                        <div
                          key={play.id}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs transition-all ${
                            play.isScoringPlay
                              ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                              : 'bg-slate-950/50 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span
                            className={`font-mono font-bold px-2 py-1 rounded text-[11px] shrink-0 ${
                              play.isScoringPlay ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {play.inning}ª {play.isTop ? '▲' : '▼'}
                          </span>
                          <div className="flex-1 space-y-1">
                            <p className="text-slate-200 leading-relaxed font-medium">
                              {play.description}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                              <span>Marcador: {play.scoreAfter}</span>
                              <span>•</span>
                              <span>{play.outs} out(s)</span>
                              {play.batterName && <span>• {play.batterName}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: DETAILS & UMPIRES */}
              {activeTab === 'info' && (
                <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-4 text-xs">
                  <div>
                    <h5 className="font-bold text-slate-300 uppercase tracking-wider mb-2">Cuerpo Arbitral</h5>
                    <ul className="list-disc list-inside text-slate-400 space-y-1">
                      {game.umpires?.map((u, i) => (
                        <li key={i}>{u}</li>
                      )) || <li>Árbitros oficiales de la Federación Cubana de Béisbol</li>}
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
