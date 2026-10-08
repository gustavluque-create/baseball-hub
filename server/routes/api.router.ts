import { Router, Request, Response, NextFunction } from 'express';
import { baseballRepo } from '../repositories/baseball.repository.ts';
import { IngestionService } from '../services/ingestion.service.ts';
import { notificationService } from '../services/notification.service.ts';
import { adminAuthService } from '../services/admin-auth.service.ts';
import { fcmServer } from '../services/fcm.service.ts';
import { requireAuth, AuthRequest, extractRequestToken } from '../../src/middleware/auth.ts';
import { getOrCreateUser, getUserByUid } from '../../src/db/users.ts';
import { supabaseAuthService, AppUserRole } from '../services/supabase-auth.service.ts';
import { isSupabaseServerConfigured } from '../lib/supabase.ts';
import {
  adminLoginLimiter,
  commentsLimiter,
  fcmRegisterLimiter,
  sensitiveWriteLimiter,
} from '../middleware/rate-limiter.ts';
import {
  teamLogoSchema,
  playerPhotoSchema,
  commentSchema,
  fcmRegisterSchema,
  fcmSubscribeGameSchema,
} from '../utils/validation.ts';

export const apiRouter = Router();

// Garantizar que BaseballRepository esté inicializado antes de procesar cualquier petición API
apiRouter.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await baseballRepo.ready();
    next();
  } catch (err) {
    next(err);
  }
});

// Helper to extract session token from Authorization header, x-admin-token header, or HttpOnly cookie
export const getRequestToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers['x-admin-token'] as string;
  if (customHeader) {
    return customHeader.trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/baseball_admin_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]).trim();
  }
  return undefined;
};

// Middleware to authenticate admin requests
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = getRequestToken(req) || extractRequestToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Acceso no autorizado. Se requiere iniciar sesión con credenciales de administrador.',
    });
  }

  // 1. Supabase Auth validation (PRIMARY)
  try {
    const sessionRes = await supabaseAuthService.verifyToken(token);
    if (sessionRes.valid && sessionRes.user) {
      const role = sessionRes.user.role;
      if (['superadmin', 'admin', 'anotador', 'prensa', 'official_scorer', 'editor'].includes(role)) {
        (req as any).adminUser = sessionRes.admin || {
          id: sessionRes.user.id,
          username: sessionRes.user.email?.split('@')[0] || sessionRes.user.id,
          name: sessionRes.user.name,
          email: sessionRes.user.email,
          role,
          lastLogin: new Date().toISOString(),
        };
        (req as any).adminToken = token;
        return next();
      } else {
        return res.status(403).json({
          success: false,
          error: 'Permisos insuficientes. El usuario autenticado no posee rol administrativo.',
        });
      }
    }
  } catch (err) {
    // continue to fallback check
  }

  // 2. Fallback to local admin session store
  const admin = adminAuthService.verifySession(token);
  if (!admin) {
    return res.status(401).json({
      success: false,
      error: 'Acceso no autorizado. Sesión de administrador inválida o expirada.',
    });
  }

  (req as any).adminUser = admin;
  (req as any).adminToken = token;
  next();
};

// Middleware to authorize specific administrative roles server-side
export const requireRole = (...allowedRoles: (AppUserRole | 'superadmin' | 'official_scorer' | 'editor')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = (req as any).adminUser;
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Acceso no autorizado. Debe autenticarse previamente.',
      });
    }

    if (!supabaseAuthService.hasPermission(admin.role, allowedRoles as AppUserRole[])) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes. Su rol no tiene autorización para ejecutar esta acción.',
      });
    }

    next();
  };
};

// ==========================================
// ADMIN AUTHENTICATION & SECURITY ENDPOINTS
// ==========================================

apiRouter.post('/admin/login', adminLoginLimiter, async (req: Request, res: Response) => {
  const { username, email, password } = req.body || {};
  const userIdentifier = (email || username || '').trim();
  if (!userIdentifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'Debe ingresar el usuario/correo y la contraseña de administración.',
    });
  }

  // 1. Supabase Auth as PRIMARY when configured
  if (isSupabaseServerConfigured()) {
    const supaResult = await supabaseAuthService.adminLogin(userIdentifier, password);
    if (supaResult.success && supaResult.token && supaResult.admin) {
      res.cookie('baseball_admin_token', supaResult.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });
      res.cookie('baseball_session', supaResult.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });
      return res.json(supaResult);
    } else if (supaResult.unauthorizedRole) {
      return res.status(403).json(supaResult);
    }
  }

  // 2. Fallback to local admin auth (local dev / test fallback)
  const result = adminAuthService.authenticate(userIdentifier, password);
  if (!result.success) {
    return res.status(401).json(result);
  }

  // Set secure HttpOnly cookie while preserving JSON token response for complete client compatibility
  if (result.token) {
    res.cookie('baseball_admin_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  res.json(result);
});

apiRouter.get('/admin/session', async (req: Request, res: Response) => {
  const token = getRequestToken(req) || extractRequestToken(req);
  if (!token) {
    return res.status(401).json({ valid: false, error: 'Sesión inválida o expirada' });
  }

  // 1. Supabase Auth check (PRIMARY)
  const sessionRes = await supabaseAuthService.verifyToken(token);
  if (sessionRes.valid && sessionRes.user) {
    const role = sessionRes.user.role;
    if (['superadmin', 'admin', 'anotador', 'prensa', 'official_scorer', 'editor'].includes(role)) {
      return res.json({
        valid: true,
        admin: sessionRes.admin || {
          id: sessionRes.user.id,
          username: sessionRes.user.email?.split('@')[0] || sessionRes.user.id,
          name: sessionRes.user.name,
          email: sessionRes.user.email,
          role,
          lastLogin: new Date().toISOString(),
        },
      });
    }
  }

  // 2. Local session fallback
  const admin = adminAuthService.verifySession(token);
  if (!admin) {
    return res.status(401).json({ valid: false, error: 'Sesión inválida o expirada' });
  }

  res.json({ valid: true, admin });
});

apiRouter.post('/admin/logout', async (req: Request, res: Response) => {
  const token = getRequestToken(req) || extractRequestToken(req);
  res.clearCookie('baseball_admin_token', { path: '/' });
  res.clearCookie('baseball_session', { path: '/' });
  await supabaseAuthService.signOut(token);
  const success = adminAuthService.logout(token);
  res.json({ success: true });
});

apiRouter.get('/admin/overview', requireAdmin, (req: Request, res: Response) => {
  const overview = adminAuthService.getOverview();
  res.json(overview);
});

apiRouter.get('/admin/audit-logs', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = adminAuthService.getAuditLogs(limit);
  res.json(logs);
});

// Admin Game Management
apiRouter.post('/admin/games', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const newGame = await baseballRepo.createGame(req.body);
    adminAuthService.addAuditLog(
      admin.username,
      'Creación de Partido',
      `Partido creado: ${newGame.awayTeam.shortName} vs ${newGame.homeTeam.shortName} (${newGame.date})`,
      'games'
    );
    res.status(201).json(newGame);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al crear partido.' });
  }
});

apiRouter.post('/admin/games/series', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const games = await baseballRepo.createGameSeries(req.body);
    if (games.length > 0) {
      adminAuthService.addAuditLog(
        admin.username,
        'Programación de Subserie',
        `Subserie creada: ${games[0].awayTeam.shortName} vs ${games[0].homeTeam.shortName} (${games.length} juegos programados)`,
        'games'
      );
    }
    res.status(201).json(games);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al programar subserie.' });
  }
});

apiRouter.put('/admin/games/:id', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const gameId = req.params.id;
  const existingGame = baseballRepo.getGameById(gameId);

  if (!existingGame) {
    return res.status(404).json({ error: 'Partido no encontrado' });
  }

  try {
    const updatedGame = await baseballRepo.updateGame(gameId, req.body);
    if (!updatedGame) {
      return res.status(404).json({ error: 'Error al actualizar partido' });
    }

    // Check if score changed to broadcast real-time alert!
    const prevHome = existingGame.homeScore;
    const prevAway = existingGame.awayScore;
    const newHome = updatedGame.homeScore;
    const newAway = updatedGame.awayScore;

    if (newHome > prevHome || newAway > prevAway) {
      const isHome = newHome > prevHome;
      const diff = isHome ? newHome - prevHome : newAway - prevAway;
      const scoringTeam = isHome ? updatedGame.homeTeam : updatedGame.awayTeam;
      const latestPlay = updatedGame.plays && updatedGame.plays.length > 0 ? updatedGame.plays[0] : null;

      notificationService.broadcastScoreChange({
        gameId: updatedGame.id,
        homeTeam: updatedGame.homeTeam,
        awayTeam: updatedGame.awayTeam,
        scoringTeam,
        scoringTeamSide: isHome ? 'home' : 'away',
        runsScored: diff,
        homeScore: updatedGame.homeScore,
        awayScore: updatedGame.awayScore,
        inning: updatedGame.currentInning || 1,
        isTopInning: updatedGame.isTopInning !== undefined ? updatedGame.isTopInning : true,
        outs: updatedGame.outs || 0,
        title: latestPlay?.isScoringPlay ? `¡Carrera(s) de ${scoringTeam.name}!` : `¡Anotación de ${scoringTeam.name}!`,
        description: latestPlay ? latestPlay.description : `Actualizado por administración: ${updatedGame.awayTeam.shortName} ${updatedGame.awayScore} - ${updatedGame.homeScore} ${updatedGame.homeTeam.shortName}`,
        playType: (latestPlay?.playType as any) || (diff > 1 ? 'homerun' : 'hit'),
      });
    }

    adminAuthService.addAuditLog(
      admin.username,
      'Actualización de Partido',
      `Partido ${updatedGame.awayTeam.shortName} vs ${updatedGame.homeTeam.shortName} actualizado (${updatedGame.status}, Marcador: ${updatedGame.awayScore}-${updatedGame.homeScore})`,
      'games'
    );

    res.json(updatedGame);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar partido.' });
  }
});

apiRouter.delete('/admin/games/:id', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const success = await baseballRepo.deleteGame(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }
    adminAuthService.addAuditLog(
      admin.username,
      'Eliminación de Partido',
      `Partido con ID ${req.params.id} eliminado del calendario.`,
      'games'
    );
    res.json({ success: true, message: 'Partido eliminado' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al eliminar partido.' });
  }
});

// Admin Player Management
apiRouter.post('/admin/players', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const player = await baseballRepo.createPlayer(req.body);
    adminAuthService.addAuditLog(
      admin.username,
      'Creación de Jugador',
      `Jugador registrado: ${player.fullName} (${player.position}, #${player.jerseyNumber} - ${player.teamShort})`,
      'players'
    );
    res.status(201).json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al registrar jugador.' });
  }
});

apiRouter.put('/admin/players/:id', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const player = await baseballRepo.updatePlayer(req.params.id, req.body);
    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }
    adminAuthService.addAuditLog(
      admin.username,
      'Actualización de Jugador',
      `Jugador ${player.fullName} actualizado.`,
      'players'
    );
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar jugador.' });
  }
});

apiRouter.post('/admin/players/import', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const rawList = Array.isArray(req.body.players) ? req.body.players : Array.isArray(req.body) ? req.body : [];
  if (rawList.length === 0) {
    return res.status(400).json({ error: 'La lista de jugadores a importar está vacía o no tiene formato válido.' });
  }

  try {
    const result = await baseballRepo.importPlayers(rawList);
    adminAuthService.addAuditLog(
      admin.username,
      'Importación de Jugadores',
      `Se procesaron e importaron ${result.importedCount} jugadores (${result.createdCount} nuevos, ${result.updatedCount} actualizados en plantilla).`,
      'players'
    );
    res.json({
      success: true,
      ...result,
      message: `Se han importado exitosamente ${result.importedCount} jugadores.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al importar jugadores.' });
  }
});

// Import Historical Stats (Batting and Pitching across seasons and players)
apiRouter.post('/admin/stats/import', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const rawPayload = req.body;
  if (!rawPayload || (Array.isArray(rawPayload) && rawPayload.length === 0)) {
    return res.status(400).json({ error: 'Los datos de estadísticas a importar están vacíos o no tienen un formato válido.' });
  }

  const result = await baseballRepo.importHistoricalStats(rawPayload);
  adminAuthService.addAuditLog(
    admin.username,
    'Importación de Estadísticas Históricas',
    `Se procesaron e importaron ${result.importedCount} registros históricos (${result.battingCount} bateo, ${result.pitchingCount} pitcheo) para ${result.playersCount} peloteros.`,
    'players'
  );

  res.json({
    success: true,
    ...result,
    message: `Se importaron ${result.importedCount} registros históricos (${result.battingCount} bateo, ${result.pitchingCount} pitcheo) para ${result.playersCount} jugadores.`,
  });
});

apiRouter.delete('/admin/players/:id', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const success = await baseballRepo.deletePlayer(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }
    adminAuthService.addAuditLog(
      admin.username,
      'Baja de Jugador',
      `Jugador con ID ${req.params.id} retirado del roster.`,
      'players'
    );
    res.json({ success: true, message: 'Jugador eliminado' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al eliminar jugador.' });
  }
});

// Bulk Player Operations
apiRouter.post('/admin/players/bulk-delete', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere una lista de IDs de jugadores a eliminar.' });
  }

  try {
    const result = await baseballRepo.bulkDeletePlayers(ids);
    adminAuthService.addAuditLog(
      admin.username,
      'Baja Masiva de Jugadores',
      `Se eliminaron ${result.deletedCount} jugadores de forma masiva del sistema.`,
      'players'
    );
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      deletedIds: result.deletedIds,
      message: `Se eliminaron exitosamente ${result.deletedCount} jugadores.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al eliminar jugadores de forma masiva.' });
  }
});

apiRouter.post('/admin/players/bulk-update', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids : [];
  const updates = req.body.updates;
  if (ids.length === 0 || !updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Se requiere una lista de IDs y los campos a actualizar.' });
  }

  try {
    const result = await baseballRepo.bulkUpdatePlayers(ids, updates);
    adminAuthService.addAuditLog(
      admin.username,
      'Actualización Masiva de Jugadores',
      `Se actualizaron ${result.updatedCount} jugadores en lote.`,
      'players'
    );
    res.json({
      success: true,
      updatedCount: result.updatedCount,
      updatedPlayers: result.updatedPlayers,
      message: `Se actualizaron exitosamente ${result.updatedCount} jugadores.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar jugadores en lote.' });
  }
});

// Admin News Management
apiRouter.post('/admin/news', requireAdmin, requireRole('superadmin', 'editor'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const article = await baseballRepo.createNews(req.body);
    adminAuthService.addAuditLog(
      admin.username,
      'Publicación de Noticia',
      `Noticia publicada: "${article.title}"`,
      'system'
    );
    res.status(201).json(article);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al publicar noticia.' });
  }
});

apiRouter.put('/admin/news/:id', requireAdmin, requireRole('superadmin', 'editor'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const updated = await baseballRepo.updateNews(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }
    adminAuthService.addAuditLog(
      admin.username,
      'Edición de Noticia',
      `Noticia "${updated.title}" modificada.`,
      'system'
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al editar noticia.' });
  }
});

apiRouter.delete('/admin/news/:id', requireAdmin, requireRole('superadmin', 'editor'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const success = await baseballRepo.deleteNews(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }
    adminAuthService.addAuditLog(
      admin.username,
      'Eliminación de Noticia',
      `Noticia con ID ${req.params.id} eliminada.`,
      'system'
    );
    res.json({ success: true, message: 'Noticia eliminada' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al eliminar noticia.' });
  }
});

// System Reset or Clear Data
apiRouter.post('/admin/system/reset-demo', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  baseballRepo.clearAllData();
  adminAuthService.addAuditLog(
    admin.username,
    'Limpieza de Datos',
    'Todos los datos de prueba fueron eliminados del sistema.',
    'system'
  );
  res.json({ success: true, message: 'Todos los datos de prueba han sido eliminados.' });
});

apiRouter.post('/admin/system/clear-all', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  baseballRepo.clearAllData();
  adminAuthService.addAuditLog(
    admin.username,
    'Eliminación de Datos',
    'Todos los datos fueron eliminados de la base de datos.',
    'system'
  );
  res.json({ success: true, message: 'Todos los datos han sido eliminados permanentemente.' });
});

// Database Persistence Status and Manual Sync
apiRouter.get('/admin/system/database-status', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const info = baseballRepo.getDatabaseInfo();
  res.json({
    success: true,
    status: 'PERSISTENT_DISK_STORAGE',
    ...info,
  });
});

apiRouter.post('/admin/system/persist', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  baseballRepo.saveToDisk();
  adminAuthService.addAuditLog(
    admin.username,
    'Sincronización Manual de Base de Datos',
    'Se forzó el guardado seguro del estado de la base de datos a disco.',
    'system'
  );
  const info = baseballRepo.getDatabaseInfo();
  res.json({
    success: true,
    message: 'Base de datos guardada en disco exitosamente.',
    info,
  });
});

// Full Database Export Backup
apiRouter.get('/admin/system/backup', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const db = baseballRepo.getFullDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="baseball_hub_backup.json"');
  res.json(db);
});

// Full Database Restore from Backup
apiRouter.post('/admin/system/restore', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const payload = req.body;
    const result = baseballRepo.restoreFullDatabase(payload);
    adminAuthService.addAuditLog(
      admin.username,
      'Restauración de Base de Datos',
      `Se restauró la base de datos completa (${result.counts.players} jugadores, ${result.counts.teams} equipos).`,
      'system'
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al restaurar la base de datos.' });
  }
});

// Client Automatic Sync Backup (Syncs client's offline / local changes to server if needed)
apiRouter.post('/admin/system/sync-client', requireAdmin, requireRole('superadmin'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const { players, teams } = req.body;
    let restoredCount = 0;
    if (Array.isArray(players) && players.length > 0) {
      // Import players into current repo
      const importRes = await baseballRepo.importPlayers(players);
      restoredCount = importRes.importedCount;
    }
    baseballRepo.saveToDisk();
    adminAuthService.addAuditLog(
      admin.username,
      'Sincronización Cliente-Servidor',
      `Sincronizados ${restoredCount} jugadores desde el almacenamiento local del navegador.`,
      'system'
    );
    res.json({
      success: true,
      message: `Se sincronizaron ${restoredCount} jugadores exitosamente con el servidor.`,
      counts: {
        players: baseballRepo.getPlayers().total,
        teams: baseballRepo.getTeams().length,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error durante la sincronización.' });
  }
});

// Real-Time Browser Webhooks & Streaming (Server-Sent Events)
apiRouter.get('/events/score-changes', (req: Request, res: Response) => {
  notificationService.handleSSEConnection(req, res);
});

// Incoming Webhook for Score Updates (from external sports feeds or simulators)
apiRouter.post('/webhooks/score-update', (req: Request, res: Response) => {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret = req.headers['x-webhook-secret'] || req.headers['authorization'];
    if (providedSecret !== webhookSecret && providedSecret !== `Bearer ${webhookSecret}`) {
      const token = getRequestToken(req);
      const admin = adminAuthService.verifySession(token);
      if (!admin) {
        return res.status(401).json({ error: 'Acceso no autorizado al webhook de marcadores.' });
      }
    }
  }
  const result = notificationService.handleIncomingWebhook(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Real-Time Polling Endpoint (for fallback or client-configured polling)
apiRouter.get('/notifications/poll', (req: Request, res: Response) => {
  const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const events = notificationService.getHistory(since, limit);
  const liveGames = baseballRepo.getGames({ status: 'LIVE' });

  res.json({
    events,
    timestamp: Date.now(),
    activeClients: notificationService.getActiveClientCount(),
    liveGamesCount: liveGames.length,
  });
});

// Notifications History
apiRouter.get('/notifications/history', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const events = notificationService.getHistory(undefined, limit);
  res.json(events);
});

// Test Notification Trigger
apiRouter.post('/notifications/test', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const testEvent = notificationService.generateTestNotification();
  res.json({
    success: true,
    message: 'Notificación de prueba generada y emitida a todos los clientes conectados',
    event: testEvent,
  });
});

// Competitions
apiRouter.get('/competitions', (req: Request, res: Response) => {
  const competitions = baseballRepo.getCompetitions();
  res.json(competitions);
});

// Seasons
apiRouter.get('/seasons', (req: Request, res: Response) => {
  const competitionId = req.query.competition as string | undefined;
  const seasons = baseballRepo.getSeasons(competitionId);
  res.json(seasons);
});

// Teams
apiRouter.get('/teams', (req: Request, res: Response) => {
  const competitionId = req.query.competition as string | undefined;
  const teams = baseballRepo.getTeams(competitionId);
  res.json(teams);
});

// Compare two teams side-by-side
apiRouter.get('/teams/compare', (req: Request, res: Response) => {
  const teamAId = (req.query.teamA || req.query.teamAId || req.query.idA) as string;
  const teamBId = (req.query.teamB || req.query.teamBId || req.query.idB) as string;

  if (!teamAId || !teamBId) {
    return res.status(400).json({ error: 'Se requieren dos identificadores de equipos (teamA y teamB).' });
  }

  const comparison = baseballRepo.compareTeams(teamAId, teamBId);
  if (!comparison) {
    return res.status(404).json({ error: 'Uno o ambos equipos no fueron encontrados para la comparativa.' });
  }

  res.json(comparison);
});

apiRouter.get('/teams/:id', (req: Request, res: Response) => {
  const team = baseballRepo.getTeamById(req.params.id);
  if (!team) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
  }
  const roster = baseballRepo.getPlayers({ teamId: team.id, limit: 100 }).items;
  const games = baseballRepo.getGames({ teamId: team.id });
  res.json({ team, roster, games });
});

// Update Team Logo directly
const handleUpdateTeamLogo = async (req: Request, res: Response) => {
  const validation = teamLogoSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0]?.message || 'Datos de logo inválidos.' });
  }

  const { logo, primaryColor } = validation.data;
  const updates: any = { logo };
  if (primaryColor) {
    updates.primaryColor = primaryColor;
  }

  try {
    const updatedTeam = await baseballRepo.updateTeam(req.params.id, updates);
    if (!updatedTeam) {
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    }

    const admin = (req as any).adminUser;
    adminAuthService.addAuditLog(
      admin ? admin.username : 'Usuario Web / Gestor',
      'Actualización de Logo de Equipo',
      `Logo oficial persistido para ${updatedTeam.name} (${updatedTeam.shortName}).`,
      'teams'
    );

    res.json({
      success: true,
      message: 'Logo del equipo actualizado y guardado permanentemente en la base de datos.',
      team: updatedTeam,
      logo: updatedTeam.logo,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar logo de equipo.' });
  }
};

apiRouter.put('/teams/:id/logo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdateTeamLogo);
apiRouter.post('/teams/:id/logo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdateTeamLogo);
apiRouter.put('/admin/teams/:id/logo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdateTeamLogo);
apiRouter.post('/admin/teams/:id/logo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdateTeamLogo);

// Client-Server Bidirectional User Data Synchronization
apiRouter.post(
  '/sync-user-data',
  requireAdmin,
  requireRole('superadmin', 'official_scorer'),
  sensitiveWriteLimiter,
  async (req: Request, res: Response) => {
    try {
      const { teamLogos, customPlayers, customTeams, deletedPlayerIds } = req.body;
      let logosCount = 0;
      let playersCount = 0;
      let teamsCount = 0;

      // 1. Sync custom team logos
      if (teamLogos && typeof teamLogos === 'object') {
        for (const [teamId, logoData] of Object.entries(teamLogos as Record<string, any>)) {
          if (logoData && logoData.logo) {
            const updated = await baseballRepo.updateTeam(teamId, {
              logo: logoData.logo,
              colors: logoData.primaryColor
                ? { primary: logoData.primaryColor, secondary: '#FFFFFF', text: '#FFFFFF' }
                : undefined,
            });
            if (updated) logosCount++;
          }
        }
      }

      // 2. Sync custom teams
      if (Array.isArray(customTeams)) {
        for (const t of customTeams) {
          if (t && t.id) {
            const existing = baseballRepo.getTeamById(t.id);
            if (!existing) {
              try {
                await baseballRepo.createTeam(t);
                teamsCount++;
              } catch {
                // Already exists or invalid
              }
            }
          }
        }
      }

      // 3. Sync custom players
      if (Array.isArray(customPlayers) && customPlayers.length > 0) {
        const importRes = await baseballRepo.importPlayers(customPlayers);
        playersCount = importRes.importedCount;
      }

      // 4. Sync deleted players
      if (Array.isArray(deletedPlayerIds)) {
        for (const pid of deletedPlayerIds) {
          await baseballRepo.deletePlayer(pid);
        }
      }

      baseballRepo.saveToDisk();

      res.json({
        success: true,
        message: 'Datos de usuario sincronizados exitosamente con la base de datos persistente.',
        synced: {
          logos: logosCount,
          players: playersCount,
          teams: teamsCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al sincronizar datos de usuario.' });
    }
  }
);

const handleUpdateTeam = async (req: Request, res: Response) => {
  try {
    const updatedTeam = await baseballRepo.updateTeam(req.params.id, req.body);
    if (!updatedTeam) {
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    }

    const admin = (req as any).adminUser;
    if (admin) {
      adminAuthService.addAuditLog(
        admin.username,
        'Modificación de Equipo',
        `Datos actualizados para ${updatedTeam.name} (${updatedTeam.shortName}).`,
        'teams'
      );
    }

    res.json(updatedTeam);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar equipo.' });
  }
};

apiRouter.put('/teams/:id', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdateTeam);
apiRouter.put('/admin/teams/:id', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdateTeam);

// Create Team
const handleCreateTeam = async (req: Request, res: Response) => {
  try {
    const newTeam = await baseballRepo.createTeam(req.body);
    const admin = (req as any).adminUser;
    if (admin) {
      adminAuthService.addAuditLog(
        admin.username,
        'Alta de Nuevo Equipo',
        `Equipo registrado: ${newTeam.name} (${newTeam.shortName}) de ${newTeam.city}.`,
        'teams'
      );
    }
    res.status(201).json(newTeam);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al crear equipo.' });
  }
};

apiRouter.post('/teams', requireAdmin, requireRole('superadmin', 'official_scorer'), handleCreateTeam);
apiRouter.post('/admin/teams', requireAdmin, requireRole('superadmin', 'official_scorer'), handleCreateTeam);

// Seed 16 Official Cuban Series Teams
const handleSeed16Teams = async (req: Request, res: Response) => {
  try {
    const teams = await baseballRepo.seed16NationalSeriesTeams();
    const admin = (req as any).adminUser;
    if (admin) {
      adminAuthService.addAuditLog(
        admin.username,
        'Carga de 16 Equipos de la Serie Nacional',
        'Se verificaron y cargaron los 16 equipos provinciales oficiales de Cuba.',
        'teams'
      );
    }
    res.json({
      success: true,
      message: 'Se han configurado y sincronizado los 16 equipos oficiales de la Serie Nacional.',
      teams,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al cargar los 16 equipos.' });
  }
};

apiRouter.post('/teams/seed-16', requireAdmin, requireRole('superadmin'), handleSeed16Teams);
apiRouter.post('/admin/teams/seed-16', requireAdmin, requireRole('superadmin'), handleSeed16Teams);

// Delete Team
const handleDeleteTeam = async (req: Request, res: Response) => {
  try {
    const result = await baseballRepo.deleteTeam(req.params.id);
    const admin = (req as any).adminUser;
    if (admin) {
      adminAuthService.addAuditLog(
        admin.username,
        'Baja de Equipo',
        `Equipo eliminado: ${result.deletedTeam.name} (${result.deletedTeam.shortName}).`,
        'teams'
      );
    }
    res.json({
      success: true,
      message: `Equipo ${result.deletedTeam.name} eliminado correctamente.`,
      deletedTeam: result.deletedTeam,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al eliminar equipo.' });
  }
};

apiRouter.delete('/teams/:id', requireAdmin, requireRole('superadmin'), handleDeleteTeam);
apiRouter.delete('/admin/teams/:id', requireAdmin, requireRole('superadmin'), handleDeleteTeam);

// Players
apiRouter.get('/players', (req: Request, res: Response) => {
  const { teamId, position, search, limit, page } = req.query;
  const result = baseballRepo.getPlayers({
    teamId: teamId as string,
    position: position as string,
    search: search as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    page: page ? parseInt(page as string, 10) : 1,
  });
  res.json(result);
});

apiRouter.get('/players/:id', (req: Request, res: Response) => {
  const player = baseballRepo.getPlayerById(req.params.id);
  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado' });
  }
  const historical = baseballRepo.getPlayerHistoricalStats(player.id);
  const batting = historical.careerBatting[historical.careerBatting.length - 1];
  const pitching = historical.careerPitching[historical.careerPitching.length - 1];
  const recentGames = baseballRepo.getPlayerRecentGameLogs(player.id, 10);

  res.json({
    player,
    batting,
    pitching,
    careerBatting: historical.careerBatting,
    careerPitching: historical.careerPitching,
    careerTotals: historical.careerTotals,
    recentGames,
  });
});

// Dedicated endpoint for player recent games / game log
apiRouter.get('/players/:id/recent-games', (req: Request, res: Response) => {
  const player = baseballRepo.getPlayerById(req.params.id);
  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado' });
  }
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
  const recentGames = baseballRepo.getPlayerRecentGameLogs(player.id, limit);
  res.json(recentGames);
});

// Personalized URL endpoint: /teams/:teamId/players/:playerId (e.g. /matanzas/erisbel-arruebarrena or /matanzas/jugador)
apiRouter.get('/teams/:teamId/players/:playerId', (req: Request, res: Response) => {
  const player = baseballRepo.getPlayerByTeamAndIdentifier(req.params.teamId, req.params.playerId);
  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado para este equipo' });
  }
  const historical = baseballRepo.getPlayerHistoricalStats(player.id);
  const batting = historical.careerBatting[historical.careerBatting.length - 1];
  const pitching = historical.careerPitching[historical.careerPitching.length - 1];
  const recentGames = baseballRepo.getPlayerRecentGameLogs(player.id, 10);

  res.json({
    player,
    batting,
    pitching,
    careerBatting: historical.careerBatting,
    careerPitching: historical.careerPitching,
    careerTotals: historical.careerTotals,
    recentGames,
  });
});

// Manage Player Historical Batting Stats
apiRouter.post('/players/:id/stats/batting', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const player = baseballRepo.getPlayerById(req.params.id);
  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado' });
  }
  try {
    const stat = await baseballRepo.addOrUpdatePlayerSeasonBatting(player.id, req.body || {});
    const historical = baseballRepo.getPlayerHistoricalStats(player.id);
    res.json({ success: true, stat, historical });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al guardar estadística de bateo.' });
  }
});

// Manage Player Historical Pitching Stats
apiRouter.post('/players/:id/stats/pitching', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const player = baseballRepo.getPlayerById(req.params.id);
  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado' });
  }
  try {
    const stat = await baseballRepo.addOrUpdatePlayerSeasonPitching(player.id, req.body || {});
    const historical = baseballRepo.getPlayerHistoricalStats(player.id);
    res.json({ success: true, stat, historical });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al guardar estadística de pitcheo.' });
  }
});

// Delete Player Historical Stat
apiRouter.delete('/players/:id/stats/:statId', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const player = baseballRepo.getPlayerById(req.params.id);
  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado' });
  }
  const type = (req.query.type as 'batting' | 'pitching') || 'batting';
  try {
    const deleted = await baseballRepo.deletePlayerSeasonStat(player.id, req.params.statId, type);
    const historical = baseballRepo.getPlayerHistoricalStats(player.id);
    res.json({ success: deleted, historical });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al eliminar estadística.' });
  }
});

// Bulk Import Historical Stats specifically for one player
apiRouter.post('/players/:id/stats/import', requireAdmin, requireRole('superadmin', 'official_scorer'), async (req: Request, res: Response) => {
  const player = baseballRepo.getPlayerById(req.params.id);
  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado' });
  }
  const rawList = Array.isArray(req.body.stats)
    ? req.body.stats
    : Array.isArray(req.body.temporadas)
    ? req.body.temporadas
    : Array.isArray(req.body)
    ? req.body
    : req.body;

  const result = await baseballRepo.importHistoricalStats(rawList, player.id);
  const historical = baseballRepo.getPlayerHistoricalStats(player.id);

  res.json({
    success: true,
    ...result,
    historical,
    message: `Se han importado exitosamente ${result.importedCount} temporadas para ${player.fullName}.`,
  });
});

// Update Player Photo directly (from profile modal or admin tools)
const handleUpdatePlayerPhoto = async (req: Request, res: Response) => {
  const validation = playerPhotoSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0]?.message || 'Datos de fotografía inválidos.' });
  }

  const playerId = (req.params.id || '').trim();
  if (!playerId) {
    return res.status(400).json({ error: 'Identificador único (ID) del jugador es requerido para la actualización.' });
  }

  const { photo } = validation.data;
  try {
    const updatedPlayer = await baseballRepo.updatePlayer(playerId, { photo });
    if (!updatedPlayer) {
      return res.status(404).json({ error: `Jugador no encontrado para el ID: ${playerId}` });
    }

    // Audit if admin session is present
    const admin = (req as any).adminUser;
    if (admin) {
      adminAuthService.addAuditLog(
        admin.username,
        'Actualización de Foto de Jugador',
        `Foto actualizada para ${updatedPlayer.fullName} (#${updatedPlayer.jerseyNumber} - ${updatedPlayer.teamShort}) [ID: ${updatedPlayer.id}].`,
        'players'
      );
    }

    res.json({
      success: true,
      message: 'Fotografía actualizada correctamente.',
      player: updatedPlayer,
      photo: updatedPlayer.photo,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar fotografía.' });
  }
};

apiRouter.put('/players/:id/photo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdatePlayerPhoto);
apiRouter.post('/players/:id/photo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdatePlayerPhoto);
apiRouter.put('/admin/players/:id/photo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdatePlayerPhoto);
apiRouter.post('/admin/players/:id/photo', requireAdmin, requireRole('superadmin', 'official_scorer'), handleUpdatePlayerPhoto);

// Games
apiRouter.get('/games', (req: Request, res: Response) => {
  const { competition, season, status, team, sort, order } = req.query;
  const sortDirection = (sort === 'desc' || order === 'desc') ? 'desc' : 'asc';
  const games = baseballRepo.getGames({
    competitionId: competition as string,
    seasonId: season as string,
    status: status as string,
    teamId: team as string,
    sortByDate: sortDirection,
  });
  res.json(games);
});

apiRouter.get('/games/:id', (req: Request, res: Response) => {
  const game = baseballRepo.getGameById(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'Partido no encontrado' });
  }
  res.json(game);
});

apiRouter.get('/games/:id/matchup', (req: Request, res: Response) => {
  const matchup = baseballRepo.getMatchupComparison(req.params.id);
  if (!matchup) {
    return res.status(404).json({ error: 'Comparativa de partido no encontrada' });
  }
  res.json(matchup);
});

apiRouter.get('/matchup/:id', (req: Request, res: Response) => {
  const matchup = baseballRepo.getMatchupComparison(req.params.id);
  if (!matchup) {
    return res.status(404).json({ error: 'Comparativa no encontrada' });
  }
  res.json(matchup);
});

apiRouter.post('/games/simulate-run', requireAdmin, requireRole('superadmin', 'official_scorer'), (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const { gameId, side, runs } = req.body || {};
  const result = baseballRepo.simulateLiveScoreChange(gameId, side, runs);
  if (!result) {
    return res.status(404).json({ error: 'No se encontraron partidos en vivo para simular carreras.' });
  }

  adminAuthService.addAuditLog(
    admin.username,
    'Simulación de Carrera en Vivo',
    `Carrera manual anotada en partido ${result.game.awayTeam.shortName} vs ${result.game.homeTeam.shortName}`,
    'games'
  );

  // Broadcast to all real-time SSE stream clients and notification subscribers
  notificationService.broadcastScoreChange({
    gameId: result.game.id,
    homeTeam: result.game.homeTeam,
    awayTeam: result.game.awayTeam,
    scoringTeam: result.scoringTeam,
    scoringTeamSide: result.scoringSide,
    runsScored: result.runsScored,
    homeScore: result.game.homeScore,
    awayScore: result.game.awayScore,
    inning: result.game.currentInning || 8,
    isTopInning: result.scoringSide === 'away',
    outs: result.game.outs ?? 1,
    title: result.title,
    description: result.playDescription,
    playType: result.playType as any,
  });

  res.json(result);
});

// Standings
apiRouter.get('/standings', (req: Request, res: Response) => {
  const { competition, division, season, seasonId } = req.query;
  const activeSeason = (seasonId || season) as string | undefined;
  const standings = baseballRepo.getStandings(competition as string, division as string, activeSeason);
  res.json(standings);
});

// Statistics
apiRouter.get('/stats', (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'batting';
  const sortBy = req.query.sortBy as any;
  const order = (req.query.order as 'asc' | 'desc') || 'desc';
  const seasonId = (req.query.seasonId || req.query.season) as string | undefined;

  if (type === 'pitching') {
    const stats = baseballRepo.getPitchingStats(sortBy || 'era', order, seasonId);
    return res.json(stats);
  }

  // batting or advanced
  const stats = baseballRepo.getBattingStats(sortBy || 'avg', order, seasonId);
  res.json(stats);
});

// Leaders
apiRouter.get('/leaders', (req: Request, res: Response) => {
  const category = (req.query.category as 'batting' | 'pitching') || 'batting';
  const stat = (req.query.stat as string) || (category === 'batting' ? 'avg' : 'era');
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
  const seasonId = (req.query.seasonId || req.query.season) as string | undefined;
  const leaders = baseballRepo.getLeaders(category, stat, limit, seasonId);
  res.json(leaders);
});

// News
apiRouter.get('/news', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 24;
  const category = req.query.category as string;
  const news = baseballRepo.getNews(limit, category);
  res.json(news);
});

apiRouter.get('/news/:slug', (req: Request, res: Response) => {
  const article = baseballRepo.getNewsBySlug(req.params.slug);
  if (!article) {
    return res.status(404).json({ error: 'Noticia no encontrada' });
  }
  res.json(article);
});

// Community Comments on News Articles (Public consumers can read and comment)
apiRouter.get('/news/:slug/comments', (req: Request, res: Response) => {
  const comments = baseballRepo.getCommentsByArticle(req.params.slug);
  res.json(comments);
});

apiRouter.post('/news/:slug/comments', commentsLimiter, async (req: Request, res: Response) => {
  const validation = commentSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0]?.message || 'Datos de comentario inválidos.' });
  }

  const { authorName, favoriteTeam, content } = validation.data;
  try {
    const comment = await baseballRepo.addComment(req.params.slug, {
      authorName,
      favoriteTeam,
      content,
    });
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al publicar comentario.' });
  }
});

// Delete comment (Administrative moderation only)
apiRouter.delete('/news/comments/:id', requireAdmin, requireRole('superadmin', 'editor'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  try {
    const success = await baseballRepo.deleteComment(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Comentario no encontrado.' });
    }

    adminAuthService.addAuditLog(
      admin.username,
      'Moderación de Comentarios',
      `Comentario ${req.params.id} eliminado por el moderador.`,
      'system'
    );

    res.json({ success: true, message: 'Comentario eliminado.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al eliminar comentario.' });
  }
});

// Like / Upvote a comment
apiRouter.post('/news/comments/:id/like', sensitiveWriteLimiter, async (req: Request, res: Response) => {
  try {
    const result = await baseballRepo.likeComment(req.params.id);
    if (!result.success) {
      return res.status(404).json({ error: 'Comentario no encontrado.' });
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar me gusta del comentario.' });
  }
});

// Videos
apiRouter.get('/videos', (req: Request, res: Response) => {
  const videos = baseballRepo.getVideos();
  res.json(videos);
});

// Global Search
apiRouter.get('/search', (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const results = baseballRepo.searchGlobal(query);
  res.json(results);
});

// Data Ingestion & Audit Tool (Administrative access only)
apiRouter.post('/ingest/validate', requireAdmin, requireRole('superadmin'), (req: Request, res: Response) => {
  const { rawText, format } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: 'rawText es requerido' });
  }
  const summary = IngestionService.processData(rawText, format || 'csv');
  res.json(summary);
});

apiRouter.post('/ingest/commit', requireAdmin, requireRole('superadmin'), async (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const { records, username } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Lista de registros válida requerida para commit' });
  }
  try {
    const insertedCount = await IngestionService.commitIngestion(records);
    adminAuthService.recordIngestionSuccess(insertedCount, admin?.username || username || 'admin');
    res.json({ success: true, count: insertedCount, message: `${insertedCount} registros insertados exitosamente` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al persistir registros en base de datos.' });
  }
});

// ==========================================
// USER AUTHENTICATION ENDPOINTS (SUPABASE AUTH PRIMARY)
// ==========================================

// Register new user (Supabase Auth PRIMARY)
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  const { email, password, displayName, name, photoUrl, avatar, preferences } = req.body || {};
  const result = await supabaseAuthService.registerUser({
    email,
    password,
    displayName: displayName || name,
    photoUrl: photoUrl || avatar,
    preferences,
    role: 'user', // default role for public registration
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  if (result.token) {
    res.cookie('baseball_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  res.status(201).json(result);
});

// User login (Supabase Auth PRIMARY)
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { email, username, password } = req.body || {};
  const identifier = email || username;
  const result = await supabaseAuthService.loginUser(identifier, password);

  if (!result.success) {
    return res.status(401).json(result);
  }

  if (result.token) {
    res.cookie('baseball_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  res.json(result);
});

// User logout
apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  const token = extractRequestToken(req) || getRequestToken(req);
  res.clearCookie('baseball_session', { path: '/' });
  res.clearCookie('baseball_admin_token', { path: '/' });
  await supabaseAuthService.signOut(token);
  res.json({ success: true, message: 'Sesión finalizada exitosamente.' });
});

// Get current user session
apiRouter.get('/auth/session', async (req: Request, res: Response) => {
  const token = extractRequestToken(req) || getRequestToken(req);
  if (!token) {
    return res.status(401).json({ valid: false, error: 'No se encontró sesión activa.' });
  }

  const result = await supabaseAuthService.verifyToken(token);
  if (!result.valid) {
    return res.status(401).json(result);
  }

  res.json({ valid: true, user: result.user });
});

// User migration without passwords, tokens, sessions, or secrets
apiRouter.post('/admin/migrate-users', requireAdmin, requireRole('superadmin'), async (req: Request, res: Response) => {
  try {
    const rawUsers = Array.isArray(req.body?.users) ? req.body.users : supabaseAuthService.getLocalUsers();
    const result = await supabaseAuthService.migrateUsersWithoutSecrets(rawUsers);
    res.json({
      success: true,
      message: `Migrados ${result.totalMigrated} usuarios sin copiar contraseñas, tokens ni secretos.`,
      summary: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error durante la migración de usuarios.' });
  }
});

// Firebase User Profile Synchronization with Cloud SQL / Supabase
apiRouter.post('/auth/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const user = await getOrCreateUser(
      req.user.uid,
      req.user.email || `${req.user.uid}@app.internal`,
      req.body?.displayName || (req.user as any).name || null,
      req.body?.photoUrl || (req.user as any).picture || null,
      req.user.role || 'user',
      req.body?.preferences || req.user.preferences || {}
    );
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Failed to sync authenticated user:', error);
    res.status(500).json({ error: 'Error al sincronizar usuario con la base de datos' });
  }
});

apiRouter.get('/users/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const user = await getUserByUid(req.user.uid);
    res.json(user || {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role || 'user',
      preferences: req.user.preferences || {},
    });
  } catch (error: any) {
    console.error('Failed to fetch user:', error);
    res.status(500).json({ error: 'Error al consultar usuario' });
  }
});

// ==========================================
// Firebase Cloud Messaging (FCM) Push Routes
// ==========================================

// Register or update device token with favorite teams and subscribed games
apiRouter.post('/notifications/fcm/register', fcmRegisterLimiter, (req: Request, res: Response) => {
  try {
    const validation = fcmRegisterSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0]?.message || 'Datos de registro FCM inválidos' });
    }
    const { token, favoriteTeamIds, subscribedGameIds, userAgent } = validation.data;

    const subscriber = fcmServer.registerDevice(
      token,
      favoriteTeamIds,
      subscribedGameIds,
      undefined,
      userAgent || req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'Dispositivo registrado exitosamente para alertas push',
      subscribedTeams: subscriber.favoriteTeamIds,
      subscribedGames: subscriber.subscribedGameIds,
      totalDevices: fcmServer.getSubscribersCount(),
    });
  } catch (err: any) {
    console.error('Error registering FCM token:', err);
    res.status(500).json({ error: 'Error al registrar token FCM' });
  }
});

// Update specific game subscription
apiRouter.post('/notifications/fcm/subscribe-game', sensitiveWriteLimiter, (req: Request, res: Response) => {
  try {
    const validation = fcmSubscribeGameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0]?.message || 'Datos de suscripción requeridos' });
    }
    const { token, gameId, subscribed } = validation.data;
    const subscriber = fcmServer.updateGameSubscription(token, String(gameId), Boolean(subscribed));
    res.json({
      success: true,
      subscribedGames: subscriber?.subscribedGameIds || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al actualizar suscripción de partido' });
  }
});

// Unregister device token
apiRouter.post('/notifications/fcm/unregister', sensitiveWriteLimiter, (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token || token.length < 10 || token.length > 600) {
      return res.status(400).json({ error: 'Token FCM requerido y válido' });
    }
    const success = fcmServer.unregisterDevice(token);
    res.json({ success, totalDevices: fcmServer.getSubscribersCount() });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al desregistrar token FCM' });
  }
});

// Send a test push notification to a device
apiRouter.post('/notifications/fcm/test', sensitiveWriteLimiter, async (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token || token.length < 10 || token.length > 600) {
      return res.status(400).json({ error: 'Token FCM requerido y válido' });
    }
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId.trim() : undefined;

    let teamName = 'Cocodrilos de Matanzas';
    if (teamId) {
      const team = baseballRepo.getTeamById(teamId);
      if (team) teamName = team.name;
    }

    const result = await fcmServer.sendTestAlert(token, teamName);
    res.json(result);
  } catch (err: any) {
    console.error('Error in FCM test alert:', err);
    res.status(500).json({ success: false, error: err.message || 'Error en prueba push' });
  }
});

// Get FCM status
apiRouter.get('/notifications/fcm/status', (_req: Request, res: Response) => {
  res.json({
    enabled: true,
    totalDevices: fcmServer.getSubscribersCount(),
  });
});


