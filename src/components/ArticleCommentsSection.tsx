import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  Reply,
  Sparkles,
  Flame,
  Clock,
  X,
  Share2,
} from 'lucide-react';
import { ArticleComment } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';

interface ArticleCommentsSectionProps {
  slug: string;
  articleTitle?: string;
}

const POPULAR_TEAMS = [
  'Industriales',
  'Las Tunas',
  'Matanzas',
  'Pinar del Río',
  'Santiago de Cuba',
  'Granma',
  'Ciego de Ávila',
  'Artemisa',
];

export const ArticleCommentsSection: React.FC<ArticleCommentsSectionProps> = ({ slug, articleTitle }) => {
  const { isAdminAuthenticated } = useAdminAuth();
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [authorName, setAuthorName] = useState(() => {
    return localStorage.getItem('baseball_comment_author_name') || '';
  });
  const [favoriteTeam, setFavoriteTeam] = useState(() => {
    return localStorage.getItem('baseball_comment_fav_team') || '';
  });
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  // Feedback & Interactions
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [likedCommentIds, setLikedCommentIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('baseball_liked_comment_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sorting
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    ApiClient.getArticleComments(slug)
      .then((data) => {
        setComments(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching comments:', err);
        setLoading(false);
      });
  }, [slug]);

  // Persist author name and team for convenience
  const handleAuthorNameChange = (val: string) => {
    setAuthorName(val);
    localStorage.setItem('baseball_comment_author_name', val);
  };

  const handleFavoriteTeamChange = (val: string) => {
    setFavoriteTeam(val);
    localStorage.setItem('baseball_comment_fav_team', val);
  };

  const handleSelectTeamChip = (teamName: string) => {
    const newTeam = favoriteTeam === teamName ? '' : teamName;
    handleFavoriteTeamChange(newTeam);
  };

  const handleReplyClick = (author: string) => {
    setReplyTo(author);
    if (!content.includes(`@${author}`)) {
      setContent((prev) => (prev ? `@${author} ${prev}` : `@${author} `));
    }
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleLikeComment = async (commentId: string) => {
    if (likedCommentIds.includes(commentId)) {
      return; // Already upvoted
    }

    // Optimistic UI update
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c))
    );
    const updatedLiked = [...likedCommentIds, commentId];
    setLikedCommentIds(updatedLiked);
    localStorage.setItem('baseball_liked_comment_ids', JSON.stringify(updatedLiked));

    try {
      await ApiClient.likeArticleComment(commentId);
    } catch (err) {
      console.error('Failed to register like on server:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent.length < 3) {
      setFeedbackMessage({
        type: 'error',
        text: 'El comentario debe contener al menos 3 caracteres.',
      });
      return;
    }

    try {
      setSubmitting(true);
      setFeedbackMessage(null);
      const newComment = await ApiClient.addArticleComment(slug, {
        authorName: authorName.trim() || 'Aficionado al Béisbol',
        favoriteTeam: favoriteTeam.trim() || undefined,
        content: cleanContent,
      });

      setComments((prev) => [newComment, ...prev]);
      setContent('');
      setReplyTo(null);
      setFeedbackMessage({
        type: 'success',
        text: '¡Tu comentario y opinión se han publicado exitosamente!',
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to post comment:', err);
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Ocurrió un error al publicar el comentario. Inténtalo nuevamente.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isAdminAuthenticated) return;
    if (!window.confirm('¿Seguro que deseas eliminar este comentario? (Acción administrativa)')) {
      return;
    }

    try {
      setDeletingId(commentId);
      await ApiClient.deleteArticleComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      console.error('Failed to delete comment:', err);
      alert('Error al eliminar comentario: ' + (err.message || 'No autorizado'));
    } finally {
      setDeletingId(null);
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const then = new Date(isoString).getTime();
      const diffSec = Math.floor((now - then) / 1000);
      if (diffSec < 60) return 'Hace un momento';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `Hace ${diffDays} d`;
      return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  // Filter & Sorted Comments
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'popular') {
      const likesA = a.likes || 0;
      const likesB = b.likes || 0;
      if (likesB !== likesA) return likesB - likesA;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <section id="article-comments-section" className="mt-12 pt-8 border-t border-slate-800 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                Comentarios &amp; Opiniones
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                {comments.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Debate sobre la jugada, pronósticos y opiniones de la afición.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Buttons */}
          {comments.length > 1 && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setSortBy('recent')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  sortBy === 'recent'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Recientes</span>
              </button>
              <button
                type="button"
                onClick={() => setSortBy('popular')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  sortBy === 'popular'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Más Votados</span>
              </button>
            </div>
          )}

          {isAdminAuthenticated && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Modo Moderador</span>
            </div>
          )}
        </div>
      </div>

      {/* Comment Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Únete al debate</span>
          </span>
          {replyTo && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
              <Reply className="w-3 h-3" />
              <span>Respondiendo a: <strong>{replyTo}</strong></span>
              <button
                type="button"
                onClick={handleCancelReply}
                className="ml-1 p-0.5 hover:text-white"
                title="Cancelar respuesta"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Tu Nombre o Alias
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => handleAuthorNameChange(e.target.value)}
              placeholder="Ej. Yordanis Morales"
              maxLength={40}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-xs placeholder-slate-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Equipo de tu Preferencia (Opcional)
            </label>
            <input
              type="text"
              value={favoriteTeam}
              onChange={(e) => handleFavoriteTeamChange(e.target.value)}
              placeholder="Ej. Leñadores de Las Tunas"
              maxLength={30}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-xs placeholder-slate-500 transition-colors"
            />
          </div>
        </div>

        {/* Quick Team Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Sugerencias de Equipos:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_TEAMS.map((team) => (
              <button
                key={team}
                type="button"
                onClick={() => handleSelectTeamChip(team)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                  favoriteTeam.toLowerCase().includes(team.toLowerCase())
                    ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                    : 'bg-slate-950 hover:bg-slate-850 text-slate-400 border-slate-800'
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            Comentario o Análisis <span className="text-emerald-400">*</span>
          </label>
          <textarea
            ref={textareaRef}
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="¿Qué opinas sobre el rendimiento, decisiones arbitrales o pronóstico del juego?..."
            maxLength={800}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-xs placeholder-slate-500 transition-colors resize-none"
          />
        </div>

        {feedbackMessage && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold animate-fadeIn ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-950/40 text-red-300 border border-red-500/30'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-mono text-slate-500">
            {content.length}/800 caracteres
          </span>
          <button
            type="submit"
            disabled={submitting || content.trim().length < 3}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Publicando...' : 'Publicar Comentario'}</span>
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-slate-500 text-xs animate-pulse">
            Cargando comentarios y opiniones de la comunidad...
          </div>
        ) : sortedComments.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">Aún no hay opiniones en esta noticia</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                ¡Sé el primero en compartir tu punto de vista sobre esta nota de béisbol!
              </p>
            </div>
          </div>
        ) : (
          sortedComments.map((comment) => {
            const isLiked = likedCommentIds.includes(comment.id);

            return (
              <div
                key={comment.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 transition-colors hover:border-slate-700/80 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs uppercase">
                      {comment.authorName ? comment.authorName.charAt(0) : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {comment.authorName}
                        </span>
                        {comment.favoriteTeam && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-950 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 truncate">
                            ⚾ {comment.favoriteTeam}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span title={formatDate(comment.createdAt)}>
                          {getRelativeTime(comment.createdAt)}
                        </span>
                        <span>•</span>
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Like, Reply, Admin Moderation) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Upvote / Like Button */}
                    <button
                      type="button"
                      onClick={() => handleLikeComment(comment.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isLiked
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                      title={isLiked ? 'Voto registrado' : 'Apoyar este comentario'}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-emerald-400' : ''}`} />
                      <span className="font-mono text-[11px]">{comment.likes || 0}</span>
                    </button>

                    {/* Reply button */}
                    <button
                      type="button"
                      onClick={() => handleReplyClick(comment.authorName)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 transition-colors cursor-pointer"
                      title="Responder a este comentario"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Moderation Controls: Only visible & executable by authenticated admins */}
                    {isAdminAuthenticated && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deletingId === comment.id}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition-colors cursor-pointer"
                        title="Eliminar comentario (Modo Administrador)"
                        aria-label="Eliminar comentario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap pl-10.5">
                  {comment.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
