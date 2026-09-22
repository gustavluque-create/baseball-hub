import {
  Competition,
  Season,
  Team,
  Player,
  Game,
  BattingStats,
  PitchingStats,
  Standing,
  NewsArticle,
  VideoItem,
  IngestionValidationSummary,
  MatchupComparisonData,
  ScoreNotificationEvent,
  AdminUser,
  AdminAuthResponse,
  AdminAuditLog,
  AdminSystemOverview,
  ArticleComment,
} from '../types/index.ts';

const API_BASE = '/api';

export class ApiClient {
  private static adminToken: string | null = (typeof window !== 'undefined' ? localStorage.getItem('baseball_admin_token') : null);

  static setAdminToken(token: string | null) {
    this.adminToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('baseball_admin_token', token);
      } else {
        localStorage.removeItem('baseball_admin_token');
      }
    }
  }

  static getAdminToken(): string | null {
    return this.adminToken;
  }

  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
      };

      if (this.adminToken && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${this.adminToken}`;
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers,
        ...options,
      });

      if (!res.ok) {
        throw new Error(`API error ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      console.warn(`Fallback on ${endpoint}:`, err);
      throw err;
    }
  }

  // Competitions
  static getCompetitions(): Promise<Competition[]> {
    return this.request<Competition[]>('/competitions');
  }

  static getSeasons(competitionId?: string): Promise<Season[]> {
    const q = competitionId ? `?competition=${encodeURIComponent(competitionId)}` : '';
    return this.request<Season[]>(`/seasons${q}`);
  }

  // Teams
  static getTeams(competitionId?: string): Promise<Team[]> {
    const q = competitionId ? `?competition=${encodeURIComponent(competitionId)}` : '';
    return this.request<Team[]>(`/teams${q}`);
  }

  static getTeamDetail(id: string): Promise<{ team: Team; roster: Player[]; games: Game[] }> {
    return this.request<{ team: Team; roster: Player[]; games: Game[] }>(`/teams/${id}`);
  }

  static updateTeamLogo(id: string, logo: string, primaryColor?: string): Promise<{ success: boolean; message: string; team: Team; logo: string }> {
    return this.request<{ success: boolean; message: string; team: Team; logo: string }>(`/teams/${id}/logo`, {
      method: 'PUT',
      body: JSON.stringify({ logo, primaryColor }),
    });
  }

  // Players
  static getPlayers(params?: {
    teamId?: string;
    position?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Player[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.teamId) searchParams.set('teamId', params.teamId);
    if (params?.position) searchParams.set('position', params.position);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    return this.request<{ items: Player[]; total: number }>(`/players?${searchParams.toString()}`);
  }

  static getPlayerDetail(id: string): Promise<{ player: Player; batting?: BattingStats; pitching?: PitchingStats }> {
    return this.request<{ player: Player; batting?: BattingStats; pitching?: PitchingStats }>(`/players/${id}`);
  }

  static updatePlayerPhoto(id: string, photo: string): Promise<{ success: boolean; message: string; player: Player; photo: string }> {
    return this.request<{ success: boolean; message: string; player: Player; photo: string }>(`/players/${id}/photo`, {
      method: 'PUT',
      body: JSON.stringify({ photo }),
    });
  }

  // Games
  static getGames(params?: { competition?: string; season?: string; status?: string; team?: string }): Promise<Game[]> {
    const searchParams = new URLSearchParams();
    if (params?.competition) searchParams.set('competition', params.competition);
    if (params?.season) searchParams.set('season', params.season);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.team) searchParams.set('team', params.team);

    return this.request<Game[]>(`/games?${searchParams.toString()}`);
  }

  static getGameDetail(id: string): Promise<Game> {
    return this.request<Game>(`/games/${id}`);
  }

  static getMatchupComparison(id: string): Promise<MatchupComparisonData> {
    return this.request<MatchupComparisonData>(`/games/${id}/matchup`);
  }

  static simulateGameRun(params?: { gameId?: string; side?: 'home' | 'away'; runs?: number }): Promise<{
    game: Game;
    runsScored: number;
    scoringTeam: Team;
    scoringSide: 'home' | 'away';
    title: string;
    playDescription: string;
    playType: 'homerun' | 'hit' | 'sacrifice' | 'walk' | 'standard';
  }> {
    return this.request('/games/simulate-run', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  // Standings
  static getStandings(params?: { competition?: string; division?: string; season?: string; seasonId?: string }): Promise<Standing[]> {
    const searchParams = new URLSearchParams();
    if (params?.competition) searchParams.set('competition', params.competition);
    if (params?.division) searchParams.set('division', params.division);
    if (params?.season) searchParams.set('season', params.season);
    if (params?.seasonId) searchParams.set('seasonId', params.seasonId);

    return this.request<Standing[]>(`/standings?${searchParams.toString()}`);
  }

  // Stats
  static getStats<T = BattingStats[] | PitchingStats[]>(params?: {
    type?: 'batting' | 'pitching' | 'advanced';
    sortBy?: string;
    order?: 'asc' | 'desc';
    season?: string;
    seasonId?: string;
  }): Promise<T> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.order) searchParams.set('order', params.order);
    if (params?.season) searchParams.set('season', params.season);
    if (params?.seasonId) searchParams.set('seasonId', params.seasonId);

    return this.request<T>(`/stats?${searchParams.toString()}`);
  }

  // Leaders
  static getLeaders(params: { category: 'batting' | 'pitching'; stat: string; limit?: number; season?: string; seasonId?: string }): Promise<any[]> {
    const searchParams = new URLSearchParams({
      category: params.category,
      stat: params.stat,
      limit: (params.limit || 5).toString(),
    });
    if (params.season) searchParams.set('season', params.season);
    if (params.seasonId) searchParams.set('seasonId', params.seasonId);

    return this.request<any[]>(`/leaders?${searchParams.toString()}`);
  }

  // News
  static getNews(params?: { limit?: number; category?: string }): Promise<NewsArticle[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.category) searchParams.set('category', params.category);

    return this.request<NewsArticle[]>(`/news?${searchParams.toString()}`);
  }

  static getNewsArticle(slug: string): Promise<NewsArticle> {
    return this.request<NewsArticle>(`/news/${slug}`);
  }

  // Article Comments (Community interactions for public consumers)
  static getArticleComments(slug: string): Promise<ArticleComment[]> {
    return this.request<ArticleComment[]>(`/news/${encodeURIComponent(slug)}/comments`);
  }

  static addArticleComment(
    slug: string,
    payload: { authorName?: string; favoriteTeam?: string; content: string }
  ): Promise<ArticleComment> {
    return this.request<ArticleComment>(`/news/${encodeURIComponent(slug)}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static deleteArticleComment(commentId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/news/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Videos
  static getVideos(): Promise<VideoItem[]> {
    return this.request<VideoItem[]>('/videos');
  }

  // Global Search
  static search(query: string): Promise<{ players: Player[]; teams: Team[]; competitions: Competition[] }> {
    return this.request<{ players: Player[]; teams: Team[]; competitions: Competition[] }>(
      `/search?q=${encodeURIComponent(query)}`
    );
  }

  // Ingestion validation & commit
  static validateIngestion(rawText: string, format: 'csv' | 'json'): Promise<IngestionValidationSummary> {
    return this.request<IngestionValidationSummary>('/ingest/validate', {
      method: 'POST',
      body: JSON.stringify({ rawText, format }),
    });
  }

  static commitIngestion(records: any[]): Promise<{ success: boolean; count: number; message: string }> {
    return this.request<{ success: boolean; count: number; message: string }>('/ingest/commit', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  }

  // Real-Time Notifications, Webhooks & Polling
  static getNotificationsHistory(limit = 20): Promise<ScoreNotificationEvent[]> {
    return this.request<ScoreNotificationEvent[]>(`/notifications/history?limit=${limit}`);
  }

  static pollScoreNotifications(
    since?: number,
    limit = 20
  ): Promise<{
    events: ScoreNotificationEvent[];
    timestamp: number;
    activeClients: number;
    liveGamesCount: number;
  }> {
    const q = since ? `?since=${since}&limit=${limit}` : `?limit=${limit}`;
    return this.request(`/notifications/poll${q}`);
  }

  static sendScoreWebhook(payload: {
    gameId: string;
    scoringTeamSide?: 'home' | 'away';
    runs?: number;
    playDescription?: string;
    title?: string;
    playType?: string;
  }): Promise<{ success: boolean; event?: ScoreNotificationEvent; message: string }> {
    return this.request('/webhooks/score-update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static testScoreNotification(): Promise<{
    success: boolean;
    message: string;
    event: ScoreNotificationEvent;
  }> {
    return this.request('/notifications/test', {
      method: 'POST',
    });
  }

  static createScoreEventSource(): EventSource | null {
    if (typeof window === 'undefined' || !('EventSource' in window)) {
      return null;
    }
    return new EventSource(`${API_BASE}/events/score-changes`);
  }

  // ===================================
  // ADMIN AUTH & MANAGEMENT API METHODS
  // ===================================

  static async adminLogin(username: string, password: string): Promise<AdminAuthResponse> {
    const res = await this.request<AdminAuthResponse>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.success && res.token) {
      this.setAdminToken(res.token);
    }
    return res;
  }

  static async checkAdminSession(): Promise<{ valid: boolean; admin?: AdminUser }> {
    try {
      if (!this.adminToken) return { valid: false };
      return await this.request<{ valid: boolean; admin?: AdminUser }>('/admin/session');
    } catch {
      this.setAdminToken(null);
      return { valid: false };
    }
  }

  static async adminLogout(): Promise<{ success: boolean }> {
    try {
      const res = await this.request<{ success: boolean }>('/admin/logout', {
        method: 'POST',
      });
      return res;
    } finally {
      this.setAdminToken(null);
    }
  }

  static getAdminOverview(): Promise<AdminSystemOverview> {
    return this.request<AdminSystemOverview>('/admin/overview');
  }

  static getAdminAuditLogs(limit = 50): Promise<AdminAuditLog[]> {
    return this.request<AdminAuditLog[]>(`/admin/audit-logs?limit=${limit}`);
  }

  static createAdminGame(gameData: Partial<Game>): Promise<Game> {
    return this.request<Game>('/admin/games', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  static updateAdminGame(id: string, updates: Partial<Game>): Promise<Game> {
    return this.request<Game>(`/admin/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  static deleteAdminGame(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/admin/games/${id}`, {
      method: 'DELETE',
    });
  }

  static createAdminPlayer(playerData: Partial<Player>): Promise<Player> {
    return this.request<Player>('/admin/players', {
      method: 'POST',
      body: JSON.stringify(playerData),
    });
  }

  static updateAdminPlayer(id: string, updates: Partial<Player>): Promise<Player> {
    return this.request<Player>(`/admin/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  static deleteAdminPlayer(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/admin/players/${id}`, {
      method: 'DELETE',
    });
  }

  static createAdminTeam(teamData: Partial<Team>): Promise<Team> {
    return this.request<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify(teamData),
    });
  }

  static updateAdminTeam(id: string, updates: Partial<Team>): Promise<Team> {
    return this.request<Team>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  static deleteAdminTeam(id: string): Promise<{ success: boolean; message: string; deletedTeam?: Team }> {
    return this.request<{ success: boolean; message: string; deletedTeam?: Team }>(`/teams/${id}`, {
      method: 'DELETE',
    });
  }

  static seedAll16Teams(): Promise<{ success: boolean; message: string; teams: Team[] }> {
    return this.request<{ success: boolean; message: string; teams: Team[] }>('/teams/seed-16', {
      method: 'POST',
    });
  }

  static importAdminPlayers(players: any[]): Promise<{
    success: boolean;
    importedCount: number;
    createdCount: number;
    updatedCount: number;
    message: string;
    players: Player[];
  }> {
    return this.request('/admin/players/import', {
      method: 'POST',
      body: JSON.stringify({ players }),
    });
  }

  static createAdminNews(newsData: Partial<NewsArticle>): Promise<NewsArticle> {
    return this.request<NewsArticle>('/admin/news', {
      method: 'POST',
      body: JSON.stringify(newsData),
    });
  }

  static deleteAdminNews(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/admin/news/${id}`, {
      method: 'DELETE',
    });
  }

  static resetAdminDemo(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/admin/system/reset-demo', {
      method: 'POST',
    });
  }
}
