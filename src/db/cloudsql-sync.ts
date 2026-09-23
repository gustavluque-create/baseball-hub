import { db } from './index.ts';
import { teams, players, teamLogos, appSettings } from './schema.ts';
import { eq, inArray } from 'drizzle-orm';
import { Team, Player } from '../types/index.ts';

export class CloudSqlSyncService {
  private static instance: CloudSqlSyncService;

  public static getInstance(): CloudSqlSyncService {
    if (!CloudSqlSyncService.instance) {
      CloudSqlSyncService.instance = new CloudSqlSyncService();
    }
    return CloudSqlSyncService.instance;
  }

  /**
   * Check if Cloud SQL has data
   */
  public async hasData(): Promise<boolean> {
    try {
      const result = await db.select().from(teams).limit(1);
      return result.length > 0;
    } catch (err) {
      console.warn('[CloudSqlSync] Notice checking data in Cloud SQL:', err);
      return false;
    }
  }

  /**
   * Load all teams, players, and custom logos from Cloud SQL
   */
  public async loadFromCloudSql(): Promise<{
    teams: Team[];
    players: Player[];
    teamLogos: Record<string, { logo: string; primaryColor?: string }>;
  } | null> {
    try {
      const dbTeams = await db.select().from(teams);
      const dbPlayers = await db.select().from(players);
      const dbLogos = await db.select().from(teamLogos);

      if (dbTeams.length === 0) {
        return null;
      }

      const logosMap: Record<string, { logo: string; primaryColor?: string }> = {};
      for (const row of dbLogos) {
        logosMap[row.teamId.toLowerCase()] = {
          logo: row.logo,
          primaryColor: row.primaryColor || undefined,
        };
      }

      const mappedTeams: Team[] = dbTeams.map((t) => {
        const logoData = logosMap[t.id.toLowerCase()] || logosMap[t.shortName.toLowerCase()];
        return {
          id: t.id,
          name: t.name,
          nickname: t.nickname,
          shortName: t.shortName,
          city: t.city,
          stadium: t.stadium,
          capacity: t.capacity,
          stadiumCapacity: t.capacity,
          manager: t.manager,
          foundedYear: t.foundedYear,
          championships: t.championships,
          colors: {
            primary: logoData?.primaryColor || t.primaryColor,
            secondary: t.secondaryColor,
            text: t.textColor,
          },
          primaryColor: logoData?.primaryColor || t.primaryColor,
          logo: logoData?.logo || t.logo,
          competitionId: t.competitionId || 'snb',
          seasonId: t.seasonId || 'snb-65',
          record: {
            wins: t.wins ?? 0,
            losses: t.losses ?? 0,
            pct: parseFloat(t.pct || '0'),
            streak: t.streak || 'E0',
            lastTen: t.lastTen || '0-0',
            position: t.position ?? 1,
          },
        };
      });

      const teamNameMap = new Map(mappedTeams.map((t) => [t.id, t.name]));

      const mappedPlayers: Player[] = dbPlayers.map((p) => {
        const parts = (p.fullName || '').split(' ');
        const firstName = parts[0] || 'Jugador';
        const lastName = parts.slice(1).join(' ') || 'Oficial';
        return {
          id: p.id,
          slug: p.slug,
          firstName,
          lastName,
          fullName: p.fullName,
          jerseyNumber: p.number,
          position: p.position as any,
          teamId: p.teamId,
          teamName: teamNameMap.get(p.teamId) || p.teamShort,
          teamShort: p.teamShort,
          bats: (p.bats as any) || 'R',
          throws: (p.throws as any) || 'R',
          age: p.age,
          birthDate: p.birthDate,
          birthPlace: 'Cuba',
          birthCountry: 'Cuba',
          height: '1.82 m',
          weight: '84 kg',
          photo: p.photo,
          bio: '',
          status: 'active',
        };
      });

      console.log(`✅ [CloudSqlSync] Loaded ${mappedTeams.length} teams, ${mappedPlayers.length} players, and ${dbLogos.length} logos from Cloud SQL PostgreSQL.`);
      return {
        teams: mappedTeams,
        players: mappedPlayers,
        teamLogos: logosMap,
      };
    } catch (err) {
      console.error('[CloudSqlSync] Failed to load data from Cloud SQL:', err);
      return null;
    }
  }

  /**
   * Seed Cloud SQL from initial repository data if database is empty
   */
  public async seedIfEmpty(
    baseTeams: Team[],
    basePlayers: Player[],
    customLogos: Record<string, { logo: string; primaryColor?: string }> = {}
  ): Promise<boolean> {
    try {
      const exists = await this.hasData();
      if (exists) {
        console.log('[CloudSqlSync] Cloud SQL already contains data. Skipping initial seeding.');
        return false;
      }

      console.log(`🌱 [CloudSqlSync] Seeding Cloud SQL with ${baseTeams.length} teams and ${basePlayers.length} players...`);

      // Insert teams
      for (const t of baseTeams) {
        const champCount = Array.isArray(t.championships) ? t.championships.length : Number(t.championships || 0);
        await db
          .insert(teams)
          .values({
            id: t.id,
            name: t.name,
            nickname: t.nickname || t.name,
            shortName: t.shortName,
            city: t.city || 'Cuba',
            stadium: t.stadium || 'Estadio',
            capacity: Number(t.capacity || t.stadiumCapacity || 15000),
            manager: t.manager || 'Director Técnico',
            foundedYear: Number(t.foundedYear || 1977),
            championships: champCount,
            primaryColor: t.colors?.primary || '#10B981',
            secondaryColor: t.colors?.secondary || '#1E293B',
            textColor: t.colors?.text || '#FFFFFF',
            logo: t.logo || '⚾',
            competitionId: t.competitionId || 'snb',
            seasonId: t.seasonId || 'snb-65',
            wins: t.record?.wins ?? 0,
            losses: t.record?.losses ?? 0,
            pct: (t.record?.pct ?? 0).toString(),
            streak: t.record?.streak || 'E0',
            lastTen: t.record?.lastTen || '0-0',
            position: t.record?.position ?? 1,
          })
          .onConflictDoUpdate({
            target: teams.id,
            set: {
              name: t.name,
              logo: t.logo,
              manager: t.manager,
            },
          });
      }

      // Insert players in chunks
      const chunkSize = 50;
      for (let i = 0; i < basePlayers.length; i += chunkSize) {
        const chunk = basePlayers.slice(i, i + chunkSize);
        for (const p of chunk) {
          await db
            .insert(players)
            .values({
              id: p.id,
              slug: p.slug || p.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              fullName: p.fullName,
              shortName: p.lastName || p.fullName,
              number: p.jerseyNumber !== undefined ? p.jerseyNumber : 99,
              position: p.position,
              teamId: p.teamId,
              teamShort: p.teamShort || '',
              bats: p.bats || 'R',
              throws: p.throws || 'R',
              age: p.age || 25,
              birthDate: p.birthDate || '1999-01-01',
              photo: p.photo || '',
              isFavorite: false,
              isHallOfFame: false,
              isAllStar: false,
              war: '0.0',
            })
            .onConflictDoNothing();
        }
      }

      // Insert custom logos
      for (const [teamId, logoData] of Object.entries(customLogos)) {
        await db
          .insert(teamLogos)
          .values({
            teamId: teamId.toLowerCase(),
            logo: logoData.logo,
            primaryColor: logoData.primaryColor || null,
          })
          .onConflictDoUpdate({
            target: teamLogos.teamId,
            set: {
              logo: logoData.logo,
              primaryColor: logoData.primaryColor || null,
            },
          });
      }

      console.log('✅ [CloudSqlSync] Successfully seeded Cloud SQL PostgreSQL.');
      return true;
    } catch (err) {
      console.error('[CloudSqlSync] Error seeding Cloud SQL:', err);
      return false;
    }
  }

  /**
   * Persist a team logo directly to Cloud SQL
   */
  public async saveTeamLogo(teamId: string, logo: string, primaryColor?: string): Promise<void> {
    try {
      const cleanId = teamId.toLowerCase().trim();
      await db
        .insert(teamLogos)
        .values({
          teamId: cleanId,
          logo,
          primaryColor: primaryColor || null,
        })
        .onConflictDoUpdate({
          target: teamLogos.teamId,
          set: {
            logo,
            primaryColor: primaryColor || null,
          },
        });

      // Also update the team record's logo field
      await db
        .update(teams)
        .set({
          logo,
          ...(primaryColor ? { primaryColor } : {}),
        })
        .where(eq(teams.id, cleanId));

      console.log(`💾 [CloudSqlSync] Persisted logo for team "${cleanId}" to Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to save team logo to Cloud SQL:', err);
    }
  }

  /**
   * Persist a team to Cloud SQL
   */
  public async saveTeam(team: Team): Promise<void> {
    try {
      const champCount = Array.isArray(team.championships)
        ? team.championships.length
        : Number(team.championships || 0);

      await db
        .insert(teams)
        .values({
          id: team.id,
          name: team.name,
          nickname: team.nickname || team.name,
          shortName: team.shortName,
          city: team.city || 'Cuba',
          stadium: team.stadium || 'Estadio',
          capacity: Number(team.capacity || team.stadiumCapacity || 15000),
          manager: team.manager || 'Director Técnico',
          foundedYear: Number(team.foundedYear || 1977),
          championships: champCount,
          primaryColor: team.colors?.primary || '#10B981',
          secondaryColor: team.colors?.secondary || '#1E293B',
          textColor: team.colors?.text || '#FFFFFF',
          logo: team.logo,
          competitionId: team.competitionId || 'snb',
          seasonId: team.seasonId || 'snb-65',
          wins: team.record?.wins ?? 0,
          losses: team.record?.losses ?? 0,
          pct: (team.record?.pct ?? 0).toString(),
          streak: team.record?.streak || 'E0',
          lastTen: team.record?.lastTen || '0-0',
          position: team.record?.position ?? 1,
        })
        .onConflictDoUpdate({
          target: teams.id,
          set: {
            name: team.name,
            nickname: team.nickname || team.name,
            shortName: team.shortName,
            city: team.city,
            stadium: team.stadium,
            capacity: Number(team.capacity || team.stadiumCapacity || 15000),
            manager: team.manager,
            foundedYear: Number(team.foundedYear || 1977),
            championships: champCount,
            primaryColor: team.colors?.primary || '#10B981',
            secondaryColor: team.colors?.secondary || '#1E293B',
            textColor: team.colors?.text || '#FFFFFF',
            logo: team.logo,
          },
        });
      console.log(`💾 [CloudSqlSync] Persisted team "${team.name}" to Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to save team to Cloud SQL:', err);
    }
  }

  /**
   * Delete a team from Cloud SQL
   */
  public async deleteTeam(teamId: string): Promise<void> {
    try {
      await db.delete(teamLogos).where(eq(teamLogos.teamId, teamId.toLowerCase()));
      await db.delete(teams).where(eq(teams.id, teamId));
      console.log(`🗑️ [CloudSqlSync] Deleted team "${teamId}" from Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to delete team from Cloud SQL:', err);
    }
  }

  /**
   * Persist a player to Cloud SQL
   */
  public async savePlayer(player: Player): Promise<void> {
    try {
      await db
        .insert(players)
        .values({
          id: player.id,
          slug: player.slug || player.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          fullName: player.fullName,
          shortName: player.lastName || player.fullName,
          number: player.jerseyNumber !== undefined ? player.jerseyNumber : 99,
          position: player.position,
          teamId: player.teamId,
          teamShort: player.teamShort || '',
          bats: player.bats || 'R',
          throws: player.throws || 'R',
          age: player.age || 25,
          birthDate: player.birthDate || '1999-01-01',
          photo: player.photo || '',
          isFavorite: false,
          isHallOfFame: false,
          isAllStar: false,
          war: '0.0',
        })
        .onConflictDoUpdate({
          target: players.id,
          set: {
            fullName: player.fullName,
            shortName: player.lastName || player.fullName,
            number: player.jerseyNumber !== undefined ? player.jerseyNumber : 99,
            position: player.position,
            teamId: player.teamId,
            teamShort: player.teamShort || '',
            photo: player.photo || '',
          },
        });
      console.log(`💾 [CloudSqlSync] Persisted player "${player.fullName}" to Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to save player to Cloud SQL:', err);
    }
  }

  /**
   * Delete a player from Cloud SQL
   */
  public async deletePlayer(playerId: string): Promise<void> {
    try {
      await db.delete(players).where(eq(players.id, playerId));
      console.log(`🗑️ [CloudSqlSync] Deleted player "${playerId}" from Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to delete player from Cloud SQL:', err);
    }
  }

  /**
   * Bulk delete players from Cloud SQL
   */
  public async bulkDeletePlayers(playerIds: string[]): Promise<void> {
    try {
      if (playerIds.length === 0) return;
      await db.delete(players).where(inArray(players.id, playerIds));
      console.log(`🗑️ [CloudSqlSync] Bulk deleted ${playerIds.length} players from Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to bulk delete players from Cloud SQL:', err);
    }
  }
}

export const cloudSqlSync = CloudSqlSyncService.getInstance();
