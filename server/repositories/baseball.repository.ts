import fs from 'fs';
import path from 'path';
import {
  Competition,
  Season,
  Team,
  Player,
  PlayerPosition,
  Game,
  BattingStats,
  PitchingStats,
  Standing,
  NewsArticle,
  VideoItem,
  TeamAggregatedStats,
  MatchupComparisonData,
  TeamDirectComparisonData,
  ArticleComment,
  PlayerGameLogItem,
  TeamLineup,
  LineupPlayer,
  GameLineups,
} from '../../src/types/index.ts';
import { generateSeoSlug } from '../../src/utils/slug.ts';
import { cloudSqlSync } from '../../src/db/cloudsql-sync.ts';
import { getSupabaseServerClient, isSupabaseServerConfigured } from '../lib/supabase.ts';

const KNOWN_SLUG_MAP: Record<string, string> = {
  mtz: 'mtz', matanzas: 'mtz', cocodrilos: 'mtz',
  ind: 'ind', industriales: 'ind', leones: 'ind', 'la-habana': 'ind', habana: 'ind',
  ltu: 'ltu', 'las-tunas': 'ltu', tunas: 'ltu', lenadores: 'ltu', 'leñadores': 'ltu',
  pri: 'pri', 'pinar-del-rio': 'pri', pinar: 'pri', vegueros: 'pri',
  gra: 'gra', granma: 'gra', alazanes: 'gra', bayamo: 'gra',
  scu: 'scu', 'santiago-de-cuba': 'scu', santiago: 'scu', avispas: 'scu',
  cav: 'cav', 'ciego-de-avila': 'cav', ciego: 'cav', tigres: 'cav',
  ssp: 'ssp', 'sancti-spiritus': 'ssp', spiritus: 'ssp', gallos: 'ssp',
  vcl: 'vcl', 'villa-clara': 'vcl', leopardos: 'vcl', 'santa-clara': 'vcl',
  cmg: 'cmg', camaguey: 'cmg', 'camagüey': 'cmg', toros: 'cmg',
  hol: 'hol', holguin: 'hol', 'holguín': 'hol', cachorros: 'hol',
  cfg: 'cfg', cienfuegos: 'cfg', elefantes: 'cfg',
  art: 'art', artemisa: 'art', cazadores: 'art',
  may: 'may', mayabeque: 'may', huracanes: 'may',
  ijv: 'ijv', 'isla-de-la-juventud': 'ijv', isla: 'ijv', piratas: 'ijv',
  gtm: 'gtm', guantanamo: 'gtm', 'guantánamo': 'gtm', indios: 'gtm',
};

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

export class BaseballRepository {
  private readonly dbFilePath = path.resolve(process.cwd(), 'server/data/database.json');
  private readonly backupFilePath = path.resolve(process.cwd(), 'server/data/database.backup.json');
  private readonly userChangesFilePath = path.resolve(process.cwd(), 'server/data/user_changes.json');

  private userOverrides: {
    teamLogos: Record<string, { logo: string; primaryColor?: string; updatedAt: string }>;
    teams: Record<string, Partial<Team>>;
    customTeams: Team[];
    players: Record<string, Partial<Player>>;
    customPlayers: Player[];
    deletedPlayerIds: string[];
    deletedTeamIds: string[];
    deletedGameIds: string[];
  } = {
    teamLogos: {},
    teams: {},
    customTeams: [],
    players: {},
    customPlayers: [],
    deletedPlayerIds: [],
    deletedTeamIds: [],
    deletedGameIds: [],
  };

  private isInitialized = false;
  private competitions: Competition[] = [];
  private seasons: Season[] = [];
  private teams: Team[] = [];
  private players: Player[] = [];
  private games: Game[] = [];
  private battingStats: BattingStats[] = [];
  private pitchingStats: PitchingStats[] = [];
  private standings: Standing[] = [];
  private news: NewsArticle[] = [];
  private videos: VideoItem[] = [];
  private comments: ArticleComment[] = [];

  constructor() {
    this.loadFromDisk();
    this.deduplicatePlayers();
    if (isSupabaseServerConfigured()) {
      this.initSupabase().catch((err) => {
        console.warn('[BaseballRepository] Supabase background init warning:', err);
      });
    } else {
      this.initCloudSql().catch((err) => {
        console.warn('[BaseballRepository] Cloud SQL background init warning:', err);
      });
    }
  }

  /**
   * Primary data loader: initializes repository directly from Supabase PostgreSQL.
   */
  public async initSupabase(): Promise<void> {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    try {
      // 1. Competitions
      const { data: supaComps } = await supabase.from('competitions').select('*');
      if (supaComps && supaComps.length > 0) {
        this.competitions = supaComps.map((sc: any) => ({
          id: sc.id,
          name: sc.name,
          slug: sc.slug || sc.id,
          shortName: sc.short_name || sc.name,
          country: sc.country || 'Cuba',
          type: sc.type || 'league',
          logo: sc.logo,
          status: sc.status || 'active',
          currentSeasonId: sc.current_season_id || 'snb-65',
          description: sc.description,
        }));
      }

      // 2. Seasons
      const { data: supaSeasons } = await supabase.from('seasons').select('*');
      if (supaSeasons && supaSeasons.length > 0) {
        this.seasons = supaSeasons.map((ss: any) => ({
          id: ss.id,
          competitionId: ss.competition_id || 'snb',
          year: ss.year || 2026,
          name: ss.display_name || ss.name,
          displayName: ss.display_name || ss.name,
          slug: ss.slug || ss.id,
          startDate: ss.start_date,
          endDate: ss.end_date,
          isCurrent: Boolean(ss.is_current),
          status: ss.status || 'in_progress',
        }));
      }

      // 3. Teams & Team Logos
      const { data: supaTeams } = await supabase.from('teams').select('*');
      const { data: supaLogos } = await supabase.from('team_logos').select('*');
      const logoMap = new Map((supaLogos || []).map((l: any) => [l.team_id, l]));

      if (supaTeams && supaTeams.length > 0) {
        this.teams = supaTeams.map((st: any) => {
          const customLogo = logoMap.get(st.id);
          const primaryColor = customLogo?.primary_color || st.primary_color || '#10B981';
          return {
            id: st.id,
            name: st.name,
            nickname: st.nickname || st.name,
            shortName: st.short_name,
            city: st.city,
            stadium: st.stadium,
            capacity: st.capacity,
            stadiumCapacity: st.capacity,
            manager: st.manager,
            foundedYear: st.founded_year,
            championships: st.championships,
            colors: {
              primary: primaryColor,
              secondary: st.secondary_color || '#1E293B',
              text: st.text_color || '#FFFFFF',
            },
            primaryColor,
            logo: customLogo?.logo || st.logo || '⚾',
            competitionId: st.competition_id || 'snb',
            seasonId: st.season_id || 'snb-65',
            record: {
              wins: st.wins || 0,
              losses: st.losses || 0,
              pct: parseFloat(st.pct) || 0,
              streak: st.streak || '-',
              lastTen: st.last_ten || '0-0',
              position: st.position || 1,
            },
          };
        });
      }

      // 4. Players
      const { data: supaPlayers } = await supabase.from('players').select('*');
      if (supaPlayers && supaPlayers.length > 0) {
        this.players = supaPlayers.map((sp: any) => ({
          id: sp.id,
          slug: sp.slug || sp.id,
          fullName: sp.full_name,
          firstName: sp.full_name?.split(' ')[0] || '',
          lastName: sp.full_name?.split(' ').slice(1).join(' ') || '',
          shortName: sp.short_name || sp.full_name,
          jerseyNumber: sp.jersey_number || 0,
          number: sp.jersey_number || 0,
          position: (sp.position || 'OF') as PlayerPosition,
          teamId: sp.team_id,
          teamShort: sp.team_short,
          teamName: this.teams.find((t) => t.id === sp.team_id)?.name || sp.team_short,
          bats: (sp.bats || 'R') as 'R' | 'L' | 'S',
          throws: (sp.throws || 'R') as 'R' | 'L',
          age: sp.age || 25,
          birthDate: sp.birth_date || '1999-01-01',
          birthPlace: sp.birth_place || 'Cuba',
          birthCountry: sp.birth_country || 'Cuba',
          height: sp.height || '1.85 m',
          weight: sp.weight || '88 kg',
          photo: sp.photo || '',
          bio: sp.bio || '',
          isFavorite: Boolean(sp.is_favorite),
          isHallOfFame: Boolean(sp.is_hall_of_fame),
          isAllStar: Boolean(sp.is_all_star),
          war: parseFloat(sp.war) || 0,
          status: 'active',
        }));
      }

      // 5. Batting Stats
      const { data: supaBatting } = await supabase.from('player_season_batting').select('*');
      if (supaBatting && supaBatting.length > 0) {
        this.battingStats = supaBatting.map((sb: any) => ({
          id: sb.id,
          playerId: sb.player_id,
          playerName: this.players.find((p) => p.id === sb.player_id)?.fullName || '',
          seasonId: sb.season_id,
          seasonYear: sb.season_year || 2026,
          teamId: sb.team_id || '',
          teamShort: sb.team_short || 'TEAM',
          position: (this.players.find((p) => p.id === sb.player_id)?.position || 'OF') as PlayerPosition,
          stage: sb.stage || 'regular',
          games: sb.games || 0,
          pa: sb.plate_appearances || 0,
          ab: sb.at_bats || 0,
          r: sb.runs || 0,
          h: sb.hits || 0,
          doubles: sb.doubles || 0,
          triples: sb.triples || 0,
          hr: sb.home_runs || 0,
          rbi: sb.rbi || 0,
          bb: sb.walks || 0,
          so: sb.strikeouts || 0,
          sb: sb.stolen_bases || 0,
          cs: sb.caught_stealing || 0,
          avg: parseFloat(sb.avg) || 0,
          obp: parseFloat(sb.obp) || 0,
          slg: parseFloat(sb.slg) || 0,
          ops: parseFloat(sb.ops) || 0,
          war: Number(this.players.find((p) => p.id === sb.player_id)?.war || 0),
        }));
      }

      // 6. Pitching Stats
      const { data: supaPitching } = await supabase.from('player_season_pitching').select('*');
      if (supaPitching && supaPitching.length > 0) {
        this.pitchingStats = supaPitching.map((sp: any) => ({
          id: sp.id,
          playerId: sp.player_id,
          playerName: this.players.find((p) => p.id === sp.player_id)?.fullName || '',
          seasonId: sp.season_id,
          seasonYear: sp.season_year || 2026,
          teamId: sp.team_id || '',
          teamShort: sp.team_short || 'TEAM',
          position: ((this.players.find((p) => p.id === sp.player_id)?.position || 'SP') === 'RP' ? 'RP' : 'SP') as 'SP' | 'RP',
          stage: sp.stage || 'regular',
          games: sp.games || 0,
          gs: sp.games_started || 0,
          cg: sp.cg || 0,
          sho: sp.sho || 0,
          hr: sp.hr || 0,
          ip: parseFloat(sp.innings_pitched) || 0,
          w: sp.wins || 0,
          l: sp.losses || 0,
          sv: sp.saves || 0,
          h: sp.hits || 0,
          r: sp.runs || 0,
          er: sp.earned_runs || 0,
          bb: sp.walks || 0,
          so: sp.strikeouts || 0,
          era: parseFloat(sp.era) || 0,
          whip: parseFloat(sp.whip) || 0,
          war: Number(this.players.find((p) => p.id === sp.player_id)?.war || 0),
        }));
      }

      // 7. Games
      const { data: supaGames } = await supabase.from('games').select('*');
      if (supaGames && supaGames.length > 0) {
        this.games = supaGames.map((sg: any) => {
          const homeTeam = this.teams.find((t) => t.id === sg.home_team_id) || ({
            id: sg.home_team_id,
            name: sg.home_team_id,
            shortName: sg.home_team_id.toUpperCase(),
            logo: '⚾',
          } as Team);
          const awayTeam = this.teams.find((t) => t.id === sg.away_team_id) || ({
            id: sg.away_team_id,
            name: sg.away_team_id,
            shortName: sg.away_team_id.toUpperCase(),
            logo: '⚾',
          } as Team);

          return {
            id: sg.id,
            competitionId: sg.competition_id || 'snb',
            seasonId: sg.season_id || 'snb-65',
            date: sg.date,
            time: sg.time || '14:00',
            stadium: sg.stadium || 'Estadio Principal',
            status: sg.status || 'SCHEDULED',
            homeTeam,
            awayTeam,
            homeScore: sg.home_score || 0,
            awayScore: sg.away_score || 0,
            homeHits: sg.home_hits || 0,
            awayHits: sg.away_hits || 0,
            homeErrors: sg.home_errors || 0,
            awayErrors: sg.away_errors || 0,
            currentInning: sg.current_inning || 1,
            isTopInning: sg.is_top_inning ?? true,
            outs: sg.outs || 0,
            balls: sg.balls || 0,
            strikes: sg.strikes || 0,
            bases: sg.bases || { first: false, second: false, third: false },
            lineScore: sg.line_score || [],
            lineups: sg.lineups || {},
            battingBoxScore: sg.lineups?.boxScore?.batting || (sg.lineups?.home ? { home: sg.lineups.home, away: sg.lineups.away } : undefined),
            pitchingBoxScore: sg.lineups?.boxScore?.pitching || (sg.lineups?.pitchers ? sg.lineups.pitchers : undefined),
            winningPitcher: sg.winning_pitcher,
            losingPitcher: sg.losing_pitcher,
            savePitcher: sg.save_pitcher,
            umpires: sg.umpires || [],
            plays: sg.plays || [],
          };
        });
      }

      // 8. Standings
      const { data: supaStandings } = await supabase.from('standings').select('*');
      if (supaStandings && supaStandings.length > 0) {
        this.standings = supaStandings.map((st: any) => {
          const team = this.teams.find((t) => t.id === st.team_id);
          return {
            position: st.position || 1,
            teamId: st.team_id,
            teamName: team?.name || st.team_id,
            teamShort: team?.shortName || st.team_id,
            teamLogo: team?.logo || '⚾',
            logo: team?.logo || '⚾',
            gamesPlayed: st.games || 0,
            games: st.games || 0,
            wins: st.wins || 0,
            losses: st.losses || 0,
            pct: parseFloat(st.pct) || 0,
            runsScored: st.runs_scored || 0,
            runsAllowed: st.runs_allowed || 0,
            runDifferential: st.run_differential || 0,
            streak: st.streak || '-',
            homeRecord: st.home_record || '0-0',
            awayRecord: st.away_record || '0-0',
            lastTen: st.last_ten || '0-0',
            gamesBehind: parseFloat(st.games_behind) || 0,
            division: st.division || 'General',
            competitionId: st.competition_id || 'snb',
            seasonId: st.season_id || 'snb-65',
          } as any;
        });
      }

      // 9. News
      const { data: supaNews } = await supabase.from('news').select('*').order('published_at', { ascending: false });
      if (supaNews && supaNews.length > 0) {
        this.news = supaNews.map((sn: any) => ({
          id: sn.id,
          title: sn.title,
          slug: sn.slug,
          subtitle: sn.subtitle,
          excerpt: sn.excerpt,
          content: sn.content,
          image: sn.image,
          author: sn.author,
          publishedAt: sn.published_at,
          category: sn.category || 'Crónica',
          tags: sn.tags || ['Béisbol'],
          readingTimeMinutes: sn.reading_time_minutes || 4,
          isFeatured: Boolean(sn.is_featured),
          imageHeight: sn.image_height || 'tall',
        }));
      }

      // 10. Comments
      const { data: supaComments } = await supabase.from('news_comments').select('*');
      if (supaComments && supaComments.length > 0) {
        this.comments = supaComments.map((sc: any) => ({
          id: sc.id,
          articleSlug: sc.article_slug,
          authorName: sc.author_name || 'Aficionado',
          favoriteTeam: sc.favorite_team,
          content: sc.content,
          likes: sc.likes || 0,
          createdAt: sc.created_at,
        }));
      }

      console.log('⚡ [BaseballRepository] Supabase PostgreSQL activo como fuente principal de datos.');
    } catch (err: any) {
      console.warn('[BaseballRepository] Supabase connection status: running with resilient memory repository layer.');
    }
  }

  /**
   * Persists repository state. If Supabase is active, disk write is skipped to prevent multi-source writes.
   */
  private persistState(): void {
    if (isSupabaseServerConfigured()) {
      // Supabase is the primary store; bypass local disk write to prevent dual writes
      return;
    }
    this.saveToDisk();
  }

  private safePostgrest(builder: any, label: string): void {
    Promise.resolve(builder).catch((err: any) => {
      console.warn(`[SupabaseSync] ${label} warning:`, err?.message || err);
    });
  }

  private syncTeamToSupabase(team: Team): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    this.safePostgrest(
      supabase
        .from('teams')
        .upsert({
          id: team.id,
          name: team.name,
          nickname: team.nickname || team.name,
          short_name: team.shortName,
          slug: team.id,
          city: team.city || 'Cuba',
          stadium: team.stadium || 'Estadio',
          capacity: team.capacity || 15000,
          manager: team.manager || 'Director',
          founded_year: team.foundedYear || 1977,
          championships: team.championships || 0,
          primary_color: team.primaryColor || team.colors?.primary || '#10B981',
          secondary_color: team.colors?.secondary || '#1E293B',
          text_color: team.colors?.text || '#FFFFFF',
          logo: team.logo || '⚾',
          competition_id: team.competitionId || 'snb',
          season_id: team.seasonId || 'snb-65',
          wins: team.record?.wins || 0,
          losses: team.record?.losses || 0,
          pct: String(team.record?.pct ?? '0.000'),
          streak: team.record?.streak || '-',
          last_ten: team.record?.lastTen || '0-0',
          position: team.record?.position || 1,
        }),
      'Team save'
    );

    if (team.logo) {
      this.safePostgrest(
        supabase
          .from('team_logos')
          .upsert({
            team_id: team.id,
            logo: team.logo,
            primary_color: team.primaryColor || team.colors?.primary || null,
          }),
        'Team logo save'
      );
    }
  }

  private deleteTeamFromSupabase(teamId: string): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('teams')
        .delete()
        .eq('id', teamId),
      'Team delete'
    );
  }

  private syncPlayerToSupabase(player: Player): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    this.safePostgrest(
      supabase
        .from('players')
        .upsert({
          id: player.id,
          slug: player.slug || player.id,
          full_name: player.fullName,
          short_name: player.shortName || player.fullName,
          jersey_number: player.jerseyNumber || player.number || 0,
          position: player.position || 'OF',
          team_id: player.teamId,
          team_short: player.teamShort || 'TEAM',
          bats: player.bats || 'R',
          throws: player.throws || 'R',
          age: player.age || 25,
          birth_date: player.birthDate || '1999-01-01',
          photo: player.photo || '',
          bio: player.bio || null,
          is_favorite: Boolean(player.isFavorite),
          is_hall_of_fame: Boolean(player.isHallOfFame),
          is_all_star: Boolean(player.isAllStar),
          war: String(player.war || '0.0'),
        }),
      'Player save'
    );
  }

  private deletePlayerFromSupabase(playerId: string): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('players')
        .delete()
        .eq('id', playerId),
      'Player delete'
    );
  }

  private bulkDeletePlayersFromSupabase(playerIds: string[]): void {
    if (!isSupabaseServerConfigured() || playerIds.length === 0) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('players')
        .delete()
        .in('id', playerIds),
      'Player bulk delete'
    );
  }

  private syncGameToSupabase(game: Game): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const homeTeamId = game.homeTeam?.id || (game as any).homeTeamId;
    const awayTeamId = game.awayTeam?.id || (game as any).awayTeamId;

    this.safePostgrest(
      supabase
        .from('games')
        .upsert({
          id: game.id,
          competition_id: game.competitionId || 'snb',
          season_id: game.seasonId || 'snb-65',
          date: game.date,
          time: game.time || '14:00',
          stadium: game.stadium || 'Estadio Principal',
          status: game.status || 'SCHEDULED',
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: game.homeScore || 0,
          away_score: game.awayScore || 0,
          home_hits: game.homeHits || 0,
          away_hits: game.awayHits || 0,
          home_errors: game.homeErrors || 0,
          away_errors: game.awayErrors || 0,
          current_inning: game.currentInning || 1,
          is_top_inning: game.isTopInning ?? true,
          outs: game.outs || 0,
          balls: game.balls || 0,
          strikes: game.strikes || 0,
          bases: game.bases || { first: false, second: false, third: false },
          line_score: game.lineScore || [],
          lineups: {
            home: game.battingBoxScore?.home || game.lineups?.home || [],
            away: game.battingBoxScore?.away || game.lineups?.away || [],
            pitchers: {
              home: game.pitchingBoxScore?.home || game.lineups?.pitchers?.home || [],
              away: game.pitchingBoxScore?.away || game.lineups?.pitchers?.away || [],
            },
            boxScore: (game as any).boxScore || {
              batting: game.battingBoxScore || null,
              pitching: game.pitchingBoxScore || null,
            },
          },
          winning_pitcher: game.winningPitcher || null,
          losing_pitcher: game.losingPitcher || null,
          save_pitcher: game.savePitcher || null,
          umpires: game.umpires || [],
          plays: game.plays || [],
        }),
      'Game save'
    );
  }

  private deleteGameFromSupabase(gameId: string): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('games')
        .delete()
        .eq('id', gameId),
      'Game delete'
    );
  }

  private syncBattingStatToSupabase(b: BattingStats): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const recordId = b.id || `bat-${b.playerId}-${b.seasonId || b.seasonYear || 2026}`;
    this.safePostgrest(
      supabase
        .from('player_season_batting')
        .upsert({
          id: recordId,
          player_id: b.playerId,
          season_id: b.seasonId || `snb-${b.seasonYear || 2026}`,
          season_year: b.seasonYear || 2026,
          team_id: b.teamId || null,
          team_short: b.teamShort || 'TEAM',
          stage: b.stage || 'regular',
          games: b.games || 0,
          plate_appearances: b.pa || (b as any).plateAppearances || 0,
          at_bats: b.ab || (b as any).atBats || 0,
          runs: b.r || (b as any).runs || 0,
          hits: b.h || (b as any).hits || 0,
          doubles: b.doubles || 0,
          triples: b.triples || 0,
          home_runs: b.hr || (b as any).homeRuns || 0,
          rbi: b.rbi || 0,
          walks: b.bb || (b as any).walks || 0,
          strikeouts: b.so || (b as any).strikeouts || 0,
          stolen_bases: b.sb || (b as any).stolenBases || 0,
          caught_stealing: b.cs || (b as any).caughtStealing || 0,
          avg: formatAvg(b.avg),
          obp: formatAvg(b.obp),
          slg: formatAvg(b.slg),
          ops: typeof b.ops === 'number' ? b.ops.toFixed(3) : String(b.ops || '.000'),
        }),
      'Batting save'
    );
  }

  private syncPitchingStatToSupabase(p: PitchingStats): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const recordId = p.id || `pit-${p.playerId}-${p.seasonId || p.seasonYear || 2026}`;
    this.safePostgrest(
      supabase
        .from('player_season_pitching')
        .upsert({
          id: recordId,
          player_id: p.playerId,
          season_id: p.seasonId || `snb-${p.seasonYear || 2026}`,
          season_year: p.seasonYear || 2026,
          team_id: p.teamId || null,
          team_short: p.teamShort || 'TEAM',
          stage: p.stage || 'regular',
          games: p.games || 0,
          games_started: p.gs || (p as any).gamesStarted || 0,
          innings_pitched: String(p.ip ?? (p as any).inningsPitched ?? '0.0'),
          wins: p.w || (p as any).wins || 0,
          losses: p.l || (p as any).losses || 0,
          saves: p.sv || (p as any).saves || 0,
          hits: p.h || (p as any).hits || 0,
          runs: p.r || (p as any).runs || 0,
          earned_runs: p.er || (p as any).earnedRuns || 0,
          walks: p.bb || (p as any).walks || 0,
          strikeouts: p.so || (p as any).strikeouts || 0,
          era: formatEra(p.era),
          whip: formatEra(p.whip),
        }),
      'Pitching save'
    );
  }

  private deleteStatFromSupabase(statId: string, type: 'batting' | 'pitching'): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    const table = type === 'batting' ? 'player_season_batting' : 'player_season_pitching';
    this.safePostgrest(
      supabase
        .from(table)
        .delete()
        .eq('id', statId),
      'Stat delete'
    );
  }

  private syncNewsToSupabase(n: NewsArticle): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    this.safePostgrest(
      supabase
        .from('news')
        .upsert({
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
        }),
      'News save'
    );
  }

  private deleteNewsFromSupabase(newsId: string): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('news')
        .delete()
        .eq('id', newsId),
      'News delete'
    );
  }

  private syncCommentToSupabase(c: ArticleComment): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    this.safePostgrest(
      supabase
        .from('news_comments')
        .upsert({
          id: c.id,
          article_slug: c.articleSlug,
          author_name: c.authorName || 'Aficionado',
          favorite_team: c.favoriteTeam || null,
          content: c.content || '',
          likes: c.likes || 0,
          created_at: c.createdAt || new Date().toISOString(),
        }),
      'Comment save'
    );
  }

  private deleteCommentFromSupabase(commentId: string): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('news_comments')
        .delete()
        .eq('id', commentId),
      'Comment delete'
    );
  }

  private syncCommentLikesToSupabase(commentId: string, likes: number): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('news_comments')
        .update({ likes })
        .eq('id', commentId),
      'Comment likes update'
    );
  }

  private syncStandingToSupabase(s: Standing): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const standingId = (s as any).id || `std-${s.teamId}-${s.seasonId || 'snb-65'}`;
    this.safePostgrest(
      supabase
        .from('standings')
        .upsert({
          id: standingId,
          team_id: s.teamId,
          competition_id: s.competitionId || 'snb',
          season_id: s.seasonId || 'snb-65',
          position: s.position || (s as any).rank || 1,
          games: s.gamesPlayed || (s as any).games || 0,
          wins: s.wins || 0,
          losses: s.losses || 0,
          pct: typeof s.pct === 'number' ? s.pct.toFixed(3) : String(s.pct || '0.000'),
          games_behind: typeof s.gamesBehind === 'number' ? s.gamesBehind.toFixed(1) : String(s.gamesBehind || '0.0'),
          streak: s.streak || '-',
          last_ten: s.lastTen || '0-0',
          home_record: s.homeRecord || '0-0',
          away_record: s.awayRecord || '0-0',
          runs_scored: s.runsScored || 0,
          runs_allowed: s.runsAllowed || 0,
          run_differential: s.runDifferential || 0,
          division: s.division || 'General',
        }),
      'Standing save'
    );
  }

  private deleteStandingFromSupabase(teamId: string, seasonId: string = 'snb-65'): void {
    if (!isSupabaseServerConfigured()) return;
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    this.safePostgrest(
      supabase
        .from('standings')
        .delete()
        .eq('team_id', teamId)
        .eq('season_id', seasonId),
      'Standing delete'
    );
  }

  public isSupabaseActive(): boolean {
    return isSupabaseServerConfigured();
  }

  public async initCloudSql(): Promise<void> {
    if (isSupabaseServerConfigured()) {
      // Supabase is the primary store; Cloud SQL is retired from primary sync
      return;
    }
    try {
      const cloudData = await cloudSqlSync.loadFromCloudSql();
      if (cloudData && cloudData.teams.length > 0) {
        const deletedTeamSet = new Set(this.userOverrides.deletedTeamIds || []);
        for (const t of cloudData.teams) {
          if (deletedTeamSet.has(t.id)) {
            cloudSqlSync.deleteTeam(t.id).catch(() => {});
            continue;
          }
          const idx = this.teams.findIndex((item) => item.id === t.id);
          if (idx !== -1) this.teams[idx] = t;
          else this.teams.push(t);
        }
        if (cloudData.players && cloudData.players.length > 0) {
          const deletedPlayerSet = new Set(this.userOverrides.deletedPlayerIds || []);
          for (const p of cloudData.players) {
            // NEVER reload or retain demo test players (p-*)
            if (p.id.startsWith('p-') || deletedPlayerSet.has(p.id)) {
              cloudSqlSync.deletePlayer(p.id).catch(() => {});
              continue;
            }
            const idx = this.players.findIndex((item) => item.id === p.id);
            if (idx !== -1) this.players[idx] = p;
            else this.players.push(p);
          }
        }
        if (cloudData.news && cloudData.news.length > 0) {
          for (const n of cloudData.news) {
            // NEVER reload or retain demo test news (news-*)
            if (n.id.startsWith('news-')) {
              cloudSqlSync.deleteNews(n.id).catch(() => {});
              continue;
            }
            const idx = this.news.findIndex((item) => item.id === n.id);
            if (idx !== -1) this.news[idx] = n;
            else this.news.push(n);
          }
        }
        for (const [teamId, logoData] of Object.entries(cloudData.teamLogos)) {
          this.userOverrides.teamLogos[teamId.toLowerCase()] = {
            logo: logoData.logo,
            primaryColor: logoData.primaryColor,
            updatedAt: new Date().toISOString(),
          };
        }
        this.applyUserOverrides();
        this.saveToDisk();
      } else {
        console.log('[BaseballRepository] Cloud SQL connected.');
      }
    } catch (err) {
      console.warn('[BaseballRepository] Cloud SQL initialization error (running on local persistence):', err);
    }
  }

  private loadUserOverridesFromDisk(): void {
    try {
      if (fs.existsSync(this.userChangesFilePath)) {
        const raw = fs.readFileSync(this.userChangesFilePath, 'utf-8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.userOverrides = {
              teamLogos: parsed.teamLogos || {},
              teams: parsed.teams || {},
              customTeams: Array.isArray(parsed.customTeams) ? parsed.customTeams : [],
              players: parsed.players || {},
              customPlayers: Array.isArray(parsed.customPlayers) ? parsed.customPlayers : [],
              deletedPlayerIds: Array.isArray(parsed.deletedPlayerIds) ? parsed.deletedPlayerIds : [],
              deletedTeamIds: Array.isArray(parsed.deletedTeamIds) ? parsed.deletedTeamIds : [],
              deletedGameIds: Array.isArray(parsed.deletedGameIds) ? parsed.deletedGameIds : [],
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Database] Could not read user_changes.json:', err);
    }
  }

  public saveUserOverridesToDisk(): void {
    try {
      const dir = path.dirname(this.userChangesFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.userChangesFilePath, JSON.stringify(this.userOverrides, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database] Could not save user_changes.json:', err);
    }
  }

  public applyUserOverrides(): void {
    this.loadUserOverridesFromDisk();

    // 1. Remove deleted teams
    if (this.userOverrides.deletedTeamIds.length > 0) {
      const deletedSet = new Set(this.userOverrides.deletedTeamIds);
      this.teams = this.teams.filter((t) => !deletedSet.has(t.id));
    }

    // 2. Add custom teams
    for (const ct of this.userOverrides.customTeams) {
      const existingIdx = this.teams.findIndex((t) => t.id === ct.id);
      if (existingIdx !== -1) {
        this.teams[existingIdx] = { ...this.teams[existingIdx], ...ct };
      } else {
        this.teams.push(ct);
      }
    }

    // 3. Apply team updates
    for (const [id, teamUpdates] of Object.entries(this.userOverrides.teams)) {
      const target = this.teams.find((t) => t.id === id || t.shortName.toLowerCase() === id.toLowerCase());
      if (target) {
        Object.assign(target, teamUpdates);
      }
    }

    // 4. Apply custom team logos (guarantees user logos are NEVER wiped out)
    for (const [teamId, logoData] of Object.entries(this.userOverrides.teamLogos)) {
      if (!logoData || !logoData.logo) continue;
      const target = this.teams.find((t) => t.id === teamId || t.shortName.toLowerCase() === teamId.toLowerCase());
      if (target) {
        target.logo = logoData.logo;
        if (logoData.primaryColor) {
          if (!target.colors) target.colors = { primary: logoData.primaryColor, secondary: '#FFFFFF', text: '#FFFFFF' };
          else target.colors.primary = logoData.primaryColor;
        }
      }

      // Propagate logo to active games and standings
      for (const g of this.games) {
        if (g.homeTeam.id === teamId || g.homeTeam.shortName.toLowerCase() === teamId.toLowerCase()) {
          g.homeTeam.logo = logoData.logo;
        }
        if (g.awayTeam.id === teamId || g.awayTeam.shortName.toLowerCase() === teamId.toLowerCase()) {
          g.awayTeam.logo = logoData.logo;
        }
      }
      for (const s of this.standings) {
        if (s.teamId === teamId || s.teamShort.toLowerCase() === teamId.toLowerCase()) {
          s.teamLogo = logoData.logo;
          (s as any).logo = logoData.logo;
        }
      }
    }

    // 5. Remove deleted players
    if (this.userOverrides.deletedPlayerIds.length > 0) {
      const deletedSet = new Set(this.userOverrides.deletedPlayerIds);
      this.players = this.players.filter((p) => !deletedSet.has(p.id));
    }

    // 6. Add custom players
    for (const cp of this.userOverrides.customPlayers) {
      const existingIdx = this.players.findIndex((p) => p.id === cp.id);
      if (existingIdx !== -1) {
        this.players[existingIdx] = { ...this.players[existingIdx], ...cp };
      } else {
        this.players.unshift(cp);
      }
    }

    // 7. Apply player updates
    for (const [id, playerUpdates] of Object.entries(this.userOverrides.players)) {
      const target = this.players.find((p) => p.id === id);
      if (target) {
        Object.assign(target, playerUpdates);
      }
    }

    // 8. Apply Industriales default photo for Industriales players without custom photo
    for (const p of this.players) {
      const isInd =
        p.teamId === 'ind' ||
        p.teamShort === 'IND' ||
        (p.teamName || '').toLowerCase().includes('industriales');
      if (isInd) {
        if (
          !p.photo ||
          p.photo.trim() === '' ||
          p.photo === 'player industriales.png' ||
          p.photo === '/player industriales.png' ||
          p.photo.includes('unsplash')
        ) {
          p.photo = '/images/industriales-player-default.svg';
        }
      }
    }

    // 9. Remove deleted games and permanently purge demo test games
    if (this.userOverrides.deletedGameIds && this.userOverrides.deletedGameIds.length > 0) {
      const deletedGameSet = new Set(this.userOverrides.deletedGameIds);
      this.games = this.games.filter((g) => !deletedGameSet.has(g.id));
    }
    this.games = this.games.filter((g) => !g.id.startsWith('g-2026-'));

    this.deduplicatePlayers();
  }

  /**
   * Load persistent database state from disk if it exists, otherwise initialize and persist seed data
   */
  private loadFromDisk(): void {
    const tryLoad = (filePath: string): boolean => {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          if (raw && raw.trim().length > 0) {
            const data = JSON.parse(raw);
            if (data.initialized) {
              this.isInitialized = true;
            }
            if (Array.isArray(data.competitions)) {
              this.competitions = data.competitions;
            }
            if (Array.isArray(data.seasons)) {
              this.seasons = data.seasons;
            }
            if (Array.isArray(data.teams)) {
              this.teams = data.teams;
            }
            if (Array.isArray(data.players)) {
              this.players = data.players;
            }
            if (Array.isArray(data.games)) {
              this.games = data.games.filter((g: any) => !g.id.startsWith('g-2026-'));
            }
            if (Array.isArray(data.battingStats)) {
              this.battingStats = data.battingStats;
            }
            if (Array.isArray(data.pitchingStats)) {
              this.pitchingStats = data.pitchingStats;
            }
            if (Array.isArray(data.standings)) {
              this.standings = data.standings;
            }
            if (Array.isArray(data.news)) {
              this.news = data.news;
            }
            if (Array.isArray(data.videos)) {
              this.videos = data.videos;
            }
            if (Array.isArray(data.comments)) {
              this.comments = data.comments;
            }
            return true;
          }
        }
      } catch (err) {
        console.error(`[Database] Failed to read ${filePath}:`, err);
      }
      return false;
    };

    // 1. Try primary database.json
    let loaded = tryLoad(this.dbFilePath);

    // 2. Try backup database.backup.json
    if (!loaded && tryLoad(this.backupFilePath)) {
      console.log('[Database] Restored state from backup database.backup.json');
      loaded = true;
    }

    // Ensure test collections remain strictly empty and never load demo test data
    const deletedTeamSet = new Set(this.userOverrides.deletedTeamIds || []);
    this.teams = (this.teams || []).filter((t) => !deletedTeamSet.has(t.id));
    this.games = (this.games || []).filter((g) => !g.id.startsWith('g-2026-'));
    this.players = (this.players || []).filter((p) => !p.id.startsWith('p-'));
    this.news = (this.news || []).filter((n) => !n.id.startsWith('news-'));
    this.videos = [];
    this.comments = [];
    this.battingStats = [];
    this.pitchingStats = [];
    this.standings = [];
    this.competitions = (this.competitions || []).filter((c) => c.id === 'snb');
    this.seasons = (this.seasons || []).filter((s) => s.id === 'snb-65');

    // Reset team records to clean 0-0 so no fake standings or records exist
    this.teams.forEach((t, idx) => {
      t.record = { wins: 0, losses: 0, pct: 0.0, streak: '-', lastTen: '0-0', position: idx + 1 };
    });

    this.isInitialized = true;

    // 3. ALWAYS apply user overrides on top (guarantees user uploaded logos and data are NEVER lost!)
    this.applyUserOverrides();

    // Apply Industriales default photo for Industriales players without custom personalized photo
    for (const p of this.players) {
      const isInd = p.teamId === 'ind' || p.teamShort === 'IND' || (p.teamName || '').toLowerCase().includes('industriales');
      if (isInd) {
        if (!p.photo || p.photo.trim() === '' || p.photo === 'player industriales.png' || p.photo === '/player industriales.png' || p.photo.includes('unsplash')) {
          p.photo = '/images/industriales-player-default.svg';
        }
      }
    }

    // Persist finalized database
    this.persistState();
  }

  /**
   * Atomically save the current database state to disk (with redundant backup)
   */
  public saveToDisk(): void {
    try {
      const dir = path.dirname(this.dbFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const deletedTeamSet = new Set(this.userOverrides.deletedTeamIds || []);
      const payload = {
        version: '1.0',
        initialized: true,
        lastUpdated: new Date().toISOString(),
        competitions: (this.competitions || []).filter((c) => c.id === 'snb'),
        seasons: (this.seasons || []).filter((s) => s.id === 'snb-65'),
        teams: (this.teams || []).filter((t) => !deletedTeamSet.has(t.id)),
        players: (this.players || []).filter((p) => !p.id.startsWith('p-')),
        games: (this.games || []).filter((g) => !g.id.startsWith('g-2026-')),
        battingStats: this.battingStats,
        pitchingStats: this.pitchingStats,
        standings: this.standings,
        news: (this.news || []).filter((n) => !n.id.startsWith('news-')),
        videos: this.videos,
        comments: this.comments,
      };
      const serialized = JSON.stringify(payload, null, 2);

      // Primary file write
      const tempPath = `${this.dbFilePath}.tmp`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      fs.renameSync(tempPath, this.dbFilePath);

      // Backup copy write
      try {
        fs.writeFileSync(this.backupFilePath, serialized, 'utf-8');
      } catch (backupErr) {
        console.warn('[Database] Could not write backup database file:', backupErr);
      }
    } catch (err) {
      console.error('[Database] Error saving database to disk:', err);
    }
  }

  deduplicatePlayers(): void {
    const seenIds = new Set<string>();
    const seenTeamAndNames = new Set<string>();
    const clean: Player[] = [];
    for (const p of this.players) {
      if (!p || !p.id) continue;
      const cleanId = String(p.id).trim();
      const normName = (p.fullName || '').trim().toLowerCase();
      const key = `${p.teamId}::${normName}`;
      if (!seenIds.has(cleanId) && !seenTeamAndNames.has(key)) {
        seenIds.add(cleanId);
        seenTeamAndNames.add(key);
        clean.push(p);
      }
    }
    this.players = clean;
  }

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
    if (!id) return undefined;
    const clean = id.trim().toLowerCase();

    // 1. Direct ID match
    const byId = this.teams.find((t) => t.id.toLowerCase() === clean);
    if (byId) return byId;

    // 2. ShortName match (e.g. MTZ, IND, LTU)
    const byShort = this.teams.find((t) => t.shortName.toLowerCase() === clean);
    if (byShort) return byShort;

    // 3. Known canonical slug map (e.g. "matanzas" -> "mtz", "industriales" -> "ind")
    const mappedId = KNOWN_SLUG_MAP[clean];
    if (mappedId) {
      const byMapped = this.teams.find((t) => t.id.toLowerCase() === mappedId);
      if (byMapped) return byMapped;
    }

    // 4. Explicit slug property
    const bySlug = this.teams.find((t) => (t as any).slug && (t as any).slug.toLowerCase() === clean);
    if (bySlug) return bySlug;

    // 4. Normalized slug from city, nickname, or full name
    const normalize = (str: string) =>
      (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Canonical city mappings (e.g. "pinar-del-rio", "la-habana", "ciego-de-avila", "matanzas")
    return this.teams.find((t) => {
      const citySlug = normalize(t.city);
      const nameSlug = normalize(t.name);
      const nickSlug = normalize(t.nickname);
      return citySlug === clean || nameSlug === clean || nickSlug === clean;
    });
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

    // Persist in user overrides so changes (especially logo) survive any reset or container redeployment
    if (updates.logo) {
      const logoPayload = {
        logo: updates.logo,
        primaryColor: updates.colors?.primary || (updates as any).primaryColor,
        updatedAt: new Date().toISOString(),
      };
      this.userOverrides.teamLogos[current.id.toLowerCase()] = logoPayload;
      this.userOverrides.teamLogos[current.shortName.toLowerCase()] = logoPayload;
    }
    this.userOverrides.teams[current.id] = {
      ...(this.userOverrides.teams[current.id] || {}),
      ...updates,
    };
    this.saveUserOverridesToDisk();

    // Persist to Supabase PostgreSQL (primary store)
    this.syncTeamToSupabase(updated);
    this.persistState();
    return updated;
  }

  createTeam(data: Partial<Team>): Team {
    if (!data.name || !data.shortName) {
      throw new Error('El nombre y la abreviatura del equipo son obligatorios.');
    }
    const shortName = data.shortName.trim().toUpperCase();
    const existing = this.teams.find(
      (t) =>
        t.shortName.toUpperCase() === shortName ||
        t.name.trim().toLowerCase() === (data.name || '').trim().toLowerCase()
    );
    if (existing) {
      throw new Error(`Ya existe un equipo registrado con el nombre "${data.name}" o sigla "${shortName}".`);
    }

    const id = data.id || shortName.toLowerCase();
    const primaryColor = data.colors?.primary || data.primaryColor || '#10B981';
    const secondaryColor = data.colors?.secondary || '#1E293B';
    const textColor = data.colors?.text || '#FFFFFF';

    const newTeam: Team = {
      id,
      name: data.name.trim(),
      nickname: (data.nickname || data.name).trim(),
      shortName,
      city: (data.city || 'Cuba').trim(),
      stadium: (data.stadium || `Estadio de ${shortName}`).trim(),
      capacity: Number(data.capacity || data.stadiumCapacity || 15000),
      manager: (data.manager || 'Director Técnico').trim(),
      foundedYear: Number(data.foundedYear || 1977),
      championships: Number(data.championships || 0),
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        text: textColor,
      },
      primaryColor,
      logo: data.logo || '⚾',
      competitionId: data.competitionId || 'snb',
      seasonId: data.seasonId || 'snb-65',
      record: data.record || {
        wins: 0,
        losses: 0,
        pct: 0,
        streak: '-',
        lastTen: '0-0',
        position: this.teams.length + 1,
      },
    };

    this.teams.push(newTeam);

    // Also add to standings if not present
    const existingStanding = this.standings.find((s) => s.teamId === newTeam.id || s.teamShort === newTeam.shortName);
    if (!existingStanding) {
      const newStanding: any = {
        position: this.standings.length + 1,
        teamId: newTeam.id,
        teamName: newTeam.name,
        teamShort: newTeam.shortName,
        teamLogo: newTeam.logo,
        logo: newTeam.logo,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pct: 0,
        gamesBehind: 0,
        homeRecord: '0-0',
        awayRecord: '0-0',
        streak: '-',
        lastTen: '0-0',
        runsScored: 0,
        runsAllowed: 0,
        runDifferential: 0,
      };
      this.standings.push(newStanding);
      this.syncStandingToSupabase(newStanding);
    }

    // Persist in user overrides
    this.userOverrides.customTeams = this.userOverrides.customTeams.filter((t) => t.id !== newTeam.id);
    this.userOverrides.customTeams.push(newTeam);
    this.saveUserOverridesToDisk();

    // Persist to Supabase PostgreSQL (primary store)
    this.syncTeamToSupabase(newTeam);
    this.persistState();
    return newTeam;
  }

  deleteTeam(id: string): { success: boolean; deletedTeam: Team } {
    const index = this.teams.findIndex((t) => t.id === id || t.shortName.toLowerCase() === id.toLowerCase());
    if (index === -1) {
      throw new Error(`Equipo con identificador "${id}" no encontrado.`);
    }

    const team = this.teams[index];

    // Remove from teams list
    this.teams.splice(index, 1);

    // Remove from standings
    this.standings = this.standings.filter((s) => s.teamId !== team.id && s.teamShort !== team.shortName);
    this.standings.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    // Remove players belonging to this team or detach
    this.players = this.players.filter((p) => p.teamId !== team.id && p.teamShort !== team.shortName);

    // Persist in user overrides
    this.userOverrides.deletedTeamIds.push(team.id);
    delete this.userOverrides.teams[team.id];
    delete this.userOverrides.teamLogos[team.id.toLowerCase()];
    delete this.userOverrides.teamLogos[team.shortName.toLowerCase()];
    this.userOverrides.customTeams = this.userOverrides.customTeams.filter((t) => t.id !== team.id);
    this.saveUserOverridesToDisk();

    // Delete from Supabase PostgreSQL (primary store)
    this.deleteTeamFromSupabase(team.id);
    this.deleteStandingFromSupabase(team.id);
    this.persistState();
    return { success: true, deletedTeam: team };
  }

  seed16NationalSeriesTeams(): Team[] {
    const OFFICIAL_16: Array<Omit<Team, 'seasonId' | 'competitionId' | 'record'>> = [
      {
        id: 'mtz',
        name: 'Cocodrilos de Matanzas',
        nickname: 'Cocodrilos',
        shortName: 'MTZ',
        city: 'Matanzas',
        stadium: 'Estadio Victoria de Girón',
        capacity: 22000,
        manager: 'Armando Ferrer',
        foundedYear: 1992,
        championships: 1,
        colors: { primary: '#DC2626', secondary: '#F59E0B', text: '#FFFFFF' },
        logo: '🐊',
      },
      {
        id: 'ind',
        name: 'Leones de Industriales',
        nickname: 'Leones de la Capital',
        shortName: 'IND',
        city: 'La Habana',
        stadium: 'Estadio Latinoamericano',
        capacity: 55000,
        manager: 'Guillermo Carmona',
        foundedYear: 1962,
        championships: 12,
        colors: { primary: '#1E40AF', secondary: '#60A5FA', text: '#FFFFFF' },
        logo: '🦁',
      },
      {
        id: 'ltu',
        name: 'Leñadores de Las Tunas',
        nickname: 'Leñadores',
        shortName: 'LTU',
        city: 'Las Tunas',
        stadium: 'Estadio Julio Antonio Mella',
        capacity: 13000,
        manager: 'Abeysi Pantoja',
        foundedYear: 1977,
        championships: 3,
        colors: { primary: '#047857', secondary: '#FBBF24', text: '#FFFFFF' },
        logo: '🪓',
      },
      {
        id: 'pri',
        name: 'Vegueros de Pinar del Río',
        nickname: 'Vegueros',
        shortName: 'PRI',
        city: 'Pinar del Río',
        stadium: 'Estadio Capitán San Luis',
        capacity: 10000,
        manager: 'Alexander Urquiola',
        foundedYear: 1967,
        championships: 10,
        colors: { primary: '#15803D', secondary: '#E2E8F0', text: '#FFFFFF' },
        logo: '🌿',
      },
      {
        id: 'scu',
        name: 'Avispas de Santiago de Cuba',
        nickname: 'Avispas',
        shortName: 'SCU',
        city: 'Santiago de Cuba',
        stadium: 'Estadio Guillermón Moncada',
        capacity: 25000,
        manager: 'Eddy Cajigal',
        foundedYear: 1977,
        championships: 8,
        colors: { primary: '#B91C1C', secondary: '#111827', text: '#FFFFFF' },
        logo: '🐝',
      },
      {
        id: 'gra',
        name: 'Alazanes de Granma',
        nickname: 'Alazanes',
        shortName: 'GRA',
        city: 'Bayamo',
        stadium: 'Estadio Mártires de Barbados',
        capacity: 12000,
        manager: 'Ángel Ortega',
        foundedYear: 1977,
        championships: 4,
        colors: { primary: '#2563EB', secondary: '#DC2626', text: '#FFFFFF' },
        logo: '🐎',
      },
      {
        id: 'vcl',
        name: 'Leopardos de Villa Clara',
        nickname: 'Leopardos',
        shortName: 'VCL',
        city: 'Santa Clara',
        stadium: 'Estadio Augusto César Sandino',
        capacity: 20000,
        manager: 'Ramón Moré',
        foundedYear: 1977,
        championships: 5,
        colors: { primary: '#EA580C', secondary: '#1E293B', text: '#FFFFFF' },
        logo: '🐆',
      },
      {
        id: 'cav',
        name: 'Tigres de Ciego de Ávila',
        nickname: 'Tigres',
        shortName: 'CAV',
        city: 'Ciego de Ávila',
        stadium: 'Estadio José Ramón Cepero',
        capacity: 13000,
        manager: 'Dany Miranda',
        foundedYear: 1977,
        championships: 3,
        colors: { primary: '#D97706', secondary: '#1E1B4B', text: '#FFFFFF' },
        logo: '🐯',
      },
      {
        id: 'art',
        name: 'Cazadores de Artemisa',
        nickname: 'Cazadores',
        shortName: 'ART',
        city: 'Artemisa',
        stadium: 'Estadio 26 de Julio',
        capacity: 10000,
        manager: 'Yulieski González',
        foundedYear: 2011,
        championships: 0,
        colors: { primary: '#B45309', secondary: '#DC2626', text: '#FFFFFF' },
        logo: '🏹',
      },
      {
        id: 'may',
        name: 'Huracanes de Mayabeque',
        nickname: 'Huracanes',
        shortName: 'MAY',
        city: 'San José de las Lajas',
        stadium: 'Estadio Nelson Fernández',
        capacity: 8000,
        manager: 'Michael González',
        foundedYear: 2011,
        championships: 0,
        colors: { primary: '#7C3AED', secondary: '#38BDF8', text: '#FFFFFF' },
        logo: '🌪️',
      },
      {
        id: 'ijv',
        name: 'Piratas de la Isla de la Juventud',
        nickname: 'Piratas',
        shortName: 'IJV',
        city: 'Nueva Gerona',
        stadium: 'Estadio Cristóbal Labra',
        capacity: 5000,
        manager: 'Maikel Maldonado',
        foundedYear: 1977,
        championships: 0,
        colors: { primary: '#0284C7', secondary: '#F59E0B', text: '#FFFFFF' },
        logo: '🏴‍☠️',
      },
      {
        id: 'cfg',
        name: 'Elefantes de Cienfuegos',
        nickname: 'Elefantes',
        shortName: 'CFG',
        city: 'Cienfuegos',
        stadium: 'Estadio 5 de Septiembre',
        capacity: 15000,
        manager: 'Jorge R. Rodríguez',
        foundedYear: 1977,
        championships: 0,
        colors: { primary: '#059669', secondary: '#0284C7', text: '#FFFFFF' },
        logo: '🐘',
      },
      {
        id: 'ssp',
        name: 'Gallos de Sancti Spíritus',
        nickname: 'Gallos',
        shortName: 'SSP',
        city: 'Sancti Spíritus',
        stadium: 'Estadio José Antonio Huelga',
        capacity: 12000,
        manager: 'Eriel Sánchez',
        foundedYear: 1977,
        championships: 1,
        colors: { primary: '#F59E0B', secondary: '#DC2626', text: '#FFFFFF' },
        logo: '🐓',
      },
      {
        id: 'cmg',
        name: 'Toros de Camagüey',
        nickname: 'Toros',
        shortName: 'CMG',
        city: 'Camagüey',
        stadium: 'Estadio Cándido González',
        capacity: 15000,
        manager: 'Marino Luis',
        foundedYear: 1977,
        championships: 1,
        colors: { primary: '#2563EB', secondary: '#0F172A', text: '#FFFFFF' },
        logo: '🐂',
      },
      {
        id: 'hol',
        name: 'Cachorros de Holguín',
        nickname: 'Cachorros',
        shortName: 'HOL',
        city: 'Holguín',
        stadium: 'Estadio Calixto García',
        capacity: 18000,
        manager: 'Lugdis Pineda',
        foundedYear: 1977,
        championships: 1,
        colors: { primary: '#DC2626', secondary: '#2563EB', text: '#FFFFFF' },
        logo: '🐶',
      },
      {
        id: 'gtm',
        name: 'Indios de Guantánamo',
        nickname: 'Indios',
        shortName: 'GTM',
        city: 'Guantánamo',
        stadium: 'Estadio Nguyen Van Troi',
        capacity: 14000,
        manager: 'Rubén Prevot',
        foundedYear: 1977,
        championships: 0,
        colors: { primary: '#16A34A', secondary: '#1E1B4B', text: '#FFFFFF' },
        logo: '🪶',
      },
    ];

    for (const official of OFFICIAL_16) {
      const existing = this.teams.find(
        (t) =>
          t.shortName.toUpperCase() === official.shortName.toUpperCase() ||
          t.id.toLowerCase() === official.id.toLowerCase()
      );
      if (!existing) {
        this.createTeam(official as any);
      } else {
        // Ensure default official attributes are complete
        if (!existing.stadium) existing.stadium = official.stadium;
        if (!existing.capacity) existing.capacity = official.capacity;
        if (!existing.manager) existing.manager = official.manager;
        if (!existing.city) existing.city = official.city;
        if (!existing.logo || existing.logo === '⚾') existing.logo = official.logo;
        if (!existing.colors) existing.colors = official.colors;
        if (!existing.foundedYear) existing.foundedYear = official.foundedYear;
      }
    }

    for (const t of this.teams) {
      this.syncTeamToSupabase(t);
    }
    this.persistState();
    return this.teams;
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
    if (!id) return undefined;
    const clean = id.trim().toLowerCase();

    // 1. Direct ID match
    const byId = this.players.find((p) => p.id.toLowerCase() === clean);
    if (byId) return byId;

    // 2. Direct slug match
    const bySlug = this.players.find((p) => p.slug && p.slug.toLowerCase() === clean);
    if (bySlug) return bySlug;

    // 3. Normalized full name match (e.g. "Erisbel Arruebarrena" -> "erisbel-arruebarrena")
    const normalize = (str: string) =>
      (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    return this.players.find((p) => normalize(p.fullName) === clean);
  }

  getPlayerByTeamAndIdentifier(teamIdOrSlug: string, playerIdentifier: string): Player | undefined {
    if (!playerIdentifier) return undefined;
    const cleanPlayer = playerIdentifier.trim().toLowerCase();
    const team = this.getTeamById(teamIdOrSlug);

    // If identifier is literally "jugador", return the first / representative player of that team
    if (cleanPlayer === 'jugador') {
      if (team) {
        const teamPlayers = this.players.filter(
          (p) => p.teamId.toLowerCase() === team.id.toLowerCase() || p.teamShort.toLowerCase() === team.shortName.toLowerCase()
        );
        if (teamPlayers.length > 0) return teamPlayers[0];
      }
      return this.players[0];
    }

    const normalize = (str: string) =>
      (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Search specifically within the team first
    if (team) {
      const inTeam = this.players.find((p) => {
        const matchesTeam =
          p.teamId.toLowerCase() === team.id.toLowerCase() ||
          p.teamShort.toLowerCase() === team.shortName.toLowerCase();
        if (!matchesTeam) return false;

        return (
          p.id.toLowerCase() === cleanPlayer ||
          (p.slug && p.slug.toLowerCase() === cleanPlayer) ||
          normalize(p.fullName) === cleanPlayer
        );
      });
      if (inTeam) return inTeam;
    }

    // Fall back to searching any player across all teams
    return this.getPlayerById(playerIdentifier);
  }

  getPlayerHistoricalStats(playerId: string): {
    careerBatting: BattingStats[];
    careerPitching: PitchingStats[];
    careerTotals: {
      batting?: any;
      pitching?: any;
      regularBatting?: any;
      postseasonBatting?: any;
      regularPitching?: any;
      postseasonPitching?: any;
    };
  } {
    const computeBattingTotals = (list: BattingStats[]) => {
      if (list.length === 0) return undefined;
      const games = list.reduce((sum, b) => sum + (b.games || 0), 0);
      const pa = list.reduce((sum, b) => sum + (b.pa || 0), 0);
      const ab = list.reduce((sum, b) => sum + (b.ab || 0), 0);
      const r = list.reduce((sum, b) => sum + (b.r || 0), 0);
      const h = list.reduce((sum, b) => sum + (b.h || 0), 0);
      const doubles = list.reduce((sum, b) => sum + (b.doubles || 0), 0);
      const triples = list.reduce((sum, b) => sum + (b.triples || 0), 0);
      const hr = list.reduce((sum, b) => sum + (b.hr || 0), 0);
      const rbi = list.reduce((sum, b) => sum + (b.rbi || 0), 0);
      const bb = list.reduce((sum, b) => sum + (b.bb || 0), 0);
      const so = list.reduce((sum, b) => sum + (b.so || 0), 0);
      const sb = list.reduce((sum, b) => sum + (b.sb || 0), 0);
      const totalWar = list.reduce((sum, b) => sum + (Number(b.war) || 0), 0);

      const avg = ab > 0 ? Number((h / ab).toFixed(3)) : 0;
      const obpDenom = ab + bb;
      const obp = obpDenom > 0 ? Number(((h + bb) / obpDenom).toFixed(3)) : 0;
      const singles = Math.max(0, h - doubles - triples - hr);
      const slg = ab > 0 ? Number(((singles + doubles * 2 + triples * 3 + hr * 4) / ab).toFixed(3)) : 0;
      const ops = Number((obp + slg).toFixed(3));

      return {
        seasons: list.length,
        games,
        pa,
        ab,
        r,
        h,
        doubles,
        triples,
        hr,
        rbi,
        bb,
        so,
        sb,
        avg,
        obp,
        slg,
        ops,
        war: Number(totalWar.toFixed(1)),
      };
    };

    const computePitchingTotals = (list: PitchingStats[]) => {
      if (list.length === 0) return undefined;
      const games = list.reduce((sum, p) => sum + (p.games || 0), 0);
      const gs = list.reduce((sum, p) => sum + (p.gs || 0), 0);
      const w = list.reduce((sum, p) => sum + (p.w ?? p.wins ?? 0), 0);
      const l = list.reduce((sum, p) => sum + (p.l ?? p.losses ?? 0), 0);
      const sv = list.reduce((sum, p) => sum + (p.sv ?? p.saves ?? 0), 0);
      const ip = list.reduce((sum, p) => sum + (Number(p.ip) || 0), 0);
      const h = list.reduce((sum, p) => sum + (p.h || 0), 0);
      const r = list.reduce((sum, p) => sum + (p.r || 0), 0);
      const er = list.reduce((sum, p) => sum + (p.er || 0), 0);
      const bb = list.reduce((sum, p) => sum + (p.bb || 0), 0);
      const so = list.reduce((sum, p) => sum + (p.so || 0), 0);
      const hr = list.reduce((sum, p) => sum + (p.hr || 0), 0);
      const totalWar = list.reduce((sum, p) => sum + (Number(p.war) || 0), 0);

      const era = ip > 0 ? Number(((er * 9) / ip).toFixed(2)) : 0;
      const whip = ip > 0 ? Number(((bb + h) / ip).toFixed(2)) : 0;

      return {
        seasons: list.length,
        games,
        gs,
        w,
        l,
        sv,
        ip: Number(ip.toFixed(1)),
        h,
        r,
        er,
        bb,
        so,
        hr,
        era,
        whip,
        war: Number(totalWar.toFixed(1)),
      };
    };

    const careerBatting = this.battingStats
      .filter((b) => b.playerId === playerId)
      .map((b) => ({
        ...b,
        stage: b.stage === 'postseason' ? ('postseason' as const) : ('regular' as const),
      }))
      .sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

    const careerPitching = this.pitchingStats
      .filter((p) => p.playerId === playerId)
      .map((p) => ({
        ...p,
        stage: p.stage === 'postseason' ? ('postseason' as const) : ('regular' as const),
      }))
      .sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

    const regularBatting = careerBatting.filter((b) => b.stage !== 'postseason');
    const postseasonBatting = careerBatting.filter((b) => b.stage === 'postseason');

    const regularPitching = careerPitching.filter((p) => p.stage !== 'postseason');
    const postseasonPitching = careerPitching.filter((p) => p.stage === 'postseason');

    return {
      careerBatting,
      careerPitching,
      careerTotals: {
        batting: computeBattingTotals(careerBatting),
        pitching: computePitchingTotals(careerPitching),
        regularBatting: computeBattingTotals(regularBatting),
        postseasonBatting: computeBattingTotals(postseasonBatting),
        regularPitching: computePitchingTotals(regularPitching),
        postseasonPitching: computePitchingTotals(postseasonPitching),
      },
    };
  }

  getPlayerRecentGameLogs(playerId: string, limit = 10): PlayerGameLogItem[] {
    const player = this.getPlayerById(playerId);
    if (!player) return [];

    const isPitcher = player.position === 'SP' || player.position === 'RP';

    // Current season stats
    const batting =
      this.battingStats.find(
        (b) => b.playerId === playerId && (b.seasonYear === 2026 || b.seasonYear === 2027 || !b.seasonId?.includes('56'))
      ) || this.battingStats.filter((b) => b.playerId === playerId).pop();

    const pitching =
      this.pitchingStats.find(
        (p) => p.playerId === playerId && (p.seasonYear === 2026 || p.seasonYear === 2027 || !p.seasonId?.includes('56'))
      ) || this.pitchingStats.filter((p) => p.playerId === playerId).pop();

    // Check if player participated in real games with boxscores
    const realGameLogs: PlayerGameLogItem[] = [];
    const teamGames = this.games
      .filter((g) => g.homeTeam.id === player.teamId || g.awayTeam.id === player.teamId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const g of teamGames) {
      const isHome = g.homeTeam.id === player.teamId;
      const opp = isHome ? g.awayTeam : g.homeTeam;
      const myScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      const result: 'W' | 'L' = myScore >= oppScore ? 'W' : 'L';

      if (!isPitcher) {
        const boxList = isHome ? g.battingBoxScore?.home : g.battingBoxScore?.away;
        const boxEntry = boxList?.find((b) => b.playerId === player.id || b.name === player.fullName);
        if (boxEntry) {
          const ab = boxEntry.ab;
          const h = boxEntry.h;
          realGameLogs.push({
            id: `gl_${g.id}_${player.id}`,
            gameId: g.id,
            gameNumber: realGameLogs.length + 1,
            date: g.date,
            formattedDate: new Date(g.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            opponentId: opp.id,
            opponentShort: opp.shortName,
            opponentName: opp.name,
            opponentLogo: opp.logo,
            isHome,
            score: `${myScore}-${oppScore}`,
            teamScore: myScore,
            opponentScore: oppScore,
            result,
            ab,
            h,
            r: boxEntry.r,
            rbi: boxEntry.rbi,
            bb: boxEntry.bb,
            so: boxEntry.so,
            gameAvg: ab > 0 ? Number((h / ab).toFixed(3)) : 0,
            rollingAvg: 0,
          });
        }
      } else {
        const pitList = isHome ? g.pitchingBoxScore?.home : g.pitchingBoxScore?.away;
        const pitEntry = pitList?.find((p) => p.playerId === player.id || p.name === player.fullName);
        if (pitEntry) {
          const ipNum = parseFloat(pitEntry.ip) || 1.0;
          realGameLogs.push({
            id: `gl_${g.id}_${player.id}`,
            gameId: g.id,
            gameNumber: realGameLogs.length + 1,
            date: g.date,
            formattedDate: new Date(g.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            opponentId: opp.id,
            opponentShort: opp.shortName,
            opponentName: opp.name,
            opponentLogo: opp.logo,
            isHome,
            score: `${myScore}-${oppScore}`,
            teamScore: myScore,
            opponentScore: oppScore,
            result,
            decision: pitEntry.decision || (result === 'W' ? 'W' : 'ND'),
            ip: pitEntry.ip,
            ipDecimal: ipNum,
            er: pitEntry.er,
            rAllowed: pitEntry.r,
            hAllowed: pitEntry.h,
            bbPitcher: pitEntry.bb,
            soPitcher: pitEntry.so,
            gameEra: Number(((pitEntry.er * 9) / Math.max(ipNum, 0.33)).toFixed(2)),
            rollingEra: 0,
          });
        }
      }
    }

    // If we have enough real games (>= limit), take the last `limit`
    if (realGameLogs.length >= limit) {
      const slice = realGameLogs.slice(-limit);
      slice.forEach((item, idx) => {
        item.gameNumber = idx + 1;
      });
      if (!isPitcher) {
        let runHits = 0;
        let runAb = 0;
        slice.forEach((item) => {
          runHits += item.h || 0;
          runAb += item.ab || 0;
          item.rollingAvg = runAb > 0 ? Number((runHits / runAb).toFixed(3)) : (batting?.avg || 0.300);
        });
      } else {
        let runEr = 0;
        let runIp = 0;
        slice.forEach((item) => {
          runEr += item.er || 0;
          runIp += item.ipDecimal || 1;
          item.rollingEra = runIp > 0 ? Number(((runEr * 9) / runIp).toFixed(2)) : (pitching?.era || 3.00);
        });
      }
      return slice;
    }

    // Complete / synthesize a realistic 10-game performance sequence for the player
    // Deterministic pseudo-random based on player id characters
    let seed = 0;
    for (let i = 0; i < player.id.length; i++) {
      seed = (seed * 31 + player.id.charCodeAt(i)) >>> 0;
    }
    const pseudoRand = (offset: number) => {
      const x = Math.sin(seed + offset * 7919) * 10000;
      return x - Math.floor(x);
    };

    const otherTeams = this.teams.filter((t) => t.id !== player.teamId);
    const availableOpponents = otherTeams.length > 0 ? otherTeams : this.teams;

    const baseDates = [
      '2026-09-01',
      '2026-09-03',
      '2026-09-05',
      '2026-09-07',
      '2026-09-09',
      '2026-09-12',
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
      '2026-09-20',
    ];

    const targetBatAvg = batting?.avg ?? 0.325;
    const targetEra = pitching?.era ?? (isPitcher ? 2.85 : 3.50);

    const generated: PlayerGameLogItem[] = [];

    if (!isPitcher) {
      let runningHits = Math.round(targetBatAvg * 32);
      let runningAb = 32;

      for (let i = 0; i < limit; i++) {
        const r1 = pseudoRand(i * 3 + 1);
        const r2 = pseudoRand(i * 3 + 2);
        const r3 = pseudoRand(i * 3 + 3);

        const opp = availableOpponents[Math.floor(r1 * availableOpponents.length)] || availableOpponents[0];
        const isHome = r2 > 0.45;
        const result: 'W' | 'L' = r3 > 0.4 ? 'W' : 'L';
        const teamScore = result === 'W' ? 4 + Math.floor(r1 * 5) : 1 + Math.floor(r1 * 3);
        const oppScore = result === 'W' ? Math.max(0, teamScore - (1 + Math.floor(r2 * 3))) : teamScore + 1 + Math.floor(r2 * 3);

        const ab = 3 + (r1 > 0.7 ? 1 : 0) + (r2 > 0.85 ? 1 : 0);
        let h = 0;
        const hitProb = targetBatAvg * 1.05;
        if (r3 < hitProb * 0.35) {
          h = 2;
        } else if (r3 < hitProb * 0.85) {
          h = 1;
        } else if (r3 < hitProb * 0.98) {
          h = 3;
        } else {
          h = 0;
        }
        h = Math.min(h, ab);

        const r = h > 0 ? (r1 > 0.5 ? 1 : r1 > 0.85 ? 2 : 0) : 0;
        const hr = (batting?.hr || 0) > 3 ? (r2 > 0.78 && h > 0 ? 1 : 0) : 0;
        const doubles = hr === 0 && h > 1 ? 1 : (r3 > 0.7 && h > 0 ? 1 : 0);
        const rbi = hr > 0 ? 1 + (r1 > 0.5 ? 1 : 0) : (h > 0 && r2 > 0.4 ? 1 + (r3 > 0.8 ? 1 : 0) : 0);
        const bb = r1 > 0.65 ? 1 : (r2 > 0.9 ? 2 : 0);
        const so = r3 > 0.55 ? 1 : 0;

        runningHits += h;
        runningAb += ab;
        const rollingAvg = Number((runningHits / runningAb).toFixed(3));
        const gameAvg = ab > 0 ? Number((h / ab).toFixed(3)) : 0;

        const dateStr = baseDates[i] || `2026-09-${10 + i}`;
        const dateObj = new Date(dateStr);
        const formattedDate = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        generated.push({
          id: `gl_sim_${player.id}_${i + 1}`,
          gameId: `g_sim_${i + 1}`,
          gameNumber: i + 1,
          date: dateStr,
          formattedDate,
          opponentId: opp.id,
          opponentShort: opp.shortName,
          opponentName: opp.name,
          opponentLogo: opp.logo,
          isHome,
          score: `${teamScore}-${oppScore}`,
          teamScore,
          opponentScore: oppScore,
          result,
          ab,
          h,
          r,
          doubles,
          triples: 0,
          hr,
          rbi,
          bb,
          so,
          sb: r1 > 0.8 ? 1 : 0,
          gameAvg,
          rollingAvg,
          rollingOps: Number((rollingAvg + 0.52).toFixed(3)),
        });
      }
    } else {
      let runningEr = Math.round((targetEra * 42) / 9);
      let runningIp = 42.0;

      for (let i = 0; i < limit; i++) {
        const r1 = pseudoRand(i * 4 + 1);
        const r2 = pseudoRand(i * 4 + 2);
        const r3 = pseudoRand(i * 4 + 3);

        const opp = availableOpponents[Math.floor(r1 * availableOpponents.length)] || availableOpponents[0];
        const isHome = r2 > 0.48;
        const result: 'W' | 'L' = r3 > 0.35 ? 'W' : 'L';
        const teamScore = result === 'W' ? 4 + Math.floor(r1 * 4) : 1 + Math.floor(r1 * 3);
        const oppScore = result === 'W' ? Math.max(0, teamScore - (1 + Math.floor(r2 * 3))) : teamScore + 1 + Math.floor(r2 * 2);

        const isReliever = player.position === 'RP';
        const ipDecimal = isReliever ? 1.0 + (r1 > 0.5 ? 0.33 : r1 > 0.8 ? 0.67 : 0) : 5.0 + Math.floor(r1 * 3) + (r2 > 0.5 ? 0.33 : 0);
        let er = 0;
        if (targetEra < 2.0) {
          er = r3 > 0.7 ? 1 : r3 > 0.9 ? 2 : 0;
        } else if (targetEra < 3.5) {
          er = r3 > 0.5 ? 1 : r3 > 0.8 ? 2 : r3 > 0.95 ? 3 : 0;
        } else {
          er = r3 > 0.35 ? 1 : r3 > 0.65 ? 2 : r3 > 0.85 ? 3 : 0;
        }

        const hAllowed = er + Math.floor(r2 * 4);
        const bbPitcher = Math.floor(r1 * 3);
        const soPitcher = isReliever ? 1 + Math.floor(r3 * 3) : 4 + Math.floor(r3 * 6);

        let decision: 'W' | 'L' | 'S' | 'ND' = 'ND';
        if (isReliever) {
          if (result === 'W' && r2 > 0.5) decision = 'S';
          else if (result === 'W' && r1 > 0.7) decision = 'W';
          else if (result === 'L' && er > 1) decision = 'L';
        } else {
          if (result === 'W' && ipDecimal >= 5.0) decision = 'W';
          else if (result === 'L') decision = 'L';
        }

        runningEr += er;
        runningIp += ipDecimal;
        const rollingEra = Number(((runningEr * 9) / runningIp).toFixed(2));
        const gameEra = Number(((er * 9) / Math.max(ipDecimal, 0.33)).toFixed(2));

        const dateStr = baseDates[i] || `2026-09-${10 + i}`;
        const dateObj = new Date(dateStr);
        const formattedDate = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        const ipWhole = Math.floor(ipDecimal);
        const ipFrac = ipDecimal - ipWhole;
        const ipString = ipFrac > 0.6 ? `${ipWhole}.2` : ipFrac > 0.3 ? `${ipWhole}.1` : `${ipWhole}.0`;

        generated.push({
          id: `gl_sim_${player.id}_${i + 1}`,
          gameId: `g_sim_${i + 1}`,
          gameNumber: i + 1,
          date: dateStr,
          formattedDate,
          opponentId: opp.id,
          opponentShort: opp.shortName,
          opponentName: opp.name,
          opponentLogo: opp.logo,
          isHome,
          score: `${teamScore}-${oppScore}`,
          teamScore,
          opponentScore: oppScore,
          result,
          decision,
          ip: ipString,
          ipDecimal: Number(ipDecimal.toFixed(2)),
          er,
          rAllowed: er + (r1 > 0.7 ? 1 : 0),
          hAllowed,
          bbPitcher,
          soPitcher,
          hrAllowed: er > 0 && r2 > 0.6 ? 1 : 0,
          gameEra,
          rollingEra,
          rollingWhip: Number(((bbPitcher + hAllowed) / ipDecimal).toFixed(2)),
        });
      }
    }

    return generated;
  }

  addOrUpdatePlayerSeasonBatting(playerId: string, statData: Partial<BattingStats>): BattingStats {
    const player = this.getPlayerById(playerId);
    const seasonYear = Number(statData.seasonYear) || new Date().getFullYear();
    const stage =
      statData.stage === 'postseason' ||
      (statData as any).seasonType === 'postseason' ||
      (statData as any).etapa === 'postseason'
        ? 'postseason'
        : 'regular';
    const statId = statData.id || `bs_${playerId}_${seasonYear}_${stage}`;

    const existingIndex = this.battingStats.findIndex(
      (b) =>
        b.id === statId ||
        (b.playerId === playerId &&
          b.seasonYear === seasonYear &&
          (b.stage || 'regular') === stage)
    );

    const ab = Number(statData.ab) || 0;
    const h = Number(statData.h) || 0;
    const doubles = Number(statData.doubles) || 0;
    const triples = Number(statData.triples) || 0;
    const hr = Number(statData.hr) || 0;
    const bb = Number(statData.bb) || 0;
    const pa = Number(statData.pa) || (ab + bb);
    const avg = statData.avg !== undefined ? Number(statData.avg) : (ab > 0 ? Number((h / ab).toFixed(3)) : 0);
    const obp = statData.obp !== undefined ? Number(statData.obp) : ((ab + bb) > 0 ? Number(((h + bb) / (ab + bb)).toFixed(3)) : 0);
    const singles = Math.max(0, h - doubles - triples - hr);
    const slg = statData.slg !== undefined ? Number(statData.slg) : (ab > 0 ? Number(((singles + doubles * 2 + triples * 3 + hr * 4) / ab).toFixed(3)) : 0);
    const ops = statData.ops !== undefined ? Number(statData.ops) : Number((obp + slg).toFixed(3));

    const statRecord: BattingStats = {
      id: statId,
      playerId,
      playerName: player?.fullName || statData.playerName || 'Jugador',
      teamId: statData.teamId || player?.teamId || '',
      teamShort: statData.teamShort || player?.teamShort || '',
      position: (statData.position || player?.position || 'OF') as PlayerPosition,
      seasonYear,
      seasonId: statData.seasonId || `snb-${seasonYear}`,
      stage,
      games: Number(statData.games) || 0,
      pa,
      ab,
      r: Number(statData.r) || 0,
      h,
      doubles,
      triples,
      hr,
      rbi: Number(statData.rbi) || 0,
      bb,
      so: Number(statData.so) || 0,
      sb: Number(statData.sb) || 0,
      cs: Number(statData.cs) || 0,
      avg,
      obp,
      slg,
      ops,
      war: Number(statData.war) || 0,
    };

    if (existingIndex !== -1) {
      this.battingStats[existingIndex] = statRecord;
    } else {
      this.battingStats.push(statRecord);
    }

    this.syncBattingStatToSupabase(statRecord);
    this.persistState();
    return statRecord;
  }

  addOrUpdatePlayerSeasonPitching(playerId: string, statData: Partial<PitchingStats>): PitchingStats {
    const player = this.getPlayerById(playerId);
    const seasonYear = Number(statData.seasonYear) || new Date().getFullYear();
    const stage =
      statData.stage === 'postseason' ||
      (statData as any).seasonType === 'postseason' ||
      (statData as any).etapa === 'postseason'
        ? 'postseason'
        : 'regular';
    const statId = statData.id || `ps_${playerId}_${seasonYear}_${stage}`;

    const existingIndex = this.pitchingStats.findIndex(
      (p) =>
        p.id === statId ||
        (p.playerId === playerId &&
          p.seasonYear === seasonYear &&
          (p.stage || 'regular') === stage)
    );

    const ip = Number(statData.ip) || 0;
    const er = Number(statData.er) || 0;
    const bb = Number(statData.bb) || 0;
    const h = Number(statData.h) || 0;
    const era = statData.era !== undefined ? Number(statData.era) : (ip > 0 ? Number(((er * 9) / ip).toFixed(2)) : 0);
    const whip = statData.whip !== undefined ? Number(statData.whip) : (ip > 0 ? Number(((bb + h) / ip).toFixed(2)) : 0);

    const statRecord: PitchingStats = {
      id: statId,
      playerId,
      playerName: player?.fullName || statData.playerName || 'Lanzador',
      teamId: statData.teamId || player?.teamId || '',
      teamShort: statData.teamShort || player?.teamShort || '',
      position: (statData.position || (player?.position === 'SP' || player?.position === 'RP' ? player.position : 'SP')) as 'SP' | 'RP',
      seasonYear,
      seasonId: statData.seasonId || `snb-${seasonYear}`,
      stage,
      games: Number(statData.games) || 0,
      gs: Number(statData.gs) || 0,
      cg: Number(statData.cg) || 0,
      sho: Number(statData.sho) || 0,
      w: Number(statData.w ?? statData.wins) || 0,
      l: Number(statData.l ?? statData.losses) || 0,
      sv: Number(statData.sv ?? statData.saves) || 0,
      wins: Number(statData.w ?? statData.wins) || 0,
      losses: Number(statData.l ?? statData.losses) || 0,
      saves: Number(statData.sv ?? statData.saves) || 0,
      ip,
      h,
      r: Number(statData.r) || 0,
      er,
      bb,
      so: Number(statData.so) || 0,
      hr: Number(statData.hr) || 0,
      era,
      whip,
      war: Number(statData.war) || 0,
    };

    if (existingIndex !== -1) {
      this.pitchingStats[existingIndex] = statRecord;
    } else {
      this.pitchingStats.push(statRecord);
    }

    this.syncPitchingStatToSupabase(statRecord);
    this.persistState();
    return statRecord;
  }

  deletePlayerSeasonStat(playerId: string, statId: string, type: 'batting' | 'pitching'): boolean {
    if (type === 'batting') {
      const prevLength = this.battingStats.length;
      this.battingStats = this.battingStats.filter((b) => !(b.id === statId && b.playerId === playerId));
      if (this.battingStats.length !== prevLength) {
        this.deleteStatFromSupabase(statId, type);
        this.persistState();
        return true;
      }
    } else {
      const prevLength = this.pitchingStats.length;
      this.pitchingStats = this.pitchingStats.filter((p) => !(p.id === statId && p.playerId === playerId));
      if (this.pitchingStats.length !== prevLength) {
        this.deleteStatFromSupabase(statId, type);
        this.persistState();
        return true;
      }
    }
    return false;
  }

  /**
   * Import historical stats for players from an array of JSON objects.
   * Supports both batting and pitching records from previous seasons (e.g. SNB 60, 61, 62, 63, 64).
   */
  importHistoricalStats(
    incoming: any[] | { batting?: any[]; pitching?: any[]; stats?: any[]; temporadas?: any[] },
    defaultPlayerId?: string
  ): {
    importedCount: number;
    battingCount: number;
    pitchingCount: number;
    playersCount: number;
    unmatchedCount: number;
    unmatchedEntries: any[];
    affectedPlayerIds: string[];
    details: {
      playerName: string;
      playerId: string;
      type: 'batting' | 'pitching';
      seasonYear: number;
      seasonId: string;
      teamShort: string;
    }[];
  } {
    let rawList: any[] = [];
    if (Array.isArray(incoming)) {
      rawList = incoming;
    } else if (incoming && typeof incoming === 'object') {
      if (Array.isArray(incoming.stats)) {
        rawList = incoming.stats;
      } else if (Array.isArray(incoming.temporadas)) {
        rawList = incoming.temporadas;
      } else {
        const battingList = Array.isArray(incoming.batting)
          ? incoming.batting.map((b) => ({ ...b, type: 'batting' }))
          : [];
        const pitchingList = Array.isArray(incoming.pitching)
          ? incoming.pitching.map((p) => ({ ...p, type: 'pitching' }))
          : [];
        rawList = [...battingList, ...pitchingList];
      }
    }

    let battingCount = 0;
    let pitchingCount = 0;
    const affectedPlayerIdsSet = new Set<string>();
    const unmatchedEntries: any[] = [];
    const details: any[] = [];

    const normalize = (str: string) =>
      str
        ? str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
        : '';

    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') continue;

      // 1. Resolve player
      let matchedPlayer: Player | undefined;
      if (defaultPlayerId) {
        matchedPlayer = this.getPlayerById(defaultPlayerId);
      }

      if (!matchedPlayer) {
        const cleanId = raw.playerId || raw.id || raw.player_id;
        if (cleanId) {
          matchedPlayer = this.getPlayerById(String(cleanId).trim());
        }
      }

      if (!matchedPlayer) {
        const searchName = (
          raw.playerName ||
          raw.fullName ||
          raw.player ||
          raw.Nombre ||
          raw.nombre ||
          raw.name ||
          raw.jugador ||
          ''
        )
          .toString()
          .trim();

        if (searchName) {
          const normSearch = normalize(searchName);
          const teamQuery = (raw.teamShort || raw.team || raw.equipo || raw.teamId || '')
            .toString()
            .trim()
            .toLowerCase();

          // Try exact match with team preference first
          if (teamQuery) {
            matchedPlayer = this.players.find(
              (p) =>
                (p.teamShort.toLowerCase() === teamQuery || p.teamId.toLowerCase() === teamQuery) &&
                normalize(p.fullName) === normSearch
            );
          }

          // Exact name match across all teams
          if (!matchedPlayer) {
            matchedPlayer = this.players.find((p) => normalize(p.fullName) === normSearch);
          }

          // Substring name match
          if (!matchedPlayer) {
            matchedPlayer = this.players.find(
              (p) =>
                normSearch.length > 4 &&
                (normalize(p.fullName).includes(normSearch) || normSearch.includes(normalize(p.fullName)))
            );
          }
        }
      }

      if (!matchedPlayer) {
        unmatchedEntries.push({
          raw,
          reason: `No se pudo emparejar al jugador "${raw.playerName || raw.fullName || raw.playerId || 'desconocido'}" en la base de datos.`,
        });
        continue;
      }

      // 2. Determine stat type
      const rawType = (raw.type || raw.tipo || '').toString().toLowerCase().trim();
      let statType: 'batting' | 'pitching' = 'batting';

      if (rawType.includes('pitch') || rawType.includes('lanz') || rawType === 'p') {
        statType = 'pitching';
      } else if (rawType.includes('bat') || rawType.includes('bate') || rawType === 'of' || rawType === 'c') {
        statType = 'batting';
      } else {
        // Auto-detect based on attributes
        const hasPitchingProps =
          raw.era !== undefined ||
          raw.pcl !== undefined ||
          raw.ip !== undefined ||
          raw.inn !== undefined ||
          raw.gs !== undefined ||
          raw.ji !== undefined ||
          raw.sv !== undefined ||
          raw.js !== undefined ||
          raw.w !== undefined ||
          raw.jg !== undefined ||
          raw.l !== undefined ||
          raw.jp !== undefined ||
          raw.er !== undefined ||
          raw.cl !== undefined;

        if (hasPitchingProps) {
          statType = 'pitching';
        } else if (
          raw.ab !== undefined ||
          raw.vb !== undefined ||
          raw.h !== undefined ||
          raw.hr !== undefined ||
          raw.rbi !== undefined ||
          raw.ci !== undefined ||
          raw.avg !== undefined ||
          raw.doubles !== undefined ||
          raw.triples !== undefined
        ) {
          statType = 'batting';
        } else {
          statType = matchedPlayer.position === 'SP' || matchedPlayer.position === 'RP' ? 'pitching' : 'batting';
        }
      }

      // 3. Season metadata
      const seasonYear =
        Number(
          raw.seasonYear ||
            raw.year ||
            raw.temporada ||
            raw.ano ||
            raw.año ||
            (raw.seasonId ? String(raw.seasonId).replace(/\D/g, '') : null)
        ) || 2025;

      const seasonId =
        raw.seasonId ||
        raw.temporadaId ||
        (seasonYear <= 90 && seasonYear >= 1 ? `snb-${seasonYear}` : `snb-${seasonYear}`);

      // 4. Team metadata
      const teamQuery = (
        raw.teamShort ||
        raw.teamId ||
        raw.equipo ||
        raw.team ||
        raw.team_short ||
        ''
      )
        .toString()
        .trim()
        .toLowerCase();

      const teamObj =
        this.teams.find(
          (t) =>
            t.shortName.toLowerCase() === teamQuery ||
            t.id.toLowerCase() === teamQuery ||
            t.name.toLowerCase().includes(teamQuery)
        ) || this.getTeamById(matchedPlayer.teamId);

      const teamId = teamObj ? teamObj.id : matchedPlayer.teamId;
      const teamShort = teamObj ? teamObj.shortName : matchedPlayer.teamShort;

      const rawStage = (
        raw.stage ||
        raw.etapa ||
        raw.fase ||
        raw.seasonType ||
        raw.tipoTemporada ||
        ''
      )
        .toString()
        .toLowerCase()
        .trim();
      const isPost =
        rawStage.includes('post') ||
        rawStage.includes('playoff') ||
        rawStage.includes('final') ||
        rawStage.includes('semifinal') ||
        rawStage.includes('cuartos');
      const stage: 'regular' | 'postseason' = isPost ? 'postseason' : 'regular';

      // 5. Add or update stat
      if (statType === 'batting') {
        const games = Number(raw.games ?? raw.jj ?? raw.j ?? raw.juegos ?? 0);
        const ab = Number(raw.ab ?? raw.vb ?? raw.turnos ?? 0);
        const r = Number(raw.r ?? raw.c ?? raw.anotadas ?? raw.runs ?? 0);
        const h = Number(raw.h ?? raw.hits ?? raw.imparables ?? 0);
        const doubles = Number(raw.doubles ?? raw.dobles ?? raw['2b'] ?? raw['2B'] ?? 0);
        const triples = Number(raw.triples ?? raw.triples ?? raw['3b'] ?? raw['3B'] ?? 0);
        const hr = Number(raw.hr ?? raw.jonrones ?? raw.cuadrangulares ?? raw.homeruns ?? 0);
        const rbi = Number(raw.rbi ?? raw.ci ?? raw.impulsadas ?? raw.remolcadas ?? 0);
        const bb = Number(raw.bb ?? raw.boletos ?? raw.basesPorBolas ?? 0);
        const so = Number(raw.so ?? raw.k ?? raw.ponches ?? raw.strikeouts ?? 0);
        const sb = Number(raw.sb ?? raw.br ?? raw.robadas ?? raw.basesRobadas ?? 0);
        const cs = Number(raw.cs ?? raw.cr ?? 0);
        const war = Number(raw.war ?? raw.WAR ?? 0);

        this.addOrUpdatePlayerSeasonBatting(matchedPlayer.id, {
          seasonYear,
          seasonId,
          stage,
          teamId,
          teamShort,
          games,
          ab,
          r,
          h,
          doubles,
          triples,
          hr,
          rbi,
          bb,
          so,
          sb,
          cs,
          war,
          avg: raw.avg !== undefined ? Number(raw.avg) : undefined,
          obp: raw.obp !== undefined ? Number(raw.obp) : undefined,
          slg: raw.slg !== undefined ? Number(raw.slg) : undefined,
          ops: raw.ops !== undefined ? Number(raw.ops) : undefined,
        });

        battingCount++;
      } else {
        const games = Number(raw.games ?? raw.jj ?? raw.j ?? raw.juegos ?? 0);
        const gs = Number(raw.gs ?? raw.ji ?? raw.juegosIniciados ?? 0);
        const w = Number(raw.w ?? raw.wins ?? raw.jg ?? raw.victorias ?? raw.ganados ?? 0);
        const l = Number(raw.l ?? raw.losses ?? raw.jp ?? raw.derrotas ?? raw.perdidos ?? 0);
        const sv = Number(raw.sv ?? raw.saves ?? raw.js ?? raw.salvados ?? 0);
        const ip = Number(raw.ip ?? raw.inn ?? raw.entradas ?? raw.innings ?? 0);
        const h = Number(raw.h ?? raw.hits ?? raw.hitsPermitidos ?? 0);
        const r = Number(raw.r ?? raw.c ?? raw.carreras ?? raw.carrerasPermitidas ?? 0);
        const er = Number(raw.er ?? raw.cl ?? raw.limpias ?? raw.carrerasLimpias ?? 0);
        const bb = Number(raw.bb ?? raw.boletos ?? 0);
        const so = Number(raw.so ?? raw.k ?? raw.ponches ?? raw.strikeouts ?? 0);
        const hr = Number(raw.hr ?? raw.jonrones ?? 0);
        const war = Number(raw.war ?? raw.WAR ?? 0);

        this.addOrUpdatePlayerSeasonPitching(matchedPlayer.id, {
          seasonYear,
          seasonId,
          stage,
          teamId,
          teamShort,
          games,
          gs,
          w,
          l,
          sv,
          ip,
          h,
          r,
          er,
          bb,
          so,
          hr,
          war,
          era: raw.era !== undefined ? Number(raw.era) : raw.pcl !== undefined ? Number(raw.pcl) : undefined,
          whip: raw.whip !== undefined ? Number(raw.whip) : undefined,
        });

        pitchingCount++;
      }

      affectedPlayerIdsSet.add(matchedPlayer.id);
      details.push({
        playerName: matchedPlayer.fullName,
        playerId: matchedPlayer.id,
        type: statType,
        seasonYear,
        seasonId,
        teamShort,
      });
    }

    this.persistState();

    return {
      importedCount: battingCount + pitchingCount,
      battingCount,
      pitchingCount,
      playersCount: affectedPlayerIdsSet.size,
      unmatchedCount: unmatchedEntries.length,
      unmatchedEntries,
      affectedPlayerIds: Array.from(affectedPlayerIdsSet),
      details,
    };
  }

  // Games
  getOrGenerateTeamLineup(teamId: string, boxBatters?: any[]): TeamLineup {
    const cleanId = (teamId || '').trim().toLowerCase();
    const teamPlayers = this.players.filter((p) => p.teamId.toLowerCase() === cleanId);
    const battingOrder: LineupPlayer[] = [];
    const usedPlayerIds = new Set<string>();

    const defaultPositions = ['CF', '2B', 'LF', '1B', 'DH', '3B', 'RF', 'C', 'SS'];

    // 1. If box score batters exist, prioritize them in order
    if (boxBatters && boxBatters.length > 0) {
      boxBatters.slice(0, 9).forEach((b, idx) => {
        const found = teamPlayers.find(
          (p) => p.id === b.playerId || p.fullName.toLowerCase() === (b.name || '').toLowerCase()
        );
        const orderNum = idx + 1;
        battingOrder.push({
          order: orderNum,
          playerId: found ? found.id : b.playerId || `lineup_${cleanId}_${orderNum}`,
          name: b.name || (found ? found.fullName : `Bateador ${orderNum}`),
          jerseyNumber: found ? found.jerseyNumber : idx * 7 + 3,
          position: b.position || defaultPositions[idx] || 'DH',
          bats: found ? found.bats : 'R',
          throws: found ? found.throws : 'R',
          ab: b.ab || 0,
          r: b.r || 0,
          h: b.h || 0,
          rbi: b.rbi || 0,
          bb: b.bb || 0,
          so: b.so || 0,
          avg: b.avg || '.280',
        });
        if (found) usedPlayerIds.add(found.id);
      });
    }

    // 2. Fill remaining slots up to 9
    for (let i = battingOrder.length; i < 9; i++) {
      const targetPos = defaultPositions[i] || 'DH';
      const playerMatch =
        teamPlayers.find((p) => !usedPlayerIds.has(p.id) && p.position === targetPos) ||
        teamPlayers.find((p) => !usedPlayerIds.has(p.id)) ||
        null;

      const orderNum = i + 1;
      if (playerMatch) {
        usedPlayerIds.add(playerMatch.id);
        battingOrder.push({
          order: orderNum,
          playerId: playerMatch.id,
          name: playerMatch.fullName,
          jerseyNumber: playerMatch.jerseyNumber,
          position: targetPos,
          bats: playerMatch.bats || 'R',
          throws: playerMatch.throws || 'R',
          ab: 3,
          r: i === 0 || i === 3 ? 1 : 0,
          h: i % 2 === 0 ? 1 : 0,
          rbi: i === 3 ? 1 : 0,
          bb: i === 1 ? 1 : 0,
          so: i === 5 ? 1 : 0,
          avg: `.2${70 + ((i * 7) % 60)}`,
        });
      } else {
        battingOrder.push({
          order: orderNum,
          playerId: `starter_${cleanId}_${orderNum}`,
          name: `Titular ${targetPos}`,
          jerseyNumber: orderNum * 4 + 2,
          position: targetPos,
          bats: 'R',
          throws: 'R',
          ab: 2,
          r: 0,
          h: 1,
          rbi: 0,
          bb: 0,
          so: 1,
          avg: '.275',
        });
      }
    }

    // 3. Find Starting Pitcher
    const pitcherMatch =
      teamPlayers.find((p) => p.position === 'P' || (p.position as string) === 'SP' || (p.position as string) === 'RP') ||
      teamPlayers[teamPlayers.length - 1];

    const startingPitcher = {
      playerId: pitcherMatch?.id,
      name: pitcherMatch ? pitcherMatch.fullName : 'Abridor Oficial',
      jerseyNumber: pitcherMatch ? pitcherMatch.jerseyNumber : 33,
      throws: pitcherMatch ? pitcherMatch.throws : ('R' as any),
      era: '3.15',
      ip: '5.2',
      h: 4,
      r: 2,
      er: 2,
      bb: 2,
      so: 5,
      pitches: 78,
    };

    // 4. Bench players
    const bench = teamPlayers
      .filter((p) => !usedPlayerIds.has(p.id) && p.position !== 'P')
      .slice(0, 6)
      .map((p) => ({
        playerId: p.id,
        name: p.fullName,
        position: p.position,
        jerseyNumber: p.jerseyNumber,
      }));

    return {
      startingPitcher,
      battingOrder,
      bench,
    };
  }

  ensureGameDetails(game: Game): Game {
    if (!game.bases) {
      game.bases = { first: false, second: false, third: false };
    }
    if (game.balls === undefined) game.balls = 0;
    if (game.strikes === undefined) game.strikes = 0;
    if (
      !game.lineups ||
      !game.lineups.away ||
      !game.lineups.home ||
      !game.lineups.away.battingOrder ||
      game.lineups.away.battingOrder.length === 0
    ) {
      game.lineups = {
        away: this.getOrGenerateTeamLineup(game.awayTeam.id, game.battingBoxScore?.away),
        home: this.getOrGenerateTeamLineup(game.homeTeam.id, game.battingBoxScore?.home),
      };
    }
    return game;
  }

  getGames(params?: {
    competitionId?: string;
    seasonId?: string;
    status?: string;
    teamId?: string;
    sortByDate?: 'asc' | 'desc';
  }): Game[] {
    let result = this.games.map((g) => this.ensureGameDetails(g));

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

    // Sort by date and time (default: ascending chronological order)
    const sortOrder = params?.sortByDate === 'desc' ? 'desc' : 'asc';
    result.sort((a, b) => {
      const dateA = a.date || '1970-01-01';
      const dateB = b.date || '1970-01-01';
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      const fullA = `${dateA}T${timeA.length === 5 ? timeA : '00:00'}:00`;
      const fullB = `${dateB}T${timeB.length === 5 ? timeB : '00:00'}:00`;
      const cmp = fullA.localeCompare(fullB);
      if (cmp !== 0) {
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return sortOrder === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    });

    return result;
  }

  getGameById(id: string): Game | undefined {
    const found = this.games.find((g) => g.id === id);
    if (!found) return undefined;
    return this.ensureGameDetails(found);
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

    this.syncGameToSupabase(target);
    this.persistState();
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
  getStandings(competitionId?: string, division?: string, seasonId?: string): Standing[] {
    let result = this.standings;

    if (seasonId) {
      const is56 = seasonId === 'snb-56' || seasonId.includes('56') || seasonId === '2017';
      const is64 = seasonId === 'snb-64' || seasonId.includes('64');
      const is65 = seasonId === 'snb-65' || seasonId.includes('65') || seasonId === '2027';

      if (is56) {
        result = result.filter((s) => s.seasonId === 'snb-56');
      } else if (is64) {
        result = result.filter((s) => s.seasonId === 'snb-64');
      } else if (is65) {
        result = result.filter((s) => s.seasonId === 'snb-65');
      } else {
        result = result.filter((s) => s.seasonId === seasonId);
      }
    } else {
      // Por defecto la temporada activa (65 Serie Nacional)
      result = result.filter((s) => s.seasonId === 'snb-65');
    }

    if (division && division !== 'General') {
      result = result.filter((s) => s.division === division);
    }
    return result.sort((a, b) => b.pct - a.pct);
  }

  // Stats
  getBattingStats(
    sortBy: keyof BattingStats = 'avg',
    order: 'asc' | 'desc' = 'desc',
    seasonId?: string
  ): BattingStats[] {
    let list = this.battingStats;
    if (seasonId) {
      const is56 = seasonId === 'snb-56' || seasonId.includes('56') || seasonId === '2017';
      const is64 = seasonId === 'snb-64' || seasonId.includes('64');
      const is65 = seasonId === 'snb-65' || seasonId.includes('65') || seasonId === '2027';

      if (is56) {
        list = list.filter((s) => s.seasonId === 'snb-56' || s.seasonYear === 2017);
      } else if (is64) {
        list = list.filter((s) => s.seasonId === 'snb-64' || (s.id?.includes('-64-')));
      } else if (is65) {
        list = list.filter((s) => s.seasonId === 'snb-65' || (!s.id?.includes('-56-') && !s.id?.includes('-64-')));
      } else {
        list = list.filter((s) => s.seasonId === seasonId);
      }
    } else {
      // Por defecto la temporada activa (65 Serie Nacional)
      list = list.filter((s) => s.seasonId === 'snb-65' || (!s.id?.includes('-56-') && !s.id?.includes('-64-')));
    }

    return [...list].sort((a, b) => {
      const valA = (a[sortBy] as number) ?? 0;
      const valB = (b[sortBy] as number) ?? 0;
      return order === 'desc' ? valB - valA : valA - valB;
    });
  }

  getPitchingStats(
    sortBy: keyof PitchingStats = 'era',
    order: 'asc' | 'desc' = 'asc',
    seasonId?: string
  ): PitchingStats[] {
    let list = this.pitchingStats;
    if (seasonId) {
      const is56 = seasonId === 'snb-56' || seasonId.includes('56') || seasonId === '2017';
      const is64 = seasonId === 'snb-64' || seasonId.includes('64');
      const is65 = seasonId === 'snb-65' || seasonId.includes('65') || seasonId === '2027';

      if (is56) {
        list = list.filter((s) => s.seasonId === 'snb-56' || s.seasonYear === 2017);
      } else if (is64) {
        list = list.filter((s) => s.seasonId === 'snb-64' || (s.id?.includes('-64-')));
      } else if (is65) {
        list = list.filter((s) => s.seasonId === 'snb-65' || (!s.id?.includes('-56-') && !s.id?.includes('-64-')));
      } else {
        list = list.filter((s) => s.seasonId === seasonId);
      }
    } else {
      // Por defecto la temporada activa (65 Serie Nacional)
      list = list.filter((s) => s.seasonId === 'snb-65' || (!s.id?.includes('-56-') && !s.id?.includes('-64-')));
    }

    return [...list].sort((a, b) => {
      const valA = (a[sortBy] as number) ?? 0;
      const valB = (b[sortBy] as number) ?? 0;
      return order === 'desc' ? valB - valA : valA - valB;
    });
  }

  // Leaders
  getLeaders(category: 'batting' | 'pitching', stat: string, limit = 5, seasonId?: string): any[] {
    if (category === 'batting') {
      const sorted = this.getBattingStats(stat as keyof BattingStats, stat === 'so' ? 'asc' : 'desc', seasonId);
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
      const sorted = this.getPitchingStats(stat as keyof PitchingStats, isAsc ? 'asc' : 'desc', seasonId);
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
    if (!q) return { players: [], teams: [], articles: [], news: [], competitions: [] };

    const matchedPlayers = this.players
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q) ||
          p.teamShort.toLowerCase().includes(q)
      )
      .slice(0, 8);

    const matchedTeams = this.teams
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.nickname.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.shortName.toLowerCase().includes(q) ||
          (t.stadium && t.stadium.toLowerCase().includes(q)) ||
          (t.manager && t.manager.toLowerCase().includes(q))
      )
      .slice(0, 8);

    const matchedArticles = this.news
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.subtitle && n.subtitle.toLowerCase().includes(q)) ||
          (n.excerpt && n.excerpt.toLowerCase().includes(q)) ||
          (n.category && n.category.toLowerCase().includes(q)) ||
          (n.tags && n.tags.some((tag) => tag.toLowerCase().includes(q))) ||
          (n.author && n.author.toLowerCase().includes(q))
      )
      .slice(0, 8);

    const matchedCompetitions = this.competitions
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q)
      )
      .slice(0, 4);

    return {
      players: matchedPlayers,
      teams: matchedTeams,
      articles: matchedArticles,
      news: matchedArticles,
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
        this.syncBattingStatToSupabase(this.battingStats[existingStatIdx]);
      } else {
        this.battingStats.push(stat);
        this.syncBattingStatToSupabase(stat);
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
          this.syncPitchingStatToSupabase(pitchData);
        } else {
          this.pitchingStats.push(pitchData);
          this.syncPitchingStatToSupabase(pitchData);
        }
      }
    }
    this.persistState();
    return newStats.length;
  }

  insertPlayersBatch(newPlayers: Player[]): number {
    let count = 0;
    for (const np of newPlayers) {
      if (!np) continue;
      const cleanId = np.id ? String(np.id).trim() : '';
      if (cleanId) {
        const existing = this.players.find((p) => p.id === cleanId);
        if (existing) {
          this.updatePlayer(existing.id, np);
          count++;
          continue;
        }
      }
      this.createPlayer(np);
      count++;
    }
    this.deduplicatePlayers();
    this.persistState();
    return count;
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

  // Direct Team-to-Team Head-to-Head Comparison
  compareTeams(teamAId: string, teamBId: string): TeamDirectComparisonData | null {
    const teamA = this.getTeamById(teamAId);
    const teamB = this.getTeamById(teamBId);
    if (!teamA || !teamB) return null;

    const standingA = this.standings.find((s) => s.teamId === teamA.id || s.teamShort === teamA.shortName);
    const standingB = this.standings.find((s) => s.teamId === teamB.id || s.teamShort === teamB.shortName);

    const statsA = this.getTeamAggregatedStats(teamA.id);
    const statsB = this.getTeamAggregatedStats(teamB.id);

    const headToHeadGames = this.games.filter(
      (g) =>
        (g.homeTeam.id === teamA.id && g.awayTeam.id === teamB.id) ||
        (g.homeTeam.id === teamB.id && g.awayTeam.id === teamA.id)
    );

    let teamAWins = 0;
    let teamBWins = 0;
    let teamARuns = 0;
    let teamBRuns = 0;

    for (const g of headToHeadGames) {
      if (g.status === 'FINAL') {
        const isAHome = g.homeTeam.id === teamA.id;
        const aScore = isAHome ? g.homeScore : g.awayScore;
        const bScore = isAHome ? g.awayScore : g.homeScore;
        teamARuns += aScore;
        teamBRuns += bScore;
        if (aScore > bScore) teamAWins++;
        else if (bScore > aScore) teamBWins++;
      }
    }

    const battersA = this.battingStats.filter((b) => b.teamId === teamA.id || b.teamShort === teamA.shortName);
    const battersB = this.battingStats.filter((b) => b.teamId === teamB.id || b.teamShort === teamB.shortName);
    const pitchersA = this.pitchingStats.filter((p) => p.teamId === teamA.id || p.teamShort === teamA.shortName);
    const pitchersB = this.pitchingStats.filter((p) => p.teamId === teamB.id || p.teamShort === teamB.shortName);

    const bestBatterA = [...battersA].sort((a, b) => (b.avg || 0) - (a.avg || 0))[0];
    const bestBatterB = [...battersB].sort((a, b) => (b.avg || 0) - (a.avg || 0))[0];
    const bestPitcherA = [...pitchersA].sort((a, b) => (a.era || 99) - (b.era || 99))[0];
    const bestPitcherB = [...pitchersB].sort((a, b) => (a.era || 99) - (b.era || 99))[0];

    const topBatterA = bestBatterA
      ? {
          player:
            this.getPlayerById(bestBatterA.playerId) ||
            ({
              id: bestBatterA.playerId,
              fullName: bestBatterA.playerName,
              firstName: bestBatterA.playerName.split(' ')[0],
              lastName: bestBatterA.playerName.split(' ').slice(1).join(' '),
              position: bestBatterA.position,
              teamId: teamA.id,
              teamName: teamA.name,
              teamShort: teamA.shortName,
              jerseyNumber: 10,
              photo: '',
            } as Player),
          stats: bestBatterA,
        }
      : undefined;

    const topBatterB = bestBatterB
      ? {
          player:
            this.getPlayerById(bestBatterB.playerId) ||
            ({
              id: bestBatterB.playerId,
              fullName: bestBatterB.playerName,
              firstName: bestBatterB.playerName.split(' ')[0],
              lastName: bestBatterB.playerName.split(' ').slice(1).join(' '),
              position: bestBatterB.position,
              teamId: teamB.id,
              teamName: teamB.name,
              teamShort: teamB.shortName,
              jerseyNumber: 10,
              photo: '',
            } as Player),
          stats: bestBatterB,
        }
      : undefined;

    const topPitcherA = bestPitcherA
      ? {
          player:
            this.getPlayerById(bestPitcherA.playerId) ||
            ({
              id: bestPitcherA.playerId,
              fullName: bestPitcherA.playerName,
              firstName: bestPitcherA.playerName.split(' ')[0],
              lastName: bestPitcherA.playerName.split(' ').slice(1).join(' '),
              position: bestPitcherA.position as any,
              teamId: teamA.id,
              teamName: teamA.name,
              teamShort: teamA.shortName,
              jerseyNumber: 20,
              photo: '',
            } as Player),
          stats: bestPitcherA,
        }
      : undefined;

    const topPitcherB = bestPitcherB
      ? {
          player:
            this.getPlayerById(bestPitcherB.playerId) ||
            ({
              id: bestPitcherB.playerId,
              fullName: bestPitcherB.playerName,
              firstName: bestPitcherB.playerName.split(' ')[0],
              lastName: bestPitcherB.playerName.split(' ').slice(1).join(' '),
              position: bestPitcherB.position as any,
              teamId: teamB.id,
              teamName: teamB.name,
              teamShort: teamB.shortName,
              jerseyNumber: 20,
              photo: '',
            } as Player),
          stats: bestPitcherB,
        }
      : undefined;

    return {
      teamA,
      teamB,
      standingA,
      standingB,
      statsA,
      statsB,
      headToHeadGames,
      headToHeadSummary: {
        totalGames: headToHeadGames.length,
        teamAWins,
        teamBWins,
        teamARuns,
        teamBRuns,
      },
      topBatterA,
      topBatterB,
      topPitcherA,
      topPitcherB,
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

    this.games.push(newGame);
    this.games.sort((a, b) => {
      const fullA = `${a.date || '1970-01-01'}T${a.time || '00:00'}:00`;
      const fullB = `${b.date || '1970-01-01'}T${b.time || '00:00'}:00`;
      return fullA.localeCompare(fullB);
    });
    this.syncGameToSupabase(newGame);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.saveGame(newGame).catch(() => {});
    }
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
      lineups: updates.lineups !== undefined ? updates.lineups : current.lineups,
      bases: updates.bases !== undefined ? updates.bases : current.bases,
      balls: updates.balls !== undefined ? updates.balls : current.balls,
      strikes: updates.strikes !== undefined ? updates.strikes : current.strikes,
    };

    this.games[index] = updated;
    this.syncGameToSupabase(updated);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.saveGame(updated).catch(() => {});
    }
    return updated;
  }

  createGameSeries(seriesData: {
    awayTeamId: string;
    homeTeamId: string;
    startDate: string;
    startTime?: string;
    numberOfGames: number;
    stadium?: string;
  }): Game[] {
    const createdGames: Game[] = [];
    const rawDate = seriesData.startDate || new Date().toISOString().split('T')[0];
    const parts = rawDate.split('-').map(Number);
    const startYear = parts[0] || new Date().getFullYear();
    const startMonth = (parts[1] || 1) - 1;
    const startDay = parts[2] || 1;
    const num = Math.min(Math.max(1, seriesData.numberOfGames || 3), 7);

    for (let i = 0; i < num; i++) {
      const gDate = new Date(startYear, startMonth, startDay + i, 12, 0, 0);
      const yStr = gDate.getFullYear();
      const mStr = String(gDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(gDate.getDate()).padStart(2, '0');
      const dateStr = `${yStr}-${mStr}-${dStr}`;
      const game = this.createGame({
        id: `game_${Date.now()}_${i + 1}`,
        awayTeamId: seriesData.awayTeamId,
        homeTeamId: seriesData.homeTeamId,
        date: dateStr,
        time: seriesData.startTime || '14:00',
        stadium: seriesData.stadium,
        status: 'SCHEDULED',
      });
      createdGames.push(game);
    }
    return createdGames;
  }

  deleteGame(id: string): boolean {
    const initialLen = this.games.length;
    this.games = this.games.filter((g) => g.id !== id);
    if (!this.userOverrides.deletedGameIds.includes(id)) {
      this.userOverrides.deletedGameIds.push(id);
      this.saveUserOverridesToDisk();
    }
    this.deleteGameFromSupabase(id);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.deleteGame(id).catch(() => {});
    }
    return this.games.length < initialLen;
  }

  createPlayer(data: any): Player {
    const team = this.getTeamById(data.teamId || '') || this.teams[0];
    const firstName = data.firstName || (data.fullName ? data.fullName.trim().split(' ')[0] : 'Nuevo');
    const lastName = data.lastName || (data.fullName ? data.fullName.trim().split(' ').slice(1).join(' ') : 'Jugador');
    const fullName = (data.fullName || `${firstName} ${lastName}`).trim();

    // 1. If an ID is provided, check if that exact player exists already
    const cleanId = data.id ? String(data.id).trim() : '';
    if (cleanId) {
      const existingById = this.players.find((p) => p.id === cleanId);
      if (existingById) {
        // Execute atomic update by existing ID without creating duplicate
        return this.updatePlayer(existingById.id, data)!;
      }
    }

    // 2. Check if player already exists by (teamId + normalized fullName) or normalized fullName
    const normalizedName = fullName.toLowerCase();
    const existingByTeamAndName = this.players.find(
      (p) => p.teamId === team.id && (p.fullName || '').trim().toLowerCase() === normalizedName
    );
    if (existingByTeamAndName) {
      return this.updatePlayer(existingByTeamAndName.id, data)!;
    }

    const existingByName = this.players.find(
      (p) => (p.fullName || '').trim().toLowerCase() === normalizedName
    );
    if (existingByName && (!data.teamId || data.teamId === existingByName.teamId)) {
      return this.updatePlayer(existingByName.id, data)!;
    }

    // 3. Enforce Serie Nacional 40-player limit per team for new registrations
    const teamPlayers = this.players.filter((p) => p.teamId === team.id);
    if (teamPlayers.length >= 40) {
      throw new Error(`El equipo ${team.name} ya cuenta con el límite reglamentario máximo de 40 jugadores.`);
    }

    const generatedId = cleanId || ('p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    const newPlayer: Player = {
      id: generatedId,
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
      photo:
        data.photo ||
        (team.id === 'ind' || team.shortName === 'IND' || (team.name || '').toLowerCase().includes('industriales')
          ? '/images/industriales-player-default.svg'
          : 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=150&auto=format&fit=crop&q=80'),
      bio: data.bio || 'Jugador profesional de la Serie Nacional.',
      status: data.status || 'active',
    };

    this.players.unshift(newPlayer);
    this.deduplicatePlayers();

    // Persist in user overrides
    this.userOverrides.deletedPlayerIds = this.userOverrides.deletedPlayerIds.filter((pid) => pid !== newPlayer.id);
    this.userOverrides.customPlayers = this.userOverrides.customPlayers.filter((p) => p.id !== newPlayer.id);
    this.userOverrides.customPlayers.unshift(newPlayer);
    this.saveUserOverridesToDisk();

    // Persist to Supabase PostgreSQL (primary store)
    this.syncPlayerToSupabase(newPlayer);
    this.persistState();

    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.savePlayer(newPlayer).catch(() => {});
    }
    return newPlayer;
  }

  updatePlayer(id: string, updates: Partial<Player>): Player | undefined {
    const cleanId = (id || '').trim();
    if (!cleanId) return undefined;

    const index = this.players.findIndex((p) => p.id === cleanId || p.slug === cleanId);
    if (index === -1) return undefined;

    const current = this.players[index];

    // Enforce 40 players limit if team is being changed
    if (updates.teamId && updates.teamId !== current.teamId) {
      const destTeam = this.getTeamById(updates.teamId);
      const destTeamPlayers = this.players.filter((p) => p.teamId === updates.teamId && p.id !== current.id);
      if (destTeamPlayers.length >= 40) {
        throw new Error(
          `El equipo de destino (${destTeam ? destTeam.name : updates.teamId}) ya cuenta con el límite reglamentario máximo de 40 jugadores.`
        );
      }
    }

    const updated: Player = {
      ...current,
      ...updates,
      id: current.id, // IMMUTABLE ID: guarantee the unique ID is preserved and never overwritten
    };

    if (updates.teamId && updates.teamId !== current.teamId) {
      const team = this.getTeamById(updates.teamId);
      if (team) {
        updated.teamId = team.id;
        updated.teamName = team.name;
        updated.teamShort = team.shortName;
      }
    }

    // Atomic update in-place at the exact index to avoid reordering or creating multiple instances
    this.players[index] = updated;

    // Purge any duplicates in memory with same id or same team+normalized name
    const normalizedName = (updated.fullName || '').trim().toLowerCase();
    this.players = this.players.filter((p) => {
      if (p.id === current.id) {
        return p === updated; // keep only the updated reference
      }
      if (
        p.teamId === updated.teamId &&
        (p.fullName || '').trim().toLowerCase() === normalizedName
      ) {
        return false;
      }
      return true;
    });

    // Atomically synchronize player details in related stats collections
    for (const b of this.battingStats) {
      if (b.playerId === current.id) {
        b.playerName = updated.fullName;
        b.teamId = updated.teamId;
        b.teamShort = updated.teamShort;
        this.syncBattingStatToSupabase(b);
      }
    }
    for (const pit of this.pitchingStats) {
      if (pit.playerId === current.id) {
        pit.playerName = updated.fullName;
        pit.teamId = updated.teamId;
        pit.teamShort = updated.teamShort;
        this.syncPitchingStatToSupabase(pit);
      }
    }

    // Persist in user overrides
    this.userOverrides.players[current.id] = {
      ...(this.userOverrides.players[current.id] || {}),
      ...updates,
    };
    this.saveUserOverridesToDisk();

    this.deduplicatePlayers();

    // Persist to Supabase PostgreSQL (primary store)
    this.syncPlayerToSupabase(updated);
    this.persistState();

    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.savePlayer(updated).catch(() => {});
    }

    return updated;
  }

  importPlayers(incoming: any[]): { importedCount: number; createdCount: number; updatedCount: number; players: Player[] } {
    const resultPlayers: Player[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const raw of incoming) {
      if (!raw) continue;
      const cleanId = raw.id ? String(raw.id).trim() : (raw.playerId ? String(raw.playerId).trim() : '');
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
      if (!fullName && !cleanId) continue;

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

      // Check if player exists by unique ID first, then by fullName + team, then by fullName
      let existing: Player | undefined;
      if (cleanId) {
        existing = this.players.find((p) => p.id === cleanId);
      }
      if (!existing && fullName) {
        const normName = fullName.toLowerCase();
        existing = this.players.find(
          (p) => p.teamId === matchedTeam.id && (p.fullName || '').trim().toLowerCase() === normName
        );
        if (!existing) {
          existing = this.players.find(
            (p) => (p.fullName || '').trim().toLowerCase() === normName
          );
        }
      }

      if (existing) {
        const updated = this.updatePlayer(existing.id, {
          teamId: matchedTeam.id,
          jerseyNumber,
          position: position as any,
          bats,
          throws: throws_,
          photo,
          bio,
          age,
          fullName: fullName || existing.fullName,
        });
        if (updated) {
          resultPlayers.push(updated);
          updatedCount++;
        }
      } else {
        try {
          const created = this.createPlayer({
            id: cleanId || undefined,
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
        } catch (err: any) {
          console.warn(`[Import] Omitido jugador ${fullName}: ${err.message}`);
        }
      }
    }

    // Persist in user overrides
    for (const p of resultPlayers) {
      this.userOverrides.deletedPlayerIds = this.userOverrides.deletedPlayerIds.filter((pid) => pid !== p.id);
      this.userOverrides.customPlayers = this.userOverrides.customPlayers.filter((cp) => cp.id !== p.id);
      this.userOverrides.customPlayers.push(p);
    }
    this.saveUserOverridesToDisk();

    this.deduplicatePlayers();
    this.persistState();

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

    // Persist in user overrides
    this.userOverrides.deletedPlayerIds.push(id);
    delete this.userOverrides.players[id];
    this.userOverrides.customPlayers = this.userOverrides.customPlayers.filter((p) => p.id !== id);
    this.saveUserOverridesToDisk();

    // Delete from Supabase PostgreSQL (primary store)
    this.deletePlayerFromSupabase(id);
    this.persistState();

    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.deletePlayer(id).catch(() => {});
    }

    return this.players.length < initialLen;
  }

  bulkDeletePlayers(ids: string[]): { deletedCount: number; deletedIds: string[] } {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { deletedCount: 0, deletedIds: [] };
    }
    const idSet = new Set(ids.map((id) => String(id).trim()));
    const initialLen = this.players.length;
    const deletedIds: string[] = [];

    this.players = this.players.filter((p) => {
      if (idSet.has(p.id)) {
        deletedIds.push(p.id);
        return false;
      }
      return true;
    });

    // Persist in user overrides
    for (const id of deletedIds) {
      this.userOverrides.deletedPlayerIds.push(id);
      delete this.userOverrides.players[id];
      this.userOverrides.customPlayers = this.userOverrides.customPlayers.filter((p) => p.id !== id);
    }
    this.saveUserOverridesToDisk();

    // Bulk delete from Supabase PostgreSQL (primary store)
    this.bulkDeletePlayersFromSupabase(deletedIds);
    this.persistState();

    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.bulkDeletePlayers(deletedIds).catch(() => {});
    }

    const deletedCount = initialLen - this.players.length;
    return { deletedCount, deletedIds };
  }

  bulkUpdatePlayers(ids: string[], updates: Partial<Player>): { updatedCount: number; updatedPlayers: Player[] } {
    if (!Array.isArray(ids) || ids.length === 0 || !updates) {
      return { updatedCount: 0, updatedPlayers: [] };
    }
    const idSet = new Set(ids.map((id) => String(id).trim()));
    const updatedPlayers: Player[] = [];

    let targetTeam: Team | undefined;
    if (updates.teamId) {
      targetTeam = this.getTeamById(updates.teamId);
    }

    for (const player of this.players) {
      if (idSet.has(player.id)) {
        if (targetTeam) {
          player.teamId = targetTeam.id;
          player.teamName = targetTeam.name;
          player.teamShort = targetTeam.shortName;
        }
        if (updates.position !== undefined) player.position = updates.position;
        if (updates.status !== undefined) player.status = updates.status;
        if ((updates as any).isStar !== undefined) (player as any).isStar = (updates as any).isStar;
        if (updates.bats !== undefined) player.bats = updates.bats;
        if (updates.throws !== undefined) player.throws = updates.throws;
        if (updates.jerseyNumber !== undefined) player.jerseyNumber = updates.jerseyNumber;
        this.syncPlayerToSupabase(player);
        updatedPlayers.push(player);
      }
    }

    if (updatedPlayers.length > 0) {
      this.persistState();
    }
    return { updatedCount: updatedPlayers.length, updatedPlayers };
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
    this.syncNewsToSupabase(newArticle);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.saveNews(newArticle).catch(() => {});
    }
    return newArticle;
  }

  updateNews(id: string, updates: Partial<NewsArticle>): NewsArticle | undefined {
    const index = this.news.findIndex((n) => n.id === id);
    if (index === -1) return undefined;

    const current = this.news[index];
    const updated: NewsArticle = {
      ...current,
      ...updates,
      id: current.id,
      slug: updates.slug ? generateSeoSlug(updates.slug) : current.slug,
    };

    this.news[index] = updated;
    this.syncNewsToSupabase(updated);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.saveNews(updated).catch(() => {});
    }
    return updated;
  }

  deleteNews(id: string): boolean {
    const initialLen = this.news.length;
    this.news = this.news.filter((n) => n.id !== id);
    this.deleteNewsFromSupabase(id);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.deleteNews(id).catch(() => {});
    }
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
    this.syncCommentToSupabase(newComment);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.saveComment(newComment).catch(() => {});
    }
    return newComment;
  }

  deleteComment(id: string): boolean {
    const initialLen = this.comments.length;
    this.comments = this.comments.filter((c) => c.id !== id);
    this.deleteCommentFromSupabase(id);
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.deleteComment(id).catch(() => {});
    }
    return this.comments.length < initialLen;
  }

  likeComment(id: string): { success: boolean; likes: number } {
    const comment = this.comments.find((c) => c.id === id);
    if (!comment) return { success: false, likes: 0 };
    comment.likes = (comment.likes || 0) + 1;
    this.syncCommentLikesToSupabase(id, comment.likes);
    this.persistState();
    return { success: true, likes: comment.likes };
  }

  resetToDefaults(clearUserOverrides = false): void {
    if (clearUserOverrides) {
      this.userOverrides = {
        teamLogos: {},
        teams: {},
        customTeams: [],
        players: {},
        customPlayers: [],
        deletedPlayerIds: [],
        deletedTeamIds: [],
        deletedGameIds: [],
      };
      this.saveUserOverridesToDisk();
    }
    this.competitions = [];
    this.seasons = [];
    this.teams = [];
    this.players = [];
    this.games = [];
    this.battingStats = [];
    this.pitchingStats = [];
    this.standings = [];
    this.news = [];
    this.videos = [];
    this.comments = [];

    // Always preserve user logos and custom data unless specifically requested to clear
    if (!clearUserOverrides) {
      this.applyUserOverrides();
    } else {
      this.deduplicatePlayers();
    }
    this.persistState();
  }

  clearAllData(): void {
    this.competitions = [];
    this.seasons = [];
    this.teams = [];
    this.players = [];
    this.games = [];
    this.battingStats = [];
    this.pitchingStats = [];
    this.standings = [];
    this.news = [];
    this.videos = [];
    this.comments = [];
    this.persistState();
    if (!isSupabaseServerConfigured()) {
      cloudSqlSync.clearAllTestData().catch((err: unknown) => {
        console.error('[BaseballRepository] Failed to clear Cloud SQL test data:', err);
      });
    }
  }

  getFullDatabase(): any {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      competitions: this.competitions,
      seasons: this.seasons,
      teams: this.teams,
      players: this.players,
      games: this.games,
      battingStats: this.battingStats,
      pitchingStats: this.pitchingStats,
      standings: this.standings,
      news: this.news,
      videos: this.videos,
      comments: this.comments,
    };
  }

  restoreFullDatabase(payload: any): { success: boolean; message: string; counts: Record<string, number> } {
    if (!payload || typeof payload !== 'object') {
      throw new Error('El archivo de respaldo o payload es inválido.');
    }
    if (Array.isArray(payload.players) && payload.players.length > 0) {
      this.players = payload.players;
    }
    if (Array.isArray(payload.teams) && payload.teams.length > 0) {
      this.teams = payload.teams;
    }
    if (Array.isArray(payload.games) && payload.games.length > 0) {
      this.games = payload.games;
    }
    if (Array.isArray(payload.news) && payload.news.length > 0) {
      this.news = payload.news;
    }
    if (Array.isArray(payload.standings) && payload.standings.length > 0) {
      this.standings = payload.standings;
    }
    if (Array.isArray(payload.battingStats) && payload.battingStats.length > 0) {
      this.battingStats = payload.battingStats;
    }
    if (Array.isArray(payload.pitchingStats) && payload.pitchingStats.length > 0) {
      this.pitchingStats = payload.pitchingStats;
    }
    this.deduplicatePlayers();
    this.persistState();

    return {
      success: true,
      message: 'Base de datos restaurada correctamente desde el respaldo.',
      counts: {
        players: this.players.length,
        teams: this.teams.length,
        games: this.games.length,
        news: this.news.length,
      },
    };
  }

  getDatabaseInfo(): { filePath: string; exists: boolean; sizeBytes: number; lastModified?: string; primarySource: string; counts: Record<string, number> } {
    const exists = fs.existsSync(this.dbFilePath);
    let sizeBytes = 0;
    let lastModified: string | undefined = undefined;
    if (exists) {
      try {
        const stats = fs.statSync(this.dbFilePath);
        sizeBytes = stats.size;
        lastModified = stats.mtime.toISOString();
      } catch (e) {
        // ignore
      }
    }
    return {
      filePath: this.dbFilePath,
      exists,
      sizeBytes,
      lastModified,
      primarySource: isSupabaseServerConfigured() ? 'supabase' : 'database.json',
      counts: {
        teams: this.teams.length,
        players: this.players.length,
        games: this.games.length,
        battingStats: this.battingStats.length,
        pitchingStats: this.pitchingStats.length,
        standings: this.standings.length,
        news: this.news.length,
        videos: this.videos.length,
        comments: this.comments.length,
      },
    };
  }
}

export const baseballRepo = new BaseballRepository();
