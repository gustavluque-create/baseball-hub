import crypto from 'crypto';
import { getSupabaseServerClient, isSupabaseServerConfigured } from '../lib/supabase.ts';
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
   * Check if Supabase Auth is active and configured
   */
  public isSupabaseAuthConfigured(): boolean {
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
    if (this.isSupabaseAuthConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          // Create user in Supabase Auth using service role with strict role: 'user'
          const { data: supaUser, error: supaErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              name: displayName,
              full_name: displayName,
              avatar_url: photoUrl,
              role: 'user',
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
            await supabase.from('users').upsert({
              id: uid,
              uid,
              email,
              display_name: displayName,
              photo_url: photoUrl,
              role: 'user',
              preferences,
              updated_at: new Date().toISOString(),
            });

            // Authenticate directly via signInWithPassword to obtain genuine Supabase Auth session token.
            // ZERO synthetic tokens for Supabase users!
            let realSessionToken: string | undefined;
            try {
              const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (!signInErr && signInData?.session?.access_token) {
                realSessionToken = signInData.session.access_token;
              }
            } catch (authErr) {
              console.warn('[SupabaseAuth] Notice during post-registration sign-in:', authErr);
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
    if (this.isSupabaseAuthConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: identifier,
            password,
          });

          if (!error && data?.session && data?.user) {
            const supaUser = data.user;
            const role = this.normalizeRole(
              supaUser.app_metadata?.role || supaUser.user_metadata?.role || 'user'
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
          console.warn('[SupabaseAuth] signInWithPassword error:', err?.message || err);
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
    if (this.isSupabaseAuthConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: identifier,
            password,
          });

          if (error || !data?.session || !data?.user) {
            return { success: false, error: 'Usuario o contraseña incorrectos en Supabase Auth.' };
          }

          const user = data.user;
          const role = this.normalizeRole(user.app_metadata?.role || user.user_metadata?.role || '');

          // Verify administrative role server-side
          const adminRoles: AppUserRole[] = ['superadmin', 'admin', 'anotador', 'prensa'];
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
        } catch (err: any) {
          return { success: false, error: err?.message || 'Error al autenticar con Supabase Auth.' };
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
    if (this.isSupabaseAuthConfigured() && cleanToken.includes('.')) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.getUser(cleanToken);
          if (error) {
            const isExpired = error.message?.toLowerCase().includes('expired') || error.status === 401;
            return { valid: false, expired: isExpired, error: isExpired ? 'Sesión expirada.' : error.message };
          }

          if (data?.user) {
            const user = data.user;
            const role = this.normalizeRole(
              user.app_metadata?.role || user.user_metadata?.role || 'user'
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

            const adminUser: AdminUser | undefined = ['superadmin', 'admin', 'anotador', 'prensa'].includes(role)
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
   * Dedicated server-side method to assign / update user roles in Supabase Auth & public.users table.
   * Enforces strict RBAC and security validations:
   * 1. Validates requester's session or identity
   * 2. Only authorized administrators (superadmin, admin) can change roles
   * 3. Prevents regular users from modifying any roles
   * 4. Prevents self-promotion to higher roles
   * 5. Admins cannot elevate anyone to superadmin (only superadmin can)
   * 6. Normalizes target role via normalizeRole()
   * 7. Updates app_metadata.role and user_metadata.role in Supabase Auth via admin.updateUserById
   * 8. Updates role in public.users table
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

    // 1. Validate requester session / authorization
    let requesterUser: AuthenticatedUser | AdminUser | undefined;
    let requesterRole: AppUserRole = 'user';

    if (typeof requesterTokenOrUser === 'string') {
      const verifyRes = await this.verifyToken(requesterTokenOrUser);
      if (!verifyRes.valid || (!verifyRes.user && !verifyRes.admin)) {
        return { success: false, error: 'Sesión del solicitante inválida o expirada.' };
      }
      requesterUser = (verifyRes.admin || verifyRes.user) as any;
      requesterRole = this.normalizeRole(requesterUser?.role);
    } else if (typeof requesterTokenOrUser === 'object' && requesterTokenOrUser !== null) {
      requesterUser = requesterTokenOrUser;
      requesterRole = this.normalizeRole((requesterUser as any).role);
    } else {
      return { success: false, error: 'Solicitante no autorizado.' };
    }

    // 2. Reject regular users or unauthorized roles
    if (requesterRole !== 'superadmin' && requesterRole !== 'admin') {
      return {
        success: false,
        error: 'Acceso denegado: solo usuarios con rol de administrador o superadministrador pueden modificar roles.',
      };
    }

    // 3. Normalize the target role
    const normalizedNewRole = this.normalizeRole(newRoleInput);

    // 4. Prevent self-promotion or self-escalation
    const requesterId = (requesterUser as any).id || (requesterUser as any).uid;
    if (requesterId && (requesterId === targetUserId || (requesterUser as any).email === targetUserId)) {
      if (requesterRole === 'admin' && normalizedNewRole === 'superadmin') {
        return {
          success: false,
          error: 'Acceso denegado: no se permite la auto-promoción a roles superiores.',
        };
      }
    }

    // 5. 'admin' cannot promote someone to 'superadmin' (only superadmin can create/promote superadmin)
    if (requesterRole === 'admin' && normalizedNewRole === 'superadmin') {
      return {
        success: false,
        error: 'Acceso denegado: solo un superadministrador puede asignar el rol de superadmin.',
      };
    }

    // 6. Update in Supabase Auth (PRIMARY)
    if (this.isSupabaseAuthConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(targetUserId, {
            app_metadata: { role: normalizedNewRole },
            user_metadata: { role: normalizedNewRole },
          });

          if (updateAuthErr) {
            console.error('[SupabaseAuth] Error updating user role in Supabase Auth:', updateAuthErr.message);
            return {
              success: false,
              error: `Error al actualizar rol en Supabase Auth: ${updateAuthErr.message}`,
            };
          }

          // Update public.users table if it exists
          try {
            await supabase
              .from('users')
              .update({
                role: normalizedNewRole,
                updated_at: new Date().toISOString(),
              })
              .eq('id', targetUserId);
          } catch (tblErr: any) {
            console.warn('[SupabaseAuth] Notice updating users table:', tblErr?.message || tblErr);
          }
        } catch (err: any) {
          console.error('[SupabaseAuth] Exception updating user role in Supabase:', err);
          return {
            success: false,
            error: err?.message || 'Error al actualizar rol en Supabase.',
          };
        }
      }
    }

    // 7. Update in local storage / in-memory cache if target user is stored locally
    for (const [email, userRec] of this.localUsers.entries()) {
      if (userRec.id === targetUserId || userRec.uid === targetUserId || email.toLowerCase() === targetUserId.toLowerCase()) {
        userRec.role = normalizedNewRole;
        userRec.updatedAt = new Date().toISOString();
        this.localUsers.set(email, userRec);
        break;
      }
    }

    // Also update any active tokens for this user
    for (const [, session] of this.activeTokens.entries()) {
      if (session.user.id === targetUserId || session.user.uid === targetUserId || session.user.email === targetUserId) {
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
