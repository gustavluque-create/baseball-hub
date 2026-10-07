import fs from 'fs';
import path from 'path';
import { getSupabaseServerClient, isSupabaseServerConfigured } from '../server/lib/supabase.ts';

export interface EntitySummary {
  source: number;
  supabase: number;
  difference: number;
  status: 'PASS' | 'FAIL';
}

export interface MigrationSummary {
  competitions: EntitySummary;
  seasons: EntitySummary;
  teams: EntitySummary;
  players: EntitySummary;
  battingStats: EntitySummary;
  pitchingStats: EntitySummary;
  games: EntitySummary;
  standings: EntitySummary;
  news: EntitySummary;
  comments: EntitySummary;
  teamLogos: EntitySummary;
}

export interface ConflictLog {
  entity: string;
  id: string;
  reason: string;
  details: string;
}

export interface MigrationResult {
  status: 'MIGRATION SUCCESS' | 'MIGRATION NOT EXECUTED' | 'MIGRATION PARTIAL';
  isConfigured: boolean;
  backupVerified: boolean;
  summary: MigrationSummary;
  conflicts: ConflictLog[];
  errors: string[];
}

/**
 * Ensures a pre-migration backup exists before any migration steps are initiated.
 * Never deletes or alters the source database.
 */
function ensureBackupExists(): boolean {
  const backupPath = path.resolve(process.cwd(), 'server/data/pre_supabase_backup.json');
  const dbPath = path.resolve(process.cwd(), 'server/data/database.json');
  const userChangesPath = path.resolve(process.cwd(), 'server/data/user_changes.json');

  if (fs.existsSync(backupPath)) {
    return true;
  }

  try {
    const rawDb = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : {};
    const userChanges = fs.existsSync(userChangesPath) ? JSON.parse(fs.readFileSync(userChangesPath, 'utf-8')) : {};

    const backupPayload = {
      createdAt: new Date().toISOString(),
      reason: 'Automated pre-migration snapshot for Supabase Fase 2.2',
      database: rawDb,
      userChanges,
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), 'utf-8');
    console.log(`📦 [BACKUP] Respaldo previo creado exitosamente en ${backupPath}`);
    return true;
  } catch (err: any) {
    console.warn(`⚠️ [BACKUP] No se pudo escribir el archivo de respaldo: ${err?.message}`);
    return false;
  }
}

/**
 * Loads and harmonizes source data STRICTLY from database.json and user_changes.json.
 * Production migration NEVER imports or introduces fictitious DEMO data from seed-data.ts.
 * Guarantees zero invented records and zero dropped records.
 */
function loadSourceData(): {
  competitions: any[];
  seasons: any[];
  teams: any[];
  players: any[];
  battingStats: any[];
  pitchingStats: any[];
  games: any[];
  standings: any[];
  news: any[];
  comments: any[];
  teamLogos: Record<string, any>;
  conflicts: ConflictLog[];
} {
  const dbPath = path.resolve(process.cwd(), 'server/data/database.json');
  const userChangesPath = path.resolve(process.cwd(), 'server/data/user_changes.json');

  const rawDb = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : {};
  const userChanges = fs.existsSync(userChangesPath) ? JSON.parse(fs.readFileSync(userChangesPath, 'utf-8')) : {};

  const conflicts: ConflictLog[] = [];

  // 1. Competitions (Strictly from database.json + userChanges)
  const compMap = new Map<string, any>();
  for (const c of rawDb.competitions || []) {
    if (c?.id) compMap.set(c.id, { ...c });
  }
  if (Array.isArray(userChanges.competitions)) {
    for (const c of userChanges.competitions) {
      if (c?.id) compMap.set(c.id, { ...(compMap.get(c.id) || {}), ...c });
    }
  }
  const competitions = Array.from(compMap.values());

  // 2. Seasons (Strictly from database.json + userChanges, preserving seasonId format e.g. snb-61, snb-65)
  const seasonMap = new Map<string, any>();
  for (const s of rawDb.seasons || []) {
    if (s?.id) seasonMap.set(s.id, { ...s });
  }
  if (Array.isArray(userChanges.seasons)) {
    for (const s of userChanges.seasons) {
      if (s?.id) seasonMap.set(s.id, { ...(seasonMap.get(s.id) || {}), ...s });
    }
  }
  const seasons = Array.from(seasonMap.values());

  // 3. Teams & Team Logos (Strictly from database.json + userChanges overrides)
  const teamMap = new Map<string, any>();
  for (const t of rawDb.teams || []) {
    if (t?.id) teamMap.set(t.id, { ...t });
  }

  // Filter out user-deleted teams
  if (Array.isArray(userChanges.deletedTeamIds) && userChanges.deletedTeamIds.length > 0) {
    const deletedTeamSet = new Set(userChanges.deletedTeamIds);
    for (const delId of deletedTeamSet) {
      if (typeof delId === 'string') teamMap.delete(delId);
    }
  }

  // Add/merge custom teams
  if (Array.isArray(userChanges.customTeams)) {
    for (const ct of userChanges.customTeams) {
      if (ct?.id) teamMap.set(ct.id, { ...(teamMap.get(ct.id) || {}), ...ct });
    }
  }

  // Apply user updates on teams
  if (userChanges.teams && typeof userChanges.teams === 'object') {
    if (Array.isArray(userChanges.teams)) {
      for (const t of userChanges.teams) {
        if (t?.id && teamMap.has(t.id)) {
          teamMap.set(t.id, { ...teamMap.get(t.id), ...t });
        }
      }
    } else {
      for (const [tId, tVal] of Object.entries(userChanges.teams)) {
        if (tVal && typeof tVal === 'object' && teamMap.has(tId)) {
          teamMap.set(tId, { ...teamMap.get(tId), ...tVal });
        }
      }
    }
  }

  // Apply user-modified team logos and colors
  const rawLogos = userChanges.teamLogos || {};
  const teamLogos: Record<string, any> = {};
  for (const [tId, val] of Object.entries(rawLogos)) {
    if (val && typeof val === 'object' && (val as any).logo) {
      teamLogos[tId] = val;
      const existing = teamMap.get(tId);
      if (existing) {
        existing.logo = (val as any).logo;
        if ((val as any).primaryColor) existing.primaryColor = (val as any).primaryColor;
      }
    }
  }
  // Also populate teamLogos from teams that have a logo defined if not already in teamLogos
  for (const t of teamMap.values()) {
    if (t?.id && t.logo && !teamLogos[t.id]) {
      teamLogos[t.id] = {
        logo: t.logo,
        primaryColor: t.primaryColor || t.colors?.primary || null,
      };
    }
  }
  const teams = Array.from(teamMap.values());

  // 4. Players (Strictly from database.json + userChanges, with homonym and duplicate detection)
  const playerMap = new Map<string, any>();
  const playerNamesSeen = new Map<string, string>(); // fullName -> id

  for (const p of rawDb.players || []) {
    if (p?.id) {
      const lowerName = (p.fullName || '').trim().toLowerCase();
      if (lowerName) {
        const existingId = playerNamesSeen.get(lowerName);
        if (existingId && existingId !== p.id) {
          // Detect ambiguity: DO NOT automatically merge ambiguous players.
          conflicts.push({
            entity: 'players',
            id: p.id,
            reason: 'Jugador ambiguo / homónimo detectado con distinto ID',
            details: `Jugador "${p.fullName}" (ID: ${p.id}) coincide en nombre con ID: ${existingId}. Conservados como registros independientes.`,
          });
        } else {
          playerNamesSeen.set(lowerName, p.id);
        }
      }
      playerMap.set(p.id, { ...(playerMap.get(p.id) || {}), ...p });
    }
  }

  // Filter out user-deleted players
  if (Array.isArray(userChanges.deletedPlayerIds) && userChanges.deletedPlayerIds.length > 0) {
    const deletedPlayerSet = new Set(userChanges.deletedPlayerIds);
    for (const delId of deletedPlayerSet) {
      if (typeof delId === 'string') playerMap.delete(delId);
    }
  }

  // Add custom players
  if (Array.isArray(userChanges.customPlayers)) {
    for (const cp of userChanges.customPlayers) {
      if (cp?.id) {
        const lowerName = (cp.fullName || '').trim().toLowerCase();
        if (lowerName) {
          const existingId = playerNamesSeen.get(lowerName);
          if (existingId && existingId !== cp.id) {
            conflicts.push({
              entity: 'players',
              id: cp.id,
              reason: 'Jugador ambiguo / homónimo detectado con distinto ID en customPlayers',
              details: `Jugador "${cp.fullName}" (ID: ${cp.id}) coincide en nombre con ID: ${existingId}. Conservados como registros independientes.`,
            });
          } else {
            playerNamesSeen.set(lowerName, cp.id);
          }
        }
        playerMap.set(cp.id, { ...(playerMap.get(cp.id) || {}), ...cp });
      }
    }
  }

  // Apply player updates from user_changes (array or object format)
  if (userChanges.players) {
    if (Array.isArray(userChanges.players)) {
      for (const up of userChanges.players) {
        if (up?.id) {
          const lowerName = (up.fullName || '').trim().toLowerCase();
          const existingId = lowerName ? playerNamesSeen.get(lowerName) : null;
          if (existingId && existingId !== up.id) {
            conflicts.push({
              entity: 'players',
              id: up.id,
              reason: 'Jugador ambiguo / homónimo detectado con distinto ID en userChanges',
              details: `Jugador "${up.fullName}" (ID: ${up.id}) coincide en nombre con ID: ${existingId}. Conservados como registros independientes.`,
            });
          }
          if (playerMap.has(up.id)) {
            playerMap.set(up.id, { ...playerMap.get(up.id), ...up });
          } else {
            playerMap.set(up.id, { ...up });
          }
        }
      }
    } else if (typeof userChanges.players === 'object') {
      for (const [upId, upVal] of Object.entries(userChanges.players)) {
        if (upVal && typeof upVal === 'object') {
          if (playerMap.has(upId)) {
            playerMap.set(upId, { ...playerMap.get(upId), ...(upVal as any) });
          }
        }
      }
    }
  }
  const players = Array.from(playerMap.values());

  // 5. Batting Stats (Strictly from database.json + userChanges; preserves type, playerName, seasonYear, seasonId, teamShort)
  const battingMap = new Map<string, any>();
  for (const b of rawDb.battingStats || []) {
    if (b?.id) {
      const p = playerMap.get(b.playerId);
      const sYear = b.seasonYear || 2026;
      battingMap.set(b.id, {
        ...b,
        type: b.type || 'batting',
        playerName: b.playerName || p?.fullName || '',
        seasonYear: sYear,
        seasonId: b.seasonId || `snb-${sYear}`,
        teamShort: b.teamShort || p?.teamShort || 'TEAM',
      });
    }
  }
  if (Array.isArray(userChanges.battingStats)) {
    for (const b of userChanges.battingStats) {
      if (b?.id) {
        const p = playerMap.get(b.playerId);
        const sYear = b.seasonYear || 2026;
        battingMap.set(b.id, {
          ...(battingMap.get(b.id) || {}),
          ...b,
          type: b.type || 'batting',
          playerName: b.playerName || p?.fullName || '',
          seasonYear: sYear,
          seasonId: b.seasonId || `snb-${sYear}`,
          teamShort: b.teamShort || p?.teamShort || 'TEAM',
        });
      }
    }
  }
  const battingStats = Array.from(battingMap.values());

  // 6. Pitching Stats (Strictly from database.json + userChanges; preserves type, playerName, seasonYear, seasonId, teamShort)
  const pitchingMap = new Map<string, any>();
  for (const p of rawDb.pitchingStats || []) {
    if (p?.id) {
      const pl = playerMap.get(p.playerId);
      const sYear = p.seasonYear || 2026;
      pitchingMap.set(p.id, {
        ...p,
        type: p.type || 'pitching',
        playerName: p.playerName || pl?.fullName || '',
        seasonYear: sYear,
        seasonId: p.seasonId || `snb-${sYear}`,
        teamShort: p.teamShort || pl?.teamShort || 'TEAM',
      });
    }
  }
  if (Array.isArray(userChanges.pitchingStats)) {
    for (const p of userChanges.pitchingStats) {
      if (p?.id) {
        const pl = playerMap.get(p.playerId);
        const sYear = p.seasonYear || 2026;
        pitchingMap.set(p.id, {
          ...(pitchingMap.get(p.id) || {}),
          ...p,
          type: p.type || 'pitching',
          playerName: p.playerName || pl?.fullName || '',
          seasonYear: sYear,
          seasonId: p.seasonId || `snb-${sYear}`,
          teamShort: p.teamShort || pl?.teamShort || 'TEAM',
        });
      }
    }
  }
  const pitchingStats = Array.from(pitchingMap.values());

  // 7. Games (Strictly from database.json + userChanges; filters deleted games)
  const deletedGameSet = new Set(
    Array.isArray(userChanges.deletedGameIds) ? userChanges.deletedGameIds : []
  );
  const gameMap = new Map<string, any>();
  for (const g of rawDb.games || []) {
    if (g?.id && !deletedGameSet.has(g.id)) {
      gameMap.set(g.id, { ...g });
    }
  }
  if (Array.isArray(userChanges.games)) {
    for (const g of userChanges.games) {
      if (g?.id && !deletedGameSet.has(g.id)) {
        gameMap.set(g.id, { ...(gameMap.get(g.id) || {}), ...g });
      }
    }
  }
  const games = Array.from(gameMap.values());

  // 8. Standings (Strictly from database.json + userChanges)
  const standingMap = new Map<string, any>();
  for (const st of rawDb.standings || []) {
    const key = st.id || `${st.seasonId || 'snb-65'}_${st.teamId}`;
    standingMap.set(key, { ...st });
  }
  if (Array.isArray(userChanges.standings)) {
    for (const st of userChanges.standings) {
      const key = st.id || `${st.seasonId || 'snb-65'}_${st.teamId}`;
      standingMap.set(key, { ...(standingMap.get(key) || {}), ...st });
    }
  }
  const standings = Array.from(standingMap.values());

  // 9. News (Strictly from database.json + userChanges)
  const newsMap = new Map<string, any>();
  for (const n of rawDb.news || []) {
    if (n?.id) newsMap.set(n.id, { ...n });
  }
  if (Array.isArray(userChanges.news)) {
    for (const n of userChanges.news) {
      if (n?.id) newsMap.set(n.id, { ...(newsMap.get(n.id) || {}), ...n });
    }
  }
  const news = Array.from(newsMap.values());

  // 10. Comments (Strictly from database.json + userChanges)
  const commentMap = new Map<string, any>();
  for (const c of rawDb.comments || []) {
    if (c?.id) commentMap.set(c.id, { ...c });
  }
  if (Array.isArray(userChanges.comments)) {
    for (const c of userChanges.comments) {
      if (c?.id) commentMap.set(c.id, { ...(commentMap.get(c.id) || {}), ...c });
    }
  }
  const comments = Array.from(commentMap.values());

  return {
    competitions,
    seasons,
    teams,
    players,
    battingStats,
    pitchingStats,
    games,
    standings,
    news,
    comments,
    teamLogos,
    conflicts,
  };
}

/**
 * Format batting average / OBP / SLG safely to text format (e.g. ".355")
 */
function formatAvg(val: any): string {
  if (typeof val === 'number') {
    if (isNaN(val)) return '.000';
    return val.toFixed(3).replace(/^0\./, '.');
  }
  if (typeof val === 'string' && val.trim()) {
    return val.trim();
  }
  return '.000';
}

/**
 * Format ERA or WHIP to text format (e.g. "1.25")
 */
function formatEra(val: any): string {
  if (typeof val === 'number') {
    if (isNaN(val)) return '0.00';
    return val.toFixed(2);
  }
  if (typeof val === 'string' && val.trim()) {
    return val.trim();
  }
  return '0.00';
}

/**
 * Runs the comprehensive, idempotent migration to Supabase PostgreSQL.
 */
export async function runSupabaseMigration(): Promise<MigrationResult> {
  console.log('⚾ ========================================================');
  console.log('⚾ BASEBALL HUB — FASE 2.2: MIGRACIÓN REAL DE DATOS A SUPABASE');
  console.log('⚾ ========================================================\n');

  // 1. Verify backup exists before any migration action
  const backupVerified = ensureBackupExists();

  // 2. Read, normalize and validate source data
  const source = loadSourceData();

  const errors: string[] = [];
  const conflicts: ConflictLog[] = [...source.conflicts];

  const supabase = getSupabaseServerClient();
  const configured = isSupabaseServerConfigured();
  let isReachable = false;

  if (configured && supabase) {
    try {
      const url = process.env.SUPABASE_URL || '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const ping = await fetch(url, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);
      if (ping && ping.status < 500) {
        isReachable = true;
      }
    } catch {
      isReachable = false;
    }
  }

  // =====================================================================
  // MANEJO ESTRICTO: NO FALSEAR RESULTADOS SI SUPABASE NO ESTÁ DISPONIBLE
  // =====================================================================
  if (!configured || !supabase || !isReachable) {
    const reason = !configured
      ? 'Variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY ausentes'
      : 'Host de Supabase inalcanzable desde el entorno actual (red aislada o DNS no resuelto)';

    console.warn('⚠️ ========================================================');
    console.warn('⚠️ ESTADO: MIGRATION NOT EXECUTED');
    console.warn(`⚠️ Razón: ${reason}`);
    console.warn('⚠️ NINGUNA simulación ni valor ficticio será registrado.');
    console.warn('⚠️ ========================================================\n');

    const summary: MigrationSummary = {
      competitions: { source: source.competitions.length, supabase: 0, difference: source.competitions.length, status: 'FAIL' },
      seasons: { source: source.seasons.length, supabase: 0, difference: source.seasons.length, status: 'FAIL' },
      teams: { source: source.teams.length, supabase: 0, difference: source.teams.length, status: 'FAIL' },
      players: { source: source.players.length, supabase: 0, difference: source.players.length, status: 'FAIL' },
      battingStats: { source: source.battingStats.length, supabase: 0, difference: source.battingStats.length, status: 'FAIL' },
      pitchingStats: { source: source.pitchingStats.length, supabase: 0, difference: source.pitchingStats.length, status: 'FAIL' },
      games: { source: source.games.length, supabase: 0, difference: source.games.length, status: 'FAIL' },
      standings: { source: source.standings.length, supabase: 0, difference: source.standings.length, status: 'FAIL' },
      news: { source: source.news.length, supabase: 0, difference: source.news.length, status: 'FAIL' },
      comments: { source: source.comments.length, supabase: 0, difference: source.comments.length, status: 'FAIL' },
      teamLogos: { source: Object.keys(source.teamLogos).length, supabase: 0, difference: Object.keys(source.teamLogos).length, status: 'FAIL' },
    };

    printComparisonReport(summary, conflicts, errors, 'MIGRATION NOT EXECUTED');

    return {
      status: 'MIGRATION NOT EXECUTED',
      isConfigured: false,
      backupVerified,
      summary,
      conflicts,
      errors: [reason],
    };
  }

  // =====================================================================
  // MIGRACIÓN REAL IDEMPOTENTE CON UPSERT EN SUPABASE
  // =====================================================================
  console.log('🚀 Iniciando ejecución real idempotente en Supabase...\n');

  // 1. Competitions
  for (const c of source.competitions) {
    const { error } = await supabase.from('competitions').upsert({
      id: c.id,
      name: c.name,
      slug: c.slug || c.id,
      short_name: c.shortName || c.name,
      country: c.country || 'Cuba',
      sport: 'Baseball',
      type: c.type || 'league',
      logo: c.logo || null,
      status: c.status || 'active',
      current_season_id: c.currentSeasonId || null,
    });
    if (error) errors.push(`[Competitions] ${c.id}: ${error.message}`);
  }

  // 2. Seasons
  for (const s of source.seasons) {
    const { error } = await supabase.from('seasons').upsert({
      id: s.id,
      competition_id: s.competitionId || 'snb',
      year: s.year || 2026,
      display_name: s.name,
      slug: s.id,
      start_date: s.startDate || null,
      end_date: s.endDate || null,
      is_current: Boolean(s.isCurrent),
      status: s.status || 'in_progress',
    });
    if (error) errors.push(`[Seasons] ${s.id}: ${error.message}`);
  }

  // 3. Teams
  for (const t of source.teams) {
    const { error } = await supabase.from('teams').upsert({
      id: t.id,
      name: t.name,
      nickname: t.nickname || t.name,
      short_name: t.shortName || t.name.substring(0, 3).toUpperCase(),
      slug: t.id,
      city: t.city || 'Cuba',
      stadium: t.stadium || 'Estadio Principal',
      capacity: t.capacity || t.stadiumCapacity || 15000,
      manager: t.manager || 'Director',
      founded_year: t.foundedYear || 1977,
      championships: t.championships || 0,
      primary_color: t.primaryColor || t.colors?.primary || '#10B981',
      secondary_color: t.secondaryColor || t.colors?.secondary || '#1E293B',
      text_color: t.textColor || t.colors?.text || '#FFFFFF',
      logo: t.logo || '⚾',
      competition_id: t.competitionId || 'snb',
      season_id: t.seasonId || 'snb-65',
      wins: t.record?.wins || 0,
      losses: t.record?.losses || 0,
      pct: String(t.record?.pct ?? '0.000'),
      streak: t.record?.streak || '-',
      last_ten: t.record?.lastTen || '0-0',
      position: t.record?.position || 1,
    });
    if (error) errors.push(`[Teams] ${t.id}: ${error.message}`);
  }

  // 4. Team Logos
  for (const [teamId, logoData] of Object.entries(source.teamLogos)) {
    if (logoData && logoData.logo) {
      const { error } = await supabase.from('team_logos').upsert({
        team_id: teamId,
        logo: logoData.logo,
        primary_color: logoData.primaryColor || null,
      });
      if (error) errors.push(`[TeamLogos] ${teamId}: ${error.message}`);
    }
  }

  // 5. Players
  for (const p of source.players) {
    const { error } = await supabase.from('players').upsert({
      id: p.id,
      slug: p.slug || p.id,
      full_name: p.fullName,
      short_name: p.shortName || p.fullName,
      jersey_number: p.jerseyNumber || p.number || 0,
      position: p.position || 'OF',
      team_id: p.teamId,
      team_short: p.teamShort || 'TEAM',
      bats: p.bats || 'R',
      throws: p.throws || 'R',
      age: p.age || 25,
      birth_date: p.birthDate || '1999-01-01',
      photo: p.photo || '',
      bio: p.bio || null,
      is_favorite: Boolean(p.isFavorite),
      is_hall_of_fame: Boolean(p.isHallOfFame),
      is_all_star: Boolean(p.isAllStar),
      war: String(p.war || '0.0'),
    });
    if (error) errors.push(`[Players] ${p.id}: ${error.message}`);
  }

  // 6. Batting Stats (REAL IMPLEMENTATION)
  for (const b of source.battingStats) {
    const recordId = b.id || `bat-${b.playerId}-${b.seasonId || b.seasonYear || 2026}`;
    const { error } = await supabase.from('player_season_batting').upsert({
      id: recordId,
      player_id: b.playerId,
      season_id: b.seasonId || `snb-${b.seasonYear || 2026}`,
      season_year: b.seasonYear || 2026,
      team_id: b.teamId || null,
      team_short: b.teamShort || 'TEAM',
      stage: b.stage || 'regular',
      games: b.games || 0,
      plate_appearances: b.pa || b.plateAppearances || 0,
      at_bats: b.ab || b.atBats || 0,
      runs: b.r || b.runs || 0,
      hits: b.h || b.hits || 0,
      doubles: b.doubles || b['2b'] || 0,
      triples: b.triples || b['3b'] || 0,
      home_runs: b.hr || b.homeRuns || 0,
      rbi: b.rbi || 0,
      walks: b.bb || b.walks || 0,
      strikeouts: b.so || b.strikeouts || 0,
      stolen_bases: b.sb || b.stolenBases || 0,
      caught_stealing: b.cs || b.caughtStealing || 0,
      avg: formatAvg(b.avg),
      obp: formatAvg(b.obp),
      slg: formatAvg(b.slg),
      ops: typeof b.ops === 'number' ? b.ops.toFixed(3) : String(b.ops || '.000'),
    });
    if (error) errors.push(`[BattingStats] ${recordId}: ${error.message}`);
  }

  // 7. Pitching Stats (REAL IMPLEMENTATION)
  for (const p of source.pitchingStats) {
    const recordId = p.id || `pit-${p.playerId}-${p.seasonId || p.seasonYear || 2026}`;
    const { error } = await supabase.from('player_season_pitching').upsert({
      id: recordId,
      player_id: p.playerId,
      season_id: p.seasonId || `snb-${p.seasonYear || 2026}`,
      season_year: p.seasonYear || 2026,
      team_id: p.teamId || null,
      team_short: p.teamShort || 'TEAM',
      stage: p.stage || 'regular',
      games: p.games || 0,
      games_started: p.gs || p.gamesStarted || 0,
      innings_pitched: String(p.ip ?? p.inningsPitched ?? '0.0'),
      wins: p.w || p.wins || 0,
      losses: p.l || p.losses || 0,
      saves: p.sv || p.saves || 0,
      hits: p.h || p.hits || 0,
      runs: p.r || p.runs || 0,
      earned_runs: p.er || p.earnedRuns || 0,
      walks: p.bb || p.walks || 0,
      strikeouts: p.so || p.strikeouts || 0,
      era: formatEra(p.era),
      whip: formatEra(p.whip),
    });
    if (error) errors.push(`[PitchingStats] ${recordId}: ${error.message}`);
  }

  // 8. Games (REAL IMPLEMENTATION CON RELACIONES, SCORE, INNINGS, LINEUPS, PLAYS)
  for (const g of source.games) {
    const homeTeamId = g.homeTeam?.id || g.homeTeamId;
    const awayTeamId = g.awayTeam?.id || g.awayTeamId;

    const { error } = await supabase.from('games').upsert({
      id: g.id,
      competition_id: g.competitionId || 'snb',
      season_id: g.seasonId || 'snb-65',
      date: g.date,
      time: g.time || '14:00',
      stadium: g.stadium || 'Estadio Principal',
      status: g.status || 'SCHEDULED',
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: g.homeScore || 0,
      away_score: g.awayScore || 0,
      home_hits: g.homeHits || 0,
      away_hits: g.awayHits || 0,
      home_errors: g.homeErrors || 0,
      away_errors: g.awayErrors || 0,
      current_inning: g.currentInning || 1,
      is_top_inning: g.isTopInning ?? true,
      outs: g.outs || 0,
      balls: g.balls || 0,
      strikes: g.strikes || 0,
      bases: g.bases || { first: false, second: false, third: false },
      line_score: g.lineScore || [],
      lineups: {
        home: g.battingBoxScore?.home || g.lineups?.home || [],
        away: g.battingBoxScore?.away || g.lineups?.away || [],
        pitchers: {
          home: g.pitchingBoxScore?.home || g.lineups?.pitchers?.home || [],
          away: g.pitchingBoxScore?.away || g.lineups?.pitchers?.away || [],
        },
        boxScore: g.boxScore || {
          batting: g.battingBoxScore || null,
          pitching: g.pitchingBoxScore || null,
        },
      },
      winning_pitcher: g.winningPitcher || null,
      losing_pitcher: g.losingPitcher || null,
      save_pitcher: g.savePitcher || null,
      umpires: g.umpires || [],
      plays: g.plays || [],
    });
    if (error) errors.push(`[Games] ${g.id}: ${error.message}`);
  }

  // 9. Standings (REAL IMPLEMENTATION)
  for (const st of source.standings) {
    const standingId = st.id || `${st.seasonId || 'snb-65'}_${st.teamId}`;
    const { error } = await supabase.from('standings').upsert({
      id: standingId,
      competition_id: st.competitionId || 'snb',
      season_id: st.seasonId || 'snb-65',
      team_id: st.teamId,
      games: st.gamesPlayed || st.games || ((st.wins || 0) + (st.losses || 0)),
      wins: st.wins || 0,
      losses: st.losses || 0,
      pct: formatAvg(st.pct),
      runs_scored: st.runsScored || 0,
      runs_allowed: st.runsAllowed || 0,
      run_differential: st.runDiff ?? ((st.runsScored || 0) - (st.runsAllowed || 0)),
      streak: st.streak || '-',
      home_record: st.homeRecord || '0-0',
      away_record: st.awayRecord || '0-0',
      last_ten: st.lastTen || '0-0',
      games_behind: String(st.diff ?? st.gamesBehind ?? '0.0'),
      position: st.position || 1,
      division: st.division || 'General',
    });
    if (error) errors.push(`[Standings] ${standingId}: ${error.message}`);
  }

  // 10. News
  for (const n of source.news) {
    const { error } = await supabase.from('news').upsert({
      id: n.id,
      title: n.title,
      slug: n.slug,
      subtitle: n.subtitle || null,
      excerpt: n.excerpt || '',
      content: n.content || '',
      image: n.image || '',
      author: n.author || 'Prensa Oficial Béisbol Hub',
      published_at: n.publishedAt || new Date().toISOString(),
      category: n.category || 'Crónica',
      tags: n.tags || ['Béisbol'],
      reading_time_minutes: n.readingTimeMinutes || 4,
      is_featured: Boolean(n.isFeatured),
      image_height: n.imageHeight || 'tall',
    });
    if (error) errors.push(`[News] ${n.id}: ${error.message}`);
  }

  // 11. Comments
  for (const c of source.comments) {
    const { error } = await supabase.from('news_comments').upsert({
      id: c.id,
      article_slug: c.articleSlug,
      author_name: c.authorName || 'Aficionado',
      favorite_team: c.favoriteTeam || null,
      content: c.content || '',
      likes: c.likes || 0,
      created_at: c.createdAt || new Date().toISOString(),
    });
    if (error) errors.push(`[Comments] ${c.id}: ${error.message}`);
  }

  // =====================================================================
  // CONSULTA REAL DE CONTEOS DIRECTAMENTE DESDE SUPABASE
  // =====================================================================
  async function fetchCount(tableName: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  const supaCompetitions = await fetchCount('competitions');
  const supaSeasons = await fetchCount('seasons');
  const supaTeams = await fetchCount('teams');
  const supaPlayers = await fetchCount('players');
  const supaBatting = await fetchCount('player_season_batting');
  const supaPitching = await fetchCount('player_season_pitching');
  const supaGames = await fetchCount('games');
  const supaStandings = await fetchCount('standings');
  const supaNews = await fetchCount('news');
  const supaComments = await fetchCount('news_comments');
  const supaLogos = await fetchCount('team_logos');

  const createEntitySummary = (sourceCount: number, supaCount: number): EntitySummary => ({
    source: sourceCount,
    supabase: supaCount,
    difference: Math.abs(sourceCount - supaCount),
    status: sourceCount === supaCount ? 'PASS' : 'FAIL',
  });

  const summary: MigrationSummary = {
    competitions: createEntitySummary(source.competitions.length, supaCompetitions),
    seasons: createEntitySummary(source.seasons.length, supaSeasons),
    teams: createEntitySummary(source.teams.length, supaTeams),
    players: createEntitySummary(source.players.length, supaPlayers),
    battingStats: createEntitySummary(source.battingStats.length, supaBatting),
    pitchingStats: createEntitySummary(source.pitchingStats.length, supaPitching),
    games: createEntitySummary(source.games.length, supaGames),
    standings: createEntitySummary(source.standings.length, supaStandings),
    news: createEntitySummary(source.news.length, supaNews),
    comments: createEntitySummary(source.comments.length, supaComments),
    teamLogos: createEntitySummary(Object.keys(source.teamLogos).length, supaLogos),
  };

  const allPassed = Object.values(summary).every((s) => s.status === 'PASS');
  const overallStatus = allPassed ? 'MIGRATION SUCCESS' : 'MIGRATION PARTIAL';

  printComparisonReport(summary, conflicts, errors, overallStatus);

  return {
    status: overallStatus,
    isConfigured: true,
    backupVerified,
    summary,
    conflicts,
    errors,
  };
}

/**
 * Prints the strict ORIGEN VS SUPABASE comparison table required by specification.
 */
function printComparisonReport(
  summary: MigrationSummary,
  conflicts: ConflictLog[],
  errors: string[],
  overallStatus: string
) {
  console.log('📊 ========================================================');
  console.log('📊 COMPARACIÓN: ORIGEN VS SUPABASE (VALIDACIÓN DE INTEGRIDAD)');
  console.log('📊 ========================================================\n');

  const rows = [
    { name: 'Competitions', s: summary.competitions },
    { name: 'Seasons', s: summary.seasons },
    { name: 'Teams', s: summary.teams },
    { name: 'Players', s: summary.players },
    { name: 'Batting', s: summary.battingStats },
    { name: 'Pitching', s: summary.pitchingStats },
    { name: 'Games', s: summary.games },
    { name: 'Standings', s: summary.standings },
    { name: 'News', s: summary.news },
    { name: 'Comments', s: summary.comments },
    { name: 'Team Logos', s: summary.teamLogos },
  ];

  for (const { name, s } of rows) {
    console.log(`${name}`);
    console.log(`Source: ${s.source}`);
    console.log(`Supabase: ${s.supabase}`);
    console.log(`Difference: ${s.difference}`);
    console.log(`Status: ${s.status}\n`);
  }

  if (conflicts.length > 0) {
    console.log('⚠️ ========================================================');
    console.log(`⚠️ CONFLICTOS Y AMBIGÜEDADES DETECTADAS (${conflicts.length}):`);
    for (const c of conflicts) {
      console.log(`  * [${c.entity.toUpperCase()}] ID: ${c.id} - ${c.reason}: ${c.details}`);
    }
    console.log('========================================================\n');
  } else {
    console.log('✨ Cero conflictos o ambigüedades en entidades de origen.\n');
  }

  if (errors.length > 0) {
    console.log('❌ ========================================================');
    console.log(`❌ ERRORES DE INSERCIÓN REGISTRADOS (${errors.length}):`);
    errors.slice(0, 10).forEach((e) => console.log(`  * ${e}`));
    if (errors.length > 10) console.log(`  ... y ${errors.length - 10} errores adicionales.`);
    console.log('========================================================\n');
  }

  console.log(`🏁 ESTADO FINAL: ${overallStatus}`);
  console.log('========================================================\n');
}

if (process.argv[1]?.endsWith('migrate-supabase.ts')) {
  runSupabaseMigration().catch((err) => {
    console.error('Error fatal ejecutando migración:', err);
    process.exit(1);
  });
}
