import { Team, Player } from '../types/index.ts';

const STORAGE_KEYS = {
  LOGOS: 'baseball_custom_team_logos',
  PLAYERS: 'baseball_custom_players',
  TEAMS: 'baseball_custom_teams',
  DELETED_PLAYERS: 'baseball_deleted_player_ids',
  LAST_SYNC: 'baseball_last_client_sync',
};

export interface CustomTeamLogoData {
  logo: string;
  primaryColor?: string;
  updatedAt: string;
}

export class ClientPersistenceService {
  private static instance: ClientPersistenceService;
  private teamLogos: Record<string, CustomTeamLogoData> = {};
  private customPlayers: Player[] = [];
  private customTeams: Team[] = [];
  private deletedPlayerIds: Set<string> = new Set();
  private isInitialized = false;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): ClientPersistenceService {
    if (!ClientPersistenceService.instance) {
      ClientPersistenceService.instance = new ClientPersistenceService();
    }
    return ClientPersistenceService.instance;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const logosRaw = localStorage.getItem(STORAGE_KEYS.LOGOS);
      if (logosRaw) {
        this.teamLogos = JSON.parse(logosRaw) || {};
      }
    } catch (e) {
      console.warn('[Persistence] Could not load logos from localStorage:', e);
    }

    try {
      const playersRaw = localStorage.getItem(STORAGE_KEYS.PLAYERS);
      if (playersRaw) {
        const parsed = JSON.parse(playersRaw);
        if (Array.isArray(parsed)) {
          this.customPlayers = parsed;
        }
      }
    } catch (e) {
      console.warn('[Persistence] Could not load players from localStorage:', e);
    }

    try {
      const teamsRaw = localStorage.getItem(STORAGE_KEYS.TEAMS);
      if (teamsRaw) {
        const parsed = JSON.parse(teamsRaw);
        if (Array.isArray(parsed)) {
          this.customTeams = parsed;
        }
      }
    } catch (e) {
      console.warn('[Persistence] Could not load teams from localStorage:', e);
    }

    try {
      const deletedRaw = localStorage.getItem(STORAGE_KEYS.DELETED_PLAYERS);
      if (deletedRaw) {
        const parsed = JSON.parse(deletedRaw);
        if (Array.isArray(parsed)) {
          this.deletedPlayerIds = new Set(parsed);
        }
      }
    } catch (e) {
      console.warn('[Persistence] Could not load deleted players from localStorage:', e);
    }

    this.isInitialized = true;
  }

  /**
   * Save or update a team logo permanently in the browser
   */
  public saveTeamLogo(teamId: string, logo: string, primaryColor?: string): void {
    if (!teamId || !logo) return;
    const cleanId = teamId.toLowerCase().trim();
    this.teamLogos[cleanId] = {
      logo,
      primaryColor,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.LOGOS, JSON.stringify(this.teamLogos));
      } catch (err) {
        console.warn('[Persistence] Storage quota exceeded while saving logo:', err);
      }
    }
  }

  /**
   * Get custom logo for a team if available
   */
  public getTeamLogo(teamId: string): string | null {
    if (!teamId) return null;
    const cleanId = teamId.toLowerCase().trim();
    return this.teamLogos[cleanId]?.logo || null;
  }

  /**
   * Get all custom team logos
   */
  public getAllTeamLogos(): Record<string, CustomTeamLogoData> {
    return { ...this.teamLogos };
  }

  /**
   * Save a newly created or edited player permanently
   */
  public savePlayer(player: Player): void {
    if (!player || !player.id) return;
    this.deletedPlayerIds.delete(player.id);
    this.customPlayers = this.customPlayers.filter((p) => p.id !== player.id);
    this.customPlayers.unshift(player);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(this.customPlayers));
        localStorage.setItem(STORAGE_KEYS.DELETED_PLAYERS, JSON.stringify(Array.from(this.deletedPlayerIds)));
      } catch (err) {
        console.warn('[Persistence] Storage quota error saving player:', err);
      }
    }
  }

  /**
   * Mark a player as deleted
   */
  public recordDeletedPlayer(id: string): void {
    if (!id) return;
    this.deletedPlayerIds.add(id);
    this.customPlayers = this.customPlayers.filter((p) => p.id !== id);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(this.customPlayers));
        localStorage.setItem(STORAGE_KEYS.DELETED_PLAYERS, JSON.stringify(Array.from(this.deletedPlayerIds)));
      } catch (err) {
        console.warn('[Persistence] Error saving deleted player status:', err);
      }
    }
  }

  /**
   * Save custom team permanently
   */
  public saveCustomTeam(team: Team): void {
    if (!team || !team.id) return;
    this.customTeams = this.customTeams.filter((t) => t.id !== team.id);
    this.customTeams.push(team);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(this.customTeams));
      } catch (err) {
        console.warn('[Persistence] Storage error saving team:', err);
      }
    }
  }

  /**
   * Alias for saving teams
   */
  public saveTeam(team: Team): void {
    this.saveCustomTeam(team);
  }

  /**
   * Record deleted team
   */
  public recordDeletedTeam(id: string): void {
    if (!id) return;
    this.customTeams = this.customTeams.filter((t) => t.id !== id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(this.customTeams));
      } catch (err) {
        console.warn('[Persistence] Storage error deleting team:', err);
      }
    }
  }

  /**
   * Get custom logo data including primaryColor
   */
  public getTeamLogoData(teamId: string): CustomTeamLogoData | null {
    if (!teamId) return null;
    const cleanId = teamId.toLowerCase().trim();
    return this.teamLogos[cleanId] || null;
  }

  /**
   * Enhance teams returned from server with any locally saved logos and customizations
   */
  public mergeTeamsWithCustomData(serverTeams: Team[]): Team[] {
    if (!serverTeams || !Array.isArray(serverTeams)) return [];

    const merged = serverTeams.map((team) => {
      const cleanId = (team.id || '').toLowerCase().trim();
      const cleanShort = (team.shortName || '').toLowerCase().trim();
      const customLogo = this.teamLogos[cleanId] || this.teamLogos[cleanShort];

      if (customLogo) {
        return {
          ...team,
          logo: customLogo.logo,
          colors: customLogo.primaryColor
            ? { ...team.colors, primary: customLogo.primaryColor }
            : team.colors,
        };
      }
      return team;
    });

    // Append any custom teams created locally that are not yet on the server
    for (const ct of this.customTeams) {
      if (!merged.some((t) => t.id === ct.id)) {
        merged.push(ct);
      }
    }

    return merged;
  }

  /**
   * Enhance players returned from server with locally created/modified players
   */
  public mergePlayersWithCustomData(serverPlayers: Player[]): Player[] {
    if (!serverPlayers || !Array.isArray(serverPlayers)) return this.customPlayers;

    // Filter out deleted players
    let list = serverPlayers.filter((p) => !this.deletedPlayerIds.has(p.id));

    // Prepend or override with custom players
    const seenIds = new Set<string>();
    const result: Player[] = [];

    // Custom players have highest priority
    for (const cp of this.customPlayers) {
      if (!seenIds.has(cp.id) && !this.deletedPlayerIds.has(cp.id)) {
        seenIds.add(cp.id);
        result.push(cp);
      }
    }

    // Then server players
    for (const sp of list) {
      if (!seenIds.has(sp.id)) {
        seenIds.add(sp.id);
        result.push(sp);
      }
    }

    return result;
  }

  /**
   * Perform bidirectional background sync with the server database
   */
  public async syncWithServer(): Promise<{ success: boolean; syncedLogos: number; syncedPlayers: number }> {
    if (typeof window === 'undefined') {
      return { success: false, syncedLogos: 0, syncedPlayers: 0 };
    }

    const payload = {
      teamLogos: this.teamLogos,
      customPlayers: this.customPlayers,
      customTeams: this.customTeams,
      deletedPlayerIds: Array.from(this.deletedPlayerIds),
    };

    const hasDataToSync =
      Object.keys(this.teamLogos).length > 0 ||
      this.customPlayers.length > 0 ||
      this.customTeams.length > 0 ||
      this.deletedPlayerIds.size > 0;

    if (!hasDataToSync) {
      return { success: true, syncedLogos: 0, syncedPlayers: 0 };
    }

    try {
      const res = await fetch('/api/sync-user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        console.log('🔄 [ClientPersistence] Synchronized local user data with server database:', result);
        return {
          success: true,
          syncedLogos: Object.keys(this.teamLogos).length,
          syncedPlayers: this.customPlayers.length,
        };
      }
    } catch (err) {
      console.warn('[ClientPersistence] Background sync failed (will retry next turn):', err);
    }

    return { success: false, syncedLogos: 0, syncedPlayers: 0 };
  }
}

export const clientPersistence = ClientPersistenceService.getInstance();
