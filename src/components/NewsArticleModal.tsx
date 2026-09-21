import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Tag, Share2, Check, ArrowRight, ExternalLink } from 'lucide-react';
import { NewsArticle } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { getArticleFullUrl } from '../utils/slug.ts';
import { ArticleModalSkeleton } from './LoadingSkeleton.tsx';
import { ArticleCommentsSection } from './ArticleCommentsSection.tsx';

interface NewsArticleModalProps {
  slug: string | null;
  onClose: () => void;
}

export const NewsArticleModal: React.FC<NewsArticleModalProps> = ({ slug, onClose }) => {
  const { navigateToTeam, navigateToPlayer, navigateToNews } = useApp();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    ApiClient.getNewsArticle(slug)
      .then((res) => {
        setArticle(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [slug]);

  if (!slug) return null;

  const fullUrl = article ? getArticleFullUrl(article.slug) : '';

  const handleShare = () => {
    if (fullUrl) {
      navigator.clipboard.writeText(fullUrl);
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenPage = () => {
    if (article) {
      onClose();
      navigateToNews(article.slug);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
              {article?.category || 'Noticia Oficial'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPage}
              title="Abrir página en su URL independiente"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Página Completa</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Enlace Copiado' : 'Compartir'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {loading || !article ? (
            <ArticleModalSkeleton />
          ) : (
            <>
              {/* Category & Date */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {article.category}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {article.publishedAt}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {article.readingTimeMinutes} min de lectura
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Por {article.author}
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  {article.title}
                </h1>
                <p className="text-base text-slate-300 font-medium mt-2 leading-relaxed">
                  {article.subtitle}
                </p>
              </div>

              {/* Featured Image */}
              <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-64 sm:h-80 object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Article Content */}
              <div className="prose prose-invert max-w-none text-slate-300 text-sm sm:text-base leading-relaxed space-y-4">
                {article.content.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              {/* Tags & Related Entities */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-400 font-bold uppercase">Etiquetas:</span>
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Related Teams & Players */}
                {article.relatedTeams && article.relatedTeams.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-xs text-slate-400 font-semibold">Equipos relacionados:</span>
                    {article.relatedTeams.map((teamId: string) => (
                      <button
                        key={teamId}
                        onClick={() => {
                          onClose();
                          navigateToTeam(teamId);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold uppercase transition-colors"
                      >
                        {teamId}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Community Comments Section */}
              <ArticleCommentsSection slug={article.slug} articleTitle={article.title} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
