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

// Relationships
export const teamsRelations = relations(teams, ({ many }) => ({
  players: many(players),
}));

export const playersRelations = relations(players, ({ one }) => ({
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
}));
