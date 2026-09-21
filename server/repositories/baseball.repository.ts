import {
  Competition,
  Season,
  Team,
  Player,
  Game,
  BattingStats,
  PitchingStats,
  Standing,
  NewsArticle,
  VideoItem,
  TeamAggregatedStats,
  MatchupComparisonData,
  ArticleComment,
} from '../../src/types/index.ts';
import { generateSeoSlug } from '../../src/utils/slug.ts';
import {
  DEMO_COMPETITIONS,
  DEMO_SEASONS,
  DEMO_TEAMS,
  DEMO_PLAYERS,
  DEMO_GAMES,
  DEMO_BATTING_STATS,
  DEMO_PITCHING_STATS,
  DEMO_STANDINGS,
  DEMO_NEWS,
  DEMO_VIDEOS,
} from '../data/seed-data.ts';

export class BaseballRepository {
  private competitions: Competition[] = [...DEMO_COMPETITIONS];
  private seasons: Season[] = [...DEMO_SEASONS];
  private teams: Team[] = [...DEMO_TEAMS];
  private players: Player[] = [...DEMO_PLAYERS];
  private games: Game[] = [...DEMO_GAMES];
  private battingStats: BattingStats[] = [...DEMO_BATTING_STATS];
  private pitchingStats: PitchingStats[] = [...DEMO_PITCHING_STATS];
  private standings: Standing[] = [...DEMO_STANDINGS];
  private news: NewsArticle[] = [...DEMO_NEWS];
  private videos: VideoItem[] = [...DEMO_VIDEOS];
  private comments: ArticleComment[] = [
    {
      id: 'comm_1',
      articleSlug: 'final-serie-nacional-63-las-tunas-vs-pinar-del-rio',
      authorName: 'Yordanis Morales',
      favoriteTeam: 'Leñadores de Las Tunas',
      content: '¡Tremendo análisis! Los Leñadores han demostrado una consistencia bárbara en el Julio Antonio Mella.',
      createdAt: '2026-09-20T14:30:00Z',
      likes: 8,
    },
    {
      id: 'comm_2',
      articleSlug: 'final-serie-nacional-63-las-tunas-vs-pinar-del-rio',
      authorName: 'Alejandro Valdés',
      favoriteTeam: 'Vegueros de Pinar del Río',
      content: 'El pitcheo de relevo de Pinar va a decidir esta serie. Si los abridores caminan 6 innings, la ventaja es verde.',
      createdAt: '2026-09-20T16:15:00Z',
      likes: 5,
    },
    {
      id: 'comm_3',
      articleSlug: 'analisis-snb-63-lideres-estadisticos-temporada-regular',
      authorName: 'Ernesto Santana',
      favoriteTeam: 'Industriales',
      content: 'Gran trabajo recopilando estos datos. Ojalá sigan publicando estas métricas avanzadas antes de cada subserie.',
      createdAt: '2026-09-20T18:40:00Z',
      likes: 12,
    },
  ];

  // Competitions & Seasons
  getCompetitions(): Competition[] {
    return this.competitions;
  }

  getCompetitionById(id: string): Competition | undefined {
    return this.competitions.find((c) => c.id === id);
  }

  getSeasons(competitionId?: string): Season[] {
    if (!competitionId) return this.seasons;
    return this.seasons.filter((s) => s.competitionId === competitionId);
  }

  // Teams
  getTeams(competitionId?: string): Team[] {
    if (!competitionId) return this.teams;
    return this.teams.filter((t) => t.competitionId === competitionId);
  }

  getTeamById(id: string): Team | undefined {
    return this.teams.find((t) => t.id === id || t.shortName.toLowerCase() === id.toLowerCase());
  }

  updateTeam(id: string, updates: Partial<Team>): Team | undefined {
    const index = this.teams.findIndex((t) => t.id === id || t.shortName.toLowerCase() === id.toLowerCase());
    if (index === -1) return undefined;

    const current = this.teams[index];
    const updated: Team = {
      ...current,
      ...updates,
    };
    this.teams[index] = updated;

    // Propagate logo and colors across active games, standings and players
    if (updates.logo || updates.colors || updates.name || updates.shortName) {
      for (const g of this.games) {
        if (g.homeTeam.id === current.id || g.homeTeam.shortName === current.shortName) {
          if (updates.logo) g.homeTeam.logo = updates.logo;
          if (updates.name) g.homeTeam.name = updates.name;
          if (updates.shortName) g.homeTeam.shortName = updates.shortName;
          if (updates.colors) g.homeTeam.colors = updates.colors;
        }
        if (g.awayTeam.id === current.id || g.awayTeam.shortName === current.shortName) {
          if (updates.logo) g.awayTeam.logo = updates.logo;
          if (updates.name) g.awayTeam.name = updates.name;
          if (updates.shortName) g.awayTeam.shortName = updates.shortName;
          if (updates.colors) g.awayTeam.colors = updates.colors;
        }
      }

      for (const s of this.standings) {
        if (s.teamId === current.id || s.teamShort === current.shortName) {
          if (updates.logo) {
            s.teamLogo = updates.logo;
            (s as any).logo = updates.logo;
          }
          if (updates.name) s.teamName = updates.name;
          if (updates.shortName) s.teamShort = updates.shortName;
        }
      }

      for (const p of this.players) {
        if (p.teamId === current.id || p.teamShort === current.shortName) {
          if (updates.name) p.teamName = updates.name;
          if (updates.shortName) p.teamShort = updates.shortName;
        }
      }
    }

    return updated;
  }

  // Players
  getPlayers(params?: { teamId?: string; position?: string; search?: string; limit?: number; page?: number }): {
    items: Player[];
    total: number;
  } {
    let result = this.players;

    if (params?.teamId) {
      result = result.filter((p) => p.teamId === params.teamId);
    }
    if (params?.position) {
      result = result.filter((p) => p.position === params.position);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q)
      );
    }

    const total = result.length;
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const start = (page - 1) * limit;
    const items = result.slice(start, start + limit);

    return { items, total };
  }

  getPlayerById(id: string): Player | undefined {
    return this.players.find((p) => p.id === id || p.slug === id);
  }

  // Games
  getGames(params?: { competitionId?: string; seasonId?: string; status?: string; teamId?: string }): Game[] {
    let result = this.games;

    if (params?.competitionId) {
      result = result.filter((g) => g.competitionId === params.competitionId);
    }
    if (params?.seasonId) {
      result = result.filter((g) => g.seasonId === params.seasonId);
    }
    if (params?.status && params.status !== 'ALL') {
      result = result.filter((g) => g.status === params.status);
    }
    if (params?.teamId) {
      result = result.filter((g) => g.homeTeam.id === params.teamId || g.awayTeam.id === params.teamId);
    }

    return result;
  }

  getGameById(id: string): Game | undefined {
    return this.games.find((g) => g.id === id);
  }

  simulateLiveScoreChange(gameId?: string, forcedSide?: 'home' | 'away', forcedRuns?: number): {
    game: Game;
    runsScored: number;
    scoringTeam: Team;
    scoringSide: 'home' | 'away';
    title: string;
    playDescription: string;
    playType: 'homerun' | 'hit' | 'sacrifice' | 'walk' | 'standard';
  } | null {
    const liveGames = this.games.filter((g) => g.status === 'LIVE');
    if (liveGames.length === 0) return null;

    const target = gameId ? liveGames.find((g) => g.id === gameId) || liveGames[0] : liveGames[Math.floor(Math.random() * liveGames.length)];
    const scoreSide = forcedSide || (Math.random() > 0.5 ? 'home' : 'away');
    const runs = forcedRuns || (Math.random() > 0.65 ? 2 : 1);
    const scoringTeam = scoreSide === 'home' ? target.homeTeam : target.awayTeam;

    if (scoreSide === 'home') {
      target.homeScore += runs;
      target.homeHits += runs;
    } else {
      target.awayScore += runs;
      target.awayHits += runs;
    }

    // Update LineScore
    const currentInning = target.currentInning || 8;
    const inningScore = target.lineScore.find((ls) => ls.inning === currentInning);
    if (inningScore) {
      if (scoreSide === 'home') {
        inningScore.home = (typeof inningScore.home === 'number' ? inningScore.home : 0) + runs;
      } else {
        inningScore.away = (typeof inningScore.away === 'number' ? inningScore.away : 0) + runs;
      }
    }

    // Realistic baseball descriptions
    const isHomerun = runs > 1 || Math.random() > 0.5;
    const playType = isHomerun ? 'homerun' : 'hit';
    const title = isHomerun
      ? (runs > 1 ? `¡JONRÓN DE ${runs} CARRERAS!` : '¡JONRÓN SOLITARIO!')
      : (runs > 1 ? `¡DOBLETE DE ${runs} CARRERAS!` : '¡SENCILLO IMPULSADOR!');

    const sampleDescriptions = [
      `${scoringTeam.shortName}: Batazo de extrabase al jardín izquierdo remolcando ${runs} carrera(s).`,
      `${scoringTeam.shortName}: Cuadrangular kilométrico entre left y center field (+${runs}).`,
      `${scoringTeam.shortName}: Imparable con hombres en posición anotadora (+${runs} carrera(s)).`,
      `${scoringTeam.shortName}: Cañonazo contra los muros que impulsa a los corredores (+${runs}).`,
    ];
    const playDescription = sampleDescriptions[Math.floor(Math.random() * sampleDescriptions.length)];

    if (!target.plays) target.plays = [];
    target.plays.unshift({
      id: `pl-sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      inning: currentInning,
      isTop: scoreSide === 'away',
      outs: target.outs ?? 1,
      description: playDescription,
      scoreAfter: `${target.awayTeam.shortName} ${target.awayScore} - ${target.homeTeam.shortName} ${target.homeScore}`,
      isScoringPlay: true,
    });

    return {
      game: { ...target },
      runsScored: runs,
      scoringTeam,
      scoringSide: scoreSide,
      title,
      playDescription,
      playType,
    };
  }

  // Standings
  getStandings(competitionId?: string, division?: string): Standing[] {
    let result = this.standings;
    if (division && division !== 'General') {
      result = result.filter((s) => s.division === division);
    }
    return result.sort((a, b) => b.pct - a.pct);
  }

  // Stats
  getBattingStats(sortBy: keyof BattingStats = 'avg', order: 'asc' | 'desc' = 'desc'): BattingStats[] {
    return [...this.battingStats].sort((a, b) => {
      const valA = (a[sortBy] as number) ?? 0;
      const valB = (b[sortBy] as number) ?? 0;
      return order === 'desc' ? valB - valA : valA - valB;
    });
  }

  getPitchingStats(sortBy: keyof PitchingStats = 'era', order: 'asc' | 'desc' = 'asc'): PitchingStats[] {
    return [...this.pitchingStats].sort((a, b) => {
      const valA = (a[sortBy] as number) ?? 0;
      const valB = (b[sortBy] as number) ?? 0;
      return order === 'desc' ? valB - valA : valA - valB;
    });
  }

  // Leaders
  getLeaders(category: 'batting' | 'pitching', stat: string, limit = 5): any[] {
    if (category === 'batting') {
      const sorted = this.getBattingStats(stat as keyof BattingStats, stat === 'so' ? 'asc' : 'desc');
      return sorted.slice(0, limit).map((s, index) => {
        const player = this.getPlayerById(s.playerId);
        const team = this.getTeamById(s.teamId);
        return {
          rank: index + 1,
          playerId: s.playerId,
          playerName: s.playerName,
          playerPhoto: player?.photo,
          teamId: s.teamId,
          teamShort: s.teamShort,
          teamLogo: team?.logo,
          position: s.position,
          value: s[stat as keyof BattingStats],
        };
      });
    } else {
      const isAsc = stat === 'era' || stat === 'whip';
      const sorted = this.getPitchingStats(stat as keyof PitchingStats, isAsc ? 'asc' : 'desc');
      return sorted.slice(0, limit).map((s, index) => {
        const player = this.getPlayerById(s.playerId);
        const team = this.getTeamById(s.teamId);
        return {
          rank: index + 1,
          playerId: s.playerId,
          playerName: s.playerName,
          playerPhoto: player?.photo,
          teamId: s.teamId,
          teamShort: s.teamShort,
          teamLogo: team?.logo,
          position: s.position,
          value: s[stat as keyof PitchingStats],
        };
      });
    }
  }

  // News
  getNews(limit = 24, category?: string): NewsArticle[] {
    let result = this.news;
    if (category && category !== 'Todos') {
      result = result.filter((n) => n.category === category);
    }
    return result.slice(0, limit);
  }

  getNewsBySlug(slug: string): NewsArticle | undefined {
    if (!slug) return undefined;
    const clean = decodeURIComponent(slug).trim().toLowerCase();
    return this.news.find(
      (n) => n.slug.toLowerCase() === clean || n.id.toLowerCase() === clean
    );
  }

  getVideos(): VideoItem[] {
    return this.videos;
  }

  // Search
  searchGlobal(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return { players: [], teams: [], competitions: [] };

    const matchedPlayers = this.players
      .filter((p) => p.fullName.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q))
      .slice(0, 6);

    const matchedTeams = this.teams
      .filter((t) => t.name.toLowerCase().includes(q) || t.nickname.toLowerCase().includes(q) || t.city.toLowerCase().includes(q))
      .slice(0, 6);

    const matchedCompetitions = this.competitions
      .filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .slice(0, 4);

    return {
      players: matchedPlayers,
      teams: matchedTeams,
      competitions: matchedCompetitions,
    };
  }

  // Ingestion persistence
  insertBattingStatsBatch(newStats: BattingStats[]): number {
    for (const stat of newStats) {
      if (!stat || !stat.playerName) continue;

      // Buscar equipo coincidente
      const targetTeamQuery = (stat.teamShort || stat.teamId || '').toLowerCase();
      const matchedTeam = this.teams.find(
        (t) =>
          t.id.toLowerCase() === targetTeamQuery ||
          t.shortName.toLowerCase() === targetTeamQuery ||
          t.name.toLowerCase() === targetTeamQuery ||
          t.name.toLowerCase().includes(targetTeamQuery)
      ) || this.teams[0];

      // Buscar si el jugador ya existe en la base de datos
      let player = this.players.find(
        (p) =>
          p.id === stat.playerId ||
          (p.fullName.toLowerCase() === stat.playerName.toLowerCase() && p.teamId === matchedTeam.id) ||
          p.fullName.toLowerCase() === stat.playerName.toLowerCase()
      );

      const rawMeta = stat as any;
      const pos = (stat.position || rawMeta.pos || 'OF').toString().toUpperCase().trim();
      const jerseyNumber = Number(rawMeta.jerseyNumber || rawMeta.numero || rawMeta.dorsal || Math.floor(Math.random() * 80) + 10);
      const bats = (rawMeta.bats || rawMeta.batea || 'R').toString().toUpperCase().trim() as 'R' | 'L' | 'S';
      const throws_ = (rawMeta.throws || rawMeta.lanza || 'R').toString().toUpperCase().trim() as 'R' | 'L';
      const bio = rawMeta.bio || rawMeta.biografia || `Jugador de ${matchedTeam.name} en la Serie Nacional.`;
      const photo = rawMeta.photo || rawMeta.foto || rawMeta.imageUrl || 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=150&auto=format&fit=crop&q=80';
      const age = Number(rawMeta.age || rawMeta.edad || 26);

      if (!player) {
        player = this.createPlayer({
          fullName: stat.playerName.trim(),
          teamId: matchedTeam.id,
          jerseyNumber,
          position: pos as any,
          bats,
          throws: throws_,
          photo,
          bio,
          age,
        });
      } else {
        // Actualizar datos si viene equipo o posición
        this.updatePlayer(player.id, {
          teamId: matchedTeam.id,
          position: pos as any,
          jerseyNumber: rawMeta.jerseyNumber ? jerseyNumber : player.jerseyNumber,
          bio: rawMeta.bio || player.bio,
        });
      }

      stat.playerId = player.id;
      stat.teamId = matchedTeam.id;
      stat.teamShort = matchedTeam.shortName;

      // Actualizar o agregar estadísticas de bateo
      const existingStatIdx = this.battingStats.findIndex((b) => b.playerId === player!.id);
      if (existingStatIdx >= 0) {
        this.battingStats[existingStatIdx] = { ...stat, id: this.battingStats[existingStatIdx].id };
      } else {
        this.battingStats.push(stat);
      }

      // Si es lanzador o trae estadísticas de pitcheo, agregar o actualizar estadísticas de pitcheo
      if (pos === 'P' || rawMeta.era !== undefined || rawMeta.ip !== undefined) {
        const era = parseFloat(rawMeta.era || '3.20') || 3.20;
        const ip = parseFloat(rawMeta.ip || '20.0') || 20.0;
        const w = parseInt(rawMeta.w || rawMeta.wins || '2', 10) || 2;
        const l = parseInt(rawMeta.l || rawMeta.losses || '1', 10) || 1;
        const sv = parseInt(rawMeta.sv || rawMeta.saves || '0', 10) || 0;
        const so = parseInt(rawMeta.so || rawMeta.k || '16', 10) || 16;
        const bb = parseInt(rawMeta.bb || '6', 10) || 6;
        const h = parseInt(rawMeta.h || '14', 10) || 14;
        const r = parseInt(rawMeta.r || '8', 10) || 8;
        const er = Math.round(era * (ip / 9)) || 7;

        const existingPitchIdx = this.pitchingStats.findIndex((p) => p.playerId === player!.id);
        const pitchData: PitchingStats = {
          id: existingPitchIdx >= 0 ? this.pitchingStats[existingPitchIdx].id : `pitch-${Date.now()}-${player.id}`,
          playerId: player.id,
          playerName: player.fullName,
          teamId: matchedTeam.id,
          teamShort: matchedTeam.shortName,
          position: 'SP',
          seasonYear: 2026,
          games: stat.games || 10,
          gs: Math.max(1, Math.floor((stat.games || 10) / 2)),
          cg: 0,
          sho: 0,
          w,
          l,
          sv,
          ip,
          h,
          r,
          er,
          bb,
          so,
          hr: stat.hr || 1,
          era,
          whip: ip > 0 ? Math.round(((bb + h) / ip) * 100) / 100 : 1.25,
        };

        if (existingPitchIdx >= 0) {
          this.pitchingStats[existingPitchIdx] = pitchData;
        } else {
          this.pitchingStats.push(pitchData);
        }
      }
    }
    return newStats.length;
  }

  insertPlayersBatch(newPlayers: Player[]): number {
    this.players.push(...newPlayers);
    return newPlayers.length;
  }

  // Team Aggregated Season Statistics
  getTeamAggregatedStats(teamId: string): TeamAggregatedStats {
    const team = this.getTeamById(teamId);
    const batters = this.battingStats.filter((b) => b.teamId === teamId);
    const pitchers = this.pitchingStats.filter((p) => p.teamId === teamId);

    const totalAB = batters.reduce((sum, b) => sum + (b.ab || 0), 0);
    const totalH = batters.reduce((sum, b) => sum + (b.h || 0), 0);
    const totalR = batters.reduce((sum, b) => sum + (b.r || 0), 0);
    const total2B = batters.reduce((sum, b) => sum + (b.doubles || 0), 0);
    const total3B = batters.reduce((sum, b) => sum + (b.triples || 0), 0);
    const totalHR = batters.reduce((sum, b) => sum + (b.hr || 0), 0);
    const totalRBI = batters.reduce((sum, b) => sum + (b.rbi || 0), 0);
    const totalBB = batters.reduce((sum, b) => sum + (b.bb || 0), 0);
    const totalSO = batters.reduce((sum, b) => sum + (b.so || 0), 0);
    const totalSB = batters.reduce((sum, b) => sum + (b.sb || 0), 0);

    const avg = totalAB > 0 ? totalH / totalAB : 0.265;
    const obp = totalAB + totalBB > 0 ? (totalH + totalBB) / (totalAB + totalBB) : 0.335;
    const singles = Math.max(0, totalH - (total2B + total3B + totalHR));
    const totalBases = singles + total2B * 2 + total3B * 3 + totalHR * 4;
    const slg = totalAB > 0 ? totalBases / totalAB : 0.41;
    const ops = obp + slg;

    const totalIP = pitchers.reduce((sum, p) => sum + (p.ip || 0), 0);
    const totalPitchH = pitchers.reduce((sum, p) => sum + (p.h || 0), 0);
    const totalPitchR = pitchers.reduce((sum, p) => sum + (p.r || 0), 0);
    const totalPitchER = pitchers.reduce((sum, p) => sum + (p.er || 0), 0);
    const totalPitchBB = pitchers.reduce((sum, p) => sum + (p.bb || 0), 0);
    const totalPitchSO = pitchers.reduce((sum, p) => sum + (p.so || 0), 0);
    const totalPitchHR = pitchers.reduce((sum, p) => sum + (p.hr || 0), 0);
    const totalW = pitchers.reduce((sum, p) => sum + (p.wins ?? p.w ?? 0), 0);
    const totalL = pitchers.reduce((sum, p) => sum + (p.losses ?? p.l ?? 0), 0);
    const totalSV = pitchers.reduce((sum, p) => sum + (p.saves ?? p.sv ?? 0), 0);

    const era = totalIP > 0 ? (totalPitchER * 9) / totalIP : 3.85;
    const whip = totalIP > 0 ? (totalPitchBB + totalPitchH) / totalIP : 1.28;
    const k9 = totalIP > 0 ? (totalPitchSO * 9) / totalIP : 7.2;
    const bb9 = totalIP > 0 ? (totalPitchBB * 9) / totalIP : 3.1;

    return {
      teamId,
      teamShort: team?.shortName || teamId.toUpperCase(),
      teamName: team?.name || teamId,
      batting: {
        avg: parseFloat(avg.toFixed(3)),
        obp: parseFloat(obp.toFixed(3)),
        slg: parseFloat(slg.toFixed(3)),
        ops: parseFloat(ops.toFixed(3)),
        runs: totalR,
        hits: totalH,
        doubles: total2B,
        triples: total3B,
        homeRuns: totalHR,
        rbi: totalRBI,
        walks: totalBB,
        strikeouts: totalSO,
        stolenBases: totalSB,
      },
      pitching: {
        era: parseFloat(era.toFixed(2)),
        whip: parseFloat(whip.toFixed(2)),
        wins: totalW,
        losses: totalL,
        saves: totalSV,
        inningsPitched: parseFloat(totalIP.toFixed(1)),
        hitsAllowed: totalPitchH,
        runsAllowed: totalPitchR,
        earnedRuns: totalPitchER,
        walks: totalPitchBB,
        strikeouts: totalPitchSO,
        homeRunsAllowed: totalPitchHR,
        k9: parseFloat(k9.toFixed(2)),
        bb9: parseFloat(bb9.toFixed(2)),
      },
    };
  }

  // Side-by-Side Matchup Comparison
  getMatchupComparison(gameId: string): MatchupComparisonData | null {
    const game = this.getGameById(gameId);
    if (!game) return null;

    const awayTeam = this.getTeamById(game.awayTeam.id) || game.awayTeam;
    const homeTeam = this.getTeamById(game.homeTeam.id) || game.homeTeam;

    const awayStanding = this.standings.find((s) => s.teamId === awayTeam.id);
    const homeStanding = this.standings.find((s) => s.teamId === homeTeam.id);

    const awayStats = this.getTeamAggregatedStats(awayTeam.id);
    const homeStats = this.getTeamAggregatedStats(homeTeam.id);

    const headToHeadGames = this.games.filter(
      (g) =>
        (g.homeTeam.id === awayTeam.id && g.awayTeam.id === homeTeam.id) ||
        (g.homeTeam.id === homeTeam.id && g.awayTeam.id === awayTeam.id)
    );

    const awayBatters = this.battingStats.filter((b) => b.teamId === awayTeam.id);
    const homeBatters = this.battingStats.filter((b) => b.teamId === homeTeam.id);
    const awayPitchers = this.pitchingStats.filter((p) => p.teamId === awayTeam.id);
    const homePitchers = this.pitchingStats.filter((p) => p.teamId === homeTeam.id);

    const bestAwayBatterStats = [...awayBatters].sort((a, b) => (b.avg || 0) - (a.avg || 0))[0];
    const bestHomeBatterStats = [...homeBatters].sort((a, b) => (b.avg || 0) - (a.avg || 0))[0];
    const bestAwayPitcherStats = [...awayPitchers].sort((a, b) => (a.era || 99) - (b.era || 99))[0];
    const bestHomePitcherStats = [...homePitchers].sort((a, b) => (a.era || 99) - (b.era || 99))[0];

    const awayTopBatter = bestAwayBatterStats
      ? {
          player:
            this.getPlayerById(bestAwayBatterStats.playerId) ||
            ({
              id: bestAwayBatterStats.playerId,
              fullName: bestAwayBatterStats.playerName,
              firstName: bestAwayBatterStats.playerName.split(' ')[0],
              lastName: bestAwayBatterStats.playerName.split(' ').slice(1).join(' '),
              position: bestAwayBatterStats.position,
              teamId: awayTeam.id,
              teamName: awayTeam.name,
              teamShort: awayTeam.shortName,
              jerseyNumber: 10,
              photo: '',
            } as Player),
          stats: bestAwayBatterStats,
        }
      : undefined;

    const homeTopBatter = bestHomeBatterStats
      ? {
          player:
            this.getPlayerById(bestHomeBatterStats.playerId) ||
            ({
              id: bestHomeBatterStats.playerId,
              fullName: bestHomeBatterStats.playerName,
              firstName: bestHomeBatterStats.playerName.split(' ')[0],
              lastName: bestHomeBatterStats.playerName.split(' ').slice(1).join(' '),
              position: bestHomeBatterStats.position,
              teamId: homeTeam.id,
              teamName: homeTeam.name,
              teamShort: homeTeam.shortName,
              jerseyNumber: 12,
              photo: '',
            } as Player),
          stats: bestHomeBatterStats,
        }
      : undefined;

    const awayTopPitcher = bestAwayPitcherStats
      ? {
          player:
            this.getPlayerById(bestAwayPitcherStats.playerId) ||
            ({
              id: bestAwayPitcherStats.playerId,
              fullName: bestAwayPitcherStats.playerName,
              firstName: bestAwayPitcherStats.playerName.split(' ')[0],
              lastName: bestAwayPitcherStats.playerName.split(' ').slice(1).join(' '),
              position: bestAwayPitcherStats.position as any,
              teamId: awayTeam.id,
              teamName: awayTeam.name,
              teamShort: awayTeam.shortName,
              jerseyNumber: 23,
              photo: '',
            } as Player),
          stats: bestAwayPitcherStats,
        }
      : undefined;

    const homeTopPitcher = bestHomePitcherStats
      ? {
          player:
            this.getPlayerById(bestHomePitcherStats.playerId) ||
            ({
              id: bestHomePitcherStats.playerId,
              fullName: bestHomePitcherStats.playerName,
              firstName: bestHomePitcherStats.playerName.split(' ')[0],
              lastName: bestHomePitcherStats.playerName.split(' ').slice(1).join(' '),
              position: bestHomePitcherStats.position as any,
              teamId: homeTeam.id,
              teamName: homeTeam.name,
              teamShort: homeTeam.shortName,
              jerseyNumber: 34,
              photo: '',
            } as Player),
          stats: bestHomePitcherStats,
        }
      : undefined;

    return {
      game,
      awayTeam,
      homeTeam,
      awayStanding,
      homeStanding,
      awayStats,
      homeStats,
      headToHeadGames,
      awayTopBatter,
      homeTopBatter,
      awayTopPitcher,
      homeTopPitcher,
    };
  }

  // Administrative Mutations
  createGame(data: any): Game {
    const awayTeam = this.getTeamById(data.awayTeamId || (data.awayTeam && data.awayTeam.id) || '') || this.teams[0];
    const homeTeam = this.getTeamById(data.homeTeamId || (data.homeTeam && data.homeTeam.id) || '') || this.teams[1];

    const newGame: Game = {
      id: data.id || 'game_' + Date.now(),
      competitionId: data.competitionId || awayTeam.competitionId,
      seasonId: data.seasonId || 's_2026',
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '14:00',
      status: data.status || 'SCHEDULED',
      stadium: data.stadium || data.venue || homeTeam.stadium,
      homeTeam,
      awayTeam,
      homeScore: data.homeScore || 0,
      awayScore: data.awayScore || 0,
      homeHits: data.homeHits || 0,
      awayHits: data.awayHits || 0,
      homeErrors: data.homeErrors || 0,
      awayErrors: data.awayErrors || 0,
      currentInning: data.currentInning || 1,
      isTopInning: data.isTopInning !== undefined ? data.isTopInning : true,
      outs: data.outs || 0,
      lineScore: data.lineScore || data.inningScores || [],
    };

    this.games.unshift(newGame);
    return newGame;
  }

  updateGame(id: string, updates: any): Game | undefined {
    const index = this.games.findIndex((g) => g.id === id);
    if (index === -1) return undefined;

    const current = this.games[index];
    const updated: Game = {
      ...current,
      ...updates,
      homeTeam: updates.homeTeamId ? (this.getTeamById(updates.homeTeamId) || current.homeTeam) : current.homeTeam,
      awayTeam: updates.awayTeamId ? (this.getTeamById(updates.awayTeamId) || current.awayTeam) : current.awayTeam,
    };

    this.games[index] = updated;
    return updated;
  }

  deleteGame(id: string): boolean {
    const initialLen = this.games.length;
    this.games = this.games.filter((g) => g.id !== id);
    return this.games.length < initialLen;
  }

  createPlayer(data: any): Player {
    const team = this.getTeamById(data.teamId || '') || this.teams[0];
    const firstName = data.firstName || (data.fullName ? data.fullName.split(' ')[0] : 'Nuevo');
    const lastName = data.lastName || (data.fullName ? data.fullName.split(' ').slice(1).join(' ') : 'Jugador');
    const fullName = data.fullName || `${firstName} ${lastName}`;

    const newPlayer: Player = {
      id: data.id || 'p_' + Date.now(),
      fullName,
      firstName,
      lastName,
      slug: data.slug || fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      jerseyNumber: data.jerseyNumber !== undefined ? Number(data.jerseyNumber) : 99,
      position: (data.position as any) || 'OF',
      teamId: team.id,
      teamName: team.name,
      teamShort: team.shortName,
      birthDate: data.birthDate || '1998-05-15',
      age: data.age || 26,
      birthPlace: data.birthPlace || 'Cuba',
      birthCountry: data.birthCountry || 'Cuba',
      height: data.height || '1.85 m',
      weight: data.weight || '88 kg',
      bats: data.bats || 'R',
      throws: data.throws || 'R',
      photo: data.photo || 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=150&auto=format&fit=crop&q=80',
      bio: data.bio || 'Jugador profesional de la Serie Nacional.',
      status: data.status || 'active',
    };

    this.players.unshift(newPlayer);
    return newPlayer;
  }

  updatePlayer(id: string, updates: Partial<Player>): Player | undefined {
    const index = this.players.findIndex((p) => p.id === id);
    if (index === -1) return undefined;

    const current = this.players[index];
    const updated: Player = {
      ...current,
      ...updates,
    };
    if (updates.teamId && updates.teamId !== current.teamId) {
      const team = this.getTeamById(updates.teamId);
      if (team) {
        updated.teamName = team.name;
        updated.teamShort = team.shortName;
      }
    }

    this.players[index] = updated;
    return updated;
  }

  importPlayers(incoming: any[]): { importedCount: number; createdCount: number; updatedCount: number; players: Player[] } {
    const resultPlayers: Player[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const raw of incoming) {
      if (!raw) continue;
      const fullName = (
        raw.fullName ||
        raw.playerName ||
        raw.player ||
        raw.Nombre ||
        raw.nombre ||
        raw.name ||
        raw.jugador ||
        ''
      ).trim();
      if (!fullName) continue;

      const teamQuery = (
        raw.teamId ||
        raw.teamShort ||
        raw.team ||
        raw.Equipo ||
        raw.equipo ||
        raw.team_short ||
        ''
      ).toString().trim().toLowerCase();
      const matchedTeam = this.teams.find(
        (t) =>
          t.id.toLowerCase() === teamQuery ||
          t.shortName.toLowerCase() === teamQuery ||
          t.name.toLowerCase() === teamQuery ||
          t.name.toLowerCase().includes(teamQuery)
      ) || this.teams[0];

      const jerseyNumber = Number(raw.jerseyNumber || raw.jersey || raw.Numero || raw.numero || raw.dorsal || raw.number || 99);
      const position = (raw.position || raw.pos || raw.Posicion || raw.posicion || 'OF').toString().toUpperCase().trim();
      const bats = (raw.bats || raw.Batea || raw.batea || 'R').toString().toUpperCase().trim() as 'R' | 'L' | 'S';
      const throws_ = (raw.throws || raw.Lanza || raw.lanza || 'R').toString().toUpperCase().trim() as 'R' | 'L';
      const photo = raw.photo || raw.Foto || raw.foto || raw.imageUrl || raw.avatar || 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=150&auto=format&fit=crop&q=80';
      const bio = raw.bio || raw.Biografia || raw.biografia || 'Jugador profesional de béisbol.';
      const age = Number(raw.age || raw.Edad || raw.edad || 25);

      // Check if player exists by id or fullName + team
      const existing = this.players.find(
        (p) => (raw.id && p.id === raw.id) || (p.fullName.toLowerCase() === fullName.toLowerCase() && p.teamId === matchedTeam.id)
      );

      if (existing) {
        const updated = this.updatePlayer(existing.id, {
          jerseyNumber,
          position: position as any,
          bats,
          throws: throws_,
          photo,
          bio,
          age,
        });
        if (updated) {
          resultPlayers.push(updated);
          updatedCount++;
        }
      } else {
        const created = this.createPlayer({
          fullName,
          teamId: matchedTeam.id,
          jerseyNumber,
          position: position as any,
          bats,
          throws: throws_,
          photo,
          bio,
          age,
        });
        resultPlayers.push(created);
        createdCount++;
      }
    }

    return {
      importedCount: resultPlayers.length,
      createdCount,
      updatedCount,
      players: resultPlayers,
    };
  }

  deletePlayer(id: string): boolean {
    const initialLen = this.players.length;
    this.players = this.players.filter((p) => p.id !== id);
    return this.players.length < initialLen;
  }

  createNews(data: Partial<NewsArticle>): NewsArticle {
    const title = (data.title || 'Boletin Oficial').trim();
    let baseSlug = data.slug ? generateSeoSlug(data.slug) : generateSeoSlug(title);
    
    // Ensure slug uniqueness
    let finalSlug = baseSlug;
    let counter = 2;
    while (this.news.some((n) => n.slug.toLowerCase() === finalSlug.toLowerCase())) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const newArticle: NewsArticle = {
      id: data.id || 'news_' + Date.now(),
      title,
      slug: finalSlug,
      excerpt: data.excerpt || 'Resumen de la noticia...',
      content: data.content || 'Contenido completo de la noticia oficial.',
      image: data.image || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
      author: data.author || 'Prensa Béisbol Hub',
      publishedAt: data.publishedAt || new Date().toISOString(),
      category: data.category || 'Crónica',
      tags: data.tags || ['Béisbol', 'Liga', 'Oficial'],
    };

    this.news.unshift(newArticle);
    return newArticle;
  }

  deleteNews(id: string): boolean {
    const initialLen = this.news.length;
    this.news = this.news.filter((n) => n.id !== id);
    return this.news.length < initialLen;
  }

  // Comments for Articles (Public community interactions)
  getCommentsByArticle(slug: string): ArticleComment[] {
    const cleanSlug = (slug || '').trim().toLowerCase();
    return this.comments
      .filter((c) => c.articleSlug.toLowerCase() === cleanSlug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addComment(slug: string, data: { authorName?: string; favoriteTeam?: string; content: string }): ArticleComment {
    const authorName = (data.authorName || '').trim() || 'Aficionado al Béisbol';
    const content = (data.content || '').trim();
    const favoriteTeam = (data.favoriteTeam || '').trim() || undefined;

    const newComment: ArticleComment = {
      id: 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      articleSlug: slug.trim().toLowerCase(),
      authorName,
      favoriteTeam,
      content,
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    this.comments.unshift(newComment);
    return newComment;
  }

  deleteComment(id: string): boolean {
    const initialLen = this.comments.length;
    this.comments = this.comments.filter((c) => c.id !== id);
    return this.comments.length < initialLen;
  }

  resetToDefaults(): void {
    this.competitions = [...DEMO_COMPETITIONS];
    this.seasons = [...DEMO_SEASONS];
    this.teams = [...DEMO_TEAMS];
    this.players = [...DEMO_PLAYERS];
    this.games = [...DEMO_GAMES];
    this.battingStats = [...DEMO_BATTING_STATS];
    this.pitchingStats = [...DEMO_PITCHING_STATS];
    this.standings = [...DEMO_STANDINGS];
    this.news = [...DEMO_NEWS];
    this.videos = [...DEMO_VIDEOS];
  }
}

export const baseballRepo = new BaseballRepository();
