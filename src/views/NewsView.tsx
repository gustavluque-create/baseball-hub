import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  Calendar,
  Clock,
  User,
  ArrowRight,
  Star,
  Columns,
  LayoutGrid,
  Tag,
  Share2,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { Skeleton, NewsMasonrySkeleton, NewsGridSkeleton } from '../components/LoadingSkeleton.tsx';
import { NewsArticle } from '../types/index.ts';

export const NewsView: React.FC = () => {
  const { navigateToNews } = useApp();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'masonry' | 'grid'>('masonry');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['Todos', 'Crónicas', 'Análisis', 'Entrevistas', 'Estadísticas', 'Oficial'];

  useEffect(() => {
    setLoading(true);
    ApiClient.getNews({
      category: selectedCategory === 'Todos' ? undefined : selectedCategory,
    })
      .then((res) => {
        setNews(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedCategory]);

  const handleShare = (e: React.MouseEvent, article: NewsArticle) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/${article.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(article.id);
      setTimeout(() => setCopiedId(null), 2000);
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Crónica':
      case 'Crónicas':
        return 'bg-emerald-500 text-slate-950';
      case 'Entrevistas':
      case 'Entrevista':
        return 'bg-amber-400 text-slate-950';
      case 'Estadísticas':
        return 'bg-purple-500 text-white';
      case 'Análisis':
        return 'bg-sky-400 text-slate-950';
      case 'Oficial':
        return 'bg-rose-500 text-white';
      default:
        return 'bg-slate-700 text-slate-100';
    }
  };

  const getImageHeight = (article: NewsArticle, index: number) => {
    if (layoutMode === 'grid') return 'h-52';

    // Explicit height preference
    if (article.imageHeight === 'tall') return 'h-80 sm:h-96';
    if (article.imageHeight === 'wide') return 'h-60 sm:h-72';
    if (article.imageHeight === 'panoramic') return 'h-44 sm:h-52';
    if (article.imageHeight === 'medium') return 'h-52 sm:h-60';

    // Dynamic rhythm based on featured status & editorial position
    if (article.isFeatured || index === 0) return 'h-72 sm:h-84';
    if (article.category === 'Entrevistas') return 'h-80 sm:h-96';
    if (article.category === 'Oficial') return 'h-44 sm:h-52';

    // Alternating aesthetic rhythm for natural masonry flow
    const heights = ['h-56 sm:h-64', 'h-80 sm:h-92', 'h-64 sm:h-72', 'h-48 sm:h-56', 'h-72 sm:h-80'];
    return heights[index % heights.length];
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
              Revista Editorial
            </span>
            <span className="text-xs text-slate-400">
              {loading && news.length === 0 ? (
                <Skeleton className="h-3.5 w-28 inline-block rounded" />
              ) : (
                `${news.length} ${news.length === 1 ? 'artículo' : 'artículos'} disponibles`
              )}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5 mt-1.5">
            <Newspaper className="w-6 h-6 text-emerald-400" />
            Noticias, Crónicas y Reportajes
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Cobertura periodística con visualización en mosaico (masonry) adaptada a portadas destacadas, reportajes fotográficos y entrevistas a profundidad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Layout View Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
            <button
              onClick={() => setLayoutMode('masonry')}
              title="Vista en Mosaico (Masonry con alturas variables)"
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'masonry'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Mosaico</span>
            </button>
            <button
              onClick={() => setLayoutMode('grid')}
              title="Vista en Cuadrícula Uniforme"
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'grid'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Uniforme</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        layoutMode === 'masonry' ? (
          <NewsMasonrySkeleton count={6} />
        ) : (
          <NewsGridSkeleton count={6} />
        )
      ) : news.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800">
          <Newspaper className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">No hay noticias en esta categoría</h3>
          <p className="text-xs text-slate-400 mt-1">
            Prueba seleccionando &quot;Todos&quot; para ver la cobertura completa.
          </p>
          <button
            onClick={() => setSelectedCategory('Todos')}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Ver todas las publicaciones
          </button>
        </div>
      ) : (
        /* Masonry or Grid Display */
        <div
          className={
            layoutMode === 'masonry'
              ? 'columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:_balance]'
              : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          }
        >
          {news.map((article, index) => {
            const isFeatured = Boolean(article.isFeatured || (selectedCategory === 'Todos' && index === 0));
            const imgHeightClass = getImageHeight(article, index);

            return (
              <article
                key={article.id}
                className={`group rounded-2xl bg-slate-900 border transition-all duration-300 overflow-hidden shadow-md hover:shadow-2xl flex flex-col justify-between cursor-pointer ${
                  layoutMode === 'masonry' ? 'break-inside-avoid inline-block w-full mb-6' : ''
                } ${
                  isFeatured
                    ? 'border-emerald-500/40 hover:border-emerald-400 ring-1 ring-emerald-500/20 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <a
                  href={`/${article.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToNews(article.slug);
                  }}
                  className="block focus:outline-none"
                >
                  {/* Image container with variable height */}
                  <div className={`relative ${imgHeightClass} w-full overflow-hidden bg-slate-950`}>
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      referrerPolicy="no-referrer"
                      loading={index > 3 ? 'lazy' : 'eager'}
                    />

                    {/* Gradient Overlay for legibility & contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-70 group-hover:opacity-50 transition-opacity" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow ${getCategoryColor(
                            article.category
                          )}`}
                        >
                          {article.category}
                        </span>

                        {isFeatured && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                            <Star className="w-2.5 h-2.5 fill-slate-950 text-slate-950" />
                            Destacado
                          </span>
                        )}
                      </div>

                      {/* Quick Share Button */}
                      <button
                        type="button"
                        onClick={(e) => handleShare(e, article)}
                        title="Copiar enlace del artículo"
                        className="pointer-events-auto p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white backdrop-blur border border-slate-700/60 shadow transition-all cursor-pointer"
                      >
                        {copiedId === article.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Bottom Metadata in Image for Featured/Tall stories */}
                    {isFeatured && (
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-200">
                        <span className="px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur border border-slate-700/50 font-medium">
                          {article.readingTimeMinutes || 5} min de lectura
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur border border-slate-700/50 text-slate-300">
                          {formatDate(article.publishedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Article Card Content */}
                  <div className="p-5 space-y-3">
                    {/* Date and Reading Time (for non-featured cards) */}
                    {!isFeatured && (
                      <div className="flex items-center gap-2.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatDate(article.publishedAt)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {article.readingTimeMinutes || 4} min
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    <h2
                      className={`font-black text-white group-hover:text-emerald-400 transition-colors leading-snug ${
                        isFeatured ? 'text-lg sm:text-xl' : 'text-base'
                      }`}
                    >
                      {article.title}
                    </h2>

                    {/* Subtitle / Pull-Quote if present */}
                    {article.subtitle && (
                      <p className="text-xs text-emerald-400/90 font-medium italic line-clamp-2 leading-relaxed">
                        &quot;{article.subtitle}&quot;
                      </p>
                    )}

                    {/* Excerpt */}
                    <p
                      className={`text-xs text-slate-400 leading-relaxed ${
                        isFeatured ? 'line-clamp-4' : 'line-clamp-3'
                      }`}
                    >
                      {article.excerpt}
                    </p>

                    {/* Tag Chips */}
                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {article.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md font-medium"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-500" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </a>

                {/* Footer Action */}
                <div className="px-5 py-3 border-t border-slate-800/80 flex items-center justify-between text-xs bg-slate-900/40">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium truncate max-w-[180px]">
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{article.author}</span>
                  </span>
                  <a
                    href={`/${article.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToNews(article.slug);
                    }}
                    className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform shrink-0"
                  >
                    <span>Leer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

