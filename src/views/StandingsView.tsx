import React, { useState, useEffect } from 'react';
import { Trophy, Shield, Info } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { StandingsTableSkeleton } from '../components/LoadingSkeleton.tsx';
import { Standing } from '../types/index.ts';
import { TeamLogo } from '../components/TeamLogo.tsx';

export const StandingsView: React.FC = () => {
  const { activeCompetitionId, navigateToTeam, dataVersion } = useApp();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [division, setDivision] = useState<string>('General');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ApiClient.getStandings({
      competition: activeCompetitionId,
      division: division === 'General' ? undefined : division,
    })
      .then((res) => {
        setStandings(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activeCompetitionId, division, dataVersion]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-400" />
            Tabla de Posiciones Oficial
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Clasificación actualizada de la temporada. Los 4 primeros puestos acceden a la postemporada.
          </p>
        </div>

        {/* Division Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {['General', 'Occidental', 'Oriental'].map((div) => (
            <button
              key={div}
              onClick={() => setDivision(div)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                division === div
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {div}
            </button>
          ))}
        </div>
      </div>

      {/* Legend & Playoff indicator */}
      <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Puestos 1-4: Zona de Clasificación (Playoffs)</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <StandingsTableSkeleton rows={division === 'General' ? 16 : 8} />
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase font-sans text-[11px]">
                  <th className="py-3 px-3 text-center w-10">POS</th>
                  <th className="py-3 px-4 min-w-[200px]">EQUIPO</th>
                  <th className="py-3 px-3 text-right">JJ</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-200">G</th>
                  <th className="py-3 px-3 text-right">P</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-400">PCT</th>
                  <th className="py-3 px-3 text-right">DIF</th>
                  <th className="py-3 px-3 text-right">L10</th>
                  <th className="py-3 px-3 text-right">RACHA</th>
                  <th className="py-3 px-3 text-right">CASA</th>
                  <th className="py-3 px-3 text-right">FUERA</th>
                  <th className="py-3 px-3 text-right">CA</th>
                  <th className="py-3 px-3 text-right">CP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {standings.map((s, index) => {
                  const isPlayoffZone = index < 4;
                  return (
                    <tr
                      key={s.id || s.teamId}
                      onClick={() => navigateToTeam(s.teamId)}
                      className={`hover:bg-slate-800/60 cursor-pointer transition-colors ${
                        isPlayoffZone ? 'bg-emerald-950/10' : ''
                      }`}
                    >
                      {/* Rank with playoff marker */}
                      <td className="py-3 px-3 text-center font-bold">
                        <div className="flex items-center justify-center gap-1">
                          {isPlayoffZone && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          )}
                          <span className={isPlayoffZone ? 'text-emerald-400' : 'text-slate-400'}>
                            {s.rank ?? (index + 1)}
                          </span>
                        </div>
                      </td>

                      {/* Team Name and Logo */}
                      <td className="py-3 px-4 font-sans font-bold text-slate-200 flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          <TeamLogo logo={s.teamLogo || s.logo} name={s.teamName} className="w-full h-full text-2xl" />
                        </div>
                        <div>
                          <p className="hover:text-emerald-400 transition-colors">{s.teamName}</p>
                          <span className="text-[10px] text-slate-500 font-normal">
                            División {s.division}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right text-slate-400">{s.gamesPlayed}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-100">{s.wins}</td>
                      <td className="py-3 px-3 text-right text-slate-400">{s.losses}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">
                        {s.pct.toFixed(3)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">
                        {typeof s.diff === 'number' ? (s.diff === 0 ? '-' : s.diff.toFixed(1)) : (s.diff || '-')}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">{s.lastTen}</td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            s.streak.startsWith('G')
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {s.streak}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">{s.homeRecord}</td>
                      <td className="py-3 px-3 text-right text-slate-400">{s.awayRecord}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{s.runsScored}</td>
                      <td className="py-3 px-3 text-right text-slate-400">{s.runsAllowed ?? s.runsAgainst ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
