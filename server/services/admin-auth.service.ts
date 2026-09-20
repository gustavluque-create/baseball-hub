import crypto from 'crypto';
import { AdminUser, AdminAuditLog, AdminSystemOverview } from '../../src/types/index.ts';
import { baseballRepo } from '../repositories/baseball.repository.ts';
import { notificationService } from './notification.service.ts';

interface StoredCredential {
  id: string;
  username: string;
  passwordHash: string; // Plain comparison or hash for simplicity
  name: string;
  email: string;
  role: 'superadmin' | 'official_scorer' | 'editor';
}

const REGISTERED_ADMINS: StoredCredential[] = [
  {
    id: 'admin_1',
    username: 'admin',
    passwordHash: 'baseball2026',
    name: 'Administrador General',
    email: 'admin@baseballhub.cu',
    role: 'superadmin',
  },
  {
    id: 'admin_2',
    username: 'anotador',
    passwordHash: 'anotador2026',
    name: 'Anotador Oficial SNB',
    email: 'anotador@baseballhub.cu',
    role: 'official_scorer',
  },
  {
    id: 'admin_3',
    username: 'prensa',
    passwordHash: 'prensa2026',
    name: 'Editor de Contenido y Noticias',
    email: 'prensa@baseballhub.cu',
    role: 'editor',
  },
];

interface SessionData {
  token: string;
  admin: AdminUser;
  createdAt: number;
  expiresAt: number;
}

export class AdminAuthService {
  private sessions = new Map<string, SessionData>();
  private auditLogs: AdminAuditLog[] = [];
  private serverStartTime = Date.now();
  private lastIngestionTime = '2026-09-20 10:30:00 UTC';

  constructor() {
    // Seed initial audit log entries
    this.addAuditLog(
      'SISTEMA',
      'Inicialización de Seguridad',
      'Módulo de autenticación administrativa activo con control de sesiones seguras y RBAC.',
      'system'
    );
    this.addAuditLog(
      'admin',
      'Ingesta Inicial de Temporada',
      'Carga de roster y estadísticas para 63 SNB y Élite 2026.',
      'etl'
    );
  }

  /**
   * Authenticate admin user by username and password
   */
  authenticate(username: string, password: string): { success: boolean; token?: string; admin?: AdminUser; error?: string } {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const matched = REGISTERED_ADMINS.find(
      (a) => a.username.toLowerCase() === cleanUser && a.passwordHash === cleanPass
    );

    if (!matched) {
      this.addAuditLog(
        cleanUser || 'ANÓNIMO',
        'Intento Fallido de Acceso',
        `Credenciales incorrectas ingresadas desde el portal de administración.`,
        'auth'
      );
      return {
        success: false,
        error: 'Usuario o contraseña incorrectos. Verifique sus credenciales de acceso.',
      };
    }

    // Generate secure session token
    const token = 'adm_' + crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    const adminUser: AdminUser = {
      id: matched.id,
      username: matched.username,
      name: matched.name,
      email: matched.email,
      role: matched.role,
      lastLogin: new Date().toISOString(),
    };

    this.sessions.set(token, {
      token,
      admin: adminUser,
      createdAt: now,
      expiresAt,
    });

    this.addAuditLog(
      matched.username,
      'Inicio de Sesión Exitoso',
      `Acceso concedido con rol ${matched.role.toUpperCase()} al panel de administración.`,
      'auth'
    );

    return {
      success: true,
      token,
      admin: adminUser,
    };
  }

  /**
   * Verify an active session token
   */
  verifySession(token?: string): AdminUser | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    return session.admin;
  }

  /**
   * Terminate a session
   */
  logout(token?: string): boolean {
    if (!token) return false;
    const session = this.sessions.get(token);
    if (session) {
      this.addAuditLog(
        session.admin.username,
        'Cierre de Sesión',
        'El usuario cerró la sesión voluntariamente.',
        'auth'
      );
      this.sessions.delete(token);
      return true;
    }
    return false;
  }

  /**
   * Record an administrative audit log
   */
  addAuditLog(
    username: string,
    action: string,
    details: string,
    category: 'auth' | 'games' | 'players' | 'etl' | 'system'
  ): void {
    const log: AdminAuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      username,
      action,
      details,
      category,
    };

    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  /**
   * Retrieve audit logs with optional pagination limit
   */
  getAuditLogs(limit: number = 50): AdminAuditLog[] {
    return this.auditLogs.slice(0, limit);
  }

  /**
   * Set last ingestion date
   */
  recordIngestionSuccess(count: number, user: string): void {
    this.lastIngestionTime = new Date().toISOString();
    this.addAuditLog(
      user,
      'Commit ETL de Estadísticas',
      `Se procesaron y cargaron ${count} registros en la base de datos central.`,
      'etl'
    );
  }

  /**
   * Get system overview metrics
   */
  getOverview(): AdminSystemOverview {
    const games = baseballRepo.getGames();
    const liveGames = games.filter((g) => g.status === 'LIVE').length;
    const teams = baseballRepo.getTeams();
    const players = baseballRepo.getPlayers();
    const notificationClients = notificationService.getActiveClientCount();
    const uptimeSeconds = Math.floor((Date.now() - this.serverStartTime) / 1000);

    return {
      totalGames: games.length,
      liveGames,
      totalPlayers: players.total,
      totalTeams: teams.length,
      notificationClients,
      uptimeSeconds,
      lastIngestionDate: this.lastIngestionTime,
    };
  }
}

export const adminAuthService = new AdminAuthService();
