import React, { useState } from 'react';
import {
  X,
  Radio,
  Save,
  Play,
  RotateCcw,
  Zap,
  Award,
  CheckCircle2,
  Users,
  Shield,
  Plus,
  Trash2,
} from 'lucide-react';
import { Game, GameStatus, InningScore, PlayEvent } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

interface GameLiveConsoleModalProps {
  game: Game;
  onClose: () => void;
  onGameUpdated: (updatedGame: Game) => void;
}

export const GameLiveConsoleModal: React.FC<GameLiveConsoleModalProps> = ({
  game,
  onClose,
  onGameUpdated,
}) => {
  // Initialize line scores (up to 9 innings or existing length)
  const initialLineScores = (): InningScore[] => {
    if (game.lineScore && game.lineScore.length > 0) {
      return [...game.lineScore];
    }
    const defaultScores: InningScore[] = [];
    for (let i = 1; i <= 9; i++) {
      defaultScores.push({ inning: i, home: 0, away: 0 });
    }
    return defaultScores;
  };

  const [status, setStatus] = useState<GameStatus>(game.status);
  const [currentInning, setCurrentInning] = useState<number>(game.currentInning || 1);
  const [isTopInning, setIsTopInning] = useState<boolean>(
    game.isTopInning !== undefined ? game.isTopInning : true
  );
  const [balls, setBalls] = useState<number>(0);
  const [strikes, setStrikes] = useState<number>(0);
  const [outs, setOuts] = useState<number>(game.outs || 0);

  // Bases occupied toggles
  const [runnerFirst, setRunnerFirst] = useState<boolean>(false);
  const [runnerSecond, setRunnerSecond] = useState<boolean>(false);
  const [runnerThird, setRunnerThird] = useState<boolean>(false);

  // Scores, Hits, Errors
  const [awayScore, setAwayScore] = useState<number>(game.awayScore || 0);
  const [homeScore, setHomeScore] = useState<number>(game.homeScore || 0);
  const [awayHits, setAwayHits] = useState<number>(game.awayHits || 0);
  const [homeHits, setHomeHits] = useState<number>(game.homeHits || 0);
  const [awayErrors, setAwayErrors] = useState<number>(game.awayErrors || 0);
  const [homeErrors, setHomeErrors] = useState<number>(game.homeErrors || 0);

  // Line score per inning
  const [lineScore, setLineScore] = useState<InningScore[]>(initialLineScores());

  // Decision Pitchers (Final games)
  const [winningPitcher, setWinningPitcher] = useState<string>(game.winningPitcher?.name || '');
  const [losingPitcher, setLosingPitcher] = useState<string>(game.losingPitcher?.name || '');
  const [savePitcher, setSavePitcher] = useState<string>(game.savePitcher?.name || '');

  // Play-by-play events
  const [plays, setPlays] = useState<PlayEvent[]>(game.plays || []);
  const [customPlayText, setCustomPlayText] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Update inning score
  const handleInningScoreChange = (index: number, side: 'away' | 'home', val: number) => {
    const safeVal = Math.max(0, isNaN(val) ? 0 : val);
    const updated = [...lineScore];
    updated[index] = {
      ...updated[index],
      [side]: safeVal,
    };
    setLineScore(updated);

    // Recalculate total scores
    const totalAway = updated.reduce((sum, item) => sum + (item.away || 0), 0);
    const totalHome = updated.reduce((sum, item) => sum + (item.home || 0), 0);
    setAwayScore(totalAway);
    setHomeScore(totalHome);
  };

  // Add extra inning column
  const handleAddExtraInning = () => {
    const nextInning = lineScore.length + 1;
    setLineScore([...lineScore, { inning: nextInning, away: 0, home: 0 }]);
    showNotification(`Entrada ${nextInning} añadida a la pizarra.`);
  };

  // Quick Play Actions
  const handleQuickPlay = (playType: string) => {
    const inningStr = `${isTopInning ? '▲ Alta' : '▼ Baja'} de la ${currentInning}ª`;
    const battingTeam = isTopInning ? game.awayTeam : game.homeTeam;
    let desc = '';
    let newOuts = outs;
    let newBalls = balls;
    let newStrikes = strikes;

    switch (playType) {
      case 'hr': {
        desc = `¡JONRÓN! Bateador de ${battingTeam.shortName} conecta cuadrangular solitario.`;
        if (isTopInning) {
          setAwayScore((s) => s + 1);
          setAwayHits((h) => h + 1);
          handleInningScoreChange(currentInning - 1, 'away', (lineScore[currentInning - 1]?.away || 0) + 1);
        } else {
          setHomeScore((s) => s + 1);
          setHomeHits((h) => h + 1);
          handleInningScoreChange(currentInning - 1, 'home', (lineScore[currentInning - 1]?.home || 0) + 1);
        }
        newBalls = 0;
        newStrikes = 0;
        break;
      }
      case 'hit': {
        desc = `Hit sencillo de ${battingTeam.shortName} al jardín central.`;
        if (isTopInning) setAwayHits((h) => h + 1);
        else setHomeHits((h) => h + 1);
        newBalls = 0;
        newStrikes = 0;
        setRunnerFirst(true);
        break;
      }
      case 'double': {
        desc = `Doblete por regla de ${battingTeam.shortName} entre left-center field.`;
        if (isTopInning) setAwayHits((h) => h + 1);
        else setHomeHits((h) => h + 1);
        newBalls = 0;
        newStrikes = 0;
        setRunnerSecond(true);
        break;
      }
      case 'strikeout': {
        desc = `Ponche cantado. El bateador de ${battingTeam.shortName} abanica para el out.`;
        newOuts = Math.min(3, outs + 1);
        newBalls = 0;
        newStrikes = 0;
        break;
      }
      case 'walk': {
        desc = `Base por bolas tras 4 envíos malos de parte del lanzador.`;
        newBalls = 0;
        newStrikes = 0;
        setRunnerFirst(true);
        break;
      }
      case 'error': {
        desc = `Error defensivo en tiro a primera base. Corredor a salvo.`;
        if (isTopInning) setHomeErrors((e) => e + 1);
        else setAwayErrors((e) => e + 1);
        break;
      }
      case 'double_play': {
        desc = `¡Doble Play! Roletazo al cuadro, 6-4-3 para completar la doble matanza.`;
        newOuts = Math.min(3, outs + 2);
        newBalls = 0;
        newStrikes = 0;
        setRunnerFirst(false);
        break;
      }
      case 'run': {
        desc = `Carrera impulsada por ${battingTeam.shortName}. Anotan desde tercera.`;
        if (isTopInning) {
          setAwayScore((s) => s + 1);
          handleInningScoreChange(currentInning - 1, 'away', (lineScore[currentInning - 1]?.away || 0) + 1);
        } else {
          setHomeScore((s) => s + 1);
          handleInningScoreChange(currentInning - 1, 'home', (lineScore[currentInning - 1]?.home || 0) + 1);
        }
        setRunnerThird(false);
        break;
      }
      default:
        desc = `Jugada en el diamante: ${playType}`;
    }

    setOuts(newOuts);
    setBalls(newBalls);
    setStrikes(newStrikes);

    const newPlay: PlayEvent = {
      id: `play_${Date.now()}`,
      inning: currentInning,
      isTop: isTopInning,
      outs: newOuts,
      description: `[${inningStr}] ${desc}`,
      scoreAfter: `${awayScore}-${homeScore}`,
      isScoringPlay: playType === 'hr' || playType === 'run',
    };

    setPlays((prev) => [newPlay, ...prev]);
    showNotification(`Jugada registrada: ${playType.toUpperCase()}`);
  };

  const handleAddCustomPlay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPlayText.trim()) return;

    const inningStr = `${isTopInning ? '▲ Alta' : '▼ Baja'} de la ${currentInning}ª`;
    const newPlay: PlayEvent = {
      id: `play_${Date.now()}`,
      inning: currentInning,
      isTop: isTopInning,
      outs,
      description: `[${inningStr}] ${customPlayText.trim()}`,
      scoreAfter: `${awayScore}-${homeScore}`,
    };

    setPlays((prev) => [newPlay, ...prev]);
    setCustomPlayText('');
    showNotification('Nota o incidencia añadida al relato en vivo.');
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<Game> = {
        status,
        currentInning,
        isTopInning,
        outs,
        awayScore,
        homeScore,
        awayHits,
        homeHits,
        awayErrors,
        homeErrors,
        lineScore,
        winningPitcher: winningPitcher ? { name: winningPitcher, record: '' } : undefined,
        losingPitcher: losingPitcher ? { name: losingPitcher, record: '' } : undefined,
        savePitcher: savePitcher ? { name: savePitcher, saves: 1 } : undefined,
        plays,
      };

      const updated = await ApiClient.updateAdminGame(game.id, updates);
      onGameUpdated(updated);
      showNotification('¡Datos del partido y pizarra guardados exitosamente!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      alert(`Error al guardar consola de juego: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
              <Radio className="w-4 h-4 animate-pulse" />
            </span>
            <div className="flex flex-col">
              <span className="text-white font-black text-sm tracking-wide flex items-center gap-2">
                <span>Consola de Operador en Vivo</span>
                <span className="text-xs font-bold text-slate-400">
                  ({game.awayTeam.shortName} vs {game.homeTeam.shortName})
                </span>
              </span>
              <span className="text-[11px] text-slate-400">
                Pizarra inning-por-inning, conteo de lanzamientos y eventos en tiempo real
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Todo'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{actionFeedback}</span>
            </div>
          </div>
        )}

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Main Status & Inning Header Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Estado del Partido
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GameStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="SCHEDULED">Programado</option>
                <option value="LIVE">🔴 EN VIVO (En Juego)</option>
                <option value="FINAL">Finalizado (Oficial)</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Entrada Actual & Mitad
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTopInning(!isTopInning)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    isTopInning
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}
                >
                  {isTopInning ? '▲ Alta (Batea Visitante)' : '▼ Baja (Batea Local)'}
                </button>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1">
                  <span className="text-xs font-mono font-bold text-white px-2">{currentInning}ª</span>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setCurrentInning((i) => Math.max(1, i + 1))}
                      className="text-[10px] text-slate-300 hover:text-white px-1 leading-none font-bold"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentInning((i) => Math.max(1, i - 1))}
                      className="text-[10px] text-slate-300 hover:text-white px-1 leading-none font-bold"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Marcador Global
              </label>
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-200 text-xs">{game.awayTeam.shortName}</span>
                  <span className="font-mono text-base font-black text-amber-400">{awayScore}</span>
                </div>
                <span className="text-slate-600 font-bold text-xs">-</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-base font-black text-emerald-400">{homeScore}</span>
                  <span className="font-bold text-slate-200 text-xs">{game.homeTeam.shortName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Line Score Table */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>Pizarra Oficial Inning por Inning (Line Score)</span>
              </h4>
              <button
                type="button"
                onClick={handleAddExtraInning}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Entrada Extra</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                    <th className="text-left py-2 px-3">Equipo</th>
                    {lineScore.map((item, idx) => (
                      <th key={idx} className="py-2 px-1 w-10 font-mono">
                        {item.inning}
                      </th>
                    ))}
                    <th className="py-2 px-2 font-mono text-amber-400 bg-slate-900/60 font-bold">C</th>
                    <th className="py-2 px-2 font-mono text-slate-300 bg-slate-900/40">H</th>
                    <th className="py-2 px-2 font-mono text-slate-300 bg-slate-900/40">E</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                  {/* Away Team Row */}
                  <tr>
                    <td className="text-left py-2 px-3 font-sans font-bold text-slate-200 whitespace-nowrap">
                      {game.awayTeam.shortName}
                    </td>
                    {lineScore.map((item, idx) => (
                      <td key={idx} className="py-1 px-1">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={item.away ?? 0}
                          onChange={(e) =>
                            handleInningScoreChange(idx, 'away', parseInt(e.target.value, 10))
                          }
                          className="w-8 py-1 text-center bg-slate-900 border border-slate-700 rounded text-slate-100 font-bold focus:border-amber-400 focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-2 font-black text-amber-400 bg-slate-900/60 text-sm">
                      {awayScore}
                    </td>
                    <td className="py-2 px-2 text-slate-200 bg-slate-900/40">
                      <input
                        type="number"
                        min={0}
                        value={awayHits}
                        onChange={(e) => setAwayHits(parseInt(e.target.value, 10) || 0)}
                        className="w-10 py-0.5 text-center bg-transparent border-b border-slate-700 text-slate-200 font-bold"
                      />
                    </td>
                    <td className="py-2 px-2 text-slate-200 bg-slate-900/40">
                      <input
                        type="number"
                        min={0}
                        value={awayErrors}
                        onChange={(e) => setAwayErrors(parseInt(e.target.value, 10) || 0)}
                        className="w-10 py-0.5 text-center bg-transparent border-b border-slate-700 text-slate-200 font-bold"
                      />
                    </td>
                  </tr>

                  {/* Home Team Row */}
                  <tr>
                    <td className="text-left py-2 px-3 font-sans font-bold text-slate-200 whitespace-nowrap">
                      {game.homeTeam.shortName}
                    </td>
                    {lineScore.map((item, idx) => (
                      <td key={idx} className="py-1 px-1">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={item.home ?? 0}
                          onChange={(e) =>
                            handleInningScoreChange(idx, 'home', parseInt(e.target.value, 10))
                          }
                          className="w-8 py-1 text-center bg-slate-900 border border-slate-700 rounded text-slate-100 font-bold focus:border-emerald-400 focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-2 font-black text-emerald-400 bg-slate-900/60 text-sm">
                      {homeScore}
                    </td>
                    <td className="py-2 px-2 text-slate-200 bg-slate-900/40">
                      <input
                        type="number"
                        min={0}
                        value={homeHits}
                        onChange={(e) => setHomeHits(parseInt(e.target.value, 10) || 0)}
                        className="w-10 py-0.5 text-center bg-transparent border-b border-slate-700 text-slate-200 font-bold"
                      />
                    </td>
                    <td className="py-2 px-2 text-slate-200 bg-slate-900/40">
                      <input
                        type="number"
                        min={0}
                        value={homeErrors}
                        onChange={(e) => setHomeErrors(parseInt(e.target.value, 10) || 0)}
                        className="w-10 py-0.5 text-center bg-transparent border-b border-slate-700 text-slate-200 font-bold"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Diamond & Count Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Baseball Diamond & Runners */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Corredores en Base (Diamante)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRunnerFirst(false);
                    setRunnerSecond(false);
                    setRunnerThird(false);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Limpiar Bases
                </button>
              </div>

              <div className="flex items-center justify-center py-2">
                <div className="relative w-36 h-36 border-2 border-dashed border-slate-800 rotate-45 flex items-center justify-center rounded-lg bg-emerald-950/10">
                  {/* Second Base (Top) */}
                  <button
                    type="button"
                    onClick={() => setRunnerSecond(!runnerSecond)}
                    title="Segunda Base (2B)"
                    className={`absolute -top-3 -left-3 w-8 h-8 rounded -rotate-45 font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center border-2 ${
                      runnerSecond
                        ? 'bg-amber-400 text-black border-white shadow-lg shadow-amber-400/50 scale-110'
                        : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-400'
                    }`}
                  >
                    2B
                  </button>

                  {/* Third Base (Left) */}
                  <button
                    type="button"
                    onClick={() => setRunnerThird(!runnerThird)}
                    title="Tercera Base (3B)"
                    className={`absolute -bottom-3 -left-3 w-8 h-8 rounded -rotate-45 font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center border-2 ${
                      runnerThird
                        ? 'bg-amber-400 text-black border-white shadow-lg shadow-amber-400/50 scale-110'
                        : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-400'
                    }`}
                  >
                    3B
                  </button>

                  {/* First Base (Right) */}
                  <button
                    type="button"
                    onClick={() => setRunnerFirst(!runnerFirst)}
                    title="Primera Base (1B)"
                    className={`absolute -top-3 -right-3 w-8 h-8 rounded -rotate-45 font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center border-2 ${
                      runnerFirst
                        ? 'bg-amber-400 text-black border-white shadow-lg shadow-amber-400/50 scale-110'
                        : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-400'
                    }`}
                  >
                    1B
                  </button>

                  {/* Home Plate (Bottom) */}
                  <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded -rotate-45 bg-slate-900 border-2 border-emerald-500/60 flex items-center justify-center text-[10px] font-bold text-emerald-400 shadow">
                    HP
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4 text-xs font-semibold text-slate-400">
                <span className={runnerFirst ? 'text-amber-400 font-bold' : ''}>1B: {runnerFirst ? 'Ocupada' : 'Libre'}</span>
                <span>•</span>
                <span className={runnerSecond ? 'text-amber-400 font-bold' : ''}>2B: {runnerSecond ? 'Ocupada' : 'Libre'}</span>
                <span>•</span>
                <span className={runnerThird ? 'text-amber-400 font-bold' : ''}>3B: {runnerThird ? 'Ocupada' : 'Libre'}</span>
              </div>
            </div>

            {/* B-S-O Clicker Panel */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Conteo de Lanzamientos (B-S-O)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBalls(0);
                    setStrikes(0);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Reiniciar Conteo (0-0)
                </button>
              </div>

              {/* Balls */}
              <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-xl">
                <span className="text-xs font-bold text-emerald-400">Bolas (B)</span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBalls(balls === b ? b - 1 : b)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                        balls >= b
                          ? 'bg-emerald-400 border-white shadow-md shadow-emerald-400/50'
                          : 'bg-slate-950 border-slate-700'
                      }`}
                    />
                  ))}
                  <span className="font-mono text-sm font-bold text-slate-300 ml-2">{balls}</span>
                </div>
              </div>

              {/* Strikes */}
              <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-xl">
                <span className="text-xs font-bold text-red-400">Strikes (S)</span>
                <div className="flex items-center gap-2">
                  {[1, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStrikes(strikes === s ? s - 1 : s)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                        strikes >= s
                          ? 'bg-red-400 border-white shadow-md shadow-red-400/50'
                          : 'bg-slate-950 border-slate-700'
                      }`}
                    />
                  ))}
                  <span className="font-mono text-sm font-bold text-slate-300 ml-2">{strikes}</span>
                </div>
              </div>

              {/* Outs */}
              <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-xl">
                <span className="text-xs font-bold text-amber-400">Outs (O)</span>
                <div className="flex items-center gap-2">
                  {[1, 2].map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOuts(outs === o ? o - 1 : o)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                        outs >= o
                          ? 'bg-amber-400 border-white shadow-md shadow-amber-400/50'
                          : 'bg-slate-950 border-slate-700'
                      }`}
                    />
                  ))}
                  <span className="font-mono text-sm font-bold text-slate-300 ml-2">{outs}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Play Recording Console */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Botones de Acción Inmediata (Eventos de Jugada)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPlay('hr')}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Jonrón (HR)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPlay('hit')}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Hit Sencillo (1B)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPlay('double')}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Doble (2B)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPlay('run')}
                className="px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Carrera Anotada (+1)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPlay('strikeout')}
                className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Ponche (K)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPlay('walk')}
                className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Base por Bolas (BB)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPlay('error')}
                className="px-3 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Error Defensivo (E)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPlay('double_play')}
                className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Doble Play (DP)</span>
              </button>
            </div>

            {/* Custom Narrative Form */}
            <form onSubmit={handleAddCustomPlay} className="flex gap-2 pt-2">
              <input
                type="text"
                value={customPlayText}
                onChange={(e) => setCustomPlayText(e.target.value)}
                placeholder="Escribir descripción personalizada de la jugada..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Agregar Incidencia
              </button>
            </form>
          </div>

          {/* Decision Pitchers for Final Status */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Decisiones de Pitcheo (Ganador, Perdedor, Salvado)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                  Pitcher Ganador (W)
                </label>
                <input
                  type="text"
                  value={winningPitcher}
                  onChange={(e) => setWinningPitcher(e.target.value)}
                  placeholder="Ej. Armando Dueñas"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-red-400 mb-1">
                  Pitcher Perdedor (L)
                </label>
                <input
                  type="text"
                  value={losingPitcher}
                  onChange={(e) => setLosingPitcher(e.target.value)}
                  placeholder="Ej. Pavel Hernández"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-400 mb-1">
                  Juego Salvado (SV)
                </label>
                <input
                  type="text"
                  value={savePitcher}
                  onChange={(e) => setSavePitcher(e.target.value)}
                  placeholder="Ej. Frank Luis Medina"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none font-semibold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800">
          <span className="text-[11px] text-slate-500 font-mono">
            ID: {game.id} • {game.date} • {game.stadium || 'Estadio Principal'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar Consola
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar y Publicar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
