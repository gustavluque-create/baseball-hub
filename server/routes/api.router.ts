import { Router, Request, Response, NextFunction } from 'express';
import { baseballRepo } from '../repositories/baseball.repository.ts';
import { IngestionService } from '../services/ingestion.service.ts';
import { notificationService } from '../services/notification.service.ts';
import { adminAuthService } from '../services/admin-auth.service.ts';

export const apiRouter = Router();

// Middleware to authenticate admin requests
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.headers['x-admin-token'] as string);

  const admin = adminAuthService.verifySession(token);
  if (!admin) {
    return res.status(401).json({
      success: false,
      error: 'Acceso no autorizado. Se requiere iniciar sesión con usuario y contraseña de administrador.',
    });
  }

  (req as any).adminUser = admin;
  (req as any).adminToken = token;
  next();
};

// ==========================================
// ADMIN AUTHENTICATION & SECURITY ENDPOINTS
// ==========================================

apiRouter.post('/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Debe ingresar el usuario y la contraseña de administración.',
    });
  }

  const result = adminAuthService.authenticate(username, password);
  if (!result.success) {
    return res.status(401).json(result);
  }

  res.json(result);
});

apiRouter.get('/admin/session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.headers['x-admin-token'] as string);

  const admin = adminAuthService.verifySession(token);
  if (!admin) {
    return res.status(401).json({ valid: false, error: 'Sesión inválida o expirada' });
  }

  res.json({ valid: true, admin });
});

apiRouter.post('/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.headers['x-admin-token'] as string);

  const success = adminAuthService.logout(token);
  res.json({ success });
});

apiRouter.get('/admin/overview', requireAdmin, (req: Request, res: Response) => {
  const overview = adminAuthService.getOverview();
  res.json(overview);
});

apiRouter.get('/admin/audit-logs', requireAdmin, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = adminAuthService.getAuditLogs(limit);
  res.json(logs);
});

// Admin Game Management
apiRouter.post('/admin/games', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const newGame = baseballRepo.createGame(req.body);
  adminAuthService.addAuditLog(
    admin.username,
    'Creación de Partido',
    `Partido creado: ${newGame.awayTeam.shortName} vs ${newGame.homeTeam.shortName} (${newGame.date})`,
    'games'
  );
  res.status(201).json(newGame);
});

apiRouter.put('/admin/games/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const gameId = req.params.id;
  const existingGame = baseballRepo.getGameById(gameId);

  if (!existingGame) {
    return res.status(404).json({ error: 'Partido no encontrado' });
  }

  const updatedGame = baseballRepo.updateGame(gameId, req.body);
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
      title: `¡Anotación de ${scoringTeam.name}!`,
      description: `Actualizado por administración: ${updatedGame.awayTeam.shortName} ${updatedGame.awayScore} - ${updatedGame.homeScore} ${updatedGame.homeTeam.shortName}`,
      playType: 'hit',
    });
  }

  adminAuthService.addAuditLog(
    admin.username,
    'Actualización de Partido',
    `Partido ${updatedGame.awayTeam.shortName} vs ${updatedGame.homeTeam.shortName} actualizado (${updatedGame.status}, Marcador: ${updatedGame.awayScore}-${updatedGame.homeScore})`,
    'games'
  );

  res.json(updatedGame);
});

apiRouter.delete('/admin/games/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const success = baseballRepo.deleteGame(req.params.id);
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
});

// Admin Player Management
apiRouter.post('/admin/players', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const player = baseballRepo.createPlayer(req.body);
  adminAuthService.addAuditLog(
    admin.username,
    'Creación de Jugador',
    `Jugador registrado: ${player.fullName} (${player.position}, #${player.jerseyNumber} - ${player.teamShort})`,
    'players'
  );
  res.status(201).json(player);
});

apiRouter.put('/admin/players/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const player = baseballRepo.updatePlayer(req.params.id, req.body);
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
});

apiRouter.delete('/admin/players/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const success = baseballRepo.deletePlayer(req.params.id);
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
});

// Admin News Management
apiRouter.post('/admin/news', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const article = baseballRepo.createNews(req.body);
  adminAuthService.addAuditLog(
    admin.username,
    'Publicación de Noticia',
    `Noticia publicada: "${article.title}"`,
    'system'
  );
  res.status(201).json(article);
});

apiRouter.delete('/admin/news/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const success = baseballRepo.deleteNews(req.params.id);
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
});

// System Reset to Demo Data
apiRouter.post('/admin/system/reset-demo', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  baseballRepo.resetToDefaults();
  adminAuthService.addAuditLog(
    admin.username,
    'Restablecimiento del Sistema',
    'Todos los datos fueron restablecidos a los valores demo de fábrica.',
    'system'
  );
  res.json({ success: true, message: 'Datos restablecidos exitosamente a los valores de fábrica.' });
});

// Real-Time Browser Webhooks & Streaming (Server-Sent Events)
apiRouter.get('/events/score-changes', (req: Request, res: Response) => {
  notificationService.handleSSEConnection(req, res);
});

// Incoming Webhook for Score Updates (from external sports feeds or simulators)
apiRouter.post('/webhooks/score-update', (req: Request, res: Response) => {
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
apiRouter.post('/notifications/test', (req: Request, res: Response) => {
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

apiRouter.get('/teams/:id', (req: Request, res: Response) => {
  const team = baseballRepo.getTeamById(req.params.id);
  if (!team) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
  }
  const roster = baseballRepo.getPlayers({ teamId: team.id, limit: 100 }).items;
  const games = baseballRepo.getGames({ teamId: team.id });
  res.json({ team, roster, games });
});

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
  const batting = baseballRepo.getBattingStats().find((b) => b.playerId === player.id);
  const pitching = baseballRepo.getPitchingStats().find((p) => p.playerId === player.id);
  res.json({ player, batting, pitching });
});

// Games
apiRouter.get('/games', (req: Request, res: Response) => {
  const { competition, season, status, team } = req.query;
  const games = baseballRepo.getGames({
    competitionId: competition as string,
    seasonId: season as string,
    status: status as string,
    teamId: team as string,
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

apiRouter.post('/games/simulate-run', (req: Request, res: Response) => {
  const { gameId, side, runs } = req.body || {};
  const result = baseballRepo.simulateLiveScoreChange(gameId, side, runs);
  if (!result) {
    return res.status(404).json({ error: 'No se encontraron partidos en vivo para simular carreras.' });
  }

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
  const { competition, division } = req.query;
  const standings = baseballRepo.getStandings(competition as string, division as string);
  res.json(standings);
});

// Statistics
apiRouter.get('/stats', (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'batting';
  const sortBy = req.query.sortBy as any;
  const order = (req.query.order as 'asc' | 'desc') || 'desc';

  if (type === 'pitching') {
    const stats = baseballRepo.getPitchingStats(sortBy || 'era', order);
    return res.json(stats);
  }

  // batting or advanced
  const stats = baseballRepo.getBattingStats(sortBy || 'avg', order);
  res.json(stats);
});

// Leaders
apiRouter.get('/leaders', (req: Request, res: Response) => {
  const category = (req.query.category as 'batting' | 'pitching') || 'batting';
  const stat = (req.query.stat as string) || (category === 'batting' ? 'avg' : 'era');
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
  const leaders = baseballRepo.getLeaders(category, stat, limit);
  res.json(leaders);
});

// News
apiRouter.get('/news', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
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

// Data Ingestion & Audit Tool
apiRouter.post('/ingest/validate', (req: Request, res: Response) => {
  const { rawText, format } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: 'rawText es requerido' });
  }
  const summary = IngestionService.processData(rawText, format || 'csv');
  res.json(summary);
});

apiRouter.post('/ingest/commit', (req: Request, res: Response) => {
  const { records, username } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Lista de registros válida requerida para commit' });
  }
  const insertedCount = IngestionService.commitIngestion(records);
  adminAuthService.recordIngestionSuccess(insertedCount, username || 'admin');
  res.json({ success: true, count: insertedCount, message: `${insertedCount} registros insertados exitosamente` });
});
