import express from 'express';
import path from 'path';
import fs from 'fs';
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // API Routes First
  app.use('/api', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), platform: 'Baseball Hub Engine' });
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
      const slugCandidate = req.path.replace(/^\/+|\/+$/g, '');
      if (slugCandidate && !slugCandidate.includes('.')) {
        const article = baseballRepo.getNewsBySlug(slugCandidate);
        if (article && cachedHtml) {
          const host = req.get('host') || 'localhost:3000';
          const protocol = req.protocol || 'https';
          const fullUrl = `${protocol}://${host}/${article.slug}`;
          const customHtml = injectArticleMeta(cachedHtml, article, fullUrl);
          return res.send(customHtml);
        }
      }

      res.sendFile(indexHtmlPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚾ BASEBALL HUB server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
