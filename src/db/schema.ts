import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table (mandatory for Firebase Auth link)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Teams table
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nickname: text('nickname').notNull(),
  shortName: text('short_name').notNull(),
  city: text('city').notNull(),
  stadium: text('stadium').notNull(),
  capacity: integer('capacity').notNull().default(15000),
  manager: text('manager').notNull(),
  foundedYear: integer('founded_year').notNull().default(1977),
  championships: integer('championships').notNull().default(0),
  primaryColor: text('primary_color').notNull().default('#10B981'),
  secondaryColor: text('secondary_color').notNull().default('#1E293B'),
  textColor: text('text_color').notNull().default('#FFFFFF'),
  logo: text('logo').notNull().default('⚾'),
  competitionId: text('competition_id').default('snb'),
  seasonId: text('season_id').default('snb-65'),
  wins: integer('wins').default(0),
  losses: integer('losses').default(0),
  pct: text('pct').default('0.000'),
  streak: text('streak').default('E0'),
  lastTen: text('last_ten').default('0-0'),
  position: integer('position').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Players table
export const players = pgTable('players', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  fullName: text('full_name').notNull(),
  shortName: text('short_name').notNull(),
  number: integer('number').notNull(),
  position: text('position').notNull(),
  teamId: text('team_id').notNull(),
  teamShort: text('team_short').notNull(),
  bats: text('bats').notNull().default('R'),
  throws: text('throws').notNull().default('R'),
  age: integer('age').notNull().default(25),
  birthDate: text('birth_date').notNull().default('1999-01-01'),
  photo: text('photo').notNull().default(''),
  isFavorite: boolean('is_favorite').default(false),
  isHallOfFame: boolean('is_hall_of_fame').default(false),
  isAllStar: boolean('is_all_star').default(false),
  war: text('war').default('0.0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Team Logos table for custom uploaded logos
export const teamLogos = pgTable('team_logos', {
  teamId: text('team_id').primaryKey(),
  logo: text('logo').notNull(),
  primaryColor: text('primary_color'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// App Settings & sync metadata
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Games table (Partidos y marcadores oficiales)
export const games = pgTable('games', {
  id: text('id').primaryKey(),
  competitionId: text('competition_id').notNull().default('snb'),
  seasonId: text('season_id').notNull().default('snb-65'),
  date: text('date').notNull(),
  time: text('time').notNull().default('14:00'),
  stadium: text('stadium').notNull().default('Estadio Principal'),
  status: text('status').notNull().default('SCHEDULED'),
  homeTeamId: text('home_team_id').notNull(),
  awayTeamId: text('away_team_id').notNull(),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
  homeHits: integer('home_hits').notNull().default(0),
  awayHits: integer('away_hits').notNull().default(0),
  homeErrors: integer('home_errors').notNull().default(0),
  awayErrors: integer('away_errors').notNull().default(0),
  currentInning: integer('current_inning').default(1),
  isTopInning: boolean('is_top_inning').default(true),
  outs: integer('outs').default(0),
  balls: integer('balls').default(0),
  strikes: integer('strikes').default(0),
  bases: text('bases').default('{"first":false,"second":false,"third":false}'),
  lineScore: text('line_score').default('[]'),
  lineups: text('lineups').default('{}'),
  winningPitcher: text('winning_pitcher'),
  losingPitcher: text('losing_pitcher'),
  savePitcher: text('save_pitcher'),
  umpires: text('umpires').default('[]'),
  plays: text('plays').default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// News table (Noticias, crónicas y reportajes)
export const news = pgTable('news', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  subtitle: text('subtitle'),
  excerpt: text('excerpt').notNull(),
  content: text('content').notNull(),
  image: text('image').notNull(),
  author: text('author').notNull().default('Prensa Oficial Béisbol Hub'),
  publishedAt: text('published_at').notNull(),
  category: text('category').notNull().default('Crónica'),
  tags: text('tags').notNull().default('["Béisbol"]'),
  readingTimeMinutes: integer('reading_time_minutes').default(4),
  isFeatured: boolean('is_featured').default(false),
  imageHeight: text('image_height').default('tall'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Article Comments table
export const newsComments = pgTable('news_comments', {
  id: text('id').primaryKey(),
  articleSlug: text('article_slug').notNull(),
  authorName: text('author_name').notNull().default('Aficionado al Béisbol'),
  favoriteTeam: text('favorite_team'),
  content: text('content').notNull(),
  likes: integer('likes').default(0),
  createdAt: text('created_at').notNull(),
});

// Audit Logs table (Auditoría de administración)
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  category: text('category').notNull().default('general'),
  timestamp: text('timestamp').notNull(),
});

// Relationships
export const teamsRelations = relations(teams, ({ many }) => ({
  players: many(players),
  homeGames: many(games, { relationName: 'homeTeam' }),
  awayGames: many(games, { relationName: 'awayTeam' }),
}));

export const gamesRelations = relations(games, ({ one }) => ({
  homeTeam: one(teams, {
    fields: [games.homeTeamId],
    references: [teams.id],
    relationName: 'homeTeam',
  }),
  awayTeam: one(teams, {
    fields: [games.awayTeamId],
    references: [teams.id],
    relationName: 'awayTeam',
  }),
}));

export const playersRelations = relations(players, ({ one }) => ({
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
}));
