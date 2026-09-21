import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Tag,
  Share2,
  Check,
  ArrowLeft,
  Newspaper,
  ExternalLink,
  MessageCircle,
  Copy,
  ChevronRight,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';
import { NewsArticle } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { getArticleFullUrl } from '../utils/slug.ts';
import { ArticleModalSkeleton } from '../components/LoadingSkeleton.tsx';
import { ArticleCommentsSection } from '../components/ArticleCommentsSection.tsx';

interface ArticlePostViewProps {
  slug: string;
  onBack?: () => void;
}

export const ArticlePostView: React.FC<ArticlePostViewProps> = ({ slug, onBack }) => {
  const { setActiveTab, navigateToNews, navigateToTeam, navigateToPlayer } = useApp();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    ApiClient.getNewsArticle(slug)
      .then((res) => {
        setArticle(res);
        setLoading(false);

        // Fetch related articles
        ApiClient.getNews({ limit: 4, category: res.category })
          .then((list) => {
            setRelatedNews(list.filter((n) => n.id !== res.id && n.slug !== res.slug).slice(0, 3));
          })
          .catch(() => {});
      })
      .catch((err) => {
        console.error('Error cargando artículo:', err);
        setError('No pudimos encontrar el artículo solicitado.');
        setLoading(false);
      });
  }, [slug]);

  // Update document title, meta tags, and structured data for SEO positioning
  useEffect(() => {
    if (!article) return;

    const fullUrl = getArticleFullUrl(article.slug);
    const siteTitle = 'Baseball Hub';
    const pageTitle = `${article.title} | ${siteTitle}`;

    // Update <title>
    document.title = pageTitle;

    // Helper to safely set meta tag
    const setMetaTag = (attributeName: string, attributeValue: string, content: string) => {
      let meta = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attributeName, attributeValue);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Helper for canonical link
    const setCanonical = (url: string) => {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', url);
    };

    // 1. Standard Meta
    setMetaTag('name', 'description', article.excerpt);
    setMetaTag('name', 'author', article.author);
    setCanonical(fullUrl);

    // 2. OpenGraph Meta
    setMetaTag('property', 'og:type', 'article');
    setMetaTag('property', 'og:title', article.title);
    setMetaTag('property', 'og:description', article.excerpt);
    setMetaTag('property', 'og:image', article.image);
    setMetaTag('property', 'og:url', fullUrl);
    setMetaTag('property', 'og:site_name', siteTitle);

    // 3. Twitter Card Meta
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', article.title);
    setMetaTag('name', 'twitter:description', article.excerpt);
    setMetaTag('name', 'twitter:image', article.image);

    // 4. Schema.org JSON-LD NewsArticle Structured Data
    const scriptId = 'news-article-json-ld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.excerpt,
      image: [article.image],
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': fullUrl,
      },
      author: {
        '@type': 'Person',
        name: article.author,
      },
      publisher: {
        '@type': 'Organization',
        name: siteTitle,
        logo: {
          '@type': 'ImageObject',
          url: window.location.origin + '/vite.svg',
        },
      },
      articleSection: article.category,
      keywords: article.tags?.join(', ') || 'béisbol, serie nacional',
    };
    script.textContent = JSON.stringify(structuredData);

    return () => {
      // Revert title on unmount
      document.title = 'Baseball Hub — Plataforma Profesional de Béisbol';
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [article]);

  const handleCopyLink = () => {
    const url = getArticleFullUrl(slug);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShareNative = () => {
    if (!article) return;
    const url = getArticleFullUrl(article.slug);
    if (navigator.share) {
      navigator
        .share({
          title: article.title,
          text: article.excerpt,
          url,
        })
        .catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setActiveTab('news');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <ArticleModalSkeleton />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
          <Newspaper className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-wide">
          Artículo No Encontrado
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {error || 'El post al que intentas acceder no existe o su enlace permanente ha sido modificado.'}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => setActiveTab('news')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>Ver Todas las Noticias</span>
          </button>
          <button
            onClick={() => setActiveTab('home')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Portada Principal</span>
          </button>
        </div>
      </div>
    );
  }

  const articleUrl = getArticleFullUrl(article.slug);
  const formattedDate = new Date(article.publishedAt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className="max-w-4xl mx-auto pb-16 px-4 sm:px-6">
      {/* Breadcrumb navigation for SEO & UX */}
      <nav aria-label="Breadcrumb" className="pt-4 pb-6 flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('home')}
          className="hover:text-emerald-400 transition-colors flex items-center gap-1"
        >
          <span>Inicio</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        <button
          onClick={() => setActiveTab('news')}
          className="hover:text-emerald-400 transition-colors flex items-center gap-1"
        >
          <span>Noticias</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        <span className="text-emerald-400 font-semibold">{article.category}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">{article.title}</span>
      </nav>

      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-800/80 mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Volver a Noticias</span>
        </button>

        {/* Independent URL Display & Copy */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-400 max-w-xs truncate">
            <span className="text-emerald-400 font-bold">URL:</span>
            <span className="truncate">/{article.slug}</span>
          </div>

          <button
            onClick={handleCopyLink}
            id="copy-article-link-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer border ${
              copied
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
            }`}
            title="Copiar URL directa del artículo"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{copied ? '¡URL Copiada!' : 'Copiar URL'}</span>
          </button>
        </div>
      </div>

      {/* Article Header */}
      <header className="space-y-4 mb-6">
        {/* Category & Editorial Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 uppercase tracking-wider text-[11px]">
            {article.category}
          </span>
          <span className="text-slate-500">•</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <time dateTime={article.publishedAt}>{formattedDate}</time>
          </span>
          {article.readingTimeMinutes && (
            <>
              <span className="text-slate-500">•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{article.readingTimeMinutes} min de lectura</span>
              </span>
            </>
          )}
        </div>

        {/* Main Title (H1 for SEO) */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
          {article.title}
        </h1>

        {/* Excerpt / Lead Paragraph */}
        {article.excerpt && (
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal border-l-2 border-emerald-500 pl-4 py-1 italic bg-slate-900/40 rounded-r-xl">
            {article.excerpt}
          </p>
        )}

        {/* Byline Author Info */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold shadow">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200 leading-none">{article.author}</p>
              <p className="text-[11px] text-slate-500 leading-none mt-1">Redacción Deportiva Oficial</p>
            </div>
          </div>

          {/* Social share icons */}
          <div className="flex items-center gap-1.5">
            {/* WhatsApp */}
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + ' ' + articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 transition-colors"
              title="Compartir en WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>

            {/* Twitter / X */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              title="Compartir en X (Twitter)"
            >
              <span className="font-bold text-xs">𝕏</span>
            </a>

            {/* Native Share / Copy */}
            <button
              onClick={handleShareNative}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
              title="Compartir"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Featured Hero Image */}
      {article.image && (
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 mb-8 aspect-video sm:aspect-[21/9] max-h-[460px] bg-slate-900">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-300 drop-shadow">
            <span>Foto oficial de la Serie Nacional</span>
            <span className="font-mono text-emerald-400">Baseball Hub Media</span>
          </div>
        </div>
      )}

      {/* Article Body Content */}
      <div className="prose prose-invert max-w-none space-y-5 text-slate-200 text-sm sm:text-base leading-relaxed">
        {article.content ? (
          article.content.split('\n\n').map((paragraph, index) => (
            <p key={index} className="text-slate-300 leading-relaxed font-normal">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="text-slate-300 leading-relaxed">{article.excerpt}</p>
        )}
      </div>

      {/* Tags Section */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>Temas y Palabras Clave</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Permanent SEO Canonical URL Box */}
      <div className="mt-8 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enlace Permanente &amp; Posicionamiento SEO</span>
          </div>
          <p className="text-slate-400 text-[11px] font-mono break-all">
            {articleUrl}
          </p>
        </div>
        <button
          onClick={handleCopyLink}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap text-xs flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>

      {/* Community Comments Section */}
      <ArticleCommentsSection slug={article.slug} articleTitle={article.title} />

      {/* Related News Section */}
      {relatedNews.length > 0 && (
        <section className="mt-12 pt-8 border-t border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Noticias Relacionadas</span>
            </h3>
            <button
              onClick={() => setActiveTab('news')}
              className="text-xs text-emerald-400 hover:underline font-bold"
            >
              Ver todas →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedNews.map((rel) => (
              <div
                key={rel.id}
                onClick={() => navigateToNews(rel.slug)}
                className="group rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 overflow-hidden cursor-pointer transition-all shadow hover:shadow-lg flex flex-col justify-between"
              >
                <div className="relative h-32 overflow-hidden bg-slate-950">
                  <img
                    src={rel.image}
                    alt={rel.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 text-emerald-400 text-[9px] font-bold uppercase">
                    {rel.category}
                  </span>
                </div>
                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                  <h4 className="font-bold text-xs text-slate-200 group-hover:text-emerald-400 transition-colors line-clamp-2">
                    {rel.title}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                    <span>{new Date(rel.publishedAt).toLocaleDateString()}</span>
                    <span className="text-emerald-400">Leer →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};
