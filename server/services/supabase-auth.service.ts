import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  createSupabaseAuthClient,
  getSupabaseServerClient,
  isSupabaseServerConfigured,
  isSupabaseAuthConfigured,
} from '../lib/supabase.ts';
import { adminAuth } from '../../src/lib/firebase-admin.ts';
import { adminAuthService } from './admin-auth.service.ts';
import { AdminUser } from '../../src/types/index.ts';

export type AppUserRole = 'superadmin' | 'admin' | 'anotador' | 'prensa' | 'official_scorer' | 'editor' | 'user';

export interface AuthenticatedUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  displayName: string;
  avatar?: string;
  photoUrl?: string;
  role: AppUserRole;
  preferences?: Record<string, any>;
  provider: 'supabase' | 'firebase' | 'local';
}

export interface AuthSessionResult {
  valid: boolean;
  expired?: boolean;
  user?: AuthenticatedUser;
  admin?: AdminUser;
  error?: string;
}

export interface UserRegistrationPayload {
  email: string;
  password?: string;
  displayName?: string;
  name?: string;
  photoUrl?: string;
  avatar?: string;
  role?: AppUserRole;
  preferences?: Record<string, any>;
}

// In-memory registry for local fallback users (zero secrets persisted to disk)
interface LocalUserRecord {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: AppUserRole;
  preferences: Record<string, any>;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

class SupabaseAuthService {
  private localUsers = new Map<string, LocalUserRecord>();
  private activeTokens = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();
  private defaultTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Zero hardcoded accounts or passwords.
    // Dynamic credentials strictly use environment bcrypt hashes via adminAuthService or real Supabase Auth.
  }

  /**
   * Check if Supabase Auth (public anon client) is active and configured
   */
  public isSupabaseAuthConfigured(): boolean {
    return isSupabaseAuthConfigured();
  }

  /**
   * Check if Supabase Server (administrative client) is active and configured
   */
  public isSupabaseServerConfigured(): boolean {
    return isSupabaseServerConfigured();
  }

  /**
   * Normalize user role server-side
   */
  public normalizeRole(rawRole?: string): AppUserRole {
    if (!rawRole) return 'user';
    const clean = rawRole.toLowerCase().trim();
    if (clean === 'superadmin') return 'superadmin';
    if (clean === 'admin') return 'admin';
    if (clean === 'anotador' || clean === 'official_scorer') return 'anotador';
    if (clean === 'prensa' || clean === 'editor') return 'prensa';
    return 'user';
  }

  /**
   * Check if user role matches allowed roles server-side
   */
  public hasPermission(userRole: AppUserRole, requiredRoles: AppUserRole[]): boolean {
    if (userRole === 'superadmin') return true; // Superadmin has universal permissions
    if (userRole === 'admin' && (requiredRoles.includes('admin') || requiredRoles.includes('anotador') || requiredRoles.includes('prensa'))) {
      return true;
    }
    const normalizedUserRole = this.normalizeRole(userRole);
    return requiredRoles.some((r) => this.normalizeRole(r) === normalizedUserRole);
  }

  /**
   * Fuente autoritativa de roles: tabla 'public.users' en PostgreSQL / Supabase.
   * Reglas de seguridad:
   * 1. Consulta el perfil mediante el UUID real validado por Supabase.
   * 2. Si la consulta falla (error de red o base de datos), falla de forma segura retornando 'user'
   *    (nunca concede privilegios administrativos ante un fallo de consulta ni recurre a app_metadata para eludir el error).
   * 3. Si no existe el perfil del usuario en public.users, retorna 'user' (cero privilegios administrativos).
   * 4. Nunca confía en user_metadata.role para ninguna decisión de autorización.
   * 5. Solo cuando Supabase Server no está configurado (modo local-fallback/testing), recurre a localUsers o appMetadataRole de prueba.
   */
  public async resolveServerRole(
    userId: string,
    appMetadataRole?: string,
    userEmail?: string
  ): Promise<AppUserRole> {
    if (!userId || typeof userId !== 'string') return 'user';

    // 1. Fuente autoritativa primaria: tabla public.users cuando Supabase Server está configurado
    if (this.isSupabaseServerConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        // Fallo seguro: sin cliente administrativo configurado, no conceder privilegios administrativos
        return 'user';
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, uid, role')
          .or(`id.eq.${userId},uid.eq.${userId}`)
          .maybeSingle();

        // Si la consulta falla, fallar de forma segura sin conceder privilegios ni eludir el error
        if (error) {
          console.error('[SupabaseAuth] Error en consulta autoritativa de public.users:', error.message);
          return 'user';
        }

        // Si no existe el perfil, no conceder privilegios administrativos
        if (!data) {
          return 'user';
        }

        // Verificación estricta: perfil corresponde al UUID autenticado
        if ((data.id === userId || data.uid === userId) && data.role) {
          return this.normalizeRole(data.role);
        }

        // Si el perfil no coincide con el UUID, denegar privilegios administrativos
        return 'user';
      } catch (err: any) {
        // En caso de excepción, fallar de forma segura retornando rol 'user'
        console.error('[SupabaseAuth] Excepción en consulta de rol autoritativo:', err?.message || err);
        return 'user';
      }
    }

    // 2. Modo fallback local (estrictamente cuando Supabase Server NO está configurado)
    if (appMetadataRole && typeof appMetadataRole === 'string') {
      return this.normalizeRole(appMetadataRole);
    }

    // 3. Fallback: check server local users store
    if (userEmail) {
      const local = this.localUsers.get(userEmail.toLowerCase().trim());
      if (local && (local.id === userId || local.uid === userId)) {
        return this.normalizeRole(local.role);
      }
    }
    for (const [, local] of this.localUsers.entries()) {
      if (local.id === userId || local.uid === userId) {
        return this.normalizeRole(local.role);
      }
    }

    return 'user';
  }

  /**
   * Register a new user in Supabase Auth (PRIMARY) with local fallback.
   * SECURITY REQUIREMENT:
   * 1. Public registration ALWAYS forces role = 'user'.
   * 2. Any role specified in the registration payload is strictly ignored.
   * 3. Administrative roles can NEVER be assigned via public registration.
   * 4. Supabase users receive a real Supabase Auth session token via signInWithPassword (zero synthetic tokens).
   */
  public async registerUser(payload: UserRegistrationPayload): Promise<{
    success: boolean;
    user?: AuthenticatedUser;
    token?: string;
    error?: string;
  }> {
    const email = (payload.email || '').toLowerCase().trim();
    const password = payload.password || '';
    const displayName = payload.displayName || payload.name || email.split('@')[0];
    const photoUrl = payload.photoUrl || payload.avatar || '';
    // FORCED STRICTLY TO 'user' - ignore any requested role in payload (prevent privilege escalation)
    const role: AppUserRole = 'user';
    const preferences = payload.preferences || {};

    if (!email || !email.includes('@')) {
      return { success: false, error: 'Correo electrónico inválido.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    // 1. Supabase Auth (PRIMARY)
    if (this.isSupabaseServerConfigured()) {
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        try {
          // Create user in Supabase Auth using service role with strict role: 'user'
          const { data: supaUser, error: supaErr } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              name: displayName,
              full_name: displayName,
              avatar_url: photoUrl,
              preferences,
            },
            app_metadata: {
              role: 'user',
              provider: 'email',
            },
          });

          if (supaErr) {
            console.error('[SupabaseAuth] Registration error in Supabase Auth:', supaErr.message);
            return { success: false, error: `Error al registrar usuario en Supabase: ${supaErr.message}` };
          }

          if (supaUser?.user) {
            const uid = supaUser.user.id;
            // Upsert user profile into public.users table (WITHOUT copying secrets/passwords)
            const { error: profileErr } = await adminClient.from('users').upsert({
              id: uid,
              uid,
              email,
              display_name: displayName,
              photo_url: photoUrl,
              role: 'user',
              preferences,
              updated_at: new Date().toISOString(),
            });

            if (profileErr) {
              console.error('[SupabaseAuth] Error al crear perfil en public.users durante registro:', profileErr.message);
              // Intento de reversión / compensación: eliminar usuario recién creado en Supabase Auth
              let deletionSucceeded = false;
              let deletionErrorMsg: string | undefined;

              try {
                const deleteRes = await adminClient.auth.admin.deleteUser(uid);
                if (deleteRes.error) {
                  deletionErrorMsg = deleteRes.error.message;
                  console.error('[SupabaseAuth] [CRÍTICO] Falló la eliminación del usuario en Supabase Auth tras error en public.users:', deleteRes.error.message);
                } else {
                  deletionSucceeded = true;
                  console.log(`[SupabaseAuth] Reversión exitosa: usuario ${uid} eliminado de Supabase Auth tras fallo en public.users.`);
                }
              } catch (rollbackErr: any) {
                deletionErrorMsg = rollbackErr?.message || String(rollbackErr);
                console.error('[SupabaseAuth] [CRÍTICO] Excepción al revertir creación en Supabase Auth:', deletionErrorMsg);
              }

              if (!deletionSucceeded) {
                return {
                  success: false,
                  error: `Error crítico durante el registro: falló la creación del perfil en base de datos (${profileErr.message}) y falló la eliminación de la cuenta en Supabase Auth (${deletionErrorMsg || 'Error desconocido'}). La cuenta requiere atención administrativa.`,
                };
              }

              return {
                success: false,
                error: `Error al crear el perfil de usuario en base de datos: ${profileErr.message}. Se canceló el registro y se eliminó la cuenta creada para mantener la consistencia.`,
              };
            }

            // Authenticate directly via signInWithPassword using independent authentication client (with SUPABASE_ANON_KEY).
            // Separado estrictamente del cliente administrativo. ZERO synthetic tokens for Supabase users!
            let realSessionToken: string | undefined;
            let sessionFetchError: string | undefined;
            const authClient = createSupabaseAuthClient();
            if (authClient) {
              try {
                const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
                  email,
                  password,
                });
                if (!signInErr && signInData?.session?.access_token) {
                  realSessionToken = signInData.session.access_token;
                } else if (signInErr) {
                  sessionFetchError = signInErr.message;
                  console.warn('[SupabaseAuth] Error al obtener sesión real post-registro:', signInErr.message);
                }
              } catch (authErr: any) {
                sessionFetchError = authErr?.message || 'Error de conexión de autenticación';
                console.warn('[SupabaseAuth] Excepción al obtener sesión post-registro:', authErr);
              }
            } else {
              sessionFetchError = 'Cliente de autenticación pública no configurado.';
            }

            return {
              success: true,
              user: {
                id: uid,
                uid,
                email,
                name: displayName,
                displayName,
                avatar: photoUrl,
                photoUrl,
                role: 'user',
                preferences,
                provider: 'supabase',
              },
              token: realSessionToken,
              error: realSessionToken ? undefined : sessionFetchError ? `Usuario registrado correctamente. Inicio de sesión automático no disponible: ${sessionFetchError}` : undefined,
            };
          }
        } catch (err: any) {
          console.error('[SupabaseAuth] Exception during user registration in Supabase:', err);
          return { success: false, error: err?.message || 'Error durante el registro en Supabase Auth.' };
        }
      }
    }

    // 2. Local Fallback (strictly when Supabase is not configured)
    const existing = this.localUsers.get(email);
    if (existing) {
      return { success: false, error: 'Ya existe un usuario registrado con este correo.' };
    }

    const uid = 'usr_' + crypto.randomBytes(8).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    const localUser: LocalUserRecord = {
      id: uid,
      uid,
      email,
      displayName,
      photoUrl,
      role: 'user', // Forced strictly to 'user'
      preferences,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.localUsers.set(email, localUser);

    const authUser: AuthenticatedUser = {
      id: uid,
      uid,
      email,
      name: displayName,
      displayName,
      avatar: photoUrl,
      photoUrl,
      role: 'user',
      preferences,
      provider: 'local',
    };

    // Synthetic tokens are strictly reserved for local fallback when Supabase is not configured
    const token = this.createSyntheticToken(authUser);
    return { success: true, user: authUser, token };
  }

  /**
   * Authenticate user with email and password via Supabase Auth (PRIMARY)
   * Fallback uses environment-configured bcrypt credentials or registered users
   */
  public async loginUser(
    emailOrUser: string,
    password?: string
  ): Promise<{
    success: boolean;
    user?: AuthenticatedUser;
    token?: string;
    error?: string;
  }> {
    const identifier = (emailOrUser || '').toLowerCase().trim();
    if (!identifier || !password) {
      return { success: false, error: 'Debe ingresar correo y contraseña.' };
    }

    // 1. Supabase Auth (PRIMARY)
    if (this.isSupabaseAuthConfigured() || this.isSupabaseServerConfigured()) {
      // Cliente de autenticación independiente por operación para aislar sesiones concurrentes
      const authClient = createSupabaseAuthClient();
      if (authClient) {
        try {
          const { data, error } = await authClient.auth.signInWithPassword({
            email: identifier,
            password,
          });

          if (!error && data?.session && data?.user) {
            const supaUser = data.user;
            const role = await this.resolveServerRole(
              supaUser.id,
              supaUser.app_metadata?.role,
              supaUser.email || identifier
            );
            const authUser: AuthenticatedUser = {
              id: supaUser.id,
              uid: supaUser.id,
              email: supaUser.email || identifier,
              name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || identifier.split('@')[0],
              displayName: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || identifier.split('@')[0],
              avatar: supaUser.user_metadata?.avatar_url,
              photoUrl: supaUser.user_metadata?.avatar_url,
              role,
              preferences: supaUser.user_metadata?.preferences || {},
              provider: 'supabase',
            };

            return {
              success: true,
              user: authUser,
              token: data.session.access_token,
            };
          }
        } catch (err: any) {
          console.warn('[SupabaseAuth] signInWithPassword notice:', err?.message || err);
        }
      }
    }

    // 2. Fallback to existing admin-auth.service for administrative credentials configured via environment bcrypt hashes
    const adminAuthResult = adminAuthService.authenticate(identifier, password);
    if (adminAuthResult.success && adminAuthResult.admin && adminAuthResult.token) {
      const role = this.normalizeRole(adminAuthResult.admin.role);
      const authUser: AuthenticatedUser = {
        id: adminAuthResult.admin.id,
        uid: adminAuthResult.admin.id,
        email: adminAuthResult.admin.email,
        name: adminAuthResult.admin.name,
        displayName: adminAuthResult.admin.name,
        role,
        preferences: {},
        provider: 'local',
      };
      return {
        success: true,
        user: authUser,
        token: adminAuthResult.token,
      };
    }

    // Si Supabase Server está activo pero el cliente de autenticación no está configurado, error controlado
    if (this.isSupabaseServerConfigured() && !getSupabaseAuthClient()) {
      return {
        success: false,
        error: 'Cliente de autenticación de Supabase no configurado.',
      };
    }

    // 3. Fallback to dynamically registered local users
    const localUser = this.localUsers.get(identifier);
    if (localUser && localUser.passwordHash) {
      const [salt, storedHash] = localUser.passwordHash.split(':');
      const computed = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      if (computed === storedHash) {
        const authUser: AuthenticatedUser = {
          id: localUser.id,
          uid: localUser.uid,
          email: localUser.email,
          name: localUser.displayName,
          displayName: localUser.displayName,
          avatar: localUser.photoUrl,
          photoUrl: localUser.photoUrl,
          role: localUser.role,
          preferences: localUser.preferences,
          provider: 'local',
        };
        const token = this.createSyntheticToken(authUser);
        return { success: true, user: authUser, token };
      }
    }

    // Safe failure if no matching credentials found
    return { success: false, error: 'Credenciales inválidas.' };
  }

  /**
   * Authenticate admin user via Supabase Auth (PRIMARY)
   * Enforces server-side role validation
   * Falls back to admin-auth.service when Supabase is not configured
   */
  public async adminLogin(
    emailOrUser: string,
    password?: string
  ): Promise<{
    success: boolean;
    admin?: AdminUser;
    token?: string;
    error?: string;
    unauthorizedRole?: boolean;
  }> {
    const identifier = (emailOrUser || '').trim();
    if (!identifier || !password) {
      return { success: false, error: 'Debe ingresar el usuario/correo y la contraseña de administración.' };
    }

    // 1. Supabase Auth (PRIMARY)
    if (this.isSupabaseAuthConfigured() || this.isSupabaseServerConfigured()) {
      // Cliente de autenticación independiente por operación para aislar sesiones
      const authClient = createSupabaseAuthClient();
      if (authClient) {
        try {
          const { data, error } = await authClient.auth.signInWithPassword({
            email: identifier,
            password,
          });

          if (!error && data?.session && data?.user) {
            const user = data.user;
            const role = await this.resolveServerRole(
              user.id,
              user.app_metadata?.role,
              user.email || identifier
            );

            // Verify administrative role server-side
            const adminRoles: AppUserRole[] = ['superadmin', 'admin', 'anotador', 'prensa', 'official_scorer', 'editor'];
            if (!adminRoles.includes(role)) {
              return {
                success: false,
                error: 'Acceso denegado: el usuario no posee permisos de administración.',
                unauthorizedRole: true,
              };
            }

            const adminUser: AdminUser = {
              id: user.id,
              username: user.email?.split('@')[0] || user.id,
              name: user.user_metadata?.full_name || user.email || 'Administrador Supabase',
              email: user.email || '',
              role: role as any,
              lastLogin: new Date().toISOString(),
            };

            return {
              success: true,
              admin: adminUser,
              token: data.session.access_token,
            };
          }
        } catch (err: any) {
          console.warn('[SupabaseAuth] adminLogin Supabase notice:', err?.message || err);
        }
      }
    }

    // 2. Fallback to existing admin-auth.service based on bcrypt hashes in environment
    const localResult = adminAuthService.authenticate(identifier, password);
    if (!localResult.success || !localResult.admin || !localResult.token) {
      return { success: false, error: localResult.error || 'Credenciales de administración inválidas.' };
    }

    const adminRole = this.normalizeRole(localResult.admin.role);
    if (adminRole === 'user') {
      return {
        success: false,
        error: 'Acceso denegado: el usuario no posee permisos de administración.',
        unauthorizedRole: true,
      };
    }

    return {
      success: true,
      admin: localResult.admin,
      token: localResult.token,
    };
  }

  /**
   * Verify token with Supabase Auth (PRIMARY), falling back to Firebase Auth, local admin session, and in-memory fallback
   */
  public async verifyToken(token?: string): Promise<AuthSessionResult> {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token no proporcionado.' };
    }
    const cleanToken = token.trim();

    // 1. Check Supabase Auth JWT (PRIMARY)
    if ((this.isSupabaseAuthConfigured() || this.isSupabaseServerConfigured()) && cleanToken.includes('.')) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.getUser(cleanToken);
          if (error) {
            const isExpired = error.message?.toLowerCase().includes('expired') || error.status === 401;
            return { valid: false, expired: isExpired, error: isExpired ? 'Sesión expirada.' : error.message };
          }

          if (data?.user) {
            const user = data.user;
            const role = await this.resolveServerRole(
              user.id,
              user.app_metadata?.role,
              user.email || ''
            );
            const authUser: AuthenticatedUser = {
              id: user.id,
              uid: user.id,
              email: user.email || '',
              name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
              displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
              avatar: user.user_metadata?.avatar_url,
              photoUrl: user.user_metadata?.avatar_url,
              role,
              preferences: user.user_metadata?.preferences || {},
              provider: 'supabase',
            };

            const adminRoles: AppUserRole[] = ['superadmin', 'admin', 'anotador', 'prensa', 'official_scorer', 'editor'];
            const adminUser: AdminUser | undefined = adminRoles.includes(role)
              ? {
                  id: user.id,
                  username: user.email?.split('@')[0] || user.id,
                  name: authUser.name,
                  email: authUser.email,
                  role: role as any,
                  lastLogin: new Date().toISOString(),
                }
              : undefined;

            return { valid: true, user: authUser, admin: adminUser };
          }
        } catch (err: any) {
          const isExpired = err?.message?.toLowerCase().includes('expired');
          return { valid: false, expired: isExpired, error: err?.message || 'Error al validar token en Supabase.' };
        }
      }
    }

    // 2. Fallback to Firebase Auth (FALLBACK)
    try {
      const decoded = await adminAuth.verifyIdToken(cleanToken);
      if (decoded) {
        const role = this.normalizeRole((decoded as any).role || 'user');
        const authUser: AuthenticatedUser = {
          id: decoded.uid,
          uid: decoded.uid,
          email: decoded.email || '',
          name: decoded.name || decoded.email?.split('@')[0] || 'Usuario Firebase',
          displayName: decoded.name || decoded.email?.split('@')[0] || 'Usuario Firebase',
          avatar: decoded.picture,
          photoUrl: decoded.picture,
          role,
          provider: 'firebase',
        };
        return { valid: true, user: authUser };
      }
    } catch {
      // Not a Firebase token, continue to local session check
    }

    // 3. Fallback to local admin session store
    const admin = adminAuthService.verifySession(cleanToken);
    if (admin) {
      const role = this.normalizeRole(admin.role);
      const authUser: AuthenticatedUser = {
        id: admin.id,
        uid: admin.id,
        email: admin.email,
        name: admin.name,
        displayName: admin.name,
        role,
        provider: 'local',
      };
      return { valid: true, user: authUser, admin };
    }

    // 4. Fallback to in-memory active tokens (used strictly for local dev/testing fallback)
    const active = this.activeTokens.get(cleanToken);
    if (active) {
      if (Date.now() > active.expiresAt) {
        this.activeTokens.delete(cleanToken);
        return { valid: false, expired: true, error: 'Sesión expirada.' };
      }
      return { valid: true, user: active.user };
    }

    return { valid: false, error: 'Token inválido o expirado.' };
  }

  /**
   * Logout user and invalidate active tokens
   */
  public async signOut(token?: string): Promise<{ success: boolean }> {
    if (!token) return { success: true };
    const cleanToken = token.trim();

    this.activeTokens.delete(cleanToken);
    adminAuthService.logout(cleanToken);

    if (this.isSupabaseAuthConfigured() && cleanToken.includes('.')) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          await supabase.auth.admin.signOut(cleanToken).catch(() => {});
        } catch {
          // ignore
        }
      }
    }

    return { success: true };
  }

  /**
   * Migrate user list without copying passwords, tokens, sessions, or secrets
   * Preserves: email, nombre, avatar, rol, preferencias
   */
  public async migrateUsersWithoutSecrets(
    sourceUsers: Array<Record<string, any>>
  ): Promise<{
    totalMigrated: number;
    sanitizedSecretsCount: number;
    users: Array<Omit<AuthenticatedUser, 'provider'>>;
  }> {
    const sanitizedList: Array<Omit<AuthenticatedUser, 'provider'>> = [];
    let sanitizedSecretsCount = 0;

    for (const raw of sourceUsers) {
      if (!raw || (!raw.email && !raw.uid)) continue;

      // Count if sensitive fields were present in input and neutralize them
      if (raw.password || raw.passwordHash || raw.password_hash) sanitizedSecretsCount++;
      if (raw.token || raw.tokens || raw.accessToken || raw.access_token) sanitizedSecretsCount++;
      if (raw.session || raw.sessions || raw.sessionData) sanitizedSecretsCount++;
      if (raw.secret || raw.secrets || raw.apiKey) sanitizedSecretsCount++;

      const uid = String(raw.uid || raw.id || 'usr_' + crypto.randomBytes(6).toString('hex'));
      const email = String(raw.email || `${uid}@baseballhub.cu`).toLowerCase().trim();
      const name = String(raw.name || raw.displayName || raw.display_name || email.split('@')[0]);
      const avatar = raw.avatar || raw.photoUrl || raw.photo_url || raw.photo || '';
      const role = this.normalizeRole(raw.role);
      const preferences = typeof raw.preferences === 'object' && raw.preferences !== null ? raw.preferences : {};

      const sanitized: Omit<AuthenticatedUser, 'provider'> = {
        id: uid,
        uid,
        email,
        name,
        displayName: name,
        avatar,
        photoUrl: avatar,
        role,
        preferences,
      };

      sanitizedList.push(sanitized);

      // Save in local users store
      this.localUsers.set(email, {
        id: uid,
        uid,
        email,
        displayName: name,
        photoUrl: avatar,
        role,
        preferences,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Upsert into Supabase public.users if configured
      if (this.isSupabaseAuthConfigured()) {
        const supabase = getSupabaseServerClient();
        if (supabase) {
          try {
            await supabase.from('users').upsert({
              id: uid,
              uid,
              email,
              display_name: name,
              photo_url: avatar,
              role,
              preferences,
              updated_at: new Date().toISOString(),
            });
          } catch (err: any) {
            console.warn('[UserMigration] Supabase user upsert notice:', err?.message || err);
          }
        }
      }
    }

    return {
      totalMigrated: sanitizedList.length,
      sanitizedSecretsCount,
      users: sanitizedList,
    };
  }

  /**
   * Actualiza el rol de un usuario estrictamente mediante fuentes controladas por el servidor:
   * 1. Valida la sesión del solicitante.
   * 2. Comprueba el rol del solicitante mediante la fuente autoritativa del servidor.
   * 3. Comprueba que el usuario objetivo existe en Supabase Auth.
   * 4. Valida las restricciones de roles actuales (superadmin, admin, no auto-modificación).
   * 5. Comprueba que el perfil de public.users corresponde al UUID objetivo.
   * 6. Comprueba explícitamente el resultado y el campo 'error' de cada operación Supabase.
   * 7. No devuelve success: true si alguna escritura necesaria falla.
   * 8. Evita dejar app_metadata.role y public.users.role inconsistentes mediante reversión.
   */
  public async updateUserRole(
    requesterTokenOrUser: string | AuthenticatedUser | AdminUser,
    targetUserId: string,
    newRoleInput: string
  ): Promise<{
    success: boolean;
    error?: string;
    targetUserId?: string;
    newRole?: AppUserRole;
  }> {
    if (!targetUserId || typeof targetUserId !== 'string') {
      return { success: false, error: 'Identificador de usuario objetivo inválido.' };
    }

    // 1. Validar la sesión del solicitante
    let requesterUser: AuthenticatedUser | AdminUser | undefined;
    let requesterId: string | undefined;

    if (typeof requesterTokenOrUser === 'string') {
      const verifyRes = await this.verifyToken(requesterTokenOrUser);
      if (!verifyRes.valid || (!verifyRes.user && !verifyRes.admin)) {
        return { success: false, error: 'Sesión del solicitante inválida o expirada.' };
      }
      requesterUser = (verifyRes.admin || verifyRes.user) as any;
      requesterId = (verifyRes.user as any)?.id || (verifyRes.admin as any)?.id || (verifyRes.user as any)?.uid;
    } else if (typeof requesterTokenOrUser === 'object' && requesterTokenOrUser !== null) {
      requesterUser = requesterTokenOrUser;
      requesterId = (requesterUser as any).id || (requesterUser as any).uid;
    } else {
      return { success: false, error: 'Solicitante no autorizado.' };
    }

    // 2. Comprobar el rol del solicitante mediante la fuente autoritativa del servidor
    let requesterRole: AppUserRole = 'user';
    if (requesterId && (requesterUser as any)?.provider === 'supabase') {
      requesterRole = await this.resolveServerRole(
        requesterId,
        (requesterUser as any)?.app_metadata?.role,
        (requesterUser as any)?.email
      );
    } else {
      requesterRole = this.normalizeRole((requesterUser as any)?.role);
    }

    // Solo superadmin o admin pueden modificar roles
    if (requesterRole !== 'superadmin' && requesterRole !== 'admin') {
      return {
        success: false,
        error: 'Acceso denegado: solo usuarios con rol de administrador o superadministrador pueden modificar roles.',
      };
    }

    // 4. Validar las restricciones de roles actuales
    const cleanRoleInput = (newRoleInput || '').toLowerCase().trim();
    const validRoleInputs = ['superadmin', 'admin', 'anotador', 'prensa', 'official_scorer', 'editor', 'user'];
    if (!validRoleInputs.includes(cleanRoleInput)) {
      return {
        success: false,
        error: `Rol destino no válido: ${newRoleInput}.`,
      };
    }
    const normalizedNewRole = this.normalizeRole(newRoleInput);

    // Impedir que los usuarios modifiquen su propio rol (sin autoelevación)
    if (requesterId && (requesterId === targetUserId || (requesterUser as any)?.email === targetUserId)) {
      return {
        success: false,
        error: 'Acceso denegado: no se permite a los usuarios modificar su propio rol.',
      };
    }

    // 'admin' no puede asignar ni promover a 'superadmin' (únicamente superadmin puede asignar superadmin)
    if (requesterRole === 'admin' && normalizedNewRole === 'superadmin') {
      return {
        success: false,
        error: 'Acceso denegado: solo un superadministrador puede asignar el rol de superadmin.',
      };
    }

    // Operaciones en Supabase si está configurado el cliente administrativo
    if (this.isSupabaseServerConfigured()) {
      const adminClient = getSupabaseAdminClient();
      if (!adminClient) {
        return {
          success: false,
          error: 'Cliente administrativo de Supabase no disponible.',
        };
      }

      // 3. Comprobar que el usuario objetivo existe en Supabase Auth
      const { data: targetAuthData, error: targetAuthErr } = await adminClient.auth.admin.getUserById(targetUserId);
      if (targetAuthErr || !targetAuthData?.user) {
        return {
          success: false,
          error: `Usuario objetivo no encontrado en Supabase Auth: ${targetAuthErr?.message || 'Usuario inexistente'}`,
        };
      }

      const targetAuthUser = targetAuthData.user;
      const previousRole = this.normalizeRole(targetAuthUser.app_metadata?.role);

      // 5. Comprobar que el perfil de public.users corresponde al UUID objetivo
      // y obtener el estado anterior real desde la fuente autoritativa (public.users)
      const { data: existingProfile, error: profileFetchErr } = await adminClient
        .from('users')
        .select('id, uid, role')
        .or(`id.eq.${targetUserId},uid.eq.${targetUserId}`)
        .maybeSingle();

      if (profileFetchErr) {
        console.error('[SupabaseAuth] Error al consultar perfil en public.users:', profileFetchErr.message);
        return {
          success: false,
          error: `Error al validar perfil en base de datos: ${profileFetchErr.message}`,
        };
      }

      if (existingProfile) {
        if (existingProfile.id !== targetUserId && existingProfile.uid !== targetUserId) {
          return {
            success: false,
            error: 'Inconsistencia de perfil: el registro en public.users no coincide con el UUID objetivo.',
          };
        }
      }

      // Fuente autoritativa para el rol anterior real:
      // Si existe perfil en public.users, usar su rol real; si no existe, el rol real es 'user'
      const authoritativePreviousRole = existingProfile?.role
        ? this.normalizeRole(existingProfile.role)
        : this.normalizeRole(targetAuthUser.app_metadata?.role);

      // Un administrador regular no puede modificar el rol de un superadministrador existente
      if (requesterRole === 'admin' && authoritativePreviousRole === 'superadmin') {
        return {
          success: false,
          error: 'Acceso denegado: un administrador no puede modificar el rol de un superadministrador.',
        };
      }

      // 6. Comprobar explícitamente el resultado y el campo 'error' de cada operación Supabase
      // Operación 1: Actualizar app_metadata.role en Supabase Auth (NUNCA en user_metadata.role)
      const { data: updateAuthData, error: updateAuthErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
        app_metadata: { role: normalizedNewRole },
      });

      if (updateAuthErr || !updateAuthData?.user) {
        console.error('[SupabaseAuth] Error actualizando app_metadata en Supabase Auth:', updateAuthErr?.message);
        return {
          success: false,
          error: `Error al actualizar rol en Supabase Auth: ${updateAuthErr?.message || 'Operación rechazada'}`,
        };
      }

      // Operación 2: Actualizar rol en public.users
      let profileWriteError: string | undefined;

      if (existingProfile) {
        const { error: updateTblErr } = await adminClient
          .from('users')
          .update({
            role: normalizedNewRole,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${targetUserId},uid.eq.${targetUserId}`);

        if (updateTblErr) {
          profileWriteError = updateTblErr.message;
        }
      } else {
        const { error: insertTblErr } = await adminClient
          .from('users')
          .insert({
            id: targetUserId,
            uid: targetUserId,
            email: targetAuthUser.email || '',
            display_name:
              targetAuthUser.user_metadata?.full_name ||
              targetAuthUser.user_metadata?.name ||
              targetAuthUser.email?.split('@')[0] ||
              'Usuario',
            photo_url: targetAuthUser.user_metadata?.avatar_url || '',
            role: normalizedNewRole,
            preferences: targetAuthUser.user_metadata?.preferences || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertTblErr) {
          profileWriteError = insertTblErr.message;
        }
      }

      // 7. No devolver success: true si alguna escritura necesaria falla
      // 8. Evitar dejar app_metadata.role y public.users.role inconsistentes mediante reversión
      // Conservando el estado anterior real de la fuente autoritativa (authoritativePreviousRole)
      if (profileWriteError) {
        console.error('[SupabaseAuth] Falló la persistencia en public.users. Revertiendo app_metadata.role al rol anterior real autoritativo:', authoritativePreviousRole);
        const { error: rollbackErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
          app_metadata: { role: authoritativePreviousRole },
        });
        if (rollbackErr) {
          // Reversión fallida: se registra como error crítico sin exponer secretos
          console.error('[SupabaseAuth] [CRÍTICO] Falló la reversión de app_metadata tras error en public.users:', rollbackErr.message);
          return {
            success: false,
            error: `Inconsistencia crítica de roles detectada: falló la persistencia en public.users (${profileWriteError}) y la reversión de Supabase Auth falló (${rollbackErr.message}). El rol anterior real era '${authoritativePreviousRole}' y requiere intervención administrativa.`,
          };
        }

        return {
          success: false,
          error: `Error al persistir rol en public.users: ${profileWriteError}. Se revirtió el cambio en Supabase Auth restaurando el rol anterior '${authoritativePreviousRole}' para mantener la consistencia.`,
        };
      }
    } else {
      // Fallback local: actualizar en almacenamiento local si el usuario existe
      for (const [email, userRec] of this.localUsers.entries()) {
        if (
          userRec.id === targetUserId ||
          userRec.uid === targetUserId ||
          email.toLowerCase() === targetUserId.toLowerCase()
        ) {
          userRec.role = normalizedNewRole;
          userRec.updatedAt = new Date().toISOString();
          this.localUsers.set(email, userRec);
          break;
        }
      }
    }

    // Actualizar también tokens activos en memoria para reflejar de inmediato el cambio
    for (const [, session] of this.activeTokens.entries()) {
      if (
        session.user.id === targetUserId ||
        session.user.uid === targetUserId ||
        session.user.email === targetUserId
      ) {
        session.user.role = normalizedNewRole;
      }
    }

    return {
      success: true,
      targetUserId,
      newRole: normalizedNewRole,
    };
  }

  /**
   * Helper to create high-entropy synthetic session token for local/fallback sessions
   */
  public createSyntheticToken(user: AuthenticatedUser, ttlMs: number = this.defaultTtlMs): string {
    const token = 'sb_tok_' + crypto.randomBytes(32).toString('hex');
    this.activeTokens.set(token, {
      user,
      expiresAt: Date.now() + ttlMs,
    });
    return token;
  }

  /**
   * Expire a token immediately (used for testing expired session handling)
   */
  public forceExpireToken(token: string): void {
    const session = this.activeTokens.get(token);
    if (session) {
      session.expiresAt = Date.now() - 1000;
    }
  }

  /**
   * Helper to get all registered local users
   */
  public getLocalUsers(): LocalUserRecord[] {
    return Array.from(this.localUsers.values());
  }
}

export const supabaseAuthService = new SupabaseAuthService();

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers?.['x-admin-token'];
  if (customHeader) {
    return String(customHeader).trim();
  }
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/baseball_admin_token=([^;]+)/) || cookieHeader.match(/baseball_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]).trim();
  }
  return undefined;
}

/**
 * Middleware to authenticate administrative requests server-side
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
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
      const validAdminRoles: AppUserRole[] = ['superadmin', 'admin', 'anotador', 'prensa', 'official_scorer', 'editor'];
      if (validAdminRoles.includes(role) && role !== 'user') {
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

  const validAdminRoles: AppUserRole[] = ['superadmin', 'admin', 'anotador', 'prensa', 'official_scorer', 'editor'];
  if (!validAdminRoles.includes(admin.role as any)) {
    return res.status(403).json({
      success: false,
      error: 'Permisos insuficientes. El usuario autenticado no posee rol administrativo.',
    });
  }

  (req as any).adminUser = admin;
  (req as any).adminToken = token;
  next();
};

/**
 * Middleware to authorize specific administrative roles server-side
 */
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
