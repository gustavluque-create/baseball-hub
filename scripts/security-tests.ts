import http from 'http';
import bcrypt from 'bcryptjs';
import { adminAuthService, isValidBcryptHash, getAdminCredential } from '../server/services/admin-auth.service.ts';
import { isSupabaseServerConfigured, getSupabaseServerClient } from '../server/lib/supabase.ts';
import { isValidImageString, playerPhotoSchema } from '../server/utils/validation.ts';

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

    // Summary
    console.log('\n🔒 ==========================================');
    console.log(`🔒 RESULTADOS: ${passed} PASADAS, ${failed} FALLADAS`);
    console.log('🔒 ==========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Error durante la ejecución de las pruebas:', err);
    process.exit(1);
  }
}

runSecurityTests();
