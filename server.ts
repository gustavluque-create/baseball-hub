import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api.router.ts';
import { baseballRepo } from './server/repositories/baseball.repository.ts';

function injectArticleMeta(html: string, article: any, fullUrl: string): string {
  const escapeHtml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const title = `${escapeHtml(article.title)} | Baseball Hub`;
  const desc = escapeHtml(article.excerpt || '');
  const image = article.image || '';

  let transformed = html
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${desc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${desc}" />`
    )
    .replace(
      /<meta\s+property="og:type"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:type" content="article" />`
    );

  const extraMeta = `
    <link rel="canonical" href="${fullUrl}" />
    <meta property="og:url" content="${fullUrl}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">
    ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.excerpt,
      image: [article.image],
      datePublished: article.publishedAt,
      author: {
        '@type': 'Person',
        name: article.author,
      },
      mainEntityOfPage: fullUrl,
    })}
    </script>
  `;

  return transformed.replace('</head>', `${extraMeta}</head>`);
}

function injectPlayerMeta(html: string, player: any, team: any, fullUrl: string): string {
  const escapeHtml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const teamName = team ? team.city || team.name : player.teamName || '';
  const title = `${escapeHtml(player.fullName)} (${escapeHtml(teamName)}) | Ficha y Estadísticas | Baseball Hub`;
  const desc = escapeHtml(
    player.bio ||
      `Perfil deportivo, estadísticas de bateo y pitcheo, métricas de rendimiento y trayectoria de ${player.fullName} en la Serie Nacional de Béisbol.`
  );
  const image = player.photo || '';

  let transformed = html
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${desc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${desc}" />`
    )
    .replace(
      /<meta\s+property="og:type"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:type" content="profile" />`
    );

  const extraMeta = `
    <link rel="canonical" href="${fullUrl}" />
    <meta property="og:url" content="${fullUrl}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">
    ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: player.fullName,
      jobTitle: 'Pelotero de Béisbol',
      memberOf: teamName ? { '@type': 'SportsTeam', name: teamName } : undefined,
      image: player.photo,
      mainEntityOfPage: fullUrl,
    })}
    </script>
  `;

  return transformed.replace('</head>', `${extraMeta}</head>`);
}

function injectTeamMeta(html: string, team: any, fullUrl: string): string {
  const escapeHtml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const title = `${escapeHtml(team.name)} (${escapeHtml(team.shortName)}) | Perfil y Roster Oficial | Baseball Hub`;
  const desc = escapeHtml(
    `Perfil oficial, roster de jugadores, calendario y estadísticas de ${team.name} (${team.city}) en la Serie Nacional de Béisbol.`
  );

  let transformed = html
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${desc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${desc}" />`
    )
    .replace(
      /<meta\s+property="og:type"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:type" content="website" />`
    );

  const extraMeta = `
    <link rel="canonical" href="${fullUrl}" />
    <meta property="og:url" content="${fullUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <script type="application/ld+json">
    ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SportsTeam',
      name: team.name,
      location: team.city,
      sport: 'Baseball',
      mainEntityOfPage: fullUrl,
    })}
    </script>
  `;

  return transformed.replace('</head>', `${extraMeta}</head>`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security HTTP Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // CORS configuration supporting authenticated credentials & configurable origins
  const allowedOriginEnv = process.env.CORS_ORIGIN;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOriginEnv) {
          if (allowedOriginEnv === '*' || allowedOriginEnv === origin) {
            return callback(null, true);
          }
          const origins = allowedOriginEnv.split(',').map((s) => s.trim());
          if (origins.includes(origin)) return callback(null, true);
        }
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-webhook-secret'],
    })
  );

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Serve static assets from public folder
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Ensure BaseballRepository is ready before handling requests
  app.use(async (_req, _res, next) => {
    try {
      await baseballRepo.ready();
      next();
    } catch (err) {
      next(err);
    }
  });

  // API Routes First
  app.use('/api', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), platform: 'Baseball Hub Engine' });
  });

  // Global Error Handler for API routes
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Unhandled Server Error]:', err?.message || err);
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({
      success: false,
      error: status === 500 ? 'Ocurrió un error interno en el servidor.' : (err?.message || 'Error en la solicitud'),
    });
  });

  // Vite Middleware in Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : typeof __dirname !== 'undefined' && fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(process.cwd(), 'dist');

    const indexHtmlPath = path.join(distPath, 'index.html');
    let cachedHtml = '';
    try {
      if (fs.existsSync(indexHtmlPath)) {
        cachedHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
      }
    } catch (e) {
      console.warn('Could not read index.html upfront:', e);
    }

    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      const cleanPath = req.path.replace(/^\/+|\/+$/g, '');
      if (cleanPath && !cleanPath.includes('.') && cachedHtml) {
        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol || 'https';
        const segments = cleanPath.split('/');

        // 1. Two segments: /:teamSlug/:playerSlug (e.g. /matanzas/erisbel-arruebarrena or /matanzas/jugador)
        if (segments.length === 2) {
          const team = baseballRepo.getTeamById(segments[0]);
          const player = baseballRepo.getPlayerByTeamAndIdentifier(segments[0], segments[1]);
          if (player) {
            const fullUrl = `${protocol}://${host}/${segments[0]}/${player.slug || segments[1]}`;
            const customHtml = injectPlayerMeta(cachedHtml, player, team, fullUrl);
            return res.send(customHtml);
          }
        }

        // 2. Single segment: /:teamSlug or /:articleSlug
        if (segments.length === 1) {
          const team = baseballRepo.getTeamById(segments[0]);
          if (team) {
            const fullUrl = `${protocol}://${host}/${segments[0]}`;
            const customHtml = injectTeamMeta(cachedHtml, team, fullUrl);
            return res.send(customHtml);
          }

          const article = baseballRepo.getNewsBySlug(segments[0]);
          if (article) {
            const fullUrl = `${protocol}://${host}/${article.slug}`;
            const customHtml = injectArticleMeta(cachedHtml, article, fullUrl);
            return res.send(customHtml);
          }
        }
      }

      res.sendFile(indexHtmlPath);
    });
  }

  // Wait for repository initialization before starting server listener
  await baseballRepo.ready();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚾ BASEBALL HUB server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
