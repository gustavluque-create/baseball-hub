export type CompetitionType = 'league' | 'tournament' | 'cup';
export type CompetitionStatus = 'active' | 'upcoming' | 'archived';

export interface Competition {
  id: string;
  name: string;
  shortName: string;
  country: string;
  type: CompetitionType;
  logo: string;
  status: CompetitionStatus;
  currentSeasonId: string;
}

export interface Season {
  id: string;
  competitionId: string;
  year: number;
  name: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  status: 'scheduled' | 'in_progress' | 'finished';
}

export interface TeamColors {
  primary: string;
  secondary: string;
  text: string;
}

export interface Team {
  id: string;
  name: string;
  nickname: string;
  shortName: string;
  city: string;
  stadium: string;
  capacity?: number;
  stadiumCapacity?: number;
  manager: string;
  foundedYear: number;
  championships: number | string[];
  colors: TeamColors;
  primaryColor?: string;
  logo: string;
  competitionId: string;
  seasonId: string;
  record: {
    wins: number;
    losses: number;
    pct: number;
    streak: string;
    lastTen: string;
    position: number;
  };
}

export type PlayerPosition = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH' | 'SP' | 'RP';
export type BatHand = 'R' | 'L' | 'S';
export type ThrowHand = 'R' | 'L';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  slug: string;
  teamId: string;
  teamName: string;
  teamShort: string;
  position: PlayerPosition;
  jerseyNumber: number;
  birthDate: string;
  age: number;
  birthPlace: string;
  birthCountry: string;
  height: string; // e.g. "1.85 m" or "6'1\""
  weight: string; // e.g. "88 kg" or "195 lbs"
  bats: BatHand;
  throws: ThrowHand;
  photo: string;
  bio: string;
  status: 'active' | 'injured' | 'minors';
}

export type GameStatus = 'SCHEDULED' | 'LIVE' | 'FINAL' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED';

export interface InningScore {
  inning: number;
  home: number | null;
  away: number | null;
}

export interface BatterBox {
  playerId: string;
  name: string;
  position: string;
  order: number;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  avg: string;
  ops: string;
}

export interface PitcherBox {
  playerId: string;
  name: string;
  decision?: 'W' | 'L' | 'S' | 'H';
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  era: string;
}

export interface PlayEvent {
  id: string;
  inning: number;
  isTop: boolean;
  outs: number;
  description: string;
  scoreAfter: string;
  isScoringPlay?: boolean;
}

export interface Game {
  id: string;
  competitionId: string;
  seasonId: string;
  date: string;
  time: string;
  stadium: string;
  status: GameStatus;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  currentInning?: number;
  isTopInning?: boolean;
  outs?: number;
  lineScore: InningScore[];
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
  umpires?: string[];
  winningPitcher?: { name: string; record: string };
  losingPitcher?: { name: string; record: string };
  savePitcher?: { name: string; saves: number };
  battingBoxScore?: {
    home: BatterBox[];
    away: BatterBox[];
  };
  pitchingBoxScore?: {
    home: PitcherBox[];
    away: PitcherBox[];
  };
  plays?: PlayEvent[];
}

export interface BattingStats {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamShort: string;
  position: PlayerPosition;
  seasonYear: number;
  games: number;
  pa: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  sb: number;
  cs: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  // Sabermetrics
  woba?: number;
  war?: number;
  babip?: number;
  iso?: number;
  opsPlus?: number;
}

export interface PitchingStats {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamShort: string;
  position: 'SP' | 'RP';
  seasonYear: number;
  games: number;
  gs: number;
  cg: number;
  sho: number;
  w: number;
  l: number;
  sv: number;
  wins?: number;
  losses?: number;
  saves?: number;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  era: number;
  whip: number;
  fip?: number;
  eraPlus?: number;
  k9?: number;
  bb9?: number;
  war?: number;
}

export interface FieldingStats {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamShort: string;
  position: PlayerPosition;
  games: number;
  po: number;
  a: number;
  e: number;
  dp: number;
  fpct: number;
}

export interface Standing {
  id?: string;
  teamId: string;
  teamName: string;
  teamShort: string;
  logo: string;
  teamLogo?: string;
  rank?: number;
  division: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pct: number;
  diff: number | string; // GB (e.g. 0, 2.5 or '—')
  gamesBehind?: number;
  runsScored: number;
  runsAllowed: number;
  runsAgainst?: number;
  runDiff: number;
  homeRecord: string;
  awayRecord: string;
  lastTen: string;
  streak: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  publishedAt: string;
  readingTimeMinutes?: number;
  category: 'Crónica' | 'Entrevista' | 'Estadísticas' | 'Ligas Extranjeras' | 'Récords' | string;
  tags: string[];
  competitionId?: string;
  teamId?: string;
  playerId?: string;
  relatedTeams?: string[];
  relatedPlayers?: string[];
  isFeatured?: boolean;
  imageHeight?: 'tall' | 'medium' | 'wide' | 'panoramic';
}

export interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  competition: string;
  category?: string;
  views: string;
  viewsCount?: number;
  date: string;
  publishedAt?: string;
  url?: string;
}

export interface IngestionValidationSummary {
  totalRecords: number;
  validRecords: number;
  warnings: Array<{ row: number; field: string; message: string }>;
  errors: Array<{ row: number; field: string; message: string }>;
  preview: any[];
  records?: any[];
}

export interface TeamAggregatedStats {
  teamId: string;
  teamShort: string;
  teamName: string;
  batting: {
    avg: number;
    obp: number;
    slg: number;
    ops: number;
    runs: number;
    hits: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    rbi: number;
    walks: number;
    strikeouts: number;
    stolenBases: number;
  };
  pitching: {
    era: number;
    whip: number;
    wins: number;
    losses: number;
    saves: number;
    inningsPitched: number;
    hitsAllowed: number;
    runsAllowed: number;
    earnedRuns: number;
    walks: number;
    strikeouts: number;
    homeRunsAllowed: number;
    k9: number;
    bb9: number;
  };
}

export interface MatchupComparisonData {
  game: Game;
  awayTeam: Team;
  homeTeam: Team;
  awayStanding?: Standing;
  homeStanding?: Standing;
  awayStats: TeamAggregatedStats;
  homeStats: TeamAggregatedStats;
  headToHeadGames: Game[];
  awayTopBatter?: { player: Player; stats: BattingStats };
  homeTopBatter?: { player: Player; stats: BattingStats };
  awayTopPitcher?: { player: Player; stats: PitchingStats };
  homeTopPitcher?: { player: Player; stats: PitchingStats };
}

export interface ScoreNotificationEvent {
  id: string;
  gameId: string;
  timestamp: number;
  homeTeam: Team;
  awayTeam: Team;
  scoringTeam: Team;
  scoringTeamSide: 'home' | 'away';
  runsScored: number;
  homeScore: number;
  awayScore: number;
  inning: number;
  isTopInning: boolean;
  outs: number;
  title?: string;
  description: string;
  playType?: 'homerun' | 'hit' | 'sacrifice' | 'walk' | 'standard';
  autoDismissMs?: number;
  read?: boolean;
}

export type RealTimeConnectionMode = 'stream' | 'polling';
export type RealTimeConnectionStatus = 'connected' | 'polling' | 'connecting' | 'disconnected' | 'error';

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'superadmin' | 'official_scorer' | 'editor';
  lastLogin: string;
}

export interface AdminAuthResponse {
  success: boolean;
  token?: string;
  admin?: AdminUser;
  message?: string;
}

export interface AdminAuditLog {
  id: string;
  timestamp: number;
  username: string;
  action: string;
  details: string;
  category: 'auth' | 'games' | 'players' | 'teams' | 'etl' | 'system';
}

export interface AdminSystemOverview {
  totalGames: number;
  liveGames: number;
  totalPlayers: number;
  totalTeams: number;
  notificationClients: number;
  uptimeSeconds: number;
  lastIngestionDate?: string;
}

export interface ArticleComment {
  id: string;
  articleSlug: string;
  authorName: string;
  favoriteTeam?: string;
  content: string;
  createdAt: string;
  likes?: number;
}

