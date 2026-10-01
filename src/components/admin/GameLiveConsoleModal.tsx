import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  TrendingUp,
  Sparkles,
  Flame,
  ArrowRight,
  ListOrdered,
  Layers,
  Activity,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import {
  Game,
  GameStatus,
  InningScore,
  PlayEvent,
  LineupPlayer,
  TeamLineup,
  Player,
  GameLineups,
} from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { TeamLogo } from '../TeamLogo.tsx';

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
  // Tabs
  const [activeConsoleTab, setActiveConsoleTab] = useState<'narrator' | 'lineups' | 'linescore'>('narrator');

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
  const [balls, setBalls] = useState<number>(game.balls || 0);
  const [strikes, setStrikes] = useState<number>(game.strikes || 0);
  const [outs, setOuts] = useState<number>(game.outs || 0);

  // Bases occupied toggles
  const [runnerFirst, setRunnerFirst] = useState<boolean>(game.bases?.first || false);
  const [runnerSecond, setRunnerSecond] = useState<boolean>(game.bases?.second || false);
  const [runnerThird, setRunnerThird] = useState<boolean>(game.bases?.third || false);

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
  const [customPlayRuns, setCustomPlayRuns] = useState<number>(0);

  // Current Batter and Pitcher
  const [currentBatterIndex, setCurrentBatterIndex] = useState<number>(0); // 0 to 8

  // Team Lineups State
  const defaultLineup = (teamId: string, teamName: string): TeamLineup => ({
    startingPitcher: {
      name: `Lanzador Abridor (${teamName})`,
      jerseyNumber: 33,
      throws: 'R',
      era: '3.20',
      ip: '4.0',
      h: 3,
      r: 1,
      er: 1,
      bb: 1,
      so: 4,
      pitches: 65,
    },
    battingOrder: [
      { order: 1, playerId: `p_${teamId}_1`, name: 'Primer Bate', jerseyNumber: 7, position: 'CF', bats: 'L', ab: 2, r: 1, h: 1, rbi: 0, bb: 1, so: 0, avg: '.312' },
      { order: 2, playerId: `p_${teamId}_2`, name: 'Segundo Bate', jerseyNumber: 12, position: '2B', bats: 'R', ab: 3, r: 0, h: 1, rbi: 0, bb: 0, so: 1, avg: '.285' },
      { order: 3, playerId: `p_${teamId}_3`, name: 'Tercer Bate', jerseyNumber: 24, position: 'LF', bats: 'R', ab: 3, r: 1, h: 2, rbi: 1, bb: 0, so: 0, avg: '.340' },
      { order: 4, playerId: `p_${teamId}_4`, name: 'Cuarto Bate', jerseyNumber: 54, position: '1B', bats: 'R', ab: 2, r: 1, h: 1, rbi: 2, bb: 1, so: 1, avg: '.325' },
      { order: 5, playerId: `p_${teamId}_5`, name: 'Quinto Bate', jerseyNumber: 31, position: 'DH', bats: 'L', ab: 3, r: 0, h: 0, rbi: 0, bb: 0, so: 2, avg: '.270' },
      { order: 6, playerId: `p_${teamId}_6`, name: 'Sexto Bate', jerseyNumber: 16, position: '3B', bats: 'R', ab: 3, r: 0, h: 1, rbi: 0, bb: 0, so: 1, avg: '.265' },
      { order: 7, playerId: `p_${teamId}_7`, name: 'Séptimo Bate', jerseyNumber: 9, position: 'RF', bats: 'L', ab: 2, r: 0, h: 0, rbi: 0, bb: 1, so: 1, avg: '.250' },
      { order: 8, playerId: `p_${teamId}_8`, name: 'Octavo Bate', jerseyNumber: 45, position: 'C', bats: 'R', ab: 3, r: 0, h: 0, rbi: 0, bb: 0, so: 2, avg: '.235' },
      { order: 9, playerId: `p_${teamId}_9`, name: 'Noveno Bate', jerseyNumber: 2, position: 'SS', bats: 'R', ab: 2, r: 0, h: 1, rbi: 0, bb: 0, so: 0, avg: '.260' },
    ],
    bench: [],
  });

  const [lineups, setLineups] = useState<GameLineups>(() => {
    return {
      away: game.lineups?.away || defaultLineup(game.awayTeam.id, game.awayTeam.shortName),
      home: game.lineups?.home || defaultLineup(game.homeTeam.id, game.homeTeam.shortName),
    };
  });

  const [activeLineupTeamSide, setActiveLineupTeamSide] = useState<'away' | 'home'>('away');

  // Rosters from backend for autocomplete
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);

  useEffect(() => {
    ApiClient.getPlayers({ teamId: game.awayTeam.id, limit: 50 })
      .then((res) => setAwayRoster(res.items))
      .catch(() => {});
    ApiClient.getPlayers({ teamId: game.homeTeam.id, limit: 50 })
      .then((res) => setHomeRoster(res.items))
      .catch(() => {});
  }, [game.awayTeam.id, game.homeTeam.id]);

  const [isSaving, setIsSaving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());
  const [isSyncingLive, setIsSyncingLive] = useState(false);

  const showNotification = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Active Batting & Pitching sides
  const battingTeam = isTopInning ? game.awayTeam : game.homeTeam;
  const pitchingTeam = isTopInning ? game.homeTeam : game.awayTeam;
  const currentBattingLineup = isTopInning ? lineups.away : lineups.home;
  const currentPitchingLineup = isTopInning ? lineups.home : lineups.away;
  const currentBatter = currentBattingLineup.battingOrder[currentBatterIndex] || currentBattingLineup.battingOrder[0];
  const currentPitcher = currentPitchingLineup.startingPitcher;

  // Advance batter to next in order 1-9
  const advanceToNextBatter = () => {
    setCurrentBatterIndex((prev) => (prev + 1) % 9);
  };

  // Update inning score
  const handleInningScoreChange = (index: number, side: 'away' | 'home', val: number) => {
    const safeVal = Math.max(0, isNaN(val) ? 0 : val);
    const updated = [...lineScore];
    while (updated.length <= index) {
      updated.push({ inning: updated.length + 1, home: 0, away: 0 });
    }
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

  // Flip half inning (Top <-> Bottom)
  const handleSwitchHalfInning = () => {
    const nextTop = !isTopInning;
    const nextInning = isTopInning ? currentInning : currentInning + 1;
    setIsTopInning(nextTop);
    if (!isTopInning) {
      setCurrentInning((inn) => inn + 1);
    }
    setOuts(0);
    setBalls(0);
    setStrikes(0);
    setRunnerFirst(false);
    setRunnerSecond(false);
    setRunnerThird(false);
    setCurrentBatterIndex(0);

    const label = nextTop ? `▲ Alta de la ${nextInning}ª` : `▼ Baja de la ${nextInning}ª`;
    showNotification(`Cambio de entrada: ${label}`);

    // Persist half-inning flip
    ApiClient.updateAdminGame(game.id, {
      status,
      currentInning: nextInning,
      isTopInning: nextTop,
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: { first: false, second: false, third: false },
      awayScore,
      homeScore,
      awayHits,
      homeHits,
      awayErrors,
      homeErrors,
      lineScore,
      lineups,
      plays,
    })
      .then((updated) => {
        onGameUpdated(updated);
        setLastSyncTime(new Date());
      })
      .catch(() => {});
  };

  // Reset Count (Bolas y Strikes)
  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
  };

  // Clear bases
  const clearBases = () => {
    setRunnerFirst(false);
    setRunnerSecond(false);
    setRunnerThird(false);
  };

  // Record a play and update scoreboard directly + auto-sync to backend
  const recordPlayAndReflectScore = (options: {
    playType: string;
    description: string;
    runsToAdd: number;
    hitsToAdd: number;
    errorsToAdd: number;
    outsChange: number; // 0, +1, +2
    setBases?: { first?: boolean; second?: boolean; third?: boolean };
    isScoringPlay?: boolean;
  }) => {
    const {
      playType,
      description,
      runsToAdd,
      hitsToAdd,
      errorsToAdd,
      outsChange,
      setBases: newBases,
      isScoringPlay,
    } = options;

    const inningIndex = currentInning - 1;
    let newAwayScore = awayScore;
    let newHomeScore = homeScore;
    let newAwayHits = awayHits;
    let newHomeHits = homeHits;
    let newAwayErrors = awayErrors;
    let newHomeErrors = homeErrors;

    const updatedLineScore = [...lineScore];
    while (updatedLineScore.length <= inningIndex) {
      updatedLineScore.push({ inning: updatedLineScore.length + 1, home: 0, away: 0 });
    }

    // 1. Carreras y Pizarra
    if (runsToAdd > 0) {
      if (isTopInning) {
        newAwayScore += runsToAdd;
        updatedLineScore[inningIndex] = {
          ...updatedLineScore[inningIndex],
          away: (updatedLineScore[inningIndex]?.away || 0) + runsToAdd,
        };
      } else {
        newHomeScore += runsToAdd;
        updatedLineScore[inningIndex] = {
          ...updatedLineScore[inningIndex],
          home: (updatedLineScore[inningIndex]?.home || 0) + runsToAdd,
        };
      }
      setLineScore(updatedLineScore);
      setAwayScore(newAwayScore);
      setHomeScore(newHomeScore);
    }

    // Hits
    if (hitsToAdd > 0) {
      if (isTopInning) newAwayHits += hitsToAdd;
      else newHomeHits += hitsToAdd;
      setAwayHits(newAwayHits);
      setHomeHits(newHomeHits);
    }

    // Errores defensivos
    if (errorsToAdd > 0) {
      if (isTopInning) newHomeErrors += errorsToAdd;
      else newAwayErrors += errorsToAdd;
      setAwayErrors(newAwayErrors);
      setHomeErrors(newHomeErrors);
    }

    // 2. Outs
    let updatedOuts = outs;
    if (outsChange > 0) {
      updatedOuts = Math.min(3, outs + outsChange);
      setOuts(updatedOuts);
    }

    // 3. Bases
    let finalRunnerFirst = newBases?.first !== undefined ? newBases.first : runnerFirst;
    let finalRunnerSecond = newBases?.second !== undefined ? newBases.second : runnerSecond;
    let finalRunnerThird = newBases?.third !== undefined ? newBases.third : runnerThird;

    if (newBases) {
      if (newBases.first !== undefined) setRunnerFirst(newBases.first);
      if (newBases.second !== undefined) setRunnerSecond(newBases.second);
      if (newBases.third !== undefined) setRunnerThird(newBases.third);
    }

    // Reset count
    resetCount();

    // 4. Update Lineup Player Stats (Bateador y Lanzador en tiempo real)
    const battingSide = isTopInning ? 'away' : 'home';
    const pitchingSide = isTopInning ? 'home' : 'away';

    const updatedLineups = { ...lineups };
    const battingTeamLineup = { ...updatedLineups[battingSide] };
    const battingOrder = [...battingTeamLineup.battingOrder];
    const batter = { ...(battingOrder[currentBatterIndex] || battingOrder[0]) };

    const isOfficialAtBat = playType !== 'walk' && playType !== 'error' && playType !== 'sacrifice';
    const newAB = (batter.ab || 0) + (isOfficialAtBat ? 1 : 0);
    const newH = (batter.h || 0) + (hitsToAdd > 0 ? 1 : 0);
    const newR = (batter.r || 0) + (playType === 'homerun' ? 1 : 0);
    const newRBI = (batter.rbi || 0) + runsToAdd;
    const newBB = (batter.bb || 0) + (playType === 'walk' ? 1 : 0);
    const newSO = (batter.so || 0) + (playType === 'strikeout' ? 1 : 0);
    const newAvg = newAB > 0 ? `.${Math.round((newH / newAB) * 1000).toString().padStart(3, '0')}` : (batter.avg || '.300');

    batter.ab = newAB;
    batter.h = newH;
    batter.r = newR;
    batter.rbi = newRBI;
    batter.bb = newBB;
    batter.so = newSO;
    batter.avg = newAvg;
    battingOrder[currentBatterIndex] = batter;
    battingTeamLineup.battingOrder = battingOrder;
    updatedLineups[battingSide] = battingTeamLineup;

    // Pitcher line updates
    const pitchingTeamLineup = { ...updatedLineups[pitchingSide] };
    if (pitchingTeamLineup.startingPitcher) {
      const sp = { ...pitchingTeamLineup.startingPitcher };
      sp.h = (sp.h || 0) + (hitsToAdd > 0 ? 1 : 0);
      sp.r = (sp.r || 0) + runsToAdd;
      sp.er = (sp.er || 0) + runsToAdd;
      sp.bb = (sp.bb || 0) + (playType === 'walk' ? 1 : 0);
      sp.so = (sp.so || 0) + (playType === 'strikeout' ? 1 : 0);
      sp.pitches = (sp.pitches || 0) + 4;
      pitchingTeamLineup.startingPitcher = sp;
      updatedLineups[pitchingSide] = pitchingTeamLineup;
    }
    setLineups(updatedLineups);

    // Inning string prefix
    const inningStr = `${isTopInning ? '▲ Alta' : '▼ Baja'} ${currentInning}ª`;
    const scoreStr = `${game.awayTeam.shortName} ${newAwayScore} - ${newHomeScore} ${game.homeTeam.shortName}`;

    // 5. Create PlayEvent
    const newPlay: PlayEvent = {
      id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      inning: currentInning,
      isTop: isTopInning,
      outs: updatedOuts,
      description: `[${inningStr}] ${description}`,
      scoreAfter: scoreStr,
      isScoringPlay: isScoringPlay || runsToAdd > 0,
      playType,
      batterName: batter?.name,
      pitcherName: pitchingTeamLineup.startingPitcher?.name,
      runsScored: runsToAdd,
      timestamp: new Date().toISOString(),
    };

    const updatedPlays = [newPlay, ...plays];
    setPlays(updatedPlays);
    advanceToNextBatter();

    showNotification(
      `¡Jugada narrada y marcador actualizado! (${scoreStr})${runsToAdd > 0 ? ` • +${runsToAdd} Carrera(s)` : ''}`
    );

    if (updatedOuts >= 3) {
      showNotification('¡Tercer out de la entrada! Listo para cambiar de mitad de inning.');
    }

    // 6. IMMEDIATE REAL-TIME PERSISTENCE TO SERVER & CLOUD SQL
    setIsSyncingLive(true);
    ApiClient.updateAdminGame(game.id, {
      status,
      currentInning,
      isTopInning,
      outs: updatedOuts,
      balls: 0,
      strikes: 0,
      bases: {
        first: finalRunnerFirst,
        second: finalRunnerSecond,
        third: finalRunnerThird,
      },
      awayScore: newAwayScore,
      homeScore: newHomeScore,
      awayHits: newAwayHits,
      homeHits: newHomeHits,
      awayErrors: newAwayErrors,
      homeErrors: newHomeErrors,
      lineScore: updatedLineScore,
      lineups: updatedLineups,
      plays: updatedPlays,
    })
      .then((updated) => {
        onGameUpdated(updated);
        setLastSyncTime(new Date());
        setIsSyncingLive(false);
      })
      .catch((err) => {
        console.warn('Auto-sync error:', err);
        setIsSyncingLive(false);
      });
  };

  // Specific Quick Play Triggers
  const handleSingle = (rbi: number = 0) => {
    const runsDesc = rbi > 0 ? ` impulsando ${rbi} carrera(s)` : '';
    const desc = `${currentBatter?.name || 'Bateador'} conecta hit sencillo al jardín central${runsDesc}.`;
    recordPlayAndReflectScore({
      playType: 'hit',
      description: desc,
      runsToAdd: rbi,
      hitsToAdd: 1,
      errorsToAdd: 0,
      outsChange: 0,
      setBases: { first: true, third: rbi > 0 ? false : runnerThird },
      isScoringPlay: rbi > 0,
    });
  };

  const handleDouble = (rbi: number = 0) => {
    const runsDesc = rbi > 0 ? ` que remolca ${rbi} anotación(es)` : '';
    const desc = `¡Tubey de ${currentBatter?.name || 'Bateador'}! Sólido doblete entre right-center${runsDesc}.`;
    recordPlayAndReflectScore({
      playType: 'double',
      description: desc,
      runsToAdd: rbi,
      hitsToAdd: 1,
      errorsToAdd: 0,
      outsChange: 0,
      setBases: { first: false, second: true, third: false },
      isScoringPlay: rbi > 0,
    });
  };

  const handleTriple = (rbi: number = 0) => {
    const runsDesc = rbi > 0 ? ` vaciando las almohadillas con ${rbi} carrera(s)` : '';
    const desc = `¡Tripletete! ${currentBatter?.name || 'Bateador'} prende la moto y ancla en 3B${runsDesc}.`;
    recordPlayAndReflectScore({
      playType: 'triple',
      description: desc,
      runsToAdd: rbi,
      hitsToAdd: 1,
      errorsToAdd: 0,
      outsChange: 0,
      setBases: { first: false, second: false, third: true },
      isScoringPlay: rbi > 0,
    });
  };

  const handleHomeRun = (type: 'solo' | '2run' | '3run' | 'grandslam') => {
    let runs = 1;
    let label = '¡JONRÓN SOLITARIO!';
    if (type === '2run') {
      runs = 2;
      label = '¡JONRÓN DE 2 CARRERAS!';
    } else if (type === '3run') {
      runs = 3;
      label = '¡JONRÓN DE 3 CARRERAS!';
    } else if (type === 'grandslam') {
      runs = 4;
      label = '¡GRAND SLAM!';
    }

    const desc = `${label} ${currentBatter?.name || 'El bateador'} la desaparece del parque por todo el jardín izquierdo.`;
    recordPlayAndReflectScore({
      playType: 'homerun',
      description: desc,
      runsToAdd: runs,
      hitsToAdd: 1,
      errorsToAdd: 0,
      outsChange: 0,
      setBases: { first: false, second: false, third: false },
      isScoringPlay: true,
    });
  };

  const handleStrikeout = () => {
    const desc = `Ponche cantado. ${currentBatter?.name || 'El bateador'} abanica el tercer strike.`;
    recordPlayAndReflectScore({
      playType: 'strikeout',
      description: desc,
      runsToAdd: 0,
      hitsToAdd: 0,
      errorsToAdd: 0,
      outsChange: 1,
    });
  };

  const handleWalk = () => {
    const isBasesLoaded = runnerFirst && runnerSecond && runnerThird;
    const runs = isBasesLoaded ? 1 : 0;
    const desc = isBasesLoaded
      ? `Base por bolas con bases llenas para ${currentBatter?.name || 'el bateador'}. Entra carrera forzada.`
      : `Base por bolas de 4 envíos malos. ${currentBatter?.name || 'El bateador'} camina a 1B.`;
    recordPlayAndReflectScore({
      playType: 'walk',
      description: desc,
      runsToAdd: runs,
      hitsToAdd: 0,
      errorsToAdd: 0,
      outsChange: 0,
      setBases: {
        first: true,
        second: runnerFirst || runnerSecond,
        third: runnerSecond || runnerThird,
      },
      isScoringPlay: isBasesLoaded,
    });
  };

  const handleGroundout = () => {
    const desc = `Roletazo al cuadro por el campocorto. Retirado de 6-3 en primera base.`;
    recordPlayAndReflectScore({
      playType: 'groundout',
      description: desc,
      runsToAdd: 0,
      hitsToAdd: 0,
      errorsToAdd: 0,
      outsChange: 1,
    });
  };

  const handleFlyout = (isSacFly: boolean = false) => {
    const runs = isSacFly ? 1 : 0;
    const desc = isSacFly
      ? `¡Elevado de Sacrificio! Batazo profundo al jardín derecho que permite anotar en pisa y corre desde 3B.`
      : `Elevado capturado de aire por el jardinero central para el out.`;
    recordPlayAndReflectScore({
      playType: 'flyout',
      description: desc,
      runsToAdd: runs,
      hitsToAdd: 0,
      errorsToAdd: 0,
      outsChange: 1,
      setBases: isSacFly ? { third: false } : undefined,
      isScoringPlay: isSacFly,
    });
  };

  const handleDoublePlay = () => {
    const desc = `¡DOBLE PLAY! Roletazo al cuadro para combinación 4-6-3 que liquida la amenaza.`;
    recordPlayAndReflectScore({
      playType: 'doubleplay',
      description: desc,
      runsToAdd: 0,
      hitsToAdd: 0,
      errorsToAdd: 0,
      outsChange: 2,
      setBases: { first: false },
    });
  };

  const handleErrorPlay = () => {
    const desc = `Pifia a la defensiva en tiro a la inicial. El corredor se embasa por error.`;
    recordPlayAndReflectScore({
      playType: 'error',
      description: desc,
      runsToAdd: 0,
      hitsToAdd: 0,
      errorsToAdd: 1,
      outsChange: 0,
      setBases: { first: true },
    });
  };

  // Add custom play
  const handleAddCustomPlay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPlayText.trim()) return;

    recordPlayAndReflectScore({
      playType: customPlayRuns > 0 ? 'scoring_play' : 'custom',
      description: customPlayText.trim(),
      runsToAdd: customPlayRuns,
      hitsToAdd: customPlayRuns > 0 ? 1 : 0,
      errorsToAdd: 0,
      outsChange: 0,
      isScoringPlay: customPlayRuns > 0,
    });

    setCustomPlayText('');
    setCustomPlayRuns(0);
  };

  // Delete a play from history
  const handleDeletePlay = (playId: string) => {
    setPlays((prev) => prev.filter((p) => p.id !== playId));
    showNotification('Jugada eliminada del registro.');
  };

  // Update Lineup Item
  const handleUpdateLineupPlayer = (
    side: 'away' | 'home',
    orderIndex: number,
    field: keyof LineupPlayer,
    val: any
  ) => {
    setLineups((prev) => {
      const copy = { ...prev };
      const teamLineup = { ...copy[side] };
      const updatedOrder = [...teamLineup.battingOrder];
      updatedOrder[orderIndex] = {
        ...updatedOrder[orderIndex],
        [field]: val,
      };
      teamLineup.battingOrder = updatedOrder;
      copy[side] = teamLineup;
      return copy;
    });
  };

  // Auto-generate starting lineup from roster
  const handleAutoFillLineupFromRoster = (side: 'away' | 'home') => {
    const roster = side === 'away' ? awayRoster : homeRoster;
    if (roster.length === 0) {
      showNotification('Cargando jugadores del equipo...');
      return;
    }

    const defaultPositions = ['CF', '2B', 'LF', '1B', 'DH', '3B', 'RF', 'C', 'SS'];
    const updatedOrder: LineupPlayer[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < 9; i++) {
      const pos = defaultPositions[i];
      const match =
        roster.find((p) => !usedIds.has(p.id) && p.position === pos) ||
        roster.find((p) => !usedIds.has(p.id)) ||
        roster[0];

      if (match) {
        usedIds.add(match.id);
        updatedOrder.push({
          order: i + 1,
          playerId: match.id,
          name: match.fullName,
          jerseyNumber: match.jerseyNumber,
          position: pos,
          bats: match.bats || 'R',
          throws: match.throws || 'R',
          ab: 3,
          r: i === 0 || i === 3 ? 1 : 0,
          h: i % 2 === 0 ? 1 : 0,
          rbi: i === 3 ? 2 : 0,
          bb: i === 1 ? 1 : 0,
          so: i === 7 ? 1 : 0,
          avg: `.2${75 + ((i * 8) % 55)}`,
        });
      }
    }

    const pitcher =
      roster.find((p) => p.position === 'P' || p.position === 'SP' || p.position === 'RP') ||
      roster[roster.length - 1];

    setLineups((prev) => ({
      ...prev,
      [side]: {
        ...prev[side],
        startingPitcher: {
          playerId: pitcher?.id,
          name: pitcher ? pitcher.fullName : 'Abridor Oficial',
          jerseyNumber: pitcher ? pitcher.jerseyNumber : 33,
          throws: pitcher ? pitcher.throws : 'R',
          era: '3.12',
          ip: '5.1',
          h: 4,
          r: 2,
          er: 2,
          bb: 2,
          so: 6,
          pitches: 82,
        },
        battingOrder: updatedOrder,
      },
    }));

    showNotification(`Alineación titular de ${side === 'away' ? game.awayTeam.name : game.homeTeam.name} generada desde roster.`);
  };

  // Save All to Server and Cloud SQL
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const updates: any = {
        status,
        currentInning,
        isTopInning,
        outs,
        balls,
        strikes,
        bases: {
          first: runnerFirst,
          second: runnerSecond,
          third: runnerThird,
        },
        awayScore,
        homeScore,
        awayHits,
        homeHits,
        awayErrors,
        homeErrors,
        lineScore,
        lineups,
        winningPitcher: winningPitcher ? { name: winningPitcher, record: '' } : undefined,
        losingPitcher: losingPitcher ? { name: losingPitcher, record: '' } : undefined,
        savePitcher: savePitcher ? { name: savePitcher, saves: 1 } : undefined,
        plays,
      };

      const updated = await ApiClient.updateAdminGame(game.id, updates);
      onGameUpdated(updated);
      showNotification('¡Marcador, alineaciones y jugadas guardados en vivo!');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-sm uppercase tracking-wide">
                  Operador en Vivo y Narrador
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {status}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSyncingLive ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`}></span>
                  <span>{isSyncingLive ? 'Sincronizando marcador...' : 'Marcador sincronizado en vivo'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {game.awayTeam.name} vs {game.homeTeam.name} • {game.stadium || 'Estadio Nacional'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Publicar Marcador'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/60">
          <button
            onClick={() => setActiveConsoleTab('narrator')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeConsoleTab === 'narrator'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Narración Jugada a Jugada y Marcador</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab('lineups')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeConsoleTab === 'lineups'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Alineaciones Oficiales (Lineups)</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab('linescore')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeConsoleTab === 'linescore'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pizarra por Entradas y Árbitros</span>
          </button>
        </div>

        {/* Feedback Banner */}
        {actionFeedback && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-5 py-2 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {actionFeedback}
            </span>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: NARRATOR & REAL-TIME SCOREBOARD */}
          {activeConsoleTab === 'narrator' && (
            <div className="space-y-6">
              {/* Top Scoreboard & Inning Controller */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* Away Team Summary */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                      <TeamLogo
                        logo={game.awayTeam.logo}
                        name={game.awayTeam.name}
                        className="w-full h-full text-4xl"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">
                          Visitante
                        </span>
                        {isTopInning && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold animate-pulse">
                            AL BATE
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-white mt-1">
                        {game.awayTeam.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {awayHits} Hits • {awayErrors} Errores
                      </p>
                    </div>
                  </div>

                  {/* Centered Score & Inning Control */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center gap-4 text-4xl sm:text-5xl font-mono font-black tracking-wider text-white">
                      <span>{awayScore}</span>
                      <span className="text-slate-600 text-3xl font-sans">-</span>
                      <span>{homeScore}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setIsTopInning(!isTopInning)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        title="Cambiar Alta/Baja"
                      >
                        <span>{isTopInning ? '▲ Alta' : '▼ Baja'}</span>
                      </button>

                      <div className="flex items-center bg-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => setCurrentInning((i) => Math.max(1, i - 1))}
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-mono font-bold text-slate-200">
                          {currentInning}ª Entrada
                        </span>
                        <button
                          onClick={() => setCurrentInning((i) => i + 1)}
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={handleSwitchHalfInning}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Cambio de Lado</span>
                      </button>
                    </div>
                  </div>

                  {/* Home Team Summary */}
                  <div className="flex items-center justify-end gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-1.5">
                        {!isTopInning && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold animate-pulse">
                            AL BATE
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">
                          Local
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white mt-1">
                        {game.homeTeam.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {homeHits} Hits • {homeErrors} Errores
                      </p>
                    </div>
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                      <TeamLogo
                        logo={game.homeTeam.logo}
                        name={game.homeTeam.name}
                        className="w-full h-full text-4xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Diamond, Count & Matchup Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Baseball Diamond & Bases Clicker */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Situación en las Almohadillas
                  </span>

                  {/* SVG Diamond */}
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform rotate-45" viewBox="0 0 100 100">
                      {/* Base paths */}
                      <rect
                        x="20"
                        y="20"
                        width="60"
                        height="60"
                        fill="none"
                        stroke="#334155"
                        strokeWidth="3"
                        strokeDasharray="4 2"
                      />
                    </svg>

                    {/* 2B (Top) */}
                    <button
                      onClick={() => setRunnerSecond(!runnerSecond)}
                      className={`absolute top-2 w-8 h-8 rounded-md transform rotate-45 transition-all cursor-pointer flex items-center justify-center shadow-md ${
                        runnerSecond
                          ? 'bg-amber-400 ring-4 ring-amber-400/40 text-slate-950 font-black'
                          : 'bg-slate-800 hover:bg-slate-700 border border-slate-600'
                      }`}
                      title="2da Base (Clic para ocupar/desocupar)"
                    >
                      <span className="transform -rotate-45 text-[10px] font-bold">2B</span>
                    </button>

                    {/* 3B (Left) */}
                    <button
                      onClick={() => setRunnerThird(!runnerThird)}
                      className={`absolute left-2 w-8 h-8 rounded-md transform rotate-45 transition-all cursor-pointer flex items-center justify-center shadow-md ${
                        runnerThird
                          ? 'bg-amber-400 ring-4 ring-amber-400/40 text-slate-950 font-black'
                          : 'bg-slate-800 hover:bg-slate-700 border border-slate-600'
                      }`}
                      title="3ra Base (Clic para ocupar/desocupar)"
                    >
                      <span className="transform -rotate-45 text-[10px] font-bold">3B</span>
                    </button>

                    {/* 1B (Right) */}
                    <button
                      onClick={() => setRunnerFirst(!runnerFirst)}
                      className={`absolute right-2 w-8 h-8 rounded-md transform rotate-45 transition-all cursor-pointer flex items-center justify-center shadow-md ${
                        runnerFirst
                          ? 'bg-amber-400 ring-4 ring-amber-400/40 text-slate-950 font-black'
                          : 'bg-slate-800 hover:bg-slate-700 border border-slate-600'
                      }`}
                      title="1ra Base (Clic para ocupar/desocupar)"
                    >
                      <span className="transform -rotate-45 text-[10px] font-bold">1B</span>
                    </button>

                    {/* Home Plate (Bottom) */}
                    <div className="absolute bottom-3 w-7 h-7 bg-slate-200 rounded-sm transform rotate-45 flex items-center justify-center shadow">
                      <span className="transform -rotate-45 text-[9px] font-black text-slate-900">HP</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRunnerFirst(true);
                        setRunnerSecond(true);
                        setRunnerThird(true);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer"
                    >
                      Llenar Bases
                    </button>
                    <button
                      onClick={clearBases}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer"
                    >
                      Limpiar Bases
                    </button>
                  </div>
                </div>

                {/* 2. Interactive B-S-O Count (Bolas, Strikes, Outs) */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Conteo en Vivo (B-S-O)
                    </span>
                    <button
                      onClick={resetCount}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      Reiniciar Conteo
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Balls */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-sky-400 w-16">BOLAS</span>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3].map((b) => (
                          <button
                            key={b}
                            onClick={() => setBalls(balls === b ? b - 1 : b)}
                            className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                              balls >= b
                                ? 'bg-sky-400 border-sky-300 shadow-md shadow-sky-500/50'
                                : 'bg-slate-900 border-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-mono font-bold text-sm text-slate-300 w-6 text-right">
                        {balls}
                      </span>
                    </div>

                    {/* Strikes */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-amber-400 w-16">STRIKES</span>
                      <div className="flex items-center gap-2">
                        {[1, 2].map((s) => (
                          <button
                            key={s}
                            onClick={() => setStrikes(strikes === s ? s - 1 : s)}
                            className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                              strikes >= s
                                ? 'bg-amber-400 border-amber-300 shadow-md shadow-amber-500/50'
                                : 'bg-slate-900 border-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-mono font-bold text-sm text-slate-300 w-6 text-right">
                        {strikes}
                      </span>
                    </div>

                    {/* Outs */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-rose-400 w-16">OUTS</span>
                      <div className="flex items-center gap-2">
                        {[1, 2].map((o) => (
                          <button
                            key={o}
                            onClick={() => setOuts(outs === o ? o - 1 : o)}
                            className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                              outs >= o
                                ? 'bg-rose-500 border-rose-400 shadow-md shadow-rose-500/50'
                                : 'bg-slate-900 border-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-mono font-bold text-sm text-slate-300 w-6 text-right">
                        {outs}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      Estado: {balls}-{strikes}, {outs} out(s)
                    </span>
                    <button
                      onClick={() => setOuts((o) => (o >= 2 ? 0 : o + 1))}
                      className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold cursor-pointer"
                    >
                      +1 Out Rápido
                    </button>
                  </div>
                </div>

                {/* 3. Current Batter & Pitcher Dual Box */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Duelo Actual en el Plato
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      Turno #{currentBatterIndex + 1}
                    </span>
                  </div>

                  {/* Batter Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Bateador ({battingTeam.shortName}):</span>
                      <button
                        onClick={advanceToNextBatter}
                        className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                      >
                        Siguiente Bateador &rarr;
                      </button>
                    </label>
                    <select
                      value={currentBatterIndex}
                      onChange={(e) => setCurrentBatterIndex(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      {currentBattingLineup.battingOrder.map((b, idx) => (
                        <option key={idx} value={idx}>
                          #{b.order} {b.name} ({b.position}) • AVG {b.avg || '.300'}
                        </option>
                      ))}
                    </select>
                    {currentBatter && (
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                        <span>Batea: {currentBatter.bats || 'R'} • Pos: {currentBatter.position}</span>
                        <span>VB: {currentBatter.ab || 0} | H: {currentBatter.h || 0} | CI: {currentBatter.rbi || 0}</span>
                      </div>
                    )}
                  </div>

                  {/* Pitcher Info */}
                  <div className="space-y-1 pt-2 border-t border-slate-800/80">
                    <label className="text-[11px] text-slate-400">
                      Lanzador ({pitchingTeam.shortName}):
                    </label>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {currentPitcher?.name || 'Abridor Oficial'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        PCL: {currentPitcher?.era || '3.20'} • {currentPitcher?.so || 4} K
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Smart Play Recorder with Scoreboard Reflection */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">
                      Botonera de Jugadas y Narración Rápida
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Al pulsar cualquier acción se actualiza automáticamente el marcador y la pizarra.
                  </span>
                </div>

                {/* Hits & Extrabases Grid */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Batazos y Conexiones (Añade Hits y Carreras Automáticas)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <button
                      onClick={() => handleSingle(0)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-emerald-400 text-sm">Hit Sencillo</span>
                      <span className="text-[10px] text-slate-400">1B • 0 CI</span>
                    </button>

                    <button
                      onClick={() => handleSingle(1)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-emerald-400 text-sm">Hit + 1 Carrera</span>
                      <span className="text-[10px] text-emerald-300 font-mono">+1 Carrera</span>
                    </button>

                    <button
                      onClick={() => handleDouble(runnerSecond || runnerThird ? 2 : 1)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-sky-400 text-sm">Doblete (2B)</span>
                      <span className="text-[10px] text-slate-400">+1 Hit, Anotan</span>
                    </button>

                    <button
                      onClick={() => handleTriple(runnerFirst || runnerSecond ? 2 : 1)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-indigo-400 text-sm">Triplete (3B)</span>
                      <span className="text-[10px] text-slate-400">+1 Hit, Limpia</span>
                    </button>

                    <button
                      onClick={() => handleHomeRun('solo')}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500 text-xs font-black text-amber-300 flex flex-col items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
                    >
                      <span className="text-sm">¡Jonrón Solitario!</span>
                      <span className="text-[10px] font-mono">+1 Carrera</span>
                    </button>

                    <button
                      onClick={() => handleHomeRun('2run')}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500 text-xs font-black text-amber-300 flex flex-col items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
                    >
                      <span className="text-sm">¡Jonrón (2 Carreras)!</span>
                      <span className="text-[10px] font-mono">+2 Carreras</span>
                    </button>

                    <button
                      onClick={() => handleHomeRun('3run')}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500 text-xs font-black text-amber-300 flex flex-col items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
                    >
                      <span className="text-sm">¡Jonrón (3 Carreras)!</span>
                      <span className="text-[10px] font-mono">+3 Carreras</span>
                    </button>

                    <button
                      onClick={() => handleHomeRun('grandslam')}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/30 to-amber-500/30 border border-emerald-400 text-xs font-black text-emerald-300 flex flex-col items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95 ring-2 ring-emerald-500/30"
                    >
                      <span className="text-sm">¡GRAND SLAM!</span>
                      <span className="text-[10px] font-mono">+4 Carreras</span>
                    </button>

                    <button
                      onClick={() => handleFlyout(true)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-amber-400 text-sm">Fly Sacrificio</span>
                      <span className="text-[10px] text-slate-400">+1 Out • +1 C</span>
                    </button>

                    <button
                      onClick={handleWalk}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-sky-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-sky-400 text-sm">Base por Bolas</span>
                      <span className="text-[10px] text-slate-400">4 Malas (BB)</span>
                    </button>
                  </div>
                </div>

                {/* Outs & Defensive Plays */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Outs, Ponches y Defensa
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                    <button
                      onClick={handleStrikeout}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-rose-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-rose-400 text-sm">Ponche (K / SO)</span>
                      <span className="text-[10px] text-slate-400">+1 Out al plato</span>
                    </button>

                    <button
                      onClick={handleGroundout}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-rose-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-rose-400 text-sm">Roletazo al Cuadro</span>
                      <span className="text-[10px] text-slate-400">Out en 1B (6-3 / 4-3)</span>
                    </button>

                    <button
                      onClick={() => handleFlyout(false)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-rose-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-rose-400 text-sm">Elevado de Out</span>
                      <span className="text-[10px] text-slate-400">Fly out a los jardines</span>
                    </button>

                    <button
                      onClick={handleDoublePlay}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-amber-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-amber-400 text-sm">¡Doble Play!</span>
                      <span className="text-[10px] text-slate-400">+2 Outs (6-4-3)</span>
                    </button>

                    <button
                      onClick={handleErrorPlay}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-rose-500 text-xs font-bold text-white flex flex-col items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                    >
                      <span className="text-rose-400 text-sm">Error Defensivo</span>
                      <span className="text-[10px] text-slate-400">+1 Error a la defensa</span>
                    </button>
                  </div>
                </div>

                {/* Custom Narrative Formulation & Quick Phrases */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-bold uppercase tracking-wider text-slate-400">
                      Plantillas y Narración Rápida
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Haz clic en una frase para insertarla y narrar al instante
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { text: 'Conecta hit de línea al jardín derecho', runs: 1, outs: 0, hits: 1 },
                      { text: 'Toque de sacrificio perfectamente colocado por tercera base', runs: 0, outs: 1, hits: 0 },
                      { text: 'Robo de segunda base con deslizamiento impecable', runs: 0, outs: 0, hits: 0 },
                      { text: 'Lanzamiento salvaje (Wild pitch), avanza corredor', runs: 0, outs: 0, hits: 0 },
                      { text: 'Elevado de sacrificio profundo al jardín central', runs: 1, outs: 1, hits: 0 },
                      { text: 'Gran atrapada corriendo hacia la pared en zona de advertencia', runs: 0, outs: 1, hits: 0 },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomPlayText(item.text);
                          setCustomPlayRuns(item.runs);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        {item.text} {item.runs > 0 ? `(+${item.runs} C)` : ''}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={handleAddCustomPlay}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1"
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={customPlayText}
                        onChange={(e) => setCustomPlayText(e.target.value)}
                        placeholder="Redactar narración personalizada de la jugada..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <select
                        value={customPlayRuns}
                        onChange={(e) => setCustomPlayRuns(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        title="Carreras impulsadas en esta jugada"
                      >
                        <option value={0}>0 Carreras</option>
                        <option value={1}>+1 Carrera</option>
                        <option value={2}>+2 Carreras</option>
                        <option value={3}>+3 Carreras</option>
                        <option value={4}>+4 Carreras</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-md shrink-0 flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Narrar Jugada</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Feed of Recorded Plays */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                      Relato Cronológico Jugada a Jugada ({plays.length})
                    </h4>
                  </div>
                  {plays.length > 0 && (
                    <button
                      onClick={() => setPlays([])}
                      className="text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      Vaciar Relato
                    </button>
                  )}
                </div>

                {plays.length === 0 ? (
                  <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500 text-xs">
                    No hay jugadas narradas todavía. Usa la botonera superior para ir narrando cada lance.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {plays.map((play) => (
                      <div
                        key={play.id}
                        className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-xs transition-all ${
                          play.isScoringPlay
                            ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] shrink-0">
                            {play.inning}ª {play.isTop ? '▲' : '▼'}
                          </span>
                          <div className="flex-1 space-y-1">
                            <p className="leading-relaxed font-medium text-slate-200">
                              {play.description}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                              <span>Marcador: {play.scoreAfter}</span>
                              <span>•</span>
                              <span>{play.outs} out(s)</span>
                              {play.batterName && <span>• Bateador: {play.batterName}</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeletePlay(play.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Eliminar esta jugada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LINEUPS BUILDER & MANAGER */}
          {activeConsoleTab === 'lineups' && (
            <div className="space-y-6">
              {/* Team Side Selector */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveLineupTeamSide('away')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeLineupTeamSide === 'away'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.name} className="w-4 h-4" />
                    <span>Alineación: {game.awayTeam.name} (Visitante)</span>
                  </button>

                  <button
                    onClick={() => setActiveLineupTeamSide('home')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeLineupTeamSide === 'home'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.name} className="w-4 h-4" />
                    <span>Alineación: {game.homeTeam.name} (Local)</span>
                  </button>
                </div>

                <button
                  onClick={() => handleAutoFillLineupFromRoster(activeLineupTeamSide)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs border border-emerald-500/30 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Autocompletar desde Roster</span>
                </button>
              </div>

              {/* Pitcher starting card */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Lanzador Abridor Titular
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Lanza: {lineups[activeLineupTeamSide].startingPitcher?.throws || 'R'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] text-slate-400">Nombre del Abridor:</label>
                    <input
                      type="text"
                      value={lineups[activeLineupTeamSide].startingPitcher?.name || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLineups((prev) => ({
                          ...prev,
                          [activeLineupTeamSide]: {
                            ...prev[activeLineupTeamSide],
                            startingPitcher: {
                              ...prev[activeLineupTeamSide].startingPitcher!,
                              name: val,
                            },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Dorsal (#):</label>
                    <input
                      type="number"
                      value={lineups[activeLineupTeamSide].startingPitcher?.jerseyNumber || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLineups((prev) => ({
                          ...prev,
                          [activeLineupTeamSide]: {
                            ...prev[activeLineupTeamSide],
                            startingPitcher: {
                              ...prev[activeLineupTeamSide].startingPitcher!,
                              jerseyNumber: val,
                            },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Entradas (IP):</label>
                    <input
                      type="text"
                      value={lineups[activeLineupTeamSide].startingPitcher?.ip || '5.0'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLineups((prev) => ({
                          ...prev,
                          [activeLineupTeamSide]: {
                            ...prev[activeLineupTeamSide],
                            startingPitcher: {
                              ...prev[activeLineupTeamSide].startingPitcher!,
                              ip: val,
                            },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Ponches (K):</label>
                    <input
                      type="number"
                      value={lineups[activeLineupTeamSide].startingPitcher?.so || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLineups((prev) => ({
                          ...prev,
                          [activeLineupTeamSide]: {
                            ...prev[activeLineupTeamSide],
                            startingPitcher: {
                              ...prev[activeLineupTeamSide].startingPitcher!,
                              so: val,
                            },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">PCL / ERA:</label>
                    <input
                      type="text"
                      value={lineups[activeLineupTeamSide].startingPitcher?.era || '3.20'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLineups((prev) => ({
                          ...prev,
                          [activeLineupTeamSide]: {
                            ...prev[activeLineupTeamSide],
                            startingPitcher: {
                              ...prev[activeLineupTeamSide].startingPitcher!,
                              era: val,
                            },
                          },
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Batting Order 1-9 Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Orden al Bate Titular (1 al 9)
                </span>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-1">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 text-left">
                        <th className="py-2 px-2.5 text-center w-10">#</th>
                        <th className="py-2 px-3">Bateador</th>
                        <th className="py-2 px-2 text-center w-16">Pos</th>
                        <th className="py-2 px-2 text-center w-12">#</th>
                        <th className="py-2 px-2 text-center w-12">Bat</th>
                        <th className="py-2 px-2 text-center w-12">VB</th>
                        <th className="py-2 px-2 text-center w-12">C</th>
                        <th className="py-2 px-2 text-center w-12">H</th>
                        <th className="py-2 px-2 text-center w-12">CI</th>
                        <th className="py-2 px-2 text-center w-12">K</th>
                        <th className="py-2 px-3 text-right">AVG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {lineups[activeLineupTeamSide].battingOrder.map((batter, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-2 px-2 text-center font-bold text-emerald-400 font-mono">
                            {batter.order}º
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={batter.name}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'name',
                                  e.target.value
                                )
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <select
                              value={batter.position}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'position',
                                  e.target.value
                                )
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-emerald-400 font-bold focus:outline-none"
                            >
                              {['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 px-2 text-center font-mono">
                            <input
                              type="number"
                              value={batter.jerseyNumber || 0}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'jerseyNumber',
                                  Number(e.target.value)
                                )
                              }
                              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-center text-slate-300 font-mono"
                            />
                          </td>

                          <td className="py-2 px-2 text-center font-mono">
                            <select
                              value={batter.bats || 'R'}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'bats',
                                  e.target.value
                                )
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-slate-400"
                            >
                              <option value="R">D</option>
                              <option value="L">Z</option>
                              <option value="S">A</option>
                            </select>
                          </td>

                          <td className="py-2 px-2 text-center font-mono">
                            <input
                              type="number"
                              value={batter.ab || 0}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'ab',
                                  Number(e.target.value)
                                )
                              }
                              className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-center text-white"
                            />
                          </td>

                          <td className="py-2 px-2 text-center font-mono">
                            <input
                              type="number"
                              value={batter.r || 0}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'r',
                                  Number(e.target.value)
                                )
                              }
                              className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-center text-amber-300"
                            />
                          </td>

                          <td className="py-2 px-2 text-center font-mono">
                            <input
                              type="number"
                              value={batter.h || 0}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'h',
                                  Number(e.target.value)
                                )
                              }
                              className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-center text-emerald-400 font-bold"
                            />
                          </td>

                          <td className="py-2 px-2 text-center font-mono">
                            <input
                              type="number"
                              value={batter.rbi || 0}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'rbi',
                                  Number(e.target.value)
                                )
                              }
                              className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-center text-sky-400 font-bold"
                            />
                          </td>

                          <td className="py-2 px-2 text-center font-mono">
                            <input
                              type="number"
                              value={batter.so || 0}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'so',
                                  Number(e.target.value)
                                )
                              }
                              className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-center text-rose-400"
                            />
                          </td>

                          <td className="py-2 px-3 text-right font-mono">
                            <input
                              type="text"
                              value={batter.avg || '.300'}
                              onChange={(e) =>
                                handleUpdateLineupPlayer(
                                  activeLineupTeamSide,
                                  idx,
                                  'avg',
                                  e.target.value
                                )
                              }
                              className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs text-right text-slate-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LINE SCORE & PITCHERS OF DECISION */}
          {activeConsoleTab === 'linescore' && (
            <div className="space-y-6">
              {/* Full Inning-by-Inning Line Score Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Anotaciones por Entrada (Line Score)
                  </span>
                  <button
                    onClick={handleAddExtraInning}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Entrada Extra</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                  <table className="w-full text-center text-xs font-mono">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="text-left py-2 px-3 font-sans uppercase font-bold text-[11px] min-w-[140px]">
                          Equipo
                        </th>
                        {lineScore.map((ls) => (
                          <th key={ls.inning} className="px-2.5 py-2 font-bold text-slate-300">
                            {ls.inning}
                          </th>
                        ))}
                        <th className="px-3 py-2 font-bold text-white bg-slate-900 border-l border-slate-800">
                          C
                        </th>
                        <th className="px-3 py-2 font-bold text-slate-300 bg-slate-900">H</th>
                        <th className="px-3 py-2 font-bold text-slate-300 bg-slate-900">E</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {/* Away row */}
                      <tr>
                        <td className="text-left py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-2">
                          <TeamLogo
                            logo={game.awayTeam.logo}
                            name={game.awayTeam.name}
                            className="w-5 h-5 shrink-0"
                          />
                          <span>{game.awayTeam.shortName}</span>
                        </td>
                        {lineScore.map((ls, idx) => (
                          <td key={`away-in-${ls.inning}`} className="p-1">
                            <input
                              type="number"
                              min={0}
                              value={ls.away !== null && ls.away !== undefined ? ls.away : 0}
                              onChange={(e) =>
                                handleInningScoreChange(idx, 'away', Number(e.target.value))
                              }
                              className="w-10 text-center bg-slate-900 border border-slate-700 rounded py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 font-bold text-white bg-slate-900 border-l border-slate-800 font-mono text-base">
                          {awayScore}
                        </td>
                        <td className="px-1.5 py-2 bg-slate-900">
                          <input
                            type="number"
                            value={awayHits}
                            onChange={(e) => setAwayHits(Number(e.target.value))}
                            className="w-10 text-center bg-slate-800 border border-slate-700 rounded py-1 text-xs text-slate-200"
                          />
                        </td>
                        <td className="px-1.5 py-2 bg-slate-900">
                          <input
                            type="number"
                            value={awayErrors}
                            onChange={(e) => setAwayErrors(Number(e.target.value))}
                            className="w-10 text-center bg-slate-800 border border-slate-700 rounded py-1 text-xs text-slate-200"
                          />
                        </td>
                      </tr>

                      {/* Home row */}
                      <tr>
                        <td className="text-left py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-2">
                          <TeamLogo
                            logo={game.homeTeam.logo}
                            name={game.homeTeam.name}
                            className="w-5 h-5 shrink-0"
                          />
                          <span>{game.homeTeam.shortName}</span>
                        </td>
                        {lineScore.map((ls, idx) => (
                          <td key={`home-in-${ls.inning}`} className="p-1">
                            <input
                              type="number"
                              min={0}
                              value={ls.home !== null && ls.home !== undefined ? ls.home : 0}
                              onChange={(e) =>
                                handleInningScoreChange(idx, 'home', Number(e.target.value))
                              }
                              className="w-10 text-center bg-slate-900 border border-slate-700 rounded py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 font-bold text-white bg-slate-900 border-l border-slate-800 font-mono text-base">
                          {homeScore}
                        </td>
                        <td className="px-1.5 py-2 bg-slate-900">
                          <input
                            type="number"
                            value={homeHits}
                            onChange={(e) => setHomeHits(Number(e.target.value))}
                            className="w-10 text-center bg-slate-800 border border-slate-700 rounded py-1 text-xs text-slate-200"
                          />
                        </td>
                        <td className="px-1.5 py-2 bg-slate-900">
                          <input
                            type="number"
                            value={homeErrors}
                            onChange={(e) => setHomeErrors(Number(e.target.value))}
                            className="w-10 text-center bg-slate-800 border border-slate-700 rounded py-1 text-xs text-slate-200"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status and Decision Pitchers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Estado del Partido
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GameStatus)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="LIVE">🔴 EN VIVO (LIVE)</option>
                    <option value="FINAL">🏁 FINALIZADO (FINAL)</option>
                    <option value="SCHEDULED">📅 PROGRAMADO (SCHEDULED)</option>
                    <option value="DELAYED">🌧️ DEMORADO (DELAYED)</option>
                    <option value="POSTPONED">🚫 POSPUESTO (POSTPONED)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Pitcher Ganador (JG)
                  </label>
                  <input
                    type="text"
                    value={winningPitcher}
                    onChange={(e) => setWinningPitcher(e.target.value)}
                    placeholder="Ej. Yoanni Yera (5-1)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Pitcher Perdedor (JP)
                  </label>
                  <input
                    type="text"
                    value={losingPitcher}
                    onChange={(e) => setLosingPitcher(e.target.value)}
                    placeholder="Ej. Frank Herrera (2-3)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Pitcher Salvador (JS)
                  </label>
                  <input
                    type="text"
                    value={savePitcher}
                    onChange={(e) => setSavePitcher(e.target.value)}
                    placeholder="Ej. Armando Dueñas (JS: 8)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Consola en tiempo real conectada a la base de datos</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando en la nube...' : 'Publicar Marcador y Narración'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
