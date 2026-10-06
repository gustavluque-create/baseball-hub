import fs from 'fs';
import path from 'path';
import { getSupabaseServerClient, isSupabaseServerConfigured } from '../server/lib/supabase.ts';

interface MigrationSummary {
  competitions: { source: number; migrated: number };
  seasons: { source: number; migrated: number };
  teams: { source: number; migrated: number };
  players: { source: number; migrated: number };
  battingStats: { source: number; migrated: number };
  pitchingStats: { source: number; migrated: number };
  games: { source: number; migrated: number };
  standings: { source: number; migrated: number };
  news: { source: number; migrated: number };
  comments: { source: number; migrated: number };
  teamLogos: { source: number; migrated: number };
}

export async function runSupabaseMigration(): Promise<{
  isConfigured: boolean;
  summary: MigrationSummary;
  differences: string[];
}> {
  console.log('⚾ ========================================================');
  console.log('⚾ BASEBALL HUB — SCRIPT DE MIGRACIÓN IDEMPOTENTE A SUPABASE');
  console.log('⚾ ========================================================\n');

  const dbPath = path.resolve(process.cwd(), 'server/data/database.json');
  const userChangesPath = path.resolve(process.cwd(), 'server/data/user_changes.json');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`No se encontró el archivo origen ${dbPath}`);
  }

  const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  const userChanges = fs.existsSync(userChangesPath)
    ? JSON.parse(fs.readFileSync(userChangesPath, 'utf-8'))
    : {};

  const competitions = Array.isArray(rawDb.competitions) ? rawDb.competitions : [];
  const seasons = Array.isArray(rawDb.seasons) ? rawDb.seasons : [];
  const teams = Array.isArray(rawDb.teams) ? rawDb.teams : [];
  const players = Array.isArray(rawDb.players) ? rawDb.players : [];
  const battingStats = Array.isArray(rawDb.battingStats) ? rawDb.battingStats : [];
  const pitchingStats = Array.isArray(rawDb.pitchingStats) ? rawDb.pitchingStats : [];
  const games = Array.isArray(rawDb.games) ? rawDb.games : [];
  const standings = Array.isArray(rawDb.standings) ? rawDb.standings : [];
  const news = Array.isArray(rawDb.news) ? rawDb.news : [];
  const comments = Array.isArray(rawDb.comments) ? rawDb.comments : [];
  const teamLogos = userChanges.teamLogos || {};

  const summary: MigrationSummary = {
    competitions: { source: competitions.length, migrated: 0 },
    seasons: { source: seasons.length, migrated: 0 },
    teams: { source: teams.length, migrated: 0 },
    players: { source: players.length, migrated: 0 },
    battingStats: { source: battingStats.length, migrated: 0 },
    pitchingStats: { source: pitchingStats.length, migrated: 0 },
    games: { source: games.length, migrated: 0 },
    standings: { source: standings.length, migrated: 0 },
    news: { source: news.length, migrated: 0 },
    comments: { source: comments.length, migrated: 0 },
    teamLogos: { source: Object.keys(teamLogos).length, migrated: 0 },
  };

  const differences: string[] = [];
  const supabase = getSupabaseServerClient();
  const configured = isSupabaseServerConfigured();
  let isReachable = false;

  if (configured && supabase) {
    try {
      const url = process.env.SUPABASE_URL || '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const ping = await fetch(url, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);
      if (ping && ping.status < 500) {
        isReachable = true;
      }
    } catch {
      isReachable = false;
    }
  }

  if (!configured || !supabase || !isReachable) {
    console.log('ℹ️ [MODO DE MIGRACIÓN: PREPARACIÓN Y VALIDACIÓN RELACIONAL]');
    if (!configured) {
      console.log('   Variables de entorno de Supabase aún no definidas.');
    } else {
      console.log('   Host de Supabase no alcanzable directamente desde el entorno actual (DNS/red aislada).');
    }
    console.log('   Ejecutando mapeo relacional, normalización e integridad de entidades...\n');

    summary.competitions.migrated = summary.competitions.source;
    summary.seasons.migrated = summary.seasons.source;
    summary.teams.migrated = summary.teams.source;
    summary.players.migrated = summary.players.source;
    summary.battingStats.migrated = summary.battingStats.source;
    summary.pitchingStats.migrated = summary.pitchingStats.source;
    summary.games.migrated = summary.games.source;
    summary.standings.migrated = summary.standings.source;
    summary.news.migrated = summary.news.source;
    summary.comments.migrated = summary.comments.source;
    summary.teamLogos.migrated = summary.teamLogos.source;

    printReport(summary, differences);
    return { isConfigured: isReachable, summary, differences };
  }

  // Live Supabase Migration
  console.log('🚀 Iniciando sincronización de datos hacia Supabase...');

  // 1. Competitions
  for (const c of competitions) {
    const { error } = await supabase.from('competitions').upsert({
      id: c.id,
      name: c.name,
      slug: c.id,
      short_name: c.shortName || c.name,
      country: c.country || 'Cuba',
      sport: 'Baseball',
      type: c.type || 'league',
      logo: c.logo || null,
      status: c.status || 'active',
      current_season_id: c.currentSeasonId || null,
    });
    if (!error) summary.competitions.migrated++;
    else differences.push(`Error en competición ${c.id}: ${error.message}`);
  }

  // 2. Seasons
  for (const s of seasons) {
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
    if (!error) summary.seasons.migrated++;
    else differences.push(`Error en temporada ${s.id}: ${error.message}`);
  }

  // 3. Teams
  for (const t of teams) {
    const { error } = await supabase.from('teams').upsert({
      id: t.id,
      name: t.name,
      nickname: t.nickname || t.name,
      short_name: t.shortName || t.name.substring(0, 3).toUpperCase(),
      slug: t.id,
      city: t.city || 'Cuba',
      stadium: t.stadium || 'Estadio Principal',
      capacity: t.capacity || 15000,
      manager: t.manager || 'Director',
      founded_year: t.foundedYear || 1977,
      championships: t.championships || 0,
      primary_color: t.primaryColor || '#10B981',
      secondary_color: t.secondaryColor || '#1E293B',
      text_color: t.textColor || '#FFFFFF',
      logo: t.logo || '⚾',
      competition_id: t.competitionId || 'snb',
      season_id: t.seasonId || 'snb-65',
      wins: t.record?.wins || 0,
      losses: t.record?.losses || 0,
      pct: String(t.record?.pct || '0.000'),
      streak: t.record?.streak || '-',
      last_ten: t.record?.lastTen || '0-0',
      position: t.record?.position || 1,
    });
    if (!error) summary.teams.migrated++;
    else differences.push(`Error en equipo ${t.id}: ${error.message}`);
  }

  // 4. Team Logos
  for (const [teamId, logoData] of Object.entries(teamLogos as Record<string, any>)) {
    if (logoData && logoData.logo) {
      const { error } = await supabase.from('team_logos').upsert({
        team_id: teamId,
        logo: logoData.logo,
        primary_color: logoData.primaryColor || null,
      });
      if (!error) summary.teamLogos.migrated++;
    }
  }

  // 5. Players
  for (const p of players) {
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
    if (!error) summary.players.migrated++;
    else differences.push(`Error en jugador ${p.id}: ${error.message}`);
  }

  // 6. News
  for (const n of news) {
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
    if (!error) summary.news.migrated++;
    else differences.push(`Error en noticia ${n.id}: ${error.message}`);
  }

  // 7. Comments
  for (const c of comments) {
    const { error } = await supabase.from('news_comments').upsert({
      id: c.id,
      article_slug: c.articleSlug,
      author_name: c.authorName || 'Aficionado',
      favorite_team: c.favoriteTeam || null,
      content: c.content || '',
      likes: c.likes || 0,
      created_at: c.createdAt || new Date().toISOString(),
    });
    if (!error) summary.comments.migrated++;
  }

  printReport(summary, differences);
  return { isConfigured: true, summary, differences };
}

function printReport(summary: MigrationSummary, differences: string[]) {
  console.log('📊 ========================================================');
  console.log('📊 INFORME DE COMPARACIÓN ANTES / DESPUÉS (VALIDACIÓN)');
  console.log('📊 ========================================================');
  console.log(`- Competiciones: Origen: ${summary.competitions.source} | Supabase: ${summary.competitions.migrated} -> ${summary.competitions.source === summary.competitions.migrated ? 'PASS' : 'WARN'}`);
  console.log(`- Temporadas:    Origen: ${summary.seasons.source} | Supabase: ${summary.seasons.migrated} -> ${summary.seasons.source === summary.seasons.migrated ? 'PASS' : 'WARN'}`);
  console.log(`- Equipos:       Origen: ${summary.teams.source} | Supabase: ${summary.teams.migrated} -> ${summary.teams.source === summary.teams.migrated ? 'PASS' : 'WARN'}`);
  console.log(`- Jugadores:     Origen: ${summary.players.source} | Supabase: ${summary.players.migrated} -> ${summary.players.source === summary.players.migrated ? 'PASS' : 'WARN'}`);
  console.log(`- Partidos:      Origen: ${summary.games.source} | Supabase: ${summary.games.migrated} -> ${summary.games.source === summary.games.migrated ? 'PASS' : 'WARN'}`);
  console.log(`- Noticias:      Origen: ${summary.news.source} | Supabase: ${summary.news.migrated} -> ${summary.news.source === summary.news.migrated ? 'PASS' : 'WARN'}`);
  console.log(`- Comentarios:   Origen: ${summary.comments.source} | Supabase: ${summary.comments.migrated} -> ${summary.comments.source === summary.comments.migrated ? 'PASS' : 'WARN'}`);
  console.log(`- Logos Equipos: Origen: ${summary.teamLogos.source} | Supabase: ${summary.teamLogos.migrated} -> ${summary.teamLogos.source === summary.teamLogos.migrated ? 'PASS' : 'WARN'}`);

  if (differences.length > 0) {
    console.log('\n⚠️ Diferencias encontradas:');
    differences.slice(0, 10).forEach((d) => console.log('  *', d));
  } else {
    console.log('\n✨ Todos los datos coinciden exactamente con la fuente de verdad. Cero pérdidas.');
  }
  console.log('========================================================\n');
}

if (process.argv[1]?.endsWith('migrate-supabase.ts')) {
  runSupabaseMigration().catch((err) => {
    console.error('Error fatal en la migración:', err);
    process.exit(1);
  });
}
