import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ArrowLeftRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Search,
  Sparkles,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { Player, BattingStats, PitchingStats } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { resolvePlayerPhoto, handlePlayerImgError } from '../utils/playerPhoto.ts';

interface PlayerComparisonViewProps {
  allPlayers: Player[];
  initialPlayerAId?: string | null;
  initialPlayerBId?: string | null;
  onClose?: () => void;
  onSelectPlayerDetail?: (playerId: string) => void;
}

interface LoadedPlayerData {
  player: Player;
  batting?: BattingStats;
  pitching?: PitchingStats;
}

interface BarChartItem {
  stat: string;
  [key: string]: string | number | boolean | undefined;
}

interface RadarChartItem {
  subject: string;
  [key: string]: string | number;
}

export const PlayerComparisonView: React.FC<PlayerComparisonViewProps> = ({
  allPlayers,
  initialPlayerAId,
  initialPlayerBId,
  onClose,
}) => {
  const { theme, navigateToPlayer } = useApp();

  // Selected Player IDs
  const [playerAId, setPlayerAId] = useState<string>(
    initialPlayerAId || allPlayers[0]?.id || ''
  );
  const [playerBId, setPlayerBId] = useState<string>(
    initialPlayerBId || (allPlayers[1]?.id !== initialPlayerAId ? allPlayers[1]?.id : allPlayers[2]?.id) || ''
  );

  // Loaded full data
  const [dataA, setDataA] = useState<LoadedPlayerData | null>(null);
  const [dataB, setDataB] = useState<LoadedPlayerData | null>(null);

  // Search filter inside selector
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [isDropdownAOpen, setIsDropdownAOpen] = useState(false);
  const [isDropdownBOpen, setIsDropdownBOpen] = useState(false);

  // Chart configuration
  const [chartType, setChartType] = useState<'bar' | 'radar'>('bar');
  const [metricGroup, setMetricGroup] = useState<'production' | 'slash' | 'discipline'>('production');

  // Load Player A details
  useEffect(() => {
    if (!playerAId) return;
    ApiClient.getPlayerDetail(playerAId)
      .then((res) => {
        setDataA(res);
      })
      .catch((err) => {
        console.error('Error cargando jugador A:', err);
      });
  }, [playerAId]);

  // Load Player B details
  useEffect(() => {
    if (!playerBId) return;
    ApiClient.getPlayerDetail(playerBId)
      .then((res) => {
        setDataB(res);
      })
      .catch((err) => {
        console.error('Error cargando jugador B:', err);
      });
  }, [playerBId]);

  // Quick swap
  const handleSwap = () => {
    const tempId = playerAId;
    setPlayerAId(playerBId);
    setPlayerBId(tempId);
  };

  // Quick Presets
  const presets = [
    {
      label: 'Arruebarrena vs Calderón',
      idA: allPlayers.find((p) => p.slug === 'erisbel-arruebarrena' || p.lastName === 'Arruebarrena')?.id || allPlayers[0]?.id,
      idB: allPlayers.find((p) => p.slug === 'alberto-calderon' || p.lastName === 'Calderón')?.id || allPlayers[1]?.id,
    },
    {
      label: 'Yera vs Álvarez',
      idA: allPlayers.find((p) => p.slug === 'yoenni-yera' || p.lastName === 'Yera')?.id,
      idB: allPlayers.find((p) => p.slug === 'frank-alvarez' || p.lastName === 'Álvarez')?.id,
    },
    {
      label: 'Santoya vs Drake',
      idA: allPlayers.find((p) => p.slug === 'yasiel-santoya' || p.lastName === 'Santoya')?.id,
      idB: allPlayers.find((p) => p.slug === 'yadir-drake' || p.lastName === 'Drake')?.id,
    },
  ].filter((p) => p.idA && p.idB);

  // Filtered player lists for search dropdowns
  const filteredPlayersA = useMemo(() => {
    const q = searchA.toLowerCase();
    return allPlayers.filter(
      (p) =>
        p.id !== playerBId &&
        (p.fullName.toLowerCase().includes(q) ||
          p.teamShort.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q))
    );
  }, [allPlayers, searchA, playerBId]);

  const filteredPlayersB = useMemo(() => {
    const q = searchB.toLowerCase();
    return allPlayers.filter(
      (p) =>
        p.id !== playerAId &&
        (p.fullName.toLowerCase().includes(q) ||
          p.teamShort.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q))
    );
  }, [allPlayers, searchB, playerAId]);

  // Color constants
  const colorA = '#10b981'; // Emerald
  const colorB = '#f59e0b'; // Amber
  const gridColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';
  const axisColor = theme === 'dark' ? '#64748b' : '#94a3b8';

  const isBothPitchers = Boolean(
    dataA?.pitching && dataB?.pitching && !dataA.batting && !dataB.batting
  );

  const nameKeyA = dataA
    ? dataA.player.fullName.split(' ')[0] + ' ' + (dataA.player.fullName.split(' ')[1]?.[0] || '') + '.'
    : 'Jugador 1';
  const nameKeyB = dataB
    ? dataB.player.fullName.split(' ')[0] + ' ' + (dataB.player.fullName.split(' ')[1]?.[0] || '') + '.'
    : 'Jugador 2';

  // Prepare Bar Chart Data
  const barChartData: BarChartItem[] = useMemo(() => {
    if (!dataA || !dataB) return [];

    // If comparing pitchers
    if (dataA.pitching && dataB.pitching) {
      const pA = dataA.pitching;
      const pB = dataB.pitching;

      if (metricGroup === 'production') {
        return [
          { stat: 'Ponches (SO)', [nameKeyA]: pA.so, [nameKeyB]: pB.so },
          { stat: 'Entradas (IP)', [nameKeyA]: Math.round(pA.ip), [nameKeyB]: Math.round(pB.ip) },
          { stat: 'Victorias (W)', [nameKeyA]: pA.w, [nameKeyB]: pB.w },
          { stat: 'Hits Permitidos', [nameKeyA]: pA.h, [nameKeyB]: pB.h },
        ];
      }
      return [
        { stat: 'PCL / ERA (x10)', [nameKeyA]: Math.round(pA.era * 10), [nameKeyB]: Math.round(pB.era * 10) },
        { stat: 'WHIP (x10)', [nameKeyA]: Math.round(pA.whip * 10), [nameKeyB]: Math.round(pB.whip * 10) },
        { stat: 'K/9 (Ponches/9)', [nameKeyA]: Math.round((pA.k9 || 0) * 10), [nameKeyB]: Math.round((pB.k9 || 0) * 10) },
        { stat: 'WAR (x10)', [nameKeyA]: Math.round((pA.war || 0) * 10), [nameKeyB]: Math.round((pB.war || 0) * 10) },
      ];
    }

    // Default Batters comparison
    const bA = dataA.batting || ({} as any);
    const bB = dataB.batting || ({} as any);

    if (metricGroup === 'production') {
      return [
        { stat: 'Imparables (H)', [nameKeyA]: bA.h || 0, [nameKeyB]: bB.h || 0 },
        { stat: 'Carreras Impulsadas (CI)', [nameKeyA]: bA.rbi || 0, [nameKeyB]: bB.rbi || 0 },
        { stat: 'Cuadrangulares (HR)', [nameKeyA]: bA.hr || 0, [nameKeyB]: bB.hr || 0 },
        { stat: 'Carreras Anotadas (C)', [nameKeyA]: bA.r || 0, [nameKeyB]: bB.r || 0 },
        { stat: 'Dobletes (2B)', [nameKeyA]: bA.doubles || 0, [nameKeyB]: bB.doubles || 0 },
      ];
    }

    if (metricGroup === 'slash') {
      return [
        { stat: 'AVG (x1000)', [nameKeyA]: Math.round((bA.avg || 0) * 1000), [nameKeyB]: Math.round((bB.avg || 0) * 1000) },
        { stat: 'OBP (x1000)', [nameKeyA]: Math.round((bA.obp || 0) * 1000), [nameKeyB]: Math.round((bB.obp || 0) * 1000) },
        { stat: 'SLG (x1000)', [nameKeyA]: Math.round((bA.slg || 0) * 1000), [nameKeyB]: Math.round((bB.slg || 0) * 1000) },
        { stat: 'OPS (x1000)', [nameKeyA]: Math.round((bA.ops || 0) * 1000), [nameKeyB]: Math.round((bB.ops || 0) * 1000) },
        { stat: 'WAR (x10)', [nameKeyA]: Math.round((bA.war || 0) * 10), [nameKeyB]: Math.round((bB.war || 0) * 10) },
      ];
    }

    // Discipline
    return [
      { stat: 'Boletos (BB)', [nameKeyA]: bA.bb || 0, [nameKeyB]: bB.bb || 0 },
      { stat: 'Ponches (SO)', [nameKeyA]: bA.so || 0, [nameKeyB]: bB.so || 0 },
      { stat: 'Bases Robadas (BR)', [nameKeyA]: bA.sb || 0, [nameKeyB]: bB.sb || 0 },
      { stat: 'Turnos al Bate (VB)', [nameKeyA]: bA.ab || 0, [nameKeyB]: bB.ab || 0 },
    ];
  }, [dataA, dataB, metricGroup, nameKeyA, nameKeyB]);

  // Prepare Radar Chart Data (0 - 100 normalized score)
  const radarChartData: RadarChartItem[] = useMemo(() => {
    if (!dataA || !dataB) return [];

    const shortNameA = dataA.player.fullName.split(' ')[0];
    const shortNameB = dataB.player.fullName.split(' ')[0];

    if (dataA.pitching && dataB.pitching) {
      const pA = dataA.pitching;
      const pB = dataB.pitching;

      const normERA = (era: number) => Math.max(10, Math.min(100, Math.round(100 - era * 16)));
      const normWHIP = (whip: number) => Math.max(10, Math.min(100, Math.round(100 - (whip - 0.8) * 60)));
      const normK9 = (k9: number) => Math.max(10, Math.min(100, Math.round(k9 * 9)));
      const normIP = (ip: number) => Math.max(10, Math.min(100, Math.round(ip * 3.2)));
      const normWAR = (war: number) => Math.max(10, Math.min(100, Math.round(war * 40)));

      return [
        { subject: 'Efectividad (ERA)', [shortNameA]: normERA(pA.era), [shortNameB]: normERA(pB.era) },
        { subject: 'Control (WHIP)', [shortNameA]: normWHIP(pA.whip), [shortNameB]: normWHIP(pB.whip) },
        { subject: 'Ponches (K/9)', [shortNameA]: normK9(pA.k9 || 8), [shortNameB]: normK9(pB.k9 || 8) },
        { subject: 'Resistencia (IP)', [shortNameA]: normIP(pA.ip), [shortNameB]: normIP(pB.ip) },
        { subject: 'Impacto (WAR)', [shortNameA]: normWAR(pA.war || 1), [shortNameB]: normWAR(pB.war || 1) },
      ];
    }

    // Batters Radar
    const bA = dataA.batting || ({} as any);
    const bB = dataB.batting || ({} as any);

    const normAVG = (avg: number) => Math.max(10, Math.min(100, Math.round(avg * 250)));
    const normOBP = (obp: number) => Math.max(10, Math.min(100, Math.round(obp * 220)));
    const normSLG = (slg: number) => Math.max(10, Math.min(100, Math.round(slg * 160)));
    const normPower = (hr: number) => Math.max(10, Math.min(100, Math.round(hr * 12)));
    const normProd = (rbi: number) => Math.max(10, Math.min(100, Math.round(rbi * 5)));
    const normWAR = (war: number) => Math.max(10, Math.min(100, Math.round(war * 40)));

    return [
      { subject: 'Contacto (AVG)', [shortNameA]: normAVG(bA.avg || 0.28), [shortNameB]: normAVG(bB.avg || 0.28) },
      { subject: 'Poder (SLG)', [shortNameA]: normSLG(bA.slg || 0.45), [shortNameB]: normSLG(bB.slg || 0.45) },
      { subject: 'Disciplina (OBP)', [shortNameA]: normOBP(bA.obp || 0.35), [shortNameB]: normOBP(bB.obp || 0.35) },
      { subject: 'Impulso (CI)', [shortNameA]: normProd(bA.rbi || 10), [shortNameB]: normProd(bB.rbi || 10) },
      { subject: 'Jonrones (HR)', [shortNameA]: normPower(bA.hr || 3), [shortNameB]: normPower(bB.hr || 3) },
      { subject: 'Valor Integral (WAR)', [shortNameA]: normWAR(bA.war || 1), [shortNameB]: normWAR(bB.war || 1) },
    ];
  }, [dataA, dataB]);

  // Calculate score advantage
  const comparisonResults = useMemo(() => {
    if (!dataA || !dataB) return { winsA: 0, winsB: 0, ties: 0 };
    let winsA = 0;
    let winsB = 0;
    let ties = 0;

    if (dataA.pitching && dataB.pitching) {
      const pA = dataA.pitching;
      const pB = dataB.pitching;
      const checks = [
        { a: pA.era, b: pB.era, lower: true },
        { a: pA.whip, b: pB.whip, lower: true },
        { a: pA.so, b: pB.so, lower: false },
        { a: pA.w, b: pB.w, lower: false },
        { a: pA.k9 || 0, b: pB.k9 || 0, lower: false },
        { a: pA.war || 0, b: pB.war || 0, lower: false },
      ];
      checks.forEach(({ a, b, lower }) => {
        if (a === b) ties++;
        else if (lower ? a < b : a > b) winsA++;
        else winsB++;
      });
    } else {
      const bA = dataA.batting || ({} as any);
      const bB = dataB.batting || ({} as any);
      const checks = [
        { a: bA.avg || 0, b: bB.avg || 0, lower: false },
        { a: bA.obp || 0, b: bB.obp || 0, lower: false },
        { a: bA.slg || 0, b: bB.slg || 0, lower: false },
        { a: bA.ops || 0, b: bB.ops || 0, lower: false },
        { a: bA.hr || 0, b: bB.hr || 0, lower: false },
        { a: bA.rbi || 0, b: bB.rbi || 0, lower: false },
        { a: bA.h || 0, b: bB.h || 0, lower: false },
        { a: bA.war || 0, b: bB.war || 0, lower: false },
      ];
      checks.forEach(({ a, b, lower }) => {
        if (a === b) ties++;
        else if (lower ? a < b : a > b) winsA++;
        else winsB++;
      });
    }

    return { winsA, winsB, ties };
  }, [dataA, dataB]);

  const shortNameA = dataA?.player.fullName.split(' ')[0] || 'Jugador 1';
  const shortNameB = dataB?.player.fullName.split(' ')[0] || 'Jugador 2';

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-4 sm:p-7 space-y-6 text-slate-100 relative">
      {/* Top Header with Close Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Swords className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                Comparador Cara a Cara de Jugadores
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Compara métricas biométricas, estadísticas y visualiza el rendimiento simultáneo en gráficos interactivos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Cerrar comparador"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* QUICK PRESETS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-semibold shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Duelos Sugeridos:
        </span>
        {presets.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (preset.idA && preset.idB) {
                setPlayerAId(preset.idA);
                setPlayerBId(preset.idB);
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 hover:border-emerald-500/50 border border-slate-700 text-slate-300 hover:text-white transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span className="font-bold">{preset.label}</span>
          </button>
        ))}
      </div>

      {/* PLAYER SELECTOR SLOTS */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* SLOT A: Player A */}
        <div className="relative p-4 rounded-2xl bg-slate-950/70 border-2 border-emerald-500/60 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Jugador 1
            </span>
            {dataA && (
              <span className="text-[11px] font-mono font-bold text-slate-400">
                #{dataA.player.jerseyNumber} • {dataA.player.position}
              </span>
            )}
          </div>

          {/* Select Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setIsDropdownAOpen(!isDropdownAOpen);
                setIsDropdownBOpen(false);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-400 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {dataA?.player ? (
                  <>
                    <img
                      src={resolvePlayerPhoto(dataA.player)}
                      alt={dataA.player.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-emerald-500/50 shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => handlePlayerImgError(e, dataA.player)}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {dataA.player.fullName}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {dataA.player.teamName} ({dataA.player.teamShort})
                      </p>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Seleccionar Jugador 1...</span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownAOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2.5 max-h-64 overflow-y-auto space-y-1.5">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchA}
                    onChange={(e) => setSearchA(e.target.value)}
                    placeholder="Filtrar por nombre o equipo..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 text-xs rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
                {filteredPlayersA.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setPlayerAId(p.id);
                      setIsDropdownAOpen(false);
                      setSearchA('');
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs hover:bg-slate-800 transition-colors cursor-pointer ${
                      p.id === playerAId ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-200'
                    }`}
                  >
                    <img
                      src={resolvePlayerPhoto(p)}
                      alt={p.fullName}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => handlePlayerImgError(e, p)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.fullName}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.position} • {p.teamShort}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div className="flex justify-center -my-2 md:my-0">
          <button
            onClick={handleSwap}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 border border-slate-700 flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
            title="Intercambiar posiciones de los jugadores"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        {/* SLOT B: Player B */}
        <div className="relative p-4 rounded-2xl bg-slate-950/70 border-2 border-amber-500/60 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Jugador 2
            </span>
            {dataB && (
              <span className="text-[11px] font-mono font-bold text-slate-400">
                #{dataB.player.jerseyNumber} • {dataB.player.position}
              </span>
            )}
          </div>

          {/* Select Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setIsDropdownBOpen(!isDropdownBOpen);
                setIsDropdownAOpen(false);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {dataB?.player ? (
                  <>
                    <img
                      src={resolvePlayerPhoto(dataB.player)}
                      alt={dataB.player.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-amber-500/50 shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => handlePlayerImgError(e, dataB.player)}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {dataB.player.fullName}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {dataB.player.teamName} ({dataB.player.teamShort})
                      </p>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Seleccionar Jugador 2...</span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownBOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2.5 max-h-64 overflow-y-auto space-y-1.5">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchB}
                    onChange={(e) => setSearchB(e.target.value)}
                    placeholder="Filtrar por nombre o equipo..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 text-xs rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500 text-white"
                  />
                </div>
                {filteredPlayersB.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setPlayerBId(p.id);
                      setIsDropdownBOpen(false);
                      setSearchB('');
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs hover:bg-slate-800 transition-colors cursor-pointer ${
                      p.id === playerBId ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-200'
                    }`}
                  >
                    <img
                      src={resolvePlayerPhoto(p)}
                      alt={p.fullName}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => handlePlayerImgError(e, p)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.fullName}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.position} • {p.teamShort}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HEAD-TO-HEAD BIOMETRIC BANNER & SCOREBOARD */}
      {dataA && dataB && (
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Player A Mini Card */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <img
                src={resolvePlayerPhoto(dataA.player)}
                alt={dataA.player.fullName}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-md shrink-0 cursor-pointer"
                onClick={() => navigateToPlayer(dataA.player.id)}
                referrerPolicy="no-referrer"
                onError={(e) => handlePlayerImgError(e, dataA.player)}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3
                    onClick={() => navigateToPlayer(dataA.player.id)}
                    className="font-bold text-base text-white hover:text-emerald-400 cursor-pointer truncate"
                  >
                    {dataA.player.fullName}
                  </h3>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    #{dataA.player.jerseyNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {dataA.player.position} • {dataA.player.teamName}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {dataA.player.age} años • {dataA.player.height} • {dataA.player.weight} • {dataA.player.bats}/{dataA.player.throws}
                </p>
              </div>
            </div>

            {/* Matchup Meter */}
            <div className="flex flex-col items-center justify-center text-center px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 min-w-[200px]">
              <div className="flex items-center gap-3 text-lg font-black font-mono">
                <span className="text-emerald-400">{comparisonResults.winsA}</span>
                <span className="text-slate-600 text-xs font-sans font-bold">VENTAJAS</span>
                <span className="text-amber-400">{comparisonResults.winsB}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {comparisonResults.winsA > comparisonResults.winsB
                  ? `${dataA.player.fullName.split(' ')[0]} lidera la comparación`
                  : comparisonResults.winsB > comparisonResults.winsA
                  ? `${dataB.player.fullName.split(' ')[0]} lidera la comparación`
                  : 'Comparativa empatada'}
              </p>
              {/* Ratio Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      (comparisonResults.winsA /
                        Math.max(1, comparisonResults.winsA + comparisonResults.winsB)) *
                      100
                    }%`,
                  }}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      (comparisonResults.winsB /
                        Math.max(1, comparisonResults.winsA + comparisonResults.winsB)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Player B Mini Card */}
            <div className="flex items-center justify-end gap-3 w-full sm:w-auto text-right sm:text-right">
              <div className="min-w-0">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-mono text-xs font-bold text-amber-400">
                    #{dataB.player.jerseyNumber}
                  </span>
                  <h3
                    onClick={() => navigateToPlayer(dataB.player.id)}
                    className="font-bold text-base text-white hover:text-amber-400 cursor-pointer truncate"
                  >
                    {dataB.player.fullName}
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  {dataB.player.position} • {dataB.player.teamName}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {dataB.player.age} años • {dataB.player.height} • {dataB.player.weight} • {dataB.player.bats}/{dataB.player.throws}
                </p>
              </div>
              <img
                src={resolvePlayerPhoto(dataB.player)}
                alt={dataB.player.fullName}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500 shadow-md shrink-0 cursor-pointer"
                onClick={() => navigateToPlayer(dataB.player.id)}
                referrerPolicy="no-referrer"
                onError={(e) => handlePlayerImgError(e, dataB.player)}
              />
            </div>
          </div>
        </div>
      )}

      {/* COMPARATIVE VISUAL CHARTS */}
      <div className="space-y-4">
        {/* Chart Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              Tipo de Gráfico:
            </span>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Barras Comparativas
              </button>
              <button
                onClick={() => setChartType('radar')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'radar'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Radar Multidimensional
              </button>
            </div>
          </div>

          {/* Metric Subcategory for Bar Chart */}
          {chartType === 'bar' && !isBothPitchers && (
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto overflow-x-auto max-w-full">
              {[
                { id: 'production', label: 'Poder & Ofensiva' },
                { id: 'slash', label: 'Sabermetría (AVG/OPS)' },
                { id: 'discipline', label: 'Disciplina (BB/SO)' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetricGroup(m.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    metricGroup === m.id
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart Canvas */}
        <div className="h-80 sm:h-96 w-full p-4 rounded-2xl bg-slate-950 border border-slate-800/80 relative">
          {chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
                margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="stat"
                  stroke={axisColor}
                  fontSize={12}
                  tickLine={false}
                  interval={0}
                />
                <YAxis stroke={axisColor} fontSize={12} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-xs space-y-2">
                        <p className="font-bold text-white border-b border-slate-800 pb-1">{label}</p>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                              {entry.name}:
                            </span>
                            <span className="font-mono font-bold text-white">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px' }}
                />
                <Bar
                  dataKey={nameKeyA}
                  fill={colorA}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
                <Bar
                  dataKey={nameKeyB}
                  fill={colorB}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarChartData} outerRadius="75%">
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis dataKey="subject" stroke={axisColor} fontSize={11} />
                <PolarRadiusAxis stroke={axisColor} domain={[0, 100]} />
                <Radar
                  name={shortNameA}
                  dataKey={shortNameA}
                  stroke={colorA}
                  fill={colorA}
                  fillOpacity={0.4}
                />
                <Radar
                  name={shortNameB}
                  dataKey={shortNameB}
                  stroke={colorB}
                  fill={colorB}
                  fillOpacity={0.4}
                />
                <Legend verticalAlign="top" align="right" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-xs space-y-1.5">
                        <p className="font-bold text-white">{payload[0]?.payload?.subject}</p>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-4">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="font-mono font-bold text-white">
                              {entry.value} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* SIDE-BY-SIDE STATS TABLE */}
      {dataA && dataB && (
        <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-emerald-400" />
              Tabla Comparativa Detallada de Estadísticas
            </span>
            <span className="text-[11px] text-slate-400">Temporada 2026</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/40">
                  <th className="py-2.5 px-4 text-emerald-400 font-bold">
                    {dataA.player.fullName}
                  </th>
                  <th className="py-2.5 px-4 text-center text-slate-300">Métrica</th>
                  <th className="py-2.5 px-4 text-right text-amber-400 font-bold">
                    {dataB.player.fullName}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {/* Check if pitchers */}
                {dataA.pitching && dataB.pitching ? (
                  <>
                    <StatRow label="PCL / Efectividad (ERA)" valA={dataA.pitching.era} valB={dataB.pitching.era} lowerIsBetter format={(v) => v.toFixed(2)} />
                    <StatRow label="WHIP" valA={dataA.pitching.whip} valB={dataB.pitching.whip} lowerIsBetter format={(v) => v.toFixed(2)} />
                    <StatRow label="Ponches (SO)" valA={dataA.pitching.so} valB={dataB.pitching.so} />
                    <StatRow label="Victorias (W)" valA={dataA.pitching.w} valB={dataB.pitching.w} />
                    <StatRow label="Entradas Lanzadas (IP)" valA={dataA.pitching.ip} valB={dataB.pitching.ip} format={(v) => v.toFixed(1)} />
                    <StatRow label="K/9 (Ponches / 9 Inng)" valA={dataA.pitching.k9 || 0} valB={dataB.pitching.k9 || 0} format={(v) => v.toFixed(2)} />
                    <StatRow label="Boletos Permitidos (BB)" valA={dataA.pitching.bb} valB={dataB.pitching.bb} lowerIsBetter />
                    <StatRow label="FIP" valA={dataA.pitching.fip || 0} valB={dataB.pitching.fip || 0} lowerIsBetter format={(v) => v.toFixed(2)} />
                    <StatRow label="WAR" valA={dataA.pitching.war || 0} valB={dataB.pitching.war || 0} format={(v) => v.toFixed(1)} />
                  </>
                ) : (
                  <>
                    <StatRow label="Promedio de Bateo (AVG)" valA={dataA.batting?.avg || 0} valB={dataB.batting?.avg || 0} format={(v) => v.toFixed(3)} />
                    <StatRow label="Porcentaje Embasado (OBP)" valA={dataA.batting?.obp || 0} valB={dataB.batting?.obp || 0} format={(v) => v.toFixed(3)} />
                    <StatRow label="Slugging (SLG)" valA={dataA.batting?.slg || 0} valB={dataB.batting?.slg || 0} format={(v) => v.toFixed(3)} />
                    <StatRow label="OPS (OBP + SLG)" valA={dataA.batting?.ops || 0} valB={dataB.batting?.ops || 0} format={(v) => v.toFixed(3)} />
                    <StatRow label="Cuadrangulares (HR)" valA={dataA.batting?.hr || 0} valB={dataB.batting?.hr || 0} />
                    <StatRow label="Carreras Impulsadas (CI)" valA={dataA.batting?.rbi || 0} valB={dataB.batting?.rbi || 0} />
                    <StatRow label="Hits Conectados (H)" valA={dataA.batting?.h || 0} valB={dataB.batting?.h || 0} />
                    <StatRow label="Carreras Anotadas (C)" valA={dataA.batting?.r || 0} valB={dataB.batting?.r || 0} />
                    <StatRow label="Dobletes (2B)" valA={dataA.batting?.doubles || 0} valB={dataB.batting?.doubles || 0} />
                    <StatRow label="Boletos Recibidos (BB)" valA={dataA.batting?.bb || 0} valB={dataB.batting?.bb || 0} />
                    <StatRow label="Ponches (SO)" valA={dataA.batting?.so || 0} valB={dataB.batting?.so || 0} lowerIsBetter />
                    <StatRow label="WAR Sabermétrico" valA={dataA.batting?.war || 0} valB={dataB.batting?.war || 0} format={(v) => v.toFixed(1)} />
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Row helper with automatic winner highlighting
interface StatRowProps {
  label: string;
  valA: number;
  valB: number;
  lowerIsBetter?: boolean;
  format?: (val: number) => string;
}

const StatRow: React.FC<StatRowProps> = ({ label, valA, valB, lowerIsBetter = false, format }) => {
  const isWinnerA = lowerIsBetter ? valA < valB : valA > valB;
  const isWinnerB = lowerIsBetter ? valB < valA : valB > valA;

  const displayA = format ? format(valA) : valA;
  const displayB = format ? format(valB) : valB;

  return (
    <tr className="hover:bg-slate-900/50 transition-colors">
      {/* Player A Value */}
      <td className="py-2 px-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold ${
            isWinnerA
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300'
          }`}
        >
          {isWinnerA && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
          <span>{displayA}</span>
        </span>
      </td>

      {/* Metric Label */}
      <td className="py-2 px-4 text-center font-sans font-medium text-slate-400">
        {label}
      </td>

      {/* Player B Value */}
      <td className="py-2 px-4 text-right">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold ${
            isWinnerB
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-300'
          }`}
        >
          <span>{displayB}</span>
          {isWinnerB && <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />}
        </span>
      </td>
    </tr>
  );
};
