-- ========================================================
-- BASEBALL HUB — SUPABASE POSTGRESQL SCHEMA MIGRATION
-- FASE 2: DEFINICIÓN DE TABLAS, ÍNDICES, CONSTRAINTS Y RLS
-- ========================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- 1. COMPETITIONS
create table if not exists public.competitions (
  id text primary key,
  name text not null,
  slug text not null unique,
  short_name text not null,
  country text not null default 'Cuba',
  sport text not null default 'Baseball',
  type text not null default 'league',
  logo text,
  status text not null default 'active',
  current_season_id text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. SEASONS
create table if not exists public.seasons (
  id text primary key,
  competition_id text not null references public.competitions(id) on delete cascade,
  year integer not null,
  display_name text not null,
  slug text not null,
  start_date text,
  end_date text,
  is_current boolean default false,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. TEAMS
create table if not exists public.teams (
  id text primary key,
  name text not null,
  nickname text not null,
  short_name text not null,
  slug text not null,
  city text not null,
  stadium text not null,
  capacity integer not null default 15000,
  manager text not null default 'Director',
  founded_year integer not null default 1977,
  championships integer not null default 0,
  primary_color text not null default '#10B981',
  secondary_color text not null default '#1E293B',
  text_color text not null default '#FFFFFF',
  logo text not null default '⚾',
  competition_id text references public.competitions(id),
  season_id text references public.seasons(id),
  wins integer default 0,
  losses integer default 0,
  pct text default '0.000',
  streak text default '-',
  last_ten text default '0-0',
  position integer default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. PLAYERS
create table if not exists public.players (
  id text primary key,
  slug text not null,
  full_name text not null,
  short_name text not null,
  jersey_number integer not null default 0,
  position text not null,
  team_id text not null references public.teams(id) on delete cascade,
  team_short text not null,
  bats text not null default 'R',
  throws text not null default 'R',
  age integer default 25,
  birth_date text default '1999-01-01',
  photo text not null default '',
  bio text,
  is_favorite boolean default false,
  is_hall_of_fame boolean default false,
  is_all_star boolean default false,
  war text default '0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. PLAYER SEASON BATTING STATS
create table if not exists public.player_season_batting (
  id text primary key,
  player_id text not null references public.players(id) on delete cascade,
  season_id text not null,
  season_year integer not null,
  team_id text,
  team_short text not null,
  stage text not null default 'regular',
  games integer default 0,
  plate_appearances integer default 0,
  at_bats integer default 0,
  runs integer default 0,
  hits integer default 0,
  doubles integer default 0,
  triples integer default 0,
  home_runs integer default 0,
  rbi integer default 0,
  walks integer default 0,
  strikeouts integer default 0,
  stolen_bases integer default 0,
  caught_stealing integer default 0,
  avg text default '.000',
  obp text default '.000',
  slg text default '.000',
  ops text default '.000',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_batting_player_season_stage unique (player_id, season_id, stage)
);

-- 6. PLAYER SEASON PITCHING STATS
create table if not exists public.player_season_pitching (
  id text primary key,
  player_id text not null references public.players(id) on delete cascade,
  season_id text not null,
  season_year integer not null,
  team_id text,
  team_short text not null,
  stage text not null default 'regular',
  games integer default 0,
  games_started integer default 0,
  innings_pitched text default '0.0',
  wins integer default 0,
  losses integer default 0,
  saves integer default 0,
  hits integer default 0,
  runs integer default 0,
  earned_runs integer default 0,
  walks integer default 0,
  strikeouts integer default 0,
  era text default '0.00',
  whip text default '0.00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_pitching_player_season_stage unique (player_id, season_id, stage)
);

-- 7. PLAYER CAREER STATS
create table if not exists public.player_career_stats (
  id text primary key,
  player_id text not null unique references public.players(id) on delete cascade,
  totals jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 8. GAMES
create table if not exists public.games (
  id text primary key,
  competition_id text not null references public.competitions(id),
  season_id text not null references public.seasons(id),
  date text not null,
  time text not null default '14:00',
  stadium text not null,
  status text not null default 'SCHEDULED',
  home_team_id text not null references public.teams(id),
  away_team_id text not null references public.teams(id),
  home_score integer default 0,
  away_score integer default 0,
  home_hits integer default 0,
  away_hits integer default 0,
  home_errors integer default 0,
  away_errors integer default 0,
  current_inning integer default 1,
  is_top_inning boolean default true,
  outs integer default 0,
  balls integer default 0,
  strikes integer default 0,
  bases jsonb default '{"first":false,"second":false,"third":false}'::jsonb,
  line_score jsonb default '[]'::jsonb,
  lineups jsonb default '{}'::jsonb,
  winning_pitcher text,
  losing_pitcher text,
  save_pitcher text,
  umpires jsonb default '[]'::jsonb,
  plays jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. GAME LINEUPS
create table if not exists public.game_lineups (
  id text primary key,
  game_id text not null references public.games(id) on delete cascade,
  team_id text not null references public.teams(id),
  player_id text not null references public.players(id),
  batting_order integer not null,
  position text not null,
  is_starter boolean default true
);

-- 10. GAME EVENTS (Play-by-Play)
create table if not exists public.game_events (
  id text primary key,
  game_id text not null references public.games(id) on delete cascade,
  inning integer not null,
  half text not null,
  sequence integer not null,
  event_type text not null,
  description text not null,
  batter_id text,
  pitcher_id text,
  runner_id text,
  outs integer default 0,
  balls integer default 0,
  strikes integer default 0,
  runs_scored integer default 0,
  created_at timestamptz not null default now()
);

-- 11. STANDINGS
create table if not exists public.standings (
  id text primary key,
  competition_id text not null references public.competitions(id),
  season_id text not null references public.seasons(id),
  team_id text not null references public.teams(id),
  games integer default 0,
  wins integer default 0,
  losses integer default 0,
  pct text default '0.000',
  runs_scored integer default 0,
  runs_allowed integer default 0,
  run_differential integer default 0,
  streak text default '-',
  home_record text default '0-0',
  away_record text default '0-0',
  last_ten text default '0-0',
  games_behind text default '0.0',
  position integer default 1,
  division text,
  updated_at timestamptz not null default now(),
  constraint uq_standings_season_team unique (season_id, team_id)
);

-- 12. NEWS
create table if not exists public.news (
  id text primary key,
  title text not null,
  slug text not null unique,
  subtitle text,
  excerpt text not null,
  content text not null,
  image text not null,
  author text not null default 'Prensa Oficial Béisbol Hub',
  published_at text not null,
  category text not null default 'Crónica',
  tags jsonb default '["Béisbol"]'::jsonb,
  reading_time_minutes integer default 4,
  is_featured boolean default false,
  image_height text default 'tall',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 13. NEWS COMMENTS
create table if not exists public.news_comments (
  id text primary key,
  article_slug text not null,
  author_name text not null default 'Aficionado al Béisbol',
  favorite_team text,
  content text not null,
  likes integer default 0,
  created_at text not null
);

-- 14. USERS & PROFILES
create table if not exists public.users (
  id text primary key,
  uid text not null unique,
  email text not null,
  display_name text,
  photo_url text,
  role text not null default 'user',
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 15. NOTIFICATIONS
create table if not exists public.notifications (
  id text primary key,
  title text not null,
  description text not null,
  game_id text,
  scoring_team_id text,
  type text not null default 'score',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 16. AUDIT LOGS
create table if not exists public.audit_logs (
  id text primary key,
  username text not null,
  action text not null,
  details text not null,
  category text not null default 'system',
  timestamp text not null,
  created_at timestamptz not null default now()
);

-- 17. TEAM LOGOS
create table if not exists public.team_logos (
  team_id text primary key references public.teams(id) on delete cascade,
  logo text not null,
  primary_color text,
  updated_at timestamptz not null default now()
);

-- 18. PLAYER PHOTOS
create table if not exists public.player_photos (
  player_id text primary key references public.players(id) on delete cascade,
  photo text not null,
  updated_at timestamptz not null default now()
);

-- 19. APP SETTINGS
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ========================================================
-- ÍNDICES DE ALTO RENDIMIENTO
-- ========================================================
create index if not exists idx_players_slug on public.players (slug);
create index if not exists idx_players_team_id on public.players (team_id);
create index if not exists idx_players_full_name on public.players (full_name);
create index if not exists idx_teams_slug on public.teams (slug);
create index if not exists idx_seasons_slug on public.seasons (slug);
create index if not exists idx_seasons_year on public.seasons (year);
create index if not exists idx_games_date on public.games (date);
create index if not exists idx_games_season on public.games (season_id);
create index if not exists idx_games_teams on public.games (home_team_id, away_team_id);
create index if not exists idx_games_status on public.games (status);
create index if not exists idx_batting_player on public.player_season_batting (player_id);
create index if not exists idx_batting_season on public.player_season_batting (season_id);
create index if not exists idx_pitching_player on public.player_season_pitching (player_id);
create index if not exists idx_pitching_season on public.player_season_pitching (season_id);
create index if not exists idx_news_slug on public.news (slug);
create index if not exists idx_news_comments_article on public.news_comments (article_slug);
create index if not exists idx_game_events_game on public.game_events (game_id, sequence);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
alter table public.competitions enable row level security;
alter table public.seasons enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_season_batting enable row level security;
alter table public.player_season_pitching enable row level security;
alter table public.player_career_stats enable row level security;
alter table public.games enable row level security;
alter table public.game_lineups enable row level security;
alter table public.game_events enable row level security;
alter table public.standings enable row level security;
alter table public.news enable row level security;
alter table public.news_comments enable row level security;
alter table public.users enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.team_logos enable row level security;
alter table public.player_photos enable row level security;
alter table public.app_settings enable row level security;

-- Public read policies for all sports data
create policy "Public read competitions" on public.competitions for select using (true);
create policy "Public read seasons" on public.seasons for select using (true);
create policy "Public read teams" on public.teams for select using (true);
create policy "Public read players" on public.players for select using (true);
create policy "Public read player_season_batting" on public.player_season_batting for select using (true);
create policy "Public read player_season_pitching" on public.player_season_pitching for select using (true);
create policy "Public read player_career_stats" on public.player_career_stats for select using (true);
create policy "Public read games" on public.games for select using (true);
create policy "Public read game_lineups" on public.game_lineups for select using (true);
create policy "Public read game_events" on public.game_events for select using (true);
create policy "Public read standings" on public.standings for select using (true);
create policy "Public read news" on public.news for select using (true);
create policy "Public read news_comments" on public.news_comments for select using (true);
create policy "Public read notifications" on public.notifications for select using (true);
create policy "Public read team_logos" on public.team_logos for select using (true);
create policy "Public read player_photos" on public.player_photos for select using (true);
create policy "Public read app_settings" on public.app_settings for select using (true);

-- Allow public creation of comments
create policy "Public create comments" on public.news_comments for insert with check (length(content) >= 3);

-- User profiles
create policy "Users read own profile" on public.users for select using (true);
create policy "Users update own profile" on public.users for update using (auth.uid() = uid);

-- Service role bypasses RLS automatically; Server Express API with service role key has full manage permissions
