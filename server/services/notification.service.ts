import { Request, Response } from 'express';
import { EventEmitter } from 'events';
import { baseballRepo } from '../repositories/baseball.repository.ts';
import { ScoreNotificationEvent } from '../../src/types/index.ts';

class NotificationService extends EventEmitter {
  private sseClients: Set<Response> = new Set();
  private history: ScoreNotificationEvent[] = [];
  private readonly maxHistoryLength = 50;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Broadcast a score change event to all connected SSE clients and save to history
   */
  public broadcastScoreChange(event: Omit<ScoreNotificationEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): ScoreNotificationEvent {
    const fullEvent: ScoreNotificationEvent = {
      id: event.id || `score-evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: event.timestamp || Date.now(),
      gameId: event.gameId,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      scoringTeam: event.scoringTeam,
      scoringTeamSide: event.scoringTeamSide,
      runsScored: event.runsScored,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      inning: event.inning,
      isTopInning: event.isTopInning,
      outs: event.outs,
      title: event.title,
      description: event.description,
      playType: event.playType || 'hit',
      autoDismissMs: event.autoDismissMs || 6500,
      read: false,
    };

    // Insert at beginning of history
    this.history.unshift(fullEvent);
    if (this.history.length > this.maxHistoryLength) {
      this.history.pop();
    }

    // Emit event locally
    this.emit('score:change', fullEvent);

    // Broadcast to SSE clients
    const payload = JSON.stringify({
      type: 'score:change',
      data: fullEvent,
      timestamp: Date.now(),
    });

    for (const client of this.sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (err) {
        console.warn('Error broadcasting to SSE client, removing:', err);
        this.sseClients.delete(client);
      }
    }

    return fullEvent;
  }

  /**
   * Register a new SSE connection for browser webhooks/streaming
   */
  public handleSSEConnection(req: Request, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Flush headers if supported
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    this.sseClients.add(res);

    // Send initial handshake
    const initialPayload = JSON.stringify({
      type: 'connected',
      message: 'Conectado al feed en tiempo real de marcadores de Baseball Hub',
      timestamp: Date.now(),
      activeClients: this.sseClients.size,
      recentEvents: this.history.slice(0, 5),
    });
    res.write(`data: ${initialPayload}\n\n`);

    // Keepalive ping every 25 seconds to prevent browser/proxy timeouts
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(`: keep-alive ${Date.now()}\n\n`);
      } catch {
        clearInterval(keepAliveTimer);
        this.sseClients.delete(res);
      }
    }, 25000);

    // Clean up when client disconnects
    req.on('close', () => {
      clearInterval(keepAliveTimer);
      this.sseClients.delete(res);
    });
  }

  /**
   * Return recent events, optionally since a specific timestamp
   */
  public getHistory(since?: number, limit = 20): ScoreNotificationEvent[] {
    if (since && !isNaN(since)) {
      return this.history.filter((e) => e.timestamp > since).slice(0, limit);
    }
    return this.history.slice(0, limit);
  }

  /**
   * Handle incoming Webhook from external sports data providers or internal triggers
   */
  public handleIncomingWebhook(body: any): { success: boolean; event?: ScoreNotificationEvent; message: string } {
    const {
      gameId,
      scoringTeamSide = 'home',
      runs = 1,
      playDescription,
      title,
      playType = 'hit',
    } = body || {};

    if (!gameId) {
      return { success: false, message: 'gameId es requerido en el payload del webhook' };
    }

    const runsCount = Math.max(1, Math.min(4, Number(runs) || 1));
    const side: 'home' | 'away' = scoringTeamSide === 'away' ? 'away' : 'home';

    // Update in repository
    const simResult = baseballRepo.simulateLiveScoreChange(gameId, side, runsCount);
    if (!simResult) {
      return { success: false, message: `No se encontró el partido activo con ID: ${gameId}` };
    }

    const event = this.broadcastScoreChange({
      gameId: simResult.game.id,
      homeTeam: simResult.game.homeTeam,
      awayTeam: simResult.game.awayTeam,
      scoringTeam: simResult.scoringTeam,
      scoringTeamSide: simResult.scoringSide,
      runsScored: simResult.runsScored,
      homeScore: simResult.game.homeScore,
      awayScore: simResult.game.awayScore,
      inning: simResult.game.currentInning || 8,
      isTopInning: simResult.scoringSide === 'away',
      outs: simResult.game.outs ?? 1,
      title: title || simResult.title,
      description: playDescription || simResult.playDescription,
      playType: (playType as any) || simResult.playType,
    });

    return {
      success: true,
      event,
      message: `Webhook procesado con éxito: +${runsCount} carrera(s) para ${simResult.scoringTeam.name}`,
    };
  }

  /**
   * Generate a realistic test score change notification for preview and sound/permission testing
   */
  public generateTestNotification(): ScoreNotificationEvent {
    const games = baseballRepo.getGames();
    const liveGames = games.filter((g) => g.status === 'LIVE');
    const targetGame = liveGames.length > 0 ? liveGames[0] : games[0];

    const runs = Math.random() > 0.7 ? 2 : 1;
    const side: 'home' | 'away' = Math.random() > 0.5 ? 'home' : 'away';

    if (targetGame) {
      const sim = baseballRepo.simulateLiveScoreChange(targetGame.id, side, runs);
      if (sim) {
        return this.broadcastScoreChange({
          gameId: sim.game.id,
          homeTeam: sim.game.homeTeam,
          awayTeam: sim.game.awayTeam,
          scoringTeam: sim.scoringTeam,
          scoringTeamSide: sim.scoringSide,
          runsScored: sim.runsScored,
          homeScore: sim.game.homeScore,
          awayScore: sim.game.awayScore,
          inning: sim.game.currentInning || 8,
          isTopInning: sim.scoringSide === 'away',
          outs: sim.game.outs ?? 1,
          title: sim.title,
          description: sim.playDescription,
          playType: sim.playType as any,
        });
      }
    }

    // Fallback dummy event if no games in repo
    return this.broadcastScoreChange({
      gameId: 'gm-demo-test',
      homeTeam: {
        id: 'ind',
        name: 'Industriales de La Habana',
        nickname: 'Leones de la Capital',
        shortName: 'IND',
        city: 'La Habana',
        stadium: 'Estadio Latinoamericano',
        manager: 'Guillermo Carmona',
        foundedYear: 1962,
        championships: 12,
        colors: { primary: '#1d4ed8', secondary: '#3b82f6', text: '#ffffff' },
        logo: '🦁',
        competitionId: 'snb',
        seasonId: 'snb-2026',
        record: { wins: 34, losses: 18, pct: 0.654, streak: 'W3', lastTen: '7-3', position: 1 },
      },
      awayTeam: {
        id: 'ltu',
        name: 'Leñadores de Las Tunas',
        nickname: 'Leñadores',
        shortName: 'LTU',
        city: 'Las Tunas',
        stadium: 'Estadio Julio Antonio Mella',
        manager: 'Abeysi Pantoja',
        foundedYear: 1977,
        championships: 2,
        colors: { primary: '#15803d', secondary: '#22c55e', text: '#ffffff' },
        logo: '🪓',
        competitionId: 'snb',
        seasonId: 'snb-2026',
        record: { wins: 32, losses: 20, pct: 0.615, streak: 'W1', lastTen: '6-4', position: 2 },
      },
      scoringTeam: {
        id: 'ind',
        name: 'Industriales de La Habana',
        nickname: 'Leones de la Capital',
        shortName: 'IND',
        city: 'La Habana',
        stadium: 'Estadio Latinoamericano',
        manager: 'Guillermo Carmona',
        foundedYear: 1962,
        championships: 12,
        colors: { primary: '#1d4ed8', secondary: '#3b82f6', text: '#ffffff' },
        logo: '🦁',
        competitionId: 'snb',
        seasonId: 'snb-2026',
        record: { wins: 34, losses: 18, pct: 0.654, streak: 'W3', lastTen: '7-3', position: 1 },
      },
      scoringTeamSide: 'home',
      runsScored: 2,
      homeScore: 5,
      awayScore: 3,
      inning: 8,
      isTopInning: false,
      outs: 1,
      title: '¡JONRÓN DE 2 CARRERAS!',
      description: 'IND: Conexión panorámica por el prado izquierdo remolcando 2 carreras para tomar ventaja.',
      playType: 'homerun',
    });
  }

  public getActiveClientCount(): number {
    return this.sseClients.size;
  }
}

export const notificationService = new NotificationService();
