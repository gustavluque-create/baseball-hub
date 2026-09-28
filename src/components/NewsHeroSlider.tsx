import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Flame,
  Calendar,
  Clock,
  User,
  Pause,
  Play,
  Share2,
  Check,
} from 'lucide-react';
import { NewsArticle } from '../types/index.ts';
import { useApp } from '../context/AppContext.tsx';

interface NewsHeroSliderProps {
  articles: NewsArticle[];
  loading?: boolean;
}

export const NewsHeroSlider: React.FC<NewsHeroSliderProps> = ({
  articles,
  loading = false,
}) => {
  const { navigateToNews } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Touch swipe support
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Take top 5 or 6 articles for the slider
  const sliderArticles = articles.slice(0, 6);
  const totalSlides = sliderArticles.length;

  // Auto-play timer
  useEffect(() => {
    if (loading || totalSlides <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 6000);

    return () => clearInterval(interval);
  }, [loading, totalSlides, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlides]);

  const goToPrev = () => {
    if (totalSlides === 0) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToNext = () => {
    if (totalSlides === 0) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (diff > minSwipeDistance) {
      goToNext();
    } else if (diff < -minSwipeDistance) {
      goToPrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleShare = (e: React.MouseEvent, article: NewsArticle) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/${article.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(article.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="relative w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[420px] sm:min-h-[480px] lg:min-h-[520px] flex flex-col justify-end p-6 sm:p-10 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-4 w-28 bg-slate-800 rounded" />
          <div className="h-4 w-20 bg-slate-800 rounded" />
        </div>
        <div className="h-10 sm:h-14 w-4/5 bg-slate-800 rounded-2xl" />
        <div className="h-5 w-3/5 bg-slate-800 rounded" />
        <div className="flex items-center gap-3 pt-4">
          <div className="h-11 w-44 bg-slate-800 rounded-xl" />
          <div className="h-11 w-11 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (totalSlides === 0) {
    return null;
  }

  const currentArticle = sliderArticles[currentIndex];

  return (
    <div
      className="relative group w-full rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-950 shadow-2xl transition-all duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Noticias y Crónicas Destacadas"
    >
      {/* Background Images Layer with Smooth Fade Transition */}
      <div className="relative w-full min-h-[440px] sm:min-h-[480px] lg:min-h-[540px]">
        {sliderArticles.map((article, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={article.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <img
                src={article.image}
                alt={article.title}
                className="w-full h-full object-cover object-center transform scale-105 group-hover:scale-100 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
              {/* Layered cinematic gradients for flawless contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />
            </div>
          );
        })}

        {/* Content Overlay */}
        <div className="relative z-20 h-full min-h-[440px] sm:min-h-[480px] lg:min-h-[540px] flex flex-col justify-end p-6 sm:p-10 lg:p-12 space-y-4">
          {/* Top Kicker & Clean Metadata (Zero-Pill Compliance) */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 font-medium">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-400">
              <Flame className="w-3.5 h-3.5 fill-emerald-400" />
              <span>{currentArticle.category || 'Destacada'}</span>
            </span>
            <span className="text-slate-600" aria-hidden="true">•</span>
            <span className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{formatDate(currentArticle.publishedAt)}</span>
            </span>
            {currentArticle.author && (
              <>
                <span className="text-slate-600" aria-hidden="true">•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>{currentArticle.author}</span>
                </span>
              </>
            )}
            <span className="text-slate-600" aria-hidden="true">•</span>
            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
              <Clock className="w-3 h-3" />
              <span>{currentArticle.readingTimeMinutes || 4} min de lectura</span>
            </span>
          </div>

          {/* Headline Title */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight max-w-4xl hover:text-emerald-300 transition-colors drop-shadow-md">
            <a
              href={`/${currentArticle.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigateToNews(currentArticle.slug);
              }}
            >
              {currentArticle.title}
            </a>
          </h1>

          {/* Subtitle / Excerpt */}
          {(currentArticle.subtitle || currentArticle.excerpt) && (
            <p className="text-sm sm:text-base text-slate-300 line-clamp-2 max-w-3xl leading-relaxed drop-shadow">
              {currentArticle.subtitle || currentArticle.excerpt}
            </p>
          )}

          {/* Bottom Action Row: CTAs & Slide Control Indicators */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateToNews(currentArticle.slug)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-xl shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <span>Leer Noticia Completa</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => handleShare(e, currentArticle)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer"
                title="Copiar enlace de esta noticia"
              >
                {copiedId === currentArticle.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Compartir</span>
                  </>
                )}
              </button>
            </div>

            {/* Slide Index & Play/Pause Status */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className="p-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 backdrop-blur transition-colors cursor-pointer"
                title={isPaused ? 'Reanudar carrusel automático' : 'Pausar carrusel'}
              >
                {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
              </button>
              <span className="font-mono text-xs font-bold text-slate-300">
                {currentIndex + 1} / {totalSlides}
              </span>
            </div>
          </div>
        </div>

        {/* Previous & Next Arrow Buttons */}
        <button
          type="button"
          onClick={goToPrev}
          className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white border border-slate-700/80 backdrop-blur-md opacity-80 group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
          aria-label="Noticia anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={goToNext}
          className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white border border-slate-700/80 backdrop-blur-md opacity-80 group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
          aria-label="Siguiente noticia"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Thumbnail Strip - Interactive Previews of All Slides */}
      <div className="bg-slate-950/95 border-t border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {sliderArticles.map((article, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={article.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`group/thumb flex items-center gap-2.5 p-1.5 rounded-xl transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-slate-900 border border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-slate-950 hover:bg-slate-900/60 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-800 border border-slate-700">
                  <img
                    src={article.image}
                    alt=""
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isActive && (
                    <div className="absolute inset-0 bg-emerald-500/20" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-500 block truncate group-hover/thumb:text-slate-400">
                    {article.category || 'Noticia'}
                  </span>
                  <span
                    className={`text-xs font-semibold block truncate leading-tight ${
                      isActive ? 'text-emerald-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    {article.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
