# DATABASE.md — Esquema Relacional de Base de Datos (PostgreSQL / Supabase)

El diseño de base de datos de **BASEBALL HUB** sigue las mejores prácticas de modelado relacional en 3FN, asegurando integridad referencial, índices óptimos para consultas analíticas y particionamiento lógico por competición y temporada.

---

## 1. Diagrama de Relaciones Entidad-Relación (ER)

```text
COMPETITIONS (1) ──< (N) SEASONS
                           │ (1)
                           ├──< (N) TEAMS_IN_SEASON >── (N) TEAMS
                           ├──< (N) GAMES (Home/Away Team, Stadium)
                           │         ├──< (N) GAME_LINEUPS (Players)
                           │         ├──< (N) GAME_EVENTS (Play-by-play)
                           │         └──< (N) GAME_BOX_SCORES
                           └──< (N) STANDINGS (Team, Record, Run Diff)

PLAYERS (1) ───────< (N) PLAYER_SEASONS >── (N) TEAMS
     │ (1)
     ├──< (N) BATTING_STATS (Season / Split / Game)
     ├──< (N) PITCHING_STATS (Season / Split / Game)
     └──< (N) FIELDING_STATS (Season / Position)

NEWS (1) ──────────< (N) NEWS_TAGS / RELATIONS (Teams, Players)
IMPORTS (1) ───────< (N) IMPORT_LOGS (Errors, Warnings)
```

---

## 2. Definición DDL (PostgreSQL)

```sql
-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. COMPETICIONES
CREATE TABLE competitions (
    id VARCHAR(50) PRIMARY KEY, -- ej: 'cuba-snb', 'cuba-lebc', 'mlb', 'wbc'
    name VARCHAR(150) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    country VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'league', 'tournament', 'cup'
    logo_url TEXT,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'upcoming'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TEMPORADAS
CREATE TABLE seasons (
    id VARCHAR(50) PRIMARY KEY, -- ej: 'cuba-snb-2026'
    competition_id VARCHAR(50) NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'in_progress', -- 'scheduled', 'in_progress', 'finished'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_seasons_competition ON seasons(competition_id, year DESC);

-- 3. CIUDADES Y ESTADIOS
CREATE TABLE stadiums (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    capacity INTEGER,
    surface VARCHAR(50) DEFAULT 'Grass',
    dimensions JSONB -- ej: {"left": 325, "center": 400, "right": 325}
);

-- 4. EQUIPOS
CREATE TABLE teams (
    id VARCHAR(50) PRIMARY KEY, -- ej: 'matanzas-cocodrilos', 'industriales'
    name VARCHAR(120) NOT NULL,
    nickname VARCHAR(80),
    short_name VARCHAR(10) NOT NULL, -- ej: 'MTZ', 'IND'
    city VARCHAR(100) NOT NULL,
    stadium_id VARCHAR(50) REFERENCES stadiums(id),
    color_primary VARCHAR(7) NOT NULL, -- Hex '#D32F2F'
    color_secondary VARCHAR(7) NOT NULL,
    logo_url TEXT,
    manager VARCHAR(120),
    founded_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. JUGADORES
CREATE TABLE players (
    id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) UNIQUE NOT NULL,
    current_team_id VARCHAR(50) REFERENCES teams(id),
    primary_position VARCHAR(10) NOT NULL, -- 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'RP'
    jersey_number INTEGER,
    birth_date DATE,
    birth_city VARCHAR(100),
    birth_country VARCHAR(100),
    height_cm INTEGER,
    weight_kg INTEGER,
    bats VARCHAR(1) CHECK (bats IN ('R', 'L', 'S')), -- Right, Left, Switch
    throws VARCHAR(1) CHECK (throws IN ('R', 'L')),
    photo_url TEXT,
    bio TEXT,
    status VARCHAR(20) DEFAULT 'active'
);
CREATE INDEX idx_players_team ON players(current_team_id);
CREATE INDEX idx_players_name_trgm ON players USING gin (full_name gin_trgm_ops);

-- 6. PARTIDOS (GAMES)
CREATE TABLE games (
    id VARCHAR(50) PRIMARY KEY,
    season_id VARCHAR(50) NOT NULL REFERENCES seasons(id),
    competition_id VARCHAR(50) NOT NULL REFERENCES competitions(id),
    home_team_id VARCHAR(50) NOT NULL REFERENCES teams(id),
    away_team_id VARCHAR(50) NOT NULL REFERENCES teams(id),
    stadium_id VARCHAR(50) REFERENCES stadiums(id),
    game_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'SCHEDULED', 'LIVE', 'FINAL', 'POSTPONED', 'SUSPENDED'
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    current_inning INTEGER,
    is_top_inning BOOLEAN,
    outs INTEGER DEFAULT 0,
    home_hits INTEGER DEFAULT 0,
    away_hits INTEGER DEFAULT 0,
    home_errors INTEGER DEFAULT 0,
    away_errors INTEGER DEFAULT 0,
    winning_pitcher_id VARCHAR(50) REFERENCES players(id),
    losing_pitcher_id VARCHAR(50) REFERENCES players(id),
    save_pitcher_id VARCHAR(50) REFERENCES players(id),
    line_score JSONB, -- Array de carreras por inning [{"inn": 1, "home": 0, "away": 2}, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_games_season_date ON games(season_id, game_date);
CREATE INDEX idx_games_status ON games(status);

-- 7. ESTADÍSTICAS DE BATEO (ACUMULADAS POR TEMPORADA)
CREATE TABLE batting_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id VARCHAR(50) NOT NULL REFERENCES players(id),
    season_id VARCHAR(50) NOT NULL REFERENCES seasons(id),
    team_id VARCHAR(50) NOT NULL REFERENCES teams(id),
    games_played INTEGER DEFAULT 0,
    plate_appearances INTEGER DEFAULT 0,
    at_bats INTEGER DEFAULT 0,
    runs INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    doubles INTEGER DEFAULT 0,
    triples INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    runs_batted_in INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    caught_stealing INTEGER DEFAULT 0,
    hit_by_pitch INTEGER DEFAULT 0,
    sacrifice_hits INTEGER DEFAULT 0,
    sacrifice_flies INTEGER DEFAULT 0,
    -- Campos calculados
    batting_average NUMERIC(5,3) GENERATED ALWAYS AS (
        CASE WHEN at_bats > 0 THEN ROUND(hits::numeric / at_bats::numeric, 3) ELSE 0.000 END
    ) STORED,
    on_base_percentage NUMERIC(5,3),
    slugging_percentage NUMERIC(5,3),
    on_base_plus_slugging NUMERIC(5,3),
    -- Métricas avanzadas
    woba NUMERIC(5,3),
    wrc_plus INTEGER,
    war NUMERIC(4,1),
    babip NUMERIC(5,3),
    iso NUMERIC(5,3),
    CONSTRAINT uq_player_season_team_bat UNIQUE(player_id, season_id, team_id)
);

-- 8. ESTADÍSTICAS DE PITCHEO
CREATE TABLE pitching_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id VARCHAR(50) NOT NULL REFERENCES players(id),
    season_id VARCHAR(50) NOT NULL REFERENCES seasons(id),
    team_id VARCHAR(50) NOT NULL REFERENCES teams(id),
    games_pitched INTEGER DEFAULT 0,
    games_started INTEGER DEFAULT 0,
    complete_games INTEGER DEFAULT 0,
    shutouts INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    innings_pitched NUMERIC(6,1) DEFAULT 0.0,
    hits_allowed INTEGER DEFAULT 0,
    runs_allowed INTEGER DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    home_runs_allowed INTEGER DEFAULT 0,
    walks_allowed INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    whip NUMERIC(5,2),
    earned_run_average NUMERIC(5,2),
    fip NUMERIC(5,2),
    era_plus INTEGER,
    k_per_nine NUMERIC(4,2),
    bb_per_nine NUMERIC(4,2),
    war NUMERIC(4,1),
    CONSTRAINT uq_player_season_team_pitch UNIQUE(player_id, season_id, team_id)
);

-- 9. TABLA DE POSICIONES (STANDINGS)
CREATE TABLE standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id VARCHAR(50) NOT NULL REFERENCES seasons(id),
    team_id VARCHAR(50) NOT NULL REFERENCES teams(id),
    division VARCHAR(50) DEFAULT 'General',
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_pct NUMERIC(5,3),
    games_behind NUMERIC(4,1) DEFAULT 0.0,
    runs_scored INTEGER DEFAULT 0,
    runs_allowed INTEGER DEFAULT 0,
    run_differential INTEGER GENERATED ALWAYS AS (runs_scored - runs_allowed) STORED,
    home_record VARCHAR(10),
    away_record VARCHAR(10),
    last_ten VARCHAR(10),
    streak VARCHAR(5),
    CONSTRAINT uq_standing_season_team UNIQUE(season_id, team_id)
);

-- 10. NOTICIAS Y ARTÍCULOS
CREATE TABLE news (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(250) NOT NULL,
    slug VARCHAR(280) UNIQUE NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    author VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Cronica', 'Entrevista', 'Estadisticas', 'Internacional'
    tags TEXT[],
    competition_id VARCHAR(50) REFERENCES competitions(id),
    team_id VARCHAR(50) REFERENCES teams(id),
    player_id VARCHAR(50) REFERENCES players(id),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. REGISTRO DE INGESTIÓN Y AUDITORÍA
CREATE TABLE data_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type VARCHAR(50) NOT NULL, -- 'CSV', 'JSON', 'API', 'MANUAL'
    file_name VARCHAR(200),
    status VARCHAR(20) NOT NULL, -- 'PENDING', 'VALIDATED', 'COMMITTED', 'FAILED'
    total_records INTEGER DEFAULT 0,
    valid_records INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
