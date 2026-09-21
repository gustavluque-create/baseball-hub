import React, { useState, useEffect } from 'react';
import { Award, Flame, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { LeadersGridSkeleton } from '../components/LoadingSkeleton.tsx';
import { getSeasonBadgeLabel } from '../utils/season.ts';
import { SeasonToggleBar } from '../components/SeasonToggleBar.tsx';

export const LeadersView: React.FC = () => {
  const { navigateToPlayer, activeSeasonId } = useApp();
  const [limit, setLimit] = useState<number>(5);

  // Batting leaders state
  const [avgLeaders, setAvgLeaders] = useState<any[]>([]);
  const [hrLeaders, setHrLeaders] = useState<any[]>([]);
  const [rbiLeaders, setRbiLeaders] = useState<any[]>([]);
  const [opsLeaders, setOpsLeaders] = useState<any[]>([]);

  // Pitching leaders state
  const [eraLeaders, setEraLeaders] = useState<any[]>([]);
  const [soLeaders, setSoLeaders] = useState<any[]>([]);
  const [winsLeaders, setWinsLeaders] = useState<any[]>([]);
  const [savesLeaders, setSavesLeaders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ApiClient.getLeaders({ category: 'batting', stat: 'avg', limit, seasonId: activeSeasonId }),
      ApiClient.getLeaders({ category: 'batting', stat: 'hr', limit, seasonId: activeSeasonId }),
      ApiClient.getLeaders({ category: 'batting', stat: 'rbi', limit, seasonId: activeSeasonId }),
      ApiClient.getLeaders({ category: 'batting', stat: 'ops', limit, seasonId: activeSeasonId }),
      ApiClient.getLeaders({ category: 'pitching', stat: 'era', limit, seasonId: activeSeasonId }),
      ApiClient.getLeaders({ category: 'pitching', stat: 'so', limit, seasonId: activeSeasonId }),
      ApiClient.getLeaders({ category: 'pitching', stat: 'wins', limit, seasonId: activeSeasonId }),
      ApiClient.getLeaders({ category: 'pitching', stat: 'saves', limit, seasonId: activeSeasonId }),
    ])
      .then(([avg, hr, rbi, ops, era, so, wins, saves]) => {
        setAvgLeaders(avg);
        setHrLeaders(hr);
        setRbiLeaders(rbi);
        setOpsLeaders(ops);
        setEraLeaders(era);
        setSoLeaders(so);
        setWinsLeaders(wins);
        setSavesLeaders(saves);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [limit, activeSeasonId]);

  const renderLeaderCard = (
    title: string,
    statName: string,
    items: any[],
    isDecimals = false,
    themeColor: 'emerald' | 'amber' | 'sky' | 'purple' = 'emerald'
  ) => {
    const colorClasses = {
      emerald: 'text-emerald-400 border-emerald-500/30',
      amber: 'text-amber-400 border-amber-500/30',
      sky: 'text-sky-400 border-sky-500/30',
      purple: 'text-purple-400 border-purple-500/30',
    };

    const firstItem = items[0];

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <h3 className="font-bold text-slate-200 text-sm">{title}</h3>
          <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-slate-800 ${colorClasses[themeColor]}`}>
            {statName}
          </span>
        </div>

        {/* #1 Leader Hero Highlight */}
        {firstItem && (
          <div
            onClick={() => navigateToPlayer(firstItem.playerId)}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all mb-3 group"
          >
            <div className="relative">
              <img
                src={firstItem.playerPhoto}
                alt={firstItem.playerName}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/40"
                referrerPolicy="no-referrer"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
                1
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-slate-100 group-hover:text-emerald-400 truncate transition-colors">
                {firstItem.playerName}
              </h4>
              <p className="text-xs text-slate-400">
                {firstItem.position} • {firstItem.teamShort}
              </p>
            </div>
            <span className={`font-mono text-xl font-black ${colorClasses[themeColor]}`}>
              {isDecimals && typeof firstItem.value === 'number'
                ? firstItem.value.toFixed(statName === 'PCL' ? 2 : 3)
                : firstItem.value}
            </span>
          </div>
        )}

        {/* Secondary Leaders List */}
        <div className="space-y-1.5 flex-1">
          {items.slice(1).map((item, idx) => (
            <div
              key={item.playerId}
              onClick={() => navigateToPlayer(item.playerId)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-slate-500 w-4 text-center font-bold">
                  {idx + 2}
                </span>
                <span className="font-medium text-slate-300 group-hover:text-emerald-400 truncate transition-colors">
                  {item.playerName}
                </span>
                <span className="text-[11px] text-slate-500">({item.teamShort})</span>
              </div>
              <span className="font-mono font-bold text-slate-200">
                {isDecimals && typeof item.value === 'number'
                  ? item.value.toFixed(statName === 'PCL' ? 2 : 3)
                  : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5 flex-wrap">
            <Award className="w-6 h-6 text-amber-400" />
            <span>Líderes Individuales de la Temporada</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {getSeasonBadgeLabel(activeSeasonId)}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Los mejores atletas en cada departamento ofensivo y de pitcheo del campeonato.
          </p>
        </div>

        {/* Controls: Season Selector & Limit Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <SeasonToggleBar />

          {/* Limit Toggle */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setLimit(5)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                limit === 5
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Top 5
            </button>
            <button
              onClick={() => setLimit(10)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                limit === 10
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Top 10
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LeadersGridSkeleton count={8} />
      ) : (
        <>
          {/* OFENSIVA / BATEO */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-black text-white tracking-wide">
                Líderes de Bateo (Ofensiva)
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {renderLeaderCard('Promedio de Bateo', 'AVG', avgLeaders, true, 'emerald')}
              {renderLeaderCard('Jonrones (Cuadrangulares)', 'HR', hrLeaders, false, 'amber')}
              {renderLeaderCard('Carreras Impulsadas', 'CI', rbiLeaders, false, 'emerald')}
              {renderLeaderCard('OPS (OBP + SLG)', 'OPS', opsLeaders, true, 'purple')}
            </div>
          </section>

          {/* PITCHEO / LANZADORES */}
          <section className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-black text-white tracking-wide">
                Líderes de Pitcheo (Lanzadores)
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {renderLeaderCard('Efectividad / PCL', 'PCL', eraLeaders, true, 'sky')}
              {renderLeaderCard('Ponches Propinados', 'K', soLeaders, false, 'sky')}
              {renderLeaderCard('Juegos Ganados', 'JG', winsLeaders, false, 'emerald')}
              {renderLeaderCard('Juegos Salvados', 'JS', savesLeaders, false, 'purple')}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
