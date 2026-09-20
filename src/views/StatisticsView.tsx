import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  ArrowUpDown,
  Search,
  Filter,
  Users,
  LineChart as LineChartIcon,
  Table as TableIcon,
  LayoutGrid,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import {
  TableSkeleton,
  StatisticsTableSkeleton,
  ChartCardSkeleton,
  SimulateLoadButton,
} from '../components/LoadingSkeleton.tsx';
import { PlayerPerformanceCharts } from '../components/PlayerPerformanceCharts.tsx';
import { BattingStats, PitchingStats } from '../types/index.ts';

export const StatisticsView: React.FC = () => {
  const { navigateToPlayer } = useApp();
  const [statType, setStatType] = useState<'batting' | 'pitching' | 'advanced'>('batting');
  const [viewMode, setViewMode] = useState<'both' | 'charts' | 'table'>('both');
  const [battingData, setBattingData] = useState<BattingStats[]>([]);
  const [pitchingData, setPitchingData] = useState<PitchingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [sortColumn, setSortColumn] = useState<string>('avg');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    if (statType === 'pitching') {
      ApiClient.getStats<PitchingStats[]>({ type: 'pitching', sortBy: sortColumn, order: sortOrder })
        .then((res) => {
          setPitchingData(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      ApiClient.getStats<BattingStats[]>({ type: 'batting', sortBy: sortColumn, order: sortOrder })
        .then((res) => {
          setBattingData(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [statType, sortColumn, sortOrder]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder(column === 'era' || column === 'whip' ? 'asc' : 'desc');
    }
  };

  // Export current table to CSV
  const handleExportCSV = () => {
    const isPitching = statType === 'pitching';
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (isPitching) {
      headers = ['Jugador', 'Equipo', 'Pos', 'JG', 'JP', 'JS', 'PCL', 'INN', 'H', 'CL', 'BB', 'K', 'WHIP'];
      rows = pitchingData.map((p) => [
        p.playerName,
        p.teamShort,
        p.position,
        p.wins ?? p.w ?? 0,
        p.losses ?? p.l ?? 0,
        p.saves ?? p.sv ?? 0,
        p.era.toFixed(2),
        p.ip,
        p.h,
        p.er,
        p.bb,
        p.so,
        p.whip.toFixed(2),
      ]);
    } else {
      headers = ['Jugador', 'Equipo', 'Pos', 'JJ', 'VB', 'C', 'H', '2B', '3B', 'HR', 'CI', 'BB', 'K', 'BR', 'AVG', 'OBP', 'SLG', 'OPS', 'WAR'];
      rows = battingData.map((b) => [
        b.playerName,
        b.teamShort,
        b.position,
        b.games,
        b.ab,
        b.r,
        b.h,
        b.doubles,
        b.triples,
        b.hr,
        b.rbi,
        b.bb,
        b.so,
        b.sb,
        b.avg.toFixed(3),
        b.obp.toFixed(3),
        b.slg.toFixed(3),
        b.ops.toFixed(3),
        b.war ?? 0,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `baseball-hub-${statType}-stats.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered lists
  const filteredBatting = battingData.filter((b) => {
    const matchesSearch = b.playerName.toLowerCase().includes(searchQuery.toLowerCase()) || b.teamShort.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPos = positionFilter === 'ALL' || b.position === positionFilter;
    return matchesSearch && matchesPos;
  });

  const filteredPitching = pitchingData.filter((p) => {
    const matchesSearch = p.playerName.toLowerCase().includes(searchQuery.toLowerCase()) || p.teamShort.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Líderes y Estadísticas Completas
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tablas estadísticas detalladas, métricas tradicionales y sabermetría avanzada con ordenación dinámica.
          </p>
        </div>

        {/* Actions: View Mode Switcher and Export CSV */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setViewMode('both')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'both'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mostrar gráficos y tabla"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ambos</span>
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'charts'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mostrar solo gráficos Recharts"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gráficos</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-slate-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mostrar solo tabla numérica"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabla</span>
            </button>
          </div>

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Type Tabs, Search, Position filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Stat category selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => {
              setStatType('batting');
              setSortColumn('avg');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statType === 'batting'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Bateo Estándar
          </button>
          <button
            onClick={() => {
              setStatType('pitching');
              setSortColumn('era');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statType === 'pitching'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Pitcheo
          </button>
          <button
            onClick={() => {
              setStatType('advanced');
              setSortColumn('war');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statType === 'advanced'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Sabermetría (Avanzadas)
          </button>
        </div>

        {/* Search & Position Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar jugador..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-slate-200"
            />
          </div>

          {statType !== 'pitching' && (
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 rounded-xl border border-slate-800 cursor-pointer focus:outline-none"
            >
              <option value="ALL">Todas las pos.</option>
              <option value="C">Receptores (C)</option>
              <option value="1B">Primera Base (1B)</option>
              <option value="2B">Segunda Base (2B)</option>
              <option value="3B">Tercera Base (3B)</option>
              <option value="SS">Campocorto (SS)</option>
              <option value="OF">Jardineros (OF)</option>
              <option value="BD">Bateador Desig. (BD)</option>
            </select>
          )}
        </div>
      </div>

      {/* Visual Analytics with Recharts (Bar and Line Charts) */}
      {viewMode !== 'table' && (
        <section className="space-y-3">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCardSkeleton />
              <ChartCardSkeleton />
            </div>
          ) : (
            <PlayerPerformanceCharts
              statType={statType}
              battingData={battingData}
              pitchingData={pitchingData}
              onSelectPlayer={navigateToPlayer}
            />
          )}
        </section>
      )}

      {/* Main Table */}
      {viewMode !== 'charts' && (
        <>
          {loading ? (
            <StatisticsTableSkeleton rows={10} statType={statType} />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                {statType === 'pitching' ? (
                  /* TABLA DE PITCHEO */
                  <table className="w-full text-xs font-mono text-left">
                    <thead>
                  <tr className="text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase font-sans text-[11px]">
                    <th className="py-3 px-3">Jugador</th>
                    <th className="py-3 px-2 text-center">Eq</th>
                    <th className="py-3 px-2 text-center">Pos</th>
                    {[
                      { key: 'wins', label: 'JG' },
                      { key: 'losses', label: 'JP' },
                      { key: 'saves', label: 'JS' },
                      { key: 'era', label: 'PCL' },
                      { key: 'ip', label: 'INN' },
                      { key: 'h', label: 'H' },
                      { key: 'er', label: 'CL' },
                      { key: 'bb', label: 'BB' },
                      { key: 'so', label: 'K' },
                      { key: 'whip', label: 'WHIP' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`py-3 px-2.5 text-right cursor-pointer select-none hover:text-white transition-colors ${
                          sortColumn === col.key ? 'text-sky-400 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>{col.label}</span>
                          {sortColumn === col.key && (
                            <span className="text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPitching.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigateToPlayer(p.playerId)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-200 hover:text-sky-400 transition-colors">
                        {p.playerName}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-400">{p.teamShort}</td>
                      <td className="py-2.5 px-2 text-center text-slate-500">{p.position}</td>
                      <td className="py-2.5 px-2.5 text-right text-emerald-400 font-bold">{p.wins ?? p.w ?? 0}</td>
                      <td className="py-2.5 px-2.5 text-right text-slate-400">{p.losses ?? p.l ?? 0}</td>
                      <td className="py-2.5 px-2.5 text-right text-purple-400 font-bold">{p.saves ?? p.sv ?? 0}</td>
                      <td className="py-2.5 px-2.5 text-right font-black text-sky-400">{p.era.toFixed(2)}</td>
                      <td className="py-2.5 px-2.5 text-right text-slate-300">{p.ip}</td>
                      <td className="py-2.5 px-2.5 text-right text-slate-400">{p.h}</td>
                      <td className="py-2.5 px-2.5 text-right text-slate-400">{p.er}</td>
                      <td className="py-2.5 px-2.5 text-right text-slate-400">{p.bb}</td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-white">{p.so}</td>
                      <td className="py-2.5 px-2.5 text-right text-slate-300">{p.whip.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* TABLA DE BATEO O SABERMETRÍA */
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase font-sans text-[11px]">
                    <th className="py-3 px-3">Jugador</th>
                    <th className="py-3 px-2 text-center">Eq</th>
                    <th className="py-3 px-2 text-center">Pos</th>
                    {(statType === 'advanced'
                      ? [
                          { key: 'pa', label: 'AP' },
                          { key: 'avg', label: 'AVG' },
                          { key: 'obp', label: 'OBP' },
                          { key: 'slg', label: 'SLG' },
                          { key: 'ops', label: 'OPS' },
                          { key: 'war', label: 'WAR' },
                        ]
                      : [
                          { key: 'games', label: 'JJ' },
                          { key: 'ab', label: 'VB' },
                          { key: 'r', label: 'C' },
                          { key: 'h', label: 'H' },
                          { key: 'doubles', label: '2B' },
                          { key: 'triples', label: '3B' },
                          { key: 'hr', label: 'HR' },
                          { key: 'rbi', label: 'CI' },
                          { key: 'bb', label: 'BB' },
                          { key: 'so', label: 'K' },
                          { key: 'sb', label: 'BR' },
                          { key: 'avg', label: 'AVG' },
                          { key: 'obp', label: 'OBP' },
                          { key: 'slg', label: 'SLG' },
                          { key: 'ops', label: 'OPS' },
                        ]
                    ).map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`py-3 px-2.5 text-right cursor-pointer select-none hover:text-white transition-colors ${
                          sortColumn === col.key ? 'text-emerald-400 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>{col.label}</span>
                          {sortColumn === col.key && (
                            <span className="text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBatting.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => navigateToPlayer(b.playerId)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-200 hover:text-emerald-400 transition-colors">
                        {b.playerName}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-400">{b.teamShort}</td>
                      <td className="py-2.5 px-2 text-center text-slate-500">{b.position}</td>

                      {statType === 'advanced' ? (
                        <>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.pa}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-300">{b.avg.toFixed(3)}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-300">{b.obp.toFixed(3)}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-300">{b.slg.toFixed(3)}</td>
                          <td className="py-2.5 px-2.5 text-right font-black text-emerald-400">{b.ops.toFixed(3)}</td>
                          <td className="py-2.5 px-2.5 text-right font-black text-amber-400">{b.war}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.games}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.ab}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-300">{b.r}</td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-white">{b.h}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.doubles}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.triples}</td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-amber-400">{b.hr}</td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-emerald-400">{b.rbi}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.bb}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.so}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-400">{b.sb}</td>
                          <td className="py-2.5 px-2.5 text-right font-black text-emerald-400">{b.avg.toFixed(3)}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-300">{b.obp.toFixed(3)}</td>
                          <td className="py-2.5 px-2.5 text-right text-slate-300">{b.slg.toFixed(3)}</td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-slate-100">{b.ops.toFixed(3)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
};
