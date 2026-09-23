import { adminMessaging } from '../../src/lib/firebase-admin.ts';
import { ScoreNotificationEvent } from '../../src/types/index.ts';

export interface FcmSubscriber {
  token: string;
  favoriteTeamIds: string[];
  userId?: string;
  userAgent?: string;
  updatedAt: number;
}

class FcmServerService {
  private static instance: FcmServerService;
  private subscribers: Map<string, FcmSubscriber> = new Map();

  public static getInstance(): FcmServerService {
    if (!FcmServerService.instance) {
      FcmServerService.instance = new FcmServerService();
    }
    return FcmServerService.instance;
  }

  /**
   * Register or update an FCM device token with subscribed favorite teams
   */
  public registerDevice(
    token: string,
    favoriteTeamIds: string[] = [],
    userId?: string,
    userAgent?: string
  ): FcmSubscriber {
    const cleanToken = token.trim();
    const normalizedTeams = favoriteTeamIds.map((t) => t.toLowerCase().trim());

    const subscriber: FcmSubscriber = {
      token: cleanToken,
      favoriteTeamIds: normalizedTeams,
      userId,
      userAgent,
      updatedAt: Date.now(),
    };

    this.subscribers.set(cleanToken, subscriber);
    console.log(
      `📲 [FCM Server] Registered device token. Subscribed teams: [${normalizedTeams.join(', ') || 'Todas'}]. Total devices: ${this.subscribers.size}`
    );
    return subscriber;
  }

  /**
   * Unregister an FCM device token
   */
  public unregisterDevice(token: string): boolean {
    const deleted = this.subscribers.delete(token.trim());
    if (deleted) {
      console.log(`📲 [FCM Server] Unregistered device token. Remaining: ${this.subscribers.size}`);
    }
    return deleted;
  }

  /**
   * Get all registered subscribers
   */
  public getSubscribersCount(): number {
    return this.subscribers.size;
  }

  /**
   * Send live score alert via FCM push to devices whose favorite team scored
   */
  public async notifyScoreChange(event: ScoreNotificationEvent): Promise<{
    sent: number;
    failed: number;
    matchedSubscribers: number;
  }> {
    if (this.subscribers.size === 0) {
      return { sent: 0, failed: 0, matchedSubscribers: 0 };
    }

    const scoringTeamId = event.scoringTeam.id.toLowerCase().trim();
    const scoringTeamName = event.scoringTeam.name;
    const runsText = event.runsScored === 1 ? '1 carrera' : `${event.runsScored} carreras`;
    const inningSide = event.isTopInning ? '▲ Alta' : '▼ Baja';

    // Find subscribers interested in this team (or subscribed to all teams)
    const targetTokens: string[] = [];
    for (const [token, subscriber] of this.subscribers.entries()) {
      if (
        subscriber.favoriteTeamIds.length === 0 ||
        subscriber.favoriteTeamIds.includes('*') ||
        subscriber.favoriteTeamIds.includes(scoringTeamId)
      ) {
        targetTokens.push(token);
      }
    }

    if (targetTokens.length === 0) {
      console.log(`📲 [FCM Server] No subscribers configured for scoring team "${scoringTeamId}".`);
      return { sent: 0, failed: 0, matchedSubscribers: 0 };
    }

    console.log(
      `📲 [FCM Server] Dispatching push notification for ${scoringTeamName} to ${targetTokens.length} device(s)...`
    );

    const title = `⚾ ¡Carrera de ${scoringTeamName}!`;
    const body = `${event.description || `Anotó ${runsText}`}. ${event.awayTeam.shortName} ${event.awayScore} - ${event.homeTeam.shortName} ${event.homeScore} (${inningSide} ${event.inning}ª)`;

    const payload = {
      notification: {
        title,
        body,
      },
      data: {
        gameId: String(event.gameId || ''),
        scoringTeamId: String(event.scoringTeam.id),
        scoringTeamName: String(event.scoringTeam.name),
        runsScored: String(event.runsScored),
        homeScore: String(event.homeScore),
        awayScore: String(event.awayScore),
        inning: String(event.inning),
        playType: String(event.playType || 'hit'),
        timestamp: String(event.timestamp || Date.now()),
        tag: `score-${event.gameId}`,
      },
      tokens: targetTokens,
    };

    try {
      const response = await adminMessaging.sendEachForMulticast(payload);
      let failedCount = 0;
      let successCount = 0;

      // Clean up invalid tokens
      response.responses.forEach((res, idx) => {
        if (res.success) {
          successCount++;
        } else {
          failedCount++;
          const errCode = res.error?.code;
          if (
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token'
          ) {
            this.subscribers.delete(targetTokens[idx]);
          }
        }
      });

      console.log(
        `📲 [FCM Server] Push broadcast result: ${successCount} successful, ${failedCount} failed.`
      );

      return {
        sent: successCount,
        failed: failedCount,
        matchedSubscribers: targetTokens.length,
      };
    } catch (err) {
      console.error('[FCM Server] Error sending multicast push notification:', err);
      return {
        sent: 0,
        failed: targetTokens.length,
        matchedSubscribers: targetTokens.length,
      };
    }
  }

  /**
   * Send a test push notification to a specific token
   */
  public async sendTestAlert(
    token: string,
    teamName: string = 'Cocodrilos de Matanzas'
  ): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      const message = {
        token: token.trim(),
        notification: {
          title: `⚾ ¡Carrera de ${teamName}! (Prueba FCM)`,
          body: `¡Jonrón con hombre en base! ${teamName} toma la ventaja 3 - 2 en la 8ª entrada.`,
        },
        data: {
          gameId: 'test-game-live',
          teamName,
          test: 'true',
          timestamp: String(Date.now()),
        },
      };

      const response = await adminMessaging.send(message);
      console.log(`📲 [FCM Server] Test push successfully sent. Message ID: ${response}`);
      return {
        success: true,
        message: `Notificación push enviada con éxito mediante Firebase Cloud Messaging para ${teamName}`,
        messageId: response,
      };
    } catch (err: any) {
      console.error('[FCM Server] Test push failed:', err);
      return {
        success: false,
        message: err.message || 'Error al enviar notificación push de prueba con FCM',
      };
    }
  }
}

export const fcmServer = FcmServerService.getInstance();
