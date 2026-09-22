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
  Send,
  Linkedin,
  Facebook,
  X,
  MessageSquare,
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

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
    const url = article ? getArticleFullUrl(article.slug) : getArticleFullUrl(slug);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setShareFeedback('¡Enlace copiado al portapapeles!');
      setTimeout(() => {
        setCopied(false);
        setShareFeedback(null);
      }, 2500);
    }
  };

  const handleShare = async () => {
    if (!article) return;
    const url = getArticleFullUrl(article.slug);
    const shareData = {
      title: article.title,
      text: article.excerpt || `Lee esta noticia en Baseball Hub: ${article.title}`,
      url,
    };

    // Check if Web Share API is available and can share this data
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        if (navigator.canShare && !navigator.canShare(shareData)) {
          // If browser canShare reports false, open custom share dialog
          setIsShareModalOpen(true);
          return;
        }
        await navigator.share(shareData);
        setShareFeedback('¡Compartido con éxito!');
        setTimeout(() => setShareFeedback(null), 3000);
      } catch (err: any) {
        // If user cancelled the share sheet, AbortError is raised
        if (err?.name === 'AbortError') {
          // User simply closed/dismissed native sheet, no error message needed
          return;
        }
        // In other cases (permissions, platform limitations), fallback to modal
        console.warn('Web Share API error, using fallback modal:', err);
        setIsShareModalOpen(true);
      }
    } else {
      // Web Share API not supported on this browser/environment (e.g. desktop non-Safari/Edge, or iframe without allow="web-share")
      setIsShareModalOpen(true);
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
          <span className="text-slate-500">•</span>
          <a
            href="#article-comments-section"
            className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors font-medium"
            title="Ir a los comentarios y opiniones"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Opiniones &amp; Debate</span>
          </a>
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

          {/* Social share icons & Native Web Share */}
          <div className="flex items-center gap-1.5">
            {/* Primary Web Share API button */}
            <button
              onClick={handleShare}
              id="article-header-share-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
              title="Compartir artículo en redes o aplicaciones"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir</span>
            </button>

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

            {/* Telegram */}
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 text-sky-400 border border-sky-500/30 transition-colors hidden sm:inline-flex"
              title="Compartir en Telegram"
            >
              <Send className="w-4 h-4" />
            </a>

            {/* Facebook */}
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 text-blue-400 border border-blue-500/30 transition-colors hidden md:inline-flex"
              title="Compartir en Facebook"
            >
              <Facebook className="w-4 h-4" />
            </a>
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

      {/* Interactive Social Share Bar */}
      <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Share2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide">
                ¿Te gustó este artículo? ¡Compártelo!
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Difunde las noticias y análisis de la Serie Nacional con tus amigos y en redes sociales.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Native Web Share button */}
            <button
              onClick={handleShare}
              id="article-bottom-webshare-btn"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md hover:shadow-emerald-600/20 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir Artículo</span>
            </button>

            {/* WhatsApp */}
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + '\n' + articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
              title="Compartir en WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {/* Twitter / X */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
              title="Compartir en X (Twitter)"
            >
              <span className="font-bold text-xs">𝕏</span>
              <span className="hidden sm:inline">Twitter</span>
            </a>

            {/* Facebook */}
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-colors"
              title="Compartir en Facebook"
            >
              <Facebook className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Facebook</span>
            </a>

            {/* Telegram */}
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors"
              title="Compartir en Telegram"
            >
              <Send className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Telegram</span>
            </a>
          </div>
        </div>

        {shareFeedback && (
          <div className="mt-3 py-1.5 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
            <Check className="w-3.5 h-3.5" />
            <span>{shareFeedback}</span>
          </div>
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

      {/* Social Media Share Modal Dialog (Fallback & Direct Selection) */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 text-slate-100 relative"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="share-modal-title" className="text-sm font-black uppercase tracking-wider text-slate-100">
                    Compartir Noticia
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Elige tu red social o copia el enlace directo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Article Preview Card */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex gap-3 items-center">
              {article.image && (
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-16 h-16 rounded-lg object-cover shrink-0 bg-slate-900 border border-slate-800"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400">
                  {article.category}
                </span>
                <p className="text-xs font-bold text-slate-200 line-clamp-2 mt-0.5">
                  {article.title}
                </p>
              </div>
            </div>

            {/* Social Media Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Redes Sociales &amp; Mensajería
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + '\n' + articleUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all hover:scale-[1.02]"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <span>WhatsApp</span>
                </a>

                {/* Twitter / X */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(articleUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-bold transition-all hover:scale-[1.02]"
                >
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-200 font-mono text-xs font-black flex items-center justify-center w-7 h-7">
                    𝕏
                  </div>
                  <span>Twitter / X</span>
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-sky-950/40 hover:bg-sky-950/70 border border-sky-500/30 text-sky-300 text-xs font-bold transition-all hover:scale-[1.02]"
                >
                  <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                    <Send className="w-4 h-4" />
                  </div>
                  <span>Telegram</span>
                </a>

                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-950/40 hover:bg-blue-950/70 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all hover:scale-[1.02]"
                >
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <Facebook className="w-4 h-4" />
                  </div>
                  <span>Facebook</span>
                </a>

                {/* LinkedIn */}
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-950/40 hover:bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all hover:scale-[1.02] col-span-2"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Linkedin className="w-4 h-4" />
                  </div>
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>

            {/* Direct Link Copy */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Enlace Directo
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={articleUrl}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate focus:outline-none focus:border-emerald-500 select-all"
                />
                <button
                  onClick={handleCopyLink}
                  id="modal-copy-link-btn"
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    copied
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
