import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AdminUser, AdminAuditLog, AdminSystemOverview } from '../../src/types/index.ts';
import { baseballRepo } from '../repositories/baseball.repository.ts';
import { notificationService } from './notification.service.ts';
import { getSupabaseServerClient, isSupabaseServerConfigured } from '../lib/supabase.ts';

interface StoredCredential {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  email: string;
  role: 'superadmin' | 'official_scorer' | 'editor';
}

// Helper to validate strict Bcrypt hash format ($2a$, $2b$, $2y$, $2x$)
export function isValidBcryptHash(hash?: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  const trimmed = hash.trim();
  return /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(trimmed);
}

// Dynamically retrieve stored admin credential from environment variables.
// CRITICAL SECURITY (FASE 2.1): NO default credentials or hashes exist in code.
// Hashes must be strictly supplied via ADMIN_*_PASSWORD_HASH in valid bcrypt format.
export function getAdminCredential(username: string): StoredCredential | null {
  const clean = username.trim().toLowerCase();

  if (clean === 'admin' || clean === 'admin@baseballhub.cu' || clean === 'superadmin' || clean === 'superadmin@baseballhub.cu') {
    const rawHash = (process.env.ADMIN_SUPERADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD_HASH || '').trim();
    if (!rawHash || !isValidBcryptHash(rawHash)) {
      return null;
    }
    return {
      id: 'admin_1',
      username: 'admin',
      passwordHash: rawHash,
      name: 'Super Administrador',
      email: 'superadmin@baseballhub.cu',
      role: 'superadmin',
    };
  }

  if (clean === 'anotador' || clean === 'anotador@baseballhub.cu') {
    const rawHash = (process.env.ADMIN_SCORER_PASSWORD_HASH || '').trim();
    if (!rawHash || !isValidBcryptHash(rawHash)) {
      return null;
    }
    return {
      id: 'admin_2',
      username: 'anotador',
      passwordHash: rawHash,
      name: 'Anotador Oficial SNB',
      email: 'anotador@baseballhub.cu',
      role: 'official_scorer',
    };
  }

  if (clean === 'prensa' || clean === 'prensa@baseballhub.cu') {
    const rawHash = (process.env.ADMIN_EDITOR_PASSWORD_HASH || '').trim();
    if (!rawHash || !isValidBcryptHash(rawHash)) {
      return null;
    }
    return {
      id: 'admin_3',
      username: 'prensa',
      passwordHash: rawHash,
      name: 'Editor de Contenido y Noticias',
      email: 'prensa@baseballhub.cu',
      role: 'editor',
    };
  }

  return null;
}

interface SessionData {
  token: string;
  admin: AdminUser;
  createdAt: number;
  expiresAt: number;
}

export class AdminAuthService {
  private readonly securityFilePath = path.resolve(process.cwd(), 'server/data/admin-security.json');
  private sessions = new Map<string, SessionData>();
  private auditLogs: AdminAuditLog[] = [];
  private serverStartTime = Date.now();
  private lastIngestionTime = '2026-09-20 10:30:00 UTC';
  private sessionTtlMs = 24 * 60 * 60 * 1000; // 24 hours standard session lifetime

  constructor() {
    this.loadFromDisk();
    if (!this.isConfigured()) {
      console.warn('[Security] Administrative credentials not configured via environment variables.');
    }
    if (this.auditLogs.length === 0) {
      // Seed initial audit log entries if first run
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
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.securityFilePath)) {
        const raw = fs.readFileSync(this.securityFilePath, 'utf-8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          // CRITICAL SECURITY (FASE 2.1): Sessions are never read from disk.
          // Invalidate and reject any legacy session files.
          if (Array.isArray(parsed.auditLogs)) {
            this.auditLogs = parsed.auditLogs;
          }
          if (parsed.lastIngestionTime) {
            this.lastIngestionTime = parsed.lastIngestionTime;
          }
        }
      }
    } catch (err) {
      console.error('[Security] Failed to read admin-security.json:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.securityFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // CRITICAL SECURITY (FASE 2.1): Never write session tokens or credentials to disk.
      const payload = {
        sessions: [],
        auditLogs: this.auditLogs.slice(0, 300),
        lastIngestionTime: this.lastIngestionTime,
      };
      const tmpPath = `${this.securityFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.securityFilePath);
    } catch (err) {
      console.error('[Security] Error writing admin-security.json:', err);
    }
  }

  /**
   * Authenticate admin user by username and password using secure bcrypt hash comparison
   */
  authenticate(
    username: string,
    password: string
  ): { success: boolean; token?: string; admin?: AdminUser; error?: string } {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) {
      return {
        success: false,
        error: 'Debe ingresar el usuario y la contraseña.',
      };
    }

    const matched = getAdminCredential(cleanUser);

    if (!matched) {
      this.addAuditLog(
        cleanUser || 'ANÓNIMO',
        'Intento Fallido de Acceso',
        `Intento de acceso denegado: credenciales no configuradas o usuario inexistente.`,
        'auth'
      );
      return {
        success: false,
        error: 'Usuario o contraseña incorrectos. Verifique sus credenciales de acceso.',
      };
    }

    // STRICT BCRYPT VALIDATION: Only valid bcrypt comparison is accepted.
    // Absolutely NO fallback to plaintext comparison.
    let passwordValid = false;
    try {
      passwordValid = bcrypt.compareSync(cleanPass, matched.passwordHash);
    } catch (err) {
      console.error('[Security] Error during bcrypt password comparison:', err);
      passwordValid = false;
    }

    if (!passwordValid) {
      this.addAuditLog(
        matched.username,
        'Intento Fallido de Acceso',
        `Credenciales incorrectas ingresadas desde el portal de administración.`,
        'auth'
      );
      return {
        success: false,
        error: 'Usuario o contraseña incorrectos. Verifique sus credenciales de acceso.',
      };
    }

    // Generate high-entropy cryptographically secure session token (256 bits)
    const token = 'adm_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + this.sessionTtlMs;

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

    this.saveToDisk();

    return {
      success: true,
      token,
      admin: adminUser,
    };
  }

  /**
   * Verify an active session token.
   * STRICT SECURITY: Only returns AdminUser if the token exists in the authenticated
   * sessions store and is not expired. Unknown tokens or tokens with 'adm_' format
   * will NEVER be automatically accepted or granted access.
   */
  verifySession(token?: string): AdminUser | null {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.trim();
    if (!cleanToken) return null;

    const session = this.sessions.get(cleanToken);
    // If session is not found in memory store, REJECT immediately (NO bypass!)
    if (!session) {
      return null;
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(cleanToken);
      return null;
    }

    return session.admin;
  }

  /**
   * Verify an administrative session via Supabase Auth JWT token
   */
  async verifySupabaseToken(jwt: string): Promise<AdminUser | null> {
    if (!jwt || !isSupabaseServerConfigured()) return null;
    const supabase = getSupabaseServerClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.auth.getUser(jwt);
      if (error || !data?.user) return null;

      const user = data.user;
      const role = (user.app_metadata?.role || user.user_metadata?.role || '') as 'superadmin' | 'official_scorer' | 'editor';
      if (!role || !['superadmin', 'official_scorer', 'editor'].includes(role)) {
        return null;
      }

      return {
        id: user.id,
        username: user.email?.split('@')[0] || user.id,
        name: user.user_metadata?.full_name || user.email || 'Administrador Supabase',
        email: user.email || '',
        role,
        lastLogin: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Terminate a session explicitly
   */
  logout(token?: string): boolean {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim();
    const session = this.sessions.get(cleanToken);
    if (session) {
      this.addAuditLog(
        session.admin.username,
        'Cierre de Sesión',
        'El usuario cerró la sesión voluntariamente.',
        'auth'
      );
      this.sessions.delete(cleanToken);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  /**
   * Check if a user has one of the allowed roles
   */
  hasRole(
    admin: AdminUser | null,
    allowedRoles: ('superadmin' | 'admin' | 'anotador' | 'prensa' | 'official_scorer' | 'editor')[]
  ): boolean {
    if (!admin) return false;
    // Superadmin has universal permissions across all administrative domains
    if (admin.role === 'superadmin') return true;
    if (admin.role === 'admin' && (allowedRoles.includes('admin') || allowedRoles.includes('official_scorer') || allowedRoles.includes('editor') || allowedRoles.includes('anotador') || allowedRoles.includes('prensa'))) {
      return true;
    }
    const role = admin.role;
    const isScorer = role === 'anotador' || role === 'official_scorer';
    const isEditor = role === 'prensa' || role === 'editor';
    return allowedRoles.some((r) => {
      if (r === role) return true;
      if (isScorer && (r === 'anotador' || r === 'official_scorer')) return true;
      if (isEditor && (r === 'prensa' || r === 'editor')) return true;
      return false;
    });
  }

  /**
   * Record an administrative audit log
   */
  addAuditLog(
    username: string,
    action: string,
    details: string,
    category: 'auth' | 'games' | 'players' | 'teams' | 'etl' | 'system'
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
    this.saveToDisk();
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
    this.saveToDisk();
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

  /**
   * Check if administrative authentication is configured via environment variables
   */
  isConfigured(role?: 'superadmin' | 'official_scorer' | 'editor'): boolean {
    if (!role) {
      return Boolean(
        getAdminCredential('admin') ||
        getAdminCredential('anotador') ||
        getAdminCredential('prensa')
      );
    }
    if (role === 'superadmin') return Boolean(getAdminCredential('admin'));
    if (role === 'official_scorer') return Boolean(getAdminCredential('anotador'));
    if (role === 'editor') return Boolean(getAdminCredential('prensa'));
    return false;
  }

  /**
   * Get credential by username
   */
  getCredential(username: string): StoredCredential | null {
    return getAdminCredential(username);
  }
}

export const adminAuthService = new AdminAuthService();
