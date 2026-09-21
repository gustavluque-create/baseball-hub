import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, User, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { ArticleComment } from '../types/index.ts';
import { ApiClient } from '../services/api.ts';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';

interface ArticleCommentsSectionProps {
  slug: string;
  articleTitle?: string;
}

export const ArticleCommentsSection: React.FC<ArticleCommentsSectionProps> = ({ slug, articleTitle }) => {
  const { isAdminAuthenticated } = useAdminAuth();
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setSubmitting(true);
      setFeedbackMessage(null);
      const newComment = await ApiClient.addArticleComment(slug, {
        authorName: authorName.trim() || 'Aficionado al Béisbol',
        favoriteTeam: favoriteTeam.trim() || undefined,
        content: content.trim(),
      });

      setComments((prev) => [newComment, ...prev]);
      setContent('');
      setFeedbackMessage({
        type: 'success',
        text: '¡Tu comentario se ha publicado correctamente!',
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

  return (
    <section className="mt-12 pt-8 border-t border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Comunidad &amp; Opiniones</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-emerald-400 font-mono border border-slate-700">
                {comments.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Espacio abierto para que los aficionados comenten sobre este artículo.
            </p>
          </div>
        </div>

        {isAdminAuthenticated && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Modo Moderador Admin</span>
          </div>
        )}
      </div>

      {/* Comment Input Form (Available to public consumers) */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Deja tu comentario
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Tu Nombre o Apodo
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              maxLength={40}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-xs placeholder-slate-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Equipo Favorito (Opcional)
            </label>
            <input
              type="text"
              value={favoriteTeam}
              onChange={(e) => setFavoriteTeam(e.target.value)}
              placeholder="Ej. Industriales, Leñadores, etc."
              maxLength={30}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-xs placeholder-slate-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Comentario <span className="text-emerald-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe tu opinión o análisis de la jugada..."
            maxLength={1000}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 text-xs placeholder-slate-500 transition-colors resize-none"
          />
        </div>

        {feedbackMessage && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
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
          <span className="text-[11px] text-slate-500">
            {content.length}/1000 caracteres
          </span>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
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
          <div className="p-8 text-center text-slate-500 text-xs animate-pulse">
            Cargando comentarios...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Aún no hay comentarios</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              ¡Sé el primero en compartir tu opinión sobre este partido o artículo!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5 transition-colors hover:border-slate-700/80"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {comment.authorName ? comment.authorName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        {comment.authorName}
                      </span>
                      {comment.favoriteTeam && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700">
                          {comment.favoriteTeam}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Moderation Controls: Only visible & executable by authenticated admins */}
                {isAdminAuthenticated && (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment.id)}
                    disabled={deletingId === comment.id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Eliminar comentario (Modo Administrador)"
                    aria-label="Eliminar comentario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-9">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
