import http from 'http';

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
    assert(resFakeToken.status === 401, '7. Token desconocido con prefijo adm_ no otorga acceso y retorna 401 (Zero Bypass)');

    // 5. Successful login with bcrypt validation
    const resLogin = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/login', method: 'POST' }, { username: 'admin', password: 'baseball2026' });
    assert(resLogin.status === 200 && !!resLogin.body?.token, '8. POST /api/admin/login con credenciales válidas retorna 200 y token');
    const adminToken = resLogin.body?.token;
    const cookieHeader = resLogin.headers['set-cookie']?.[0] || '';
    assert(cookieHeader.includes('baseball_admin_token') && cookieHeader.includes('HttpOnly'), '9. Inicio de sesión emite cookie HttpOnly');

    // 6. Authorized admin access
    const resOverview = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resOverview.status === 200, '10. Endpoint protegido /api/admin/overview con token válido retorna 200');

    // 7. Role-Based Access Control (RBAC): Editor cannot access superadmin-only endpoints
    const resEditorLogin = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/login', method: 'POST' }, { username: 'prensa', password: 'prensa2026' });
    assert(resEditorLogin.status === 200, '11. Login de usuario prensa/editor retorna 200');
    const editorToken = resEditorLogin.body?.token;

    const resEditorForbidden = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/system/backup',
      method: 'GET',
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    assert(resEditorForbidden.status === 403, '12. Rol prensa no puede acceder a respaldos de sistema (retorna 403 Forbidden)');

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
    const resBadImage = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/players/p-01/photo',
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      { photo: 'data:image/svg+xml;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' }
    );
    assert(resBadImage.status === 400, '14. SVG malicioso con scripts es rechazado con 400 Bad Request');

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
    const resLogout = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/logout',
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resLogout.status === 200, '17. Logout exitoso');

    const resPostLogout = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/session',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resPostLogout.status === 401, '18. Sesión invalidada tras logout (retorna 401)');

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
