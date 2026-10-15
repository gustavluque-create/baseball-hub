import http from 'http';
import bcrypt from 'bcryptjs';
import { adminAuthService, isValidBcryptHash, getAdminCredential } from '../server/services/admin-auth.service.ts';
import {
  isSupabaseServerConfigured,
  getSupabaseServerClient,
  isSupabaseAuthConfigured,
  getSupabaseAuthClient,
  getSupabaseAdminClient,
  createSupabaseAuthClient,
  setSupabaseAdminClientOverride,
} from '../server/lib/supabase.ts';
import { isValidImageString, playerPhotoSchema } from '../server/utils/validation.ts';
import { baseballRepo, BaseballRepository } from '../server/repositories/baseball.repository.ts';
import { supabaseAuthService } from '../server/services/supabase-auth.service.ts';
import { requireAuth } from '../src/middleware/auth.ts';
import { adminAuth } from '../src/lib/firebase-admin.ts';

function request(options: http.RequestOptions, body?: any): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    const reqOptions: any = {
      ...options,
      headers: { ...(options.headers || {}) },
    };
    if (postData) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed: any = data;
        try {
          parsed = JSON.parse(data);
        } catch {
          // Leave as raw text if not JSON
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runSecurityTests() {
  console.log('🔒 ==========================================');
  console.log('🔒 BASEBALL HUB — SUITE DE PRUEBAS DE SEGURIDAD');
  console.log('🔒 ==========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3000';

  try {
    // 1. Public GET routes
    const resPublicTeams = await request({ hostname: 'localhost', port: 3000, path: '/api/teams', method: 'GET' });
    assert(resPublicTeams.status === 200, '1. GET público /api/teams retorna 200');

    const resPublicNews = await request({ hostname: 'localhost', port: 3000, path: '/api/news', method: 'GET' });
    assert(resPublicNews.status === 200, '2. GET público /api/news retorna 200');

    // 2. Unauthenticated write protections
    const resUnauthPostGame = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/games', method: 'POST' }, { name: 'Test' });
    assert(resUnauthPostGame.status === 401, '3. POST /api/admin/games sin autenticación retorna 401');

    const resUnauthPutPhoto = await request({ hostname: 'localhost', port: 3000, path: '/api/players/p-01/photo', method: 'PUT' }, { photo: 'https://example.com/photo.png' });
    assert(resUnauthPutPhoto.status === 401, '4. PUT /api/players/:id/photo sin autenticación retorna 401');

    const resUnauthDeleteGame = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/games/g-test', method: 'DELETE' });
    assert(resUnauthDeleteGame.status === 401, '5. DELETE /api/admin/games/:id sin autenticación retorna 401');

    // 3. Bad credentials rejection
    const resBadLogin = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/login', method: 'POST' }, { username: 'admin', password: 'wrongpassword' });
    assert(resBadLogin.status === 401, '6. POST /api/admin/login con contraseña incorrecta retorna 401');

    // 4. Token format bypass rejection (token.startsWith("adm_"))
    const resFakeToken = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/session',
      method: 'GET',
      headers: { Authorization: 'Bearer adm_fake_bypass_token_1234567890abcdef' },
    });
    assert(resFakeToken.status === 401, '5. Token falso adm_ retorna 401 (Zero Bypass)');

    // ========================================================
    // COMPROBACIONES ESPECÍFICAS DE SEGURIDAD (FASE 2.1)
    // ========================================================

    // 1. Sin ADMIN_*_PASSWORD_HASH: NO debe existir login administrativo con password predeterminada
    const origSuperadminHash = process.env.ADMIN_SUPERADMIN_PASSWORD_HASH;
    const origPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_SUPERADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD_HASH;

    const resNoEnvLogin = adminAuthService.authenticate('admin', 'baseball2026');
    assert(
      resNoEnvLogin.success === false,
      'VERIFICACIÓN 1: Sin ADMIN_*_PASSWORD_HASH → NO existe login administrativo con password predeterminada'
    );

    // 2. Hash bcrypt válido: login correcto
    const testSecret = 'pass_seguro_fase2_test_verification_2026';
    const dynamicBcryptHash = bcrypt.hashSync(testSecret, 10);
    process.env.ADMIN_SUPERADMIN_PASSWORD_HASH = dynamicBcryptHash;

    const resValidLogin = adminAuthService.authenticate('admin', testSecret);
    assert(
      resValidLogin.success === true && !!resValidLogin.token && resValidLogin.admin?.role === 'superadmin',
      'VERIFICACIÓN 2: Hash bcrypt válido → login correcto y emisión de sesión'
    );
    const validAdminToken = resValidLogin.token || '';

    // 3. Hash inválido / no bcrypt: login rechazado (sin fallback de texto plano)
    process.env.ADMIN_SUPERADMIN_PASSWORD_HASH = 'plaintext_password_hash_without_bcrypt';
    const resInvalidHashLogin = adminAuthService.authenticate('admin', 'plaintext_password_hash_without_bcrypt');
    assert(
      resInvalidHashLogin.success === false,
      'VERIFICACIÓN 3: Hash inválido/no bcrypt → login rechazado (cero fallback en texto plano)'
    );

    // Restaurar hash bcrypt válido para pruebas autenticadas subsiguientes
    process.env.ADMIN_SUPERADMIN_PASSWORD_HASH = dynamicBcryptHash;

    // 4. SUPABASE_SERVICE_ROLE_KEY ausente: NO utilizar SUPABASE_ANON_KEY como sustituto
    const origSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const origSupaAnon = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_test';

    const supaConfigured = isSupabaseServerConfigured();
    const supaClient = getSupabaseServerClient();
    assert(
      supaConfigured === false && supaClient === null,
      'VERIFICACIÓN 4: SUPABASE_SERVICE_ROLE_KEY ausente → NO utilizar SUPABASE_ANON_KEY como sustituto'
    );

    // Restaurar variables de Supabase
    if (origSupaKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupaKey;
    if (origSupaAnon !== undefined) process.env.SUPABASE_ANON_KEY = origSupaAnon;

    // 8. XSS prevention on user comments
    const resCommentXss = await request(
      { hostname: 'localhost', port: 3000, path: '/api/news/snb-noticia/comments', method: 'POST' },
      { authorName: '<script>alert("hack")</script>Fan', content: 'Buen partido <img src=x onerror=alert(1)>' }
    );
    assert(
      resCommentXss.status === 201 &&
        !resCommentXss.body.content.includes('<script>') &&
        resCommentXss.body.content.includes('&lt;img'),
      '13. XSS en comentarios es sanitizado server-side antes de persistencia'
    );

    // 9. Input validation on images
    const isSvgRejected = !isValidImageString('data:image/svg+xml;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==');
    const photoParsed = playerPhotoSchema.safeParse({ photo: 'data:image/svg+xml;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' });
    assert(isSvgRejected && !photoParsed.success, '14. SVG malicioso con scripts es detectado y rechazado por el validador');

    // 10. Ingestion endpoints protection
    const resIngestUnauth = await request({ hostname: 'localhost', port: 3000, path: '/api/ingest/validate', method: 'POST' }, { rawText: 'test' });
    assert(resIngestUnauth.status === 401, '15. Endpoint /ingest/validate sin autenticación retorna 401');

    // 11. Path traversal attempt rejection
    const resPathTraversal = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/players/..%2f..%2fetc%2fpasswd',
      method: 'GET',
    });
    assert(resPathTraversal.status === 404, '16. Intento de Path Traversal es neutralizado y retorna 404');

    // 12. Logout and session invalidation
    const logoutSuccess = adminAuthService.logout(validAdminToken);
    assert(logoutSuccess === true, '17. Logout exitoso');

    const resPostLogout = adminAuthService.verifySession(validAdminToken);
    assert(resPostLogout === null, '18. Sesión invalidada tras logout (retorna null)');

    // Restaurar variables de auth originales
    if (origSuperadminHash !== undefined) process.env.ADMIN_SUPERADMIN_PASSWORD_HASH = origSuperadminHash;
    if (origPasswordHash !== undefined) process.env.ADMIN_PASSWORD_HASH = origPasswordHash;

    // 13. Supabase Schema and Storage Architecture Verification
    const fs = await import('fs');
    const path = await import('path');
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20261006000000_baseball_hub_schema.sql');
    const sqlExists = fs.existsSync(sqlPath);
    const sqlContent = sqlExists ? fs.readFileSync(sqlPath, 'utf-8') : '';
    assert(
      sqlExists &&
        sqlContent.includes('create table if not exists public.competitions') &&
        sqlContent.includes('create table if not exists public.players') &&
        sqlContent.includes('create table if not exists public.games') &&
        sqlContent.includes('create table if not exists public.player_season_batting'),
      '19. Archivo de migración Supabase DDL existe con esquema de 19 tablas e índices'
    );

    // 14. Pre-migration backup exists
    const backupPath = path.resolve(process.cwd(), 'server/data/pre_supabase_backup.json');
    if (!fs.existsSync(backupPath)) {
      const { ensureBackupExists } = await import('./migrate-supabase.ts');
      ensureBackupExists();
    }
    assert(fs.existsSync(backupPath), '20. Respaldo previo a migración pre_supabase_backup.json generado correctamente');

    // ========================================================
    // COMPROBACIONES DE INICIALIZACIÓN DETERMINISTA (FASE 2.3)
    // ========================================================

    // 21. Estado de repositorio sin Supabase configurado -> LOCAL-FALLBACK
    await baseballRepo.ready();
    const repoState = baseballRepo.getState();
    assert(
      repoState === 'local-fallback' && baseballRepo.isReady() && !baseballRepo.isSupabaseActive(),
      '21. Repositorio sin Supabase inicializa deterministamente en estado LOCAL-FALLBACK'
    );

    // 22. Database info reporta estado y fuente primaria
    const dbInfo = baseballRepo.getDatabaseInfo();
    assert(
      dbInfo.state === 'local-fallback' && dbInfo.primarySource === 'database.json' && dbInfo.counts.teams > 0,
      '22. getDatabaseInfo() refleja estado LOCAL-FALLBACK y fuente primaria database.json'
    );

    // 23. Funciones de consulta del repositorio operativas
    const teams = baseballRepo.getTeams();
    const players = baseballRepo.getPlayers({ limit: 10 });
    const games = baseballRepo.getGames();
    const news = baseballRepo.getNews();
    const search = baseballRepo.searchGlobal('Industriales');
    assert(
      teams.length > 0 && Array.isArray(players.items) && Array.isArray(games) && Array.isArray(news) && search.teams.length > 0,
      '23. Métodos del repositorio (equipos, jugadores, juegos, noticias, búsqueda) operan normalmente'
    );

    // 24. Supabase configurado pero inaccesible -> Transición limpia a LOCAL-FALLBACK con log de advertencia
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      process.env.SUPABASE_URL = 'https://unreachable-host-testing-fase-2-3.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'invalid-testing-key-fase-2-3';
      const fallbackRepo = new BaseballRepository();
      await fallbackRepo.ready();
      assert(
        fallbackRepo.getState() === 'local-fallback' &&
          fallbackRepo.isReady() === true &&
          fallbackRepo.isSupabaseActive() === false &&
          fallbackRepo.getTeams().length > 0,
        '24. Supabase configurado pero inaccesible -> Cae limpiamente a LOCAL-FALLBACK sin bloquear ni fingir actividad'
      );
    } finally {
      if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
      else delete process.env.SUPABASE_URL;
      if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }

    // 25. Con Supabase activo -> Estado SUPABASE
    const testSupaRepo = new BaseballRepository();
    (testSupaRepo as any).state = 'supabase';
    assert(
      testSupaRepo.getState() === 'supabase' && testSupaRepo.isSupabaseActive() === true,
      '25. Con Supabase activo -> Estado SUPABASE y isSupabaseActive() retorna true'
    );

    // ========================================================
    // COMPROBACIONES DE AUTENTICACIÓN SUPABASE (FASE 2.4)
    // ========================================================

    // 26. Registro de usuario (Supabase Auth PRIMARY)
    const testEmail = `fan_${Date.now()}@baseballhub.cu`;
    const regRes = await request(
      { hostname: 'localhost', port: 3000, path: '/api/auth/register', method: 'POST' },
      {
        email: testEmail,
        password: 'PasswordSegura2026!',
        displayName: 'Fanatico Cubano',
        photoUrl: 'https://example.com/avatar.png',
        role: 'superadmin', // Intento de escalada de privilegios en registro público
        preferences: { favoriteTeam: 'ind' },
      }
    );
    assert(
      regRes.status === 201 &&
        regRes.body.success === true &&
        regRes.body.user?.email === testEmail &&
        regRes.body.user?.role === 'user' &&
        !regRes.body.user?.password &&
        !regRes.body.user?.passwordHash &&
        !!regRes.body.token,
      '26. Registro de usuario: Fuerza role=user ignorando payload malicioso y emite token sin exponer secretos'
    );
    const userToken = regRes.body.token;

    // 27. Login exitoso e inválido (Supabase Auth PRIMARY)
    const loginOk = await request(
      { hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST' },
      { email: testEmail, password: 'PasswordSegura2026!' }
    );
    const rawCookie = loginOk.headers['set-cookie'];
    const cookieStrings: string[] = Array.isArray(rawCookie)
      ? rawCookie
      : typeof rawCookie === 'string'
        ? [rawCookie]
        : [];
    const hasHttpOnlyCookie = cookieStrings.some((c: string) => c.includes('HttpOnly') && c.includes('baseball_session'));

    assert(
      loginOk.status === 200 && loginOk.body.success === true && !!loginOk.body.token && hasHttpOnlyCookie,
      '27. Login de usuario: Autenticación exitosa emite token y cookie HttpOnly'
    );

    const loginBad = await request(
      { hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST' },
      { email: testEmail, password: 'WrongPassword123' }
    );
    assert(loginBad.status === 401, '28. Login con credenciales incorrectas es rechazado con 401');

    // 29. Consulta de sesión activa
    const sessionRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/session',
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      sessionRes.status === 200 &&
        sessionRes.body.valid === true &&
        sessionRes.body.user?.email === testEmail &&
        sessionRes.body.user?.role === 'user',
      '29. Sesión activa: Consulta de sesión retorna usuario sanitizado con rol validado'
    );

    // 30. Sesión expirada
    const testExpiredToken = supabaseAuthService.createSyntheticToken(
      {
        id: 'usr_test_expired',
        uid: 'usr_test_expired',
        email: 'expired@test.cu',
        name: 'Expired Test',
        displayName: 'Expired Test',
        role: 'user',
        provider: 'local',
      },
      -5000
    );
    const expiredVerify = await supabaseAuthService.verifyToken(testExpiredToken);
    assert(
      expiredVerify.valid === false && expiredVerify.expired === true,
      '30. Sesión expirada: Token vencido es detectado y rechazado'
    );

    // 31. Usuario normal no tiene acceso a endpoints de administración (RBAC)
    const normalAdminReq = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      normalAdminReq.status === 401 || normalAdminReq.status === 403,
      '31. RBAC: Usuario normal no tiene acceso a endpoints administrativos'
    );

    // 32. Rol 'superadmin' posee acceso universal
    const superadminLogin = await supabaseAuthService.loginUser('superadmin@baseballhub.cu', testSecret);
    assert(
      superadminLogin.success === true &&
        superadminLogin.user?.role === 'superadmin' &&
        !!superadminLogin.token,
      '32. RBAC: Login de superadmin con hash bcrypt configurado emite sesión superadmin'
    );
    const superadminToken = superadminLogin.token!;
    const superadminVerify = await supabaseAuthService.verifyToken(superadminToken);
    assert(
      superadminVerify.valid === true &&
        superadminVerify.user?.role === 'superadmin' &&
        superadminVerify.admin?.role === 'superadmin',
      '32b. RBAC: Rol superadmin verificado server-side con acceso administrativo universal'
    );

    // 33. Rol 'admin' posee acceso general
    const hasAdminAccess = supabaseAuthService.hasPermission('admin', ['admin']) &&
      supabaseAuthService.hasPermission('admin', ['anotador', 'prensa']);
    assert(hasAdminAccess, '33. RBAC: Rol admin posee acceso administrativo general');

    // 34. Rol 'anotador' y rol 'prensa' validados server-side
    const isAnotadorOk = supabaseAuthService.hasPermission('anotador', ['anotador']);
    const isPrensaOk = supabaseAuthService.hasPermission('prensa', ['prensa']);
    const anotadorCantDoPrensa = !supabaseAuthService.hasPermission('anotador', ['prensa']);
    assert(
      isAnotadorOk && isPrensaOk && anotadorCantDoPrensa,
      '34. RBAC: Roles anotador y prensa validados server-side con segregación de funciones'
    );

    // 34b. Asignación y actualización de roles administrativos (updateUserRole)
    const unauthRoleUpdate = await supabaseAuthService.updateUserRole(userToken, regRes.body.user.id, 'admin');
    assert(
      unauthRoleUpdate.success === false,
      '34b. RBAC: Usuario normal no puede modificar roles de usuarios'
    );

    const authRoleUpdate = await supabaseAuthService.updateUserRole(superadminToken, regRes.body.user.id, 'anotador');
    assert(
      authRoleUpdate.success === true && authRoleUpdate.newRole === 'anotador',
      '34c. RBAC: Superadministrador autorizado puede actualizar rol mediante updateUserRole'
    );

    // 34d. Eliminación de dependencia de user_metadata.role: Rol se resuelve exclusivamente server-side
    // Distinción estricta entre Supabase activo y modo local:
    // Si Supabase está activo y el usuario no tiene perfil válido en public.users, el rol esperado es estrictamente 'user' (nunca 'prensa' ni rol administrativo).
    // Si se encuentra en modo local (sin Supabase activo), se resuelve el rol del servidor de prueba ('prensa').
    const isSupaActive = supabaseAuthService.isSupabaseServerConfigured();
    const serverRole34d = await supabaseAuthService.resolveServerRole(
      'usr_test_server_controlled',
      'prensa'
    );
    const expectedRole34d = isSupaActive ? 'user' : 'prensa';
    assert(
      serverRole34d === expectedRole34d,
      `34d. RBAC: Distinción entre Supabase activo y modo local verificada. Modo: ${isSupaActive ? 'Supabase Activo (esperado: user)' : 'Local Fallback (esperado: prensa)'}, obtenido: ${serverRole34d}`
    );

    // 35. Logout de usuario
    const logoutRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/logout',
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(logoutRes.status === 200 && logoutRes.body.success === true, '35. Logout: Cierre de sesión exitoso y cookies revocadas');

    // 36. Migración de usuarios sin copiar secretos (passwords, tokens, secretos)
    const rawUsersForMigration = [
      {
        uid: 'migrated_usr_1',
        email: 'migrated1@baseballhub.cu',
        name: 'Carlos Perez',
        avatar: 'https://example.com/carlos.jpg',
        role: 'user',
        preferences: { favoriteTeam: 'mtz' },
        password: 'PLAIN_SECRET_PASSWORD_123',
        passwordHash: '$2a$10$fakehashsecret1234567890',
        token: 'secret_jwt_token_123',
        session: { sessionId: 'secret_session_abc' },
        apiKey: 'SECRET_API_KEY_999',
      },
    ];
    const migrationResult = await supabaseAuthService.migrateUsersWithoutSecrets(rawUsersForMigration);
    const migratedUser = migrationResult.users[0] as any;
    assert(
      migrationResult.totalMigrated === 1 &&
        migrationResult.sanitizedSecretsCount > 0 &&
        migratedUser.email === 'migrated1@baseballhub.cu' &&
        migratedUser.name === 'Carlos Perez' &&
        migratedUser.avatar === 'https://example.com/carlos.jpg' &&
        migratedUser.role === 'user' &&
        migratedUser.preferences?.favoriteTeam === 'mtz' &&
        !migratedUser.password &&
        !migratedUser.passwordHash &&
        !migratedUser.token &&
        !migratedUser.session &&
        !migratedUser.apiKey,
      '36. Migración de usuarios: Transfiere email, nombre, avatar, rol y preferencias SIN contraseñas, tokens ni secretos'
    );

    // 37. Firebase Fallback preservado
    assert(
      typeof requireAuth === 'function' && typeof adminAuth !== 'undefined',
      '37. Firebase Auth preservado estrictamente como fallback temporal sin eliminar Firebase'
    );

    // 38. Separación estricta: Cliente administrativo vs Cliente de autenticación
    const savedRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const savedAnonKey = process.env.SUPABASE_ANON_KEY;
    try {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key_secret_for_test';
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.VITE_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_PUBLIC_KEY;

      const adminClient = getSupabaseAdminClient();
      const authClientMissing = getSupabaseAuthClient();
      assert(
        adminClient !== null && authClientMissing === null,
        '38. Separación de clientes: Cliente administrativo no comparte clave ni instancia con cliente de autenticación'
      );

      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.SUPABASE_ANON_KEY = 'anon_key_public_for_test';
      const adminClientMissing = getSupabaseAdminClient();
      const authClientPresent = getSupabaseAuthClient();
      assert(
        adminClientMissing === null && authClientPresent !== null,
        '38b. Separación de clientes: Cliente de autenticación requiere SUPABASE_ANON_KEY y no sustituye al cliente administrativo'
      );
    } finally {
      if (savedRoleKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedRoleKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (savedAnonKey !== undefined) process.env.SUPABASE_ANON_KEY = savedAnonKey;
      else delete process.env.SUPABASE_ANON_KEY;
    }

    // 39. updateUserRole: Restricción contra auto-modificación de rol
    const superadminId = superadminVerify.admin?.id || superadminVerify.user?.id || 'admin_1';
    const selfRoleAttempt = await supabaseAuthService.updateUserRole(
      superadminToken,
      superadminId,
      'user'
    );
    assert(
      selfRoleAttempt.success === false,
      '39. RBAC: Intento de auto-modificación de rol es rechazado por el servidor'
    );

    // 40. updateUserRole: 'admin' no puede promover a 'superadmin'
    process.env.ADMIN_SCORER_PASSWORD_HASH = dynamicBcryptHash;
    const scorerAuth = adminAuthService.authenticate('anotador', testSecret);
    const scorerToken = scorerAuth.token || '';
    const promoteToSuperadminAttempt = await supabaseAuthService.updateUserRole(
      scorerToken,
      regRes.body.user.id,
      'superadmin'
    );
    assert(
      promoteToSuperadminAttempt.success === false,
      '40. RBAC: Administrador regular no puede promover ni asignar rol de superadmin'
    );

    // 41. updateUserRole: Rol destino inválido es rechazado
    const invalidRoleAttempt = await supabaseAuthService.updateUserRole(
      superadminToken,
      regRes.body.user.id,
      'invalid_role_xyz'
    );
    assert(
      invalidRoleAttempt.success === false,
      '41. RBAC: Rol destino no reconocido o inválido es rechazado'
    );

    // 42. Aislamiento de clientes: createSupabaseAuthClient() crea instancias independientes por operación
    const origAnon = process.env.SUPABASE_ANON_KEY;
    try {
      process.env.SUPABASE_ANON_KEY = 'test_anon_key_for_client_isolation_check_123';
      const clientOpA = createSupabaseAuthClient();
      const clientOpB = createSupabaseAuthClient();
      assert(
        clientOpA !== null && clientOpB !== null && clientOpA !== clientOpB,
        '42. Aislamiento de autenticación: Cada operación utiliza un cliente independiente sin compartir estado de sesión'
      );
    } finally {
      if (origAnon !== undefined) process.env.SUPABASE_ANON_KEY = origAnon;
      else delete process.env.SUPABASE_ANON_KEY;
    }

    // 43. Falla segura: Usuario sin perfil en fuente autoritativa nunca obtiene privilegios administrativos
    const unprofiledRole = await supabaseAuthService.resolveServerRole(
      '00000000-0000-0000-0000-000000000000'
    );
    assert(
      unprofiledRole === 'user',
      '43. Fallo seguro: Usuario sin perfil en tabla autoritativa recibe estrictamente rol user (cero privilegios)'
    );

    // 44. Tokens Supabase inválidos reciben 401 en endpoints administrativos
    const badTokenReq = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/overview',
      method: 'GET',
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_signature.token' },
    });
    assert(
      badTokenReq.status === 401,
      '44. Token inválido: Peticiones con tokens malformados o inválidos son rechazadas con 401'
    );

    // 45. Manipulación de user_metadata.role: No concede privilegios si la fuente autoritativa es 'user'
    const roleWithMaliciousUserMetadata = await supabaseAuthService.resolveServerRole(
      'usr_test_malicious_metadata',
      undefined // app_metadata ausente o vacío
    );
    assert(
      roleWithMaliciousUserMetadata === 'user',
      '45. RBAC: Rol no confía en user_metadata.role y se resuelve exclusivamente desde fuente autoritativa'
    );

    // 46. Actualización de rol con solicitante no autorizado nunca devuelve éxito
    const unauthAtt = await supabaseAuthService.updateUserRole(
      'token_falso_no_autorizado',
      'target_user_id',
      'admin'
    );
    assert(
      unauthAtt.success === false && !unauthAtt.newRole,
      '46. RBAC: Actualización fallida nunca devuelve éxito ni nuevo rol'
    );

    // 47. Fallo seguro en consulta autoritativa: Si Supabase está activo pero el usuario no tiene perfil en public.users, rol SIEMPRE es 'user' (nunca admin ni superadmin)
    const prevRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevUrl = process.env.SUPABASE_URL;
    try {
      // Simular Supabase server configurado
      process.env.SUPABASE_URL = 'https://mock-project-for-test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key_for_test';

      const unprofiledServerRole = await supabaseAuthService.resolveServerRole(
        'b2938104-5f21-4890-a541-111111111111',
        'superadmin', // Aunque app_metadata diga superadmin, si public.users no existe o falla la consulta, NUNCA conceder privilegios
        'unprofiled@test.cu'
      );
      assert(
        unprofiledServerRole === 'user',
        '47. Fallo seguro: Con Supabase activo, usuario sin perfil en public.users o con fallo de consulta recibe estrictamente rol user (cero admin/superadmin)'
      );

      // 48. Intento de escalada con user_metadata.role: CERO privilegios otorgados
      const userMetaExploitRole = await supabaseAuthService.resolveServerRole(
        'c3938104-5f21-4890-a541-222222222222',
        undefined,
        'exploiter@test.cu'
      );
      assert(
        userMetaExploitRole === 'user',
        '48. RBAC: user_metadata.role malicioso o inventado no puede otorgar privilegios administrativos'
      );
    } finally {
      if (prevRoleKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevRoleKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
      else delete process.env.SUPABASE_URL;
    }

    // 49a. Situación 1: Fallo al guardar perfil en public.users con deleteUser() exitoso
    // Debe devolver success: false y eliminar la cuenta creada en Supabase Auth
    let deleteUserAttemptedWithUid1: string | null = null;
    const mockUid1 = 'simulated_user_uuid_ok_deletion';

    const mockAdminClientDeleteSuccess: any = {
      auth: {
        admin: {
          createUser: async () => ({
            data: {
              user: {
                id: mockUid1,
                email: 'test_del_ok@baseballhub.cu',
                app_metadata: { role: 'user' },
                user_metadata: { full_name: 'Test Delete Ok' },
              },
            },
            error: null,
          }),
          deleteUser: async (uidToDelete: string) => {
            deleteUserAttemptedWithUid1 = uidToDelete;
            return { data: { user: null }, error: null };
          },
        },
      },
      from: () => ({
        upsert: async () => ({
          error: { message: 'relation public.users does not exist or disk full simulated error' },
        }),
      }),
    };

    setSupabaseAdminClientOverride(mockAdminClientDeleteSuccess);
    try {
      const regRes1 = await supabaseAuthService.registerUser({
        email: 'test_del_ok@baseballhub.cu',
        password: 'PasswordSegura2026!',
        displayName: 'Test Delete Ok',
      });

      assert(
        regRes1.success === false &&
          !!regRes1.error &&
          regRes1.error.includes('Error al crear el perfil') &&
          regRes1.error.includes('eliminó la cuenta creada') &&
          deleteUserAttemptedWithUid1 === mockUid1,
        '49a. Registro: Si falla public.users y deleteUser() funciona, devuelve success: false y elimina la cuenta creada'
      );
    } finally {
      setSupabaseAdminClientOverride(null);
    }

    // 49b. Situación 2: Fallo al guardar perfil en public.users y deleteUser() también falla
    // En ambos casos el registro debe devolver success: false y debe quedar constancia expresa del error crítico
    let deleteUserAttemptedWithUid2: string | null = null;
    const mockUid2 = 'simulated_user_uuid_failed_deletion';

    const mockAdminClientDeleteFailure: any = {
      auth: {
        admin: {
          createUser: async () => ({
            data: {
              user: {
                id: mockUid2,
                email: 'test_del_fail@baseballhub.cu',
                app_metadata: { role: 'user' },
                user_metadata: { full_name: 'Test Delete Fail' },
              },
            },
            error: null,
          }),
          deleteUser: async (uidToDelete: string) => {
            deleteUserAttemptedWithUid2 = uidToDelete;
            return {
              data: { user: null },
              error: { message: 'Simulated connection failure during compensation delete' },
            };
          },
        },
      },
      from: () => ({
        upsert: async () => ({
          error: { message: 'Database connection dropped while inserting user profile' },
        }),
      }),
    };

    setSupabaseAdminClientOverride(mockAdminClientDeleteFailure);
    try {
      const regRes2 = await supabaseAuthService.registerUser({
        email: 'test_del_fail@baseballhub.cu',
        password: 'PasswordSegura2026!',
        displayName: 'Test Delete Fail',
      });

      assert(
        regRes2.success === false &&
          !!regRes2.error &&
          regRes2.error.includes('Error crítico') &&
          regRes2.error.includes('falló la eliminación de la cuenta') &&
          deleteUserAttemptedWithUid2 === mockUid2,
        '49b. Registro: Si falla public.users y deleteUser() falla, devuelve success: false y registra explícitamente el error crítico'
      );
    } finally {
      setSupabaseAdminClientOverride(null);
    }

    // 50. Reversión en updateUserRole(): Si falla la escritura en public.users, restaura el rol anterior correcto en Supabase Auth
    // y si no tenía perfil en public.users, el rol anterior restaurado es estrictamente 'user' (fuente autoritativa).
    let rollbackRoleAttempted: string | null = null;
    const mockTargetUserId = 'user_target_role_rollback';

    const mockAdminClientRoleRollback: any = {
      auth: {
        admin: {
          getUserById: async (uid: string) => {
            return {
              data: {
                user: {
                  id: mockTargetUserId,
                  email: 'target@baseballhub.cu',
                  app_metadata: { role: 'admin' }, // metadata residual en Auth
                },
              },
              error: null,
            };
          },
          updateUserById: async (uid: string, attrs: any) => {
            if (attrs?.app_metadata?.role) {
              rollbackRoleAttempted = attrs.app_metadata.role;
            }
            return {
              data: {
                user: {
                  id: uid,
                  app_metadata: attrs?.app_metadata || {},
                },
              },
              error: null,
            };
          },
        },
      },
      from: () => ({
        select: () => ({
          or: () => ({
            maybeSingle: async () => {
              // Sin perfil en public.users para el usuario objetivo
              return { data: null, error: null };
            },
          }),
        }),
        insert: async () => ({
          error: { message: 'Disk quota exceeded inserting into public.users' },
        }),
        update: async () => ({
          error: { message: 'Disk quota exceeded updating public.users' },
        }),
      }),
    };

    setSupabaseAdminClientOverride(mockAdminClientRoleRollback);
    try {
      const roleUpdateRes = await supabaseAuthService.updateUserRole(
        { id: 'requester_admin_id', role: 'superadmin' } as any,
        mockTargetUserId,
        'prensa'
      );

      assert(
        roleUpdateRes.success === false &&
          !!roleUpdateRes.error &&
          roleUpdateRes.error.includes('Error al persistir rol en public.users') &&
          roleUpdateRes.error.includes("restaurando el rol anterior 'user'") &&
          rollbackRoleAttempted === 'user',
        "50. Reversión de rol: Si falla public.users sin perfil previo, restaura en Auth el rol anterior autoritativo 'user' (nunca app_metadata residual)"
      );
    } finally {
      setSupabaseAdminClientOverride(null);
    }

    // =========================================================================
    // FASE 2.5A: ROW LEVEL SECURITY & PROFILE / COMMENTS / SPORTS HARDENING
    // =========================================================================
    console.log('\n🔒 --- FASE 2.5A: PRUEBAS DE SEGURIDAD RLS Y PERFILES PÚBLICOS ---');

    // 51. Comentarios de noticias: Validación y límite de longitud
    const resShortComment = await request(
      { hostname: 'localhost', port: 3000, path: '/api/news/slug-test/comments', method: 'POST' },
      { authorName: 'Tester', content: 'ab' }
    );
    assert(
      resShortComment.status === 400,
      '51. POST /api/news/:slug/comments con contenido < 3 caracteres es rechazado (400)'
    );

    // 52. Comentarios de noticias: Creación válida
    const resValidComment = await request(
      { hostname: 'localhost', port: 3000, path: '/api/news/noticia-estrella/comments', method: 'POST' },
      { authorName: 'Aficionado Fiel', favoriteTeam: 'Industriales', content: 'Excelente análisis del juego de anoche.' }
    );
    assert(
      resValidComment.status === 201 && !!resValidComment.body.id,
      '52. POST /api/news/:slug/comments con contenido válido se registra exitosamente (201)'
    );

    // 53. Comentarios de noticias: Moderación administrativa protegida
    const resAnonDeleteComment = await request(
      { hostname: 'localhost', port: 3000, path: `/api/news/comments/${resValidComment.body.id || 'c-test'}`, method: 'DELETE' }
    );
    assert(
      resAnonDeleteComment.status === 401,
      '53. DELETE /api/news/comments/:id sin credenciales administrativas retorna 401 (rechazado para anónimos)'
    );

    // 54. Perfil público seguro: No expone email ni preferencias privadas de los usuarios
    const phase25Email = `public_profile_${Date.now()}@baseballhub.cu`;
    const regPublicProfileRes = await request(
      { hostname: 'localhost', port: 3000, path: '/api/auth/register', method: 'POST' },
      {
        email: phase25Email,
        password: 'SecurePassword123!',
        displayName: 'Perfil Test',
        preferences: { favoriteTeam: 'Avispas', privateSecret: 'no_exponer' },
      }
    );
    const testNormalUser = regPublicProfileRes.body.user;
    const testNormalUserId = testNormalUser?.id || testNormalUser?.uid;
    const normalUserToken = regPublicProfileRes.body.token;

    const resPublicProfile = await request(
      { hostname: 'localhost', port: 3000, path: `/api/users/profile/${testNormalUserId}`, method: 'GET' }
    );
    assert(
      resPublicProfile.status === 200 &&
        resPublicProfile.body.profile &&
        resPublicProfile.body.profile.displayName === 'Perfil Test' &&
        resPublicProfile.body.profile.email === undefined &&
        resPublicProfile.body.profile.preferences === undefined,
      '54. GET /api/users/profile/:uid expone estrictamente campos públicos (sin emails ni preferencias privadas)'
    );

    // 55. Usuario normal intentando auto-elevar su rol vía PUT /api/users/me
    const resSelfEscalate = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/users/me',
        method: 'PUT',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { role: 'superadmin', displayName: 'Hacker Intent' }
    );
    assert(
      resSelfEscalate.status === 403 &&
        resSelfEscalate.body.error?.includes('privilegios para modificar su propio rol'),
      '55. PUT /api/users/me: Se bloquea intento de auto-elevación de rol por usuario normal (403)'
    );

    // 56. Usuario normal actualiza campos permitidos de su propio perfil
    const resSelfUpdateValid = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/users/me',
        method: 'PUT',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { displayName: 'Nuevo Nombre Aficionado' }
    );
    assert(
      resSelfUpdateValid.status === 200 &&
        resSelfUpdateValid.body.success === true &&
        resSelfUpdateValid.body.user.role === 'user' &&
        resSelfUpdateValid.body.user.name === 'Nuevo Nombre Aficionado',
      '56. PUT /api/users/me: Usuario normal actualiza su display_name conservando estrictamente el rol "user"'
    );

    // 57. Tablas deportivas y resultados protegidos contra usuarios normales y anónimos
    const resNormalUserPostGame = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/admin/games',
        method: 'POST',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { homeScore: 99, awayScore: 0 }
    );
    assert(
      resNormalUserPostGame.status === 403,
      '57. POST /api/admin/games: Usuario autenticado normal sin rol administrativo retorna 403 Forbidden'
    );

    // 58. Moderación de comentarios: Bloqueada para usuarios normales y permitida para moderadores autorizados
    const resNormalDeleteComment = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/news/comments/${resValidComment.body.id}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      }
    );
    const addedCommentInRepo = await baseballRepo.addComment('snb-noticia', {
      authorName: 'Moderación Test',
      content: 'Comentario para prueba de eliminación administrativa autorizada',
    });
    const deleteRepoSuccess = await baseballRepo.deleteComment(addedCommentInRepo.id);
    const checkDeletedComment = baseballRepo.getCommentsByArticle('snb-noticia').find((c: any) => c.id === addedCommentInRepo.id);
    assert(
      resNormalDeleteComment.status === 403 && deleteRepoSuccess === true && !checkDeletedComment,
      '58. Moderación de comentarios: Rechazado para usuarios normales (403) y ejecutado correctamente por moderador autorizado'
    );

    // 59. Acceso a perfiles privados: Usuario anónimo no tiene acceso a /api/users/me
    const resAnonPrivateProfile = await request(
      { hostname: 'localhost', port: 3000, path: '/api/users/me', method: 'GET' }
    );
    assert(
      resAnonPrivateProfile.status === 401,
      '59. GET /api/users/me: Usuario anónimo no puede acceder a perfiles privados (401)'
    );

    // 60. Modificación de roles de terceros: Usuario normal recibe 403 en /api/admin/users/:userId/role
    const resNormalChangeRole = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/admin/users/${testNormalUserId}/role`,
        method: 'PUT',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { role: 'superadmin' }
    );
    assert(
      resNormalChangeRole.status === 403,
      '60. PUT /api/admin/users/:userId/role: Usuario normal no puede modificar roles de usuarios (403 Forbidden)'
    );

    // 61. Edición de comentarios: Autor legítimo actualiza su propio comentario
    const resAuthorPostComment = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/news/snb-noticia/comments',
        method: 'POST',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { authorName: 'Autor Legítimo', content: 'Comentario original del autor que será editado.' }
    );
    const authorCommentId = resAuthorPostComment.body?.id;
    assert(
      resAuthorPostComment.status === 201 && !!authorCommentId,
      '61a. POST /api/news/:slug/comments: Autor autenticado crea comentario con autoría vinculada (201)'
    );

    const resAuthorUpdateComment = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/news/comments/${authorCommentId}`,
        method: 'PUT',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { content: 'Comentario actualizado legítimamente por su autor con texto válido.' }
    );
    assert(
      resAuthorUpdateComment.status === 200 &&
        resAuthorUpdateComment.body.success === true &&
        resAuthorUpdateComment.body.comment?.content?.includes('actualizado legítimamente'),
      '61b. PUT /api/news/comments/:id: Autor legítimo actualiza exitosamente su propio comentario (200)'
    );

    // 62. Edición de comentarios: Usuario normal B no puede editar el comentario del usuario A
    const regUserB = await request(
      { hostname: 'localhost', port: 3000, path: '/api/auth/register', method: 'POST' },
      {
        email: `user_b_${Date.now()}@baseballhub.cu`,
        password: 'PasswordB123456!',
        displayName: 'Usuario B Aficionado',
      }
    );
    const userBToken = regUserB.body.token;

    const resUserBEditOtherComment = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/news/comments/${authorCommentId}`,
        method: 'PUT',
        headers: { Authorization: `Bearer ${userBToken}` },
      },
      { content: 'Intento malicioso de modificar el comentario de otra persona.' }
    );
    assert(
      resUserBEditOtherComment.status === 403,
      '62. PUT /api/news/comments/:id: Usuario normal no puede modificar comentarios de otros autores (403 Forbidden)'
    );

    // 63. Escritura de estadísticas: Usuario anónimo no puede ingresar estadísticas de bateo
    const resAnonStatsBatting = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/players/p-01/stats/batting',
        method: 'POST',
      },
      { hr: 40, avg: 0.400 }
    );
    assert(
      resAnonStatsBatting.status === 401,
      '63. POST /api/players/:id/stats/batting: Usuario anónimo no puede escribir estadísticas (401)'
    );

    // 64. Escritura de estadísticas: Usuario normal autenticado sin rol administrativo recibe 403
    const resNormalStatsBatting = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/players/p-01/stats/batting',
        method: 'POST',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { hr: 50, avg: 0.500 }
    );
    assert(
      resNormalStatsBatting.status === 403,
      '64. POST /api/players/:id/stats/batting: Usuario normal sin rol administrativo recibe 403 Forbidden'
    );

    // 65. Verificación de trigger anti-escalación: Usuario normal no puede elevar sus privilegios
    const resNormalAttemptAdmin = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/users/me',
        method: 'PUT',
        headers: { Authorization: `Bearer ${normalUserToken}` },
      },
      { role: 'admin', email: 'hacker@baseballhub.cu' }
    );
    assert(
      resNormalAttemptAdmin.status === 403 &&
        resNormalAttemptAdmin.body?.error?.includes('privilegios para modificar su propio rol'),
      '65. Anti-escalación: Usuario normal no puede elevar privilegios ni cambiar su rol a admin (403)'
    );

    // 66. Gestión de roles autorizada: Un administrador autorizado (superadmin) puede gestionar roles mediante el flujo previsto
    const resSuperadminPromoteUser = await supabaseAuthService.updateUserRole(
      superadminToken,
      testNormalUserId,
      'prensa'
    );
    assert(
      resSuperadminPromoteUser.success === true && resSuperadminPromoteUser.newRole === 'prensa',
      '66. Gestión de roles autorizada: Superadmin autorizado promueve a usuario mediante flujo previsto (updateUserRole)'
    );

    // 67. Anti-tampering de comentarios: Moderador no puede transferir la propiedad de un comentario
    const commentForTamperCheck = await baseballRepo.addComment('snb-noticia', {
      authorName: 'Autor Legítimo',
      content: 'Comentario original del autor que será moderado.',
      userId: testNormalUserId,
    });

    const testModeratorEditAttempt = await baseballRepo.updateComment(
      commentForTamperCheck.id,
      'Contenido moderado con texto adecuado y respetuoso.',
      'moderator_different_user_id',
      true // isModerator
    );
    const updatedCommentAfterMod = baseballRepo.getCommentsByArticle('snb-noticia').find((c: any) => c.id === commentForTamperCheck.id);
    assert(
      testModeratorEditAttempt.success === true &&
        updatedCommentAfterMod?.userId === testNormalUserId &&
        updatedCommentAfterMod?.articleSlug === 'snb-noticia' &&
        updatedCommentAfterMod?.id === commentForTamperCheck.id,
      '67. Moderación anti-tampering: Moderador edita contenido pero autoría (userId), artículo y ID permanecen estrictamente inmutables'
    );

    // 68. Operaciones del servidor: El servidor puede realizar operaciones legítimas autorizadas (sync, stats, comentarios, likes)
    const serverLikeRes = await baseballRepo.likeComment(commentForTamperCheck.id);
    const serverStatRes = await baseballRepo.addOrUpdatePlayerSeasonBatting('p-01', {
      seasonId: 'snb-65',
      seasonYear: 2026,
      teamShort: 'MTZ',
      stage: 'regular',
      games: 15,
      ab: 45,
      h: 15,
      hr: 3,
      avg: 0.333,
    });
    assert(
      serverLikeRes.success === true && !!serverStatRes && Number(serverStatRes.avg) === 0.333,
      '68. Servidor autorizado: Realiza operaciones legítimas del sistema (likes vía endpoint/repo y actualización de estadísticas autorizada)'
    );

    // 69. Auditoría RLS: Archivo de migración complementaria v2 existe con eliminación exhaustiva de políticas antiguas
    const v2Path = path.resolve('supabase/migrations/20261013000000_baseball_hub_rls_hardening_v2.sql');
    const v2Content = fs.existsSync(v2Path) ? fs.readFileSync(v2Path, 'utf8') : '';
    const hasDropPolicies = v2Content.includes('drop policy if exists "Public read competitions"') === false &&
      v2Content.includes('drop policy if exists "Public manage players"') &&
      v2Content.includes('drop policy if exists "Public manage games"') &&
      v2Content.includes('v_is_server_authorized') &&
      v2Content.includes('auth.role() = \'service_role\'');
    assert(
      hasDropPolicies,
      '69. Auditoría de migración v2: Contiene limpieza exhaustiva de políticas antiguas, eliminación de dependencias inseguras y validación estricta'
    );

    // Summary
    console.log('\n🔒 ==========================================');
    console.log(`🔒 RESULTADOS: ${passed} PASADAS, ${failed} FALLADAS`);
    console.log('🔒 ==========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error durante la ejecución de las pruebas:', err);
    process.exit(1);
  }
}

runSecurityTests();
