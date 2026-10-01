import { db } from './index.ts';
import {
  teams,
  players,
  teamLogos,
  appSettings,
  games,
  news,
  newsComments,
  auditLogs,
} from './schema.ts';
import { eq, inArray } from 'drizzle-orm';
import {
  Team,
  Player,
  Game,
  NewsArticle,
  ArticleComment,
  AdminAuditLog,
} from '../types/index.ts';

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
    games?: Game[];
    news?: NewsArticle[];
  } | null> {
    try {
      const [dbTeams, dbPlayers, dbLogos, dbGames, dbNews] = await Promise.all([
        db.select().from(teams),
        db.select().from(players),
        db.select().from(teamLogos),
        db.select().from(games),
        db.select().from(news),
      ]);

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

      const teamMap = new Map(mappedTeams.map((t) => [t.id, t]));

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
          teamName: teamMap.get(p.teamId)?.name || p.teamShort,
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

      const mappedGames: Game[] = dbGames.map((g) => {
        const awayTeam = teamMap.get(g.awayTeamId) || mappedTeams[0];
        const homeTeam = teamMap.get(g.homeTeamId) || mappedTeams[1] || mappedTeams[0];
        let lineScore = [];
        let umpires = [];
        let plays = [];
        let bases = { first: false, second: false, third: false };
        let lineups = undefined;
        try {
          lineScore = JSON.parse(g.lineScore || '[]');
        } catch {}
        try {
          umpires = JSON.parse(g.umpires || '[]');
        } catch {}
        try {
          plays = JSON.parse(g.plays || '[]');
        } catch {}
        try {
          if (g.bases) bases = JSON.parse(g.bases);
        } catch {}
        try {
          if (g.lineups && g.lineups !== '{}') lineups = JSON.parse(g.lineups);
        } catch {}

        return {
          id: g.id,
          competitionId: g.competitionId,
          seasonId: g.seasonId,
          date: g.date,
          time: g.time,
          stadium: g.stadium,
          status: g.status as any,
          homeTeam,
          awayTeam,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          homeHits: g.homeHits,
          awayHits: g.awayHits,
          homeErrors: g.homeErrors,
          awayErrors: g.awayErrors,
          currentInning: g.currentInning || 1,
          isTopInning: g.isTopInning != null ? g.isTopInning : true,
          outs: g.outs || 0,
          balls: g.balls || 0,
          strikes: g.strikes || 0,
          bases,
          lineups,
          lineScore,
          winningPitcher: g.winningPitcher ? { name: g.winningPitcher, record: '' } : undefined,
          losingPitcher: g.losingPitcher ? { name: g.losingPitcher, record: '' } : undefined,
          savePitcher: g.savePitcher ? { name: g.savePitcher, saves: 1 } : undefined,
          umpires,
          plays,
        };
      });

      const mappedNews: NewsArticle[] = dbNews.map((n) => {
        let tags: string[] = ['Béisbol'];
        try {
          tags = JSON.parse(n.tags || '["Béisbol"]');
        } catch {}

        return {
          id: n.id,
          title: n.title,
          slug: n.slug,
          subtitle: n.subtitle || undefined,
          excerpt: n.excerpt,
          content: n.content,
          image: n.image,
          author: n.author,
          publishedAt: n.publishedAt,
          category: n.category as any,
          tags,
          readingTimeMinutes: n.readingTimeMinutes || 4,
          isFeatured: n.isFeatured || false,
          imageHeight: (n.imageHeight as any) || 'tall',
        };
      });

      console.log(
        `✅ [CloudSqlSync] Loaded ${mappedTeams.length} teams, ${mappedPlayers.length} players, ${mappedGames.length} games, and ${mappedNews.length} news from Cloud SQL PostgreSQL.`
      );

      return {
        teams: mappedTeams,
        players: mappedPlayers,
        teamLogos: logosMap,
        games: mappedGames.length > 0 ? mappedGames : undefined,
        news: mappedNews.length > 0 ? mappedNews : undefined,
      };
    } catch (err) {
      console.error('[CloudSqlSync] Failed to load data from Cloud SQL:', err);
      return null;
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

  /**
   * Persist a Game to Cloud SQL
   */
  public async saveGame(game: Game): Promise<void> {
    try {
      await db
        .insert(games)
        .values({
          id: game.id,
          competitionId: game.competitionId || 'snb',
          seasonId: game.seasonId || 'snb-65',
          date: game.date,
          time: game.time || '14:00',
          stadium: game.stadium || 'Estadio Principal',
          status: game.status || 'SCHEDULED',
          homeTeamId: game.homeTeam?.id || '',
          awayTeamId: game.awayTeam?.id || '',
          homeScore: game.homeScore || 0,
          awayScore: game.awayScore || 0,
          homeHits: game.homeHits || 0,
          awayHits: game.awayHits || 0,
          homeErrors: game.homeErrors || 0,
          awayErrors: game.awayErrors || 0,
          currentInning: game.currentInning || 1,
          isTopInning: game.isTopInning !== undefined ? game.isTopInning : true,
          outs: game.outs || 0,
          balls: game.balls || 0,
          strikes: game.strikes || 0,
          bases: JSON.stringify(game.bases || { first: false, second: false, third: false }),
          lineScore: JSON.stringify(game.lineScore || []),
          lineups: JSON.stringify(game.lineups || {}),
          winningPitcher: game.winningPitcher?.name || null,
          losingPitcher: game.losingPitcher?.name || null,
          savePitcher: game.savePitcher?.name || null,
          umpires: JSON.stringify(game.umpires || []),
          plays: JSON.stringify(game.plays || []),
        })
        .onConflictDoUpdate({
          target: games.id,
          set: {
            date: game.date,
            time: game.time || '14:00',
            stadium: game.stadium || 'Estadio Principal',
            status: game.status || 'SCHEDULED',
            homeScore: game.homeScore || 0,
            awayScore: game.awayScore || 0,
            homeHits: game.homeHits || 0,
            awayHits: game.awayHits || 0,
            homeErrors: game.homeErrors || 0,
            awayErrors: game.awayErrors || 0,
            currentInning: game.currentInning || 1,
            isTopInning: game.isTopInning !== undefined ? game.isTopInning : true,
            outs: game.outs || 0,
            balls: game.balls || 0,
            strikes: game.strikes || 0,
            bases: JSON.stringify(game.bases || { first: false, second: false, third: false }),
            lineScore: JSON.stringify(game.lineScore || []),
            lineups: JSON.stringify(game.lineups || {}),
            winningPitcher: game.winningPitcher?.name || null,
            losingPitcher: game.losingPitcher?.name || null,
            savePitcher: game.savePitcher?.name || null,
            umpires: JSON.stringify(game.umpires || []),
            plays: JSON.stringify(game.plays || []),
          },
        });
      console.log(`💾 [CloudSqlSync] Persisted game "${game.id}" to Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to save game to Cloud SQL:', err);
    }
  }

  /**
   * Delete a Game from Cloud SQL
   */
  public async deleteGame(gameId: string): Promise<void> {
    try {
      await db.delete(games).where(eq(games.id, gameId));
      console.log(`🗑️ [CloudSqlSync] Deleted game "${gameId}" from Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to delete game from Cloud SQL:', err);
    }
  }

  /**
   * Persist a News Article to Cloud SQL
   */
  public async saveNews(article: NewsArticle): Promise<void> {
    try {
      await db
        .insert(news)
        .values({
          id: article.id,
          title: article.title,
          slug: article.slug,
          subtitle: article.subtitle || null,
          excerpt: article.excerpt,
          content: article.content,
          image: article.image,
          author: article.author || 'Prensa Oficial Béisbol Hub',
          publishedAt: article.publishedAt || new Date().toISOString(),
          category: article.category || 'Crónica',
          tags: JSON.stringify(article.tags || ['Béisbol']),
          readingTimeMinutes: article.readingTimeMinutes || 4,
          isFeatured: Boolean(article.isFeatured),
          imageHeight: article.imageHeight || 'tall',
        })
        .onConflictDoUpdate({
          target: news.id,
          set: {
            title: article.title,
            slug: article.slug,
            subtitle: article.subtitle || null,
            excerpt: article.excerpt,
            content: article.content,
            image: article.image,
            author: article.author || 'Prensa Oficial Béisbol Hub',
            category: article.category || 'Crónica',
            tags: JSON.stringify(article.tags || ['Béisbol']),
            readingTimeMinutes: article.readingTimeMinutes || 4,
            isFeatured: Boolean(article.isFeatured),
            imageHeight: article.imageHeight || 'tall',
          },
        });
      console.log(`💾 [CloudSqlSync] Persisted news article "${article.title}" to Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to save news to Cloud SQL:', err);
    }
  }

  /**
   * Delete a News Article from Cloud SQL
   */
  public async deleteNews(newsId: string): Promise<void> {
    try {
      await db.delete(news).where(eq(news.id, newsId));
      console.log(`🗑️ [CloudSqlSync] Deleted news "${newsId}" from Cloud SQL.`);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to delete news from Cloud SQL:', err);
    }
  }

  /**
   * Persist a Comment to Cloud SQL
   */
  public async saveComment(comment: ArticleComment): Promise<void> {
    try {
      await db
        .insert(newsComments)
        .values({
          id: comment.id,
          articleSlug: comment.articleSlug,
          authorName: comment.authorName || 'Aficionado al Béisbol',
          favoriteTeam: comment.favoriteTeam || null,
          content: comment.content,
          likes: comment.likes || 0,
          createdAt: comment.createdAt || new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: newsComments.id,
          set: {
            content: comment.content,
            likes: comment.likes || 0,
          },
        });
    } catch (err) {
      console.error('[CloudSqlSync] Failed to save comment to Cloud SQL:', err);
    }
  }

  /**
   * Delete a Comment from Cloud SQL
   */
  public async deleteComment(commentId: string): Promise<void> {
    try {
      await db.delete(newsComments).where(eq(newsComments.id, commentId));
    } catch (err) {
      console.error('[CloudSqlSync] Failed to delete comment from Cloud SQL:', err);
    }
  }

  /**
   * Persist an Audit Log to Cloud SQL
   */
  public async saveAuditLog(log: AdminAuditLog): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        id: log.id,
        username: log.username,
        action: log.action,
        details: log.details,
        category: log.category || 'general',
        timestamp: log.timestamp,
      } as any);
    } catch (err) {
      console.error('[CloudSqlSync] Failed to save audit log to Cloud SQL:', err);
    }
  }

  /**
   * Clear all tables from Cloud SQL
   */
  public async clearAllTestData(): Promise<void> {
    try {
      await db.delete(newsComments);
      await db.delete(news);
      await db.delete(games);
      await db.delete(players);
      await db.delete(teamLogos);
      await db.delete(teams);
      console.log('🗑️ [CloudSqlSync] Cleared all Cloud SQL tables.');
    } catch (err) {
      console.error('[CloudSqlSync] Error clearing test data from Cloud SQL:', err);
    }
  }

  /**
   * Initial Seed to Cloud SQL: Pushes base dataset into Cloud SQL if tables are empty
   */
  public async seedInitialDataset(
    allTeams: Team[],
    allPlayers: Player[],
    allGames: Game[],
    allNews: NewsArticle[]
  ): Promise<void> {
    try {
      const hasTeams = await this.hasData();
      if (!hasTeams && allTeams.length > 0) {
        console.log(`🌱 [CloudSqlSync] Seeding initial ${allTeams.length} teams and ${allPlayers.length} players to Cloud SQL...`);
        for (const t of allTeams) {
          await this.saveTeam(t);
        }
        for (const p of allPlayers) {
          await this.savePlayer(p);
        }
        for (const g of allGames) {
          if (!g.id.startsWith('g-2026-')) {
            await this.saveGame(g);
          }
        }
        for (const n of allNews) {
          await this.saveNews(n);
        }
        console.log('✅ [CloudSqlSync] Initial Cloud SQL database seeding completed successfully.');
      }
    } catch (err) {
      console.error('[CloudSqlSync] Error seeding initial dataset to Cloud SQL:', err);
    }
  }
}

export const cloudSqlSync = CloudSqlSyncService.getInstance();
