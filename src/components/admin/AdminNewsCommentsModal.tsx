import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Trash2, CheckCircle2, RefreshCw, Heart, User, Shield } from 'lucide-react';
import { ArticleComment, NewsArticle } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

interface AdminNewsCommentsModalProps {
  article: NewsArticle;
  onClose: () => void;
}

export const AdminNewsCommentsModal: React.FC<AdminNewsCommentsModalProps> = ({
  article,
  onClose,
}) => {
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.getArticleComments(article.slug);
      setComments(res);
    } catch (err: any) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [article.slug]);

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('¿Eliminar este comentario de la publicación?')) return;
    try {
      await ApiClient.deleteArticleComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setActionMessage('Comentario eliminado correctamente.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Error al eliminar comentario: ${err.message}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-white font-black text-sm tracking-wide line-clamp-1">
                Comentarios de Lectores ({comments.length})
              </h3>
              <p className="text-[11px] text-slate-400 line-clamp-1">
                {article.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {actionMessage && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Cargando comentarios...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 text-xs">
              Esta noticia aún no tiene comentarios registrados de la comunidad.
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-2 transition-all"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{comment.authorName || 'Aficionado al Béisbol'}</span>
                    </span>
                    {comment.favoriteTeam && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-semibold border border-slate-700">
                        {comment.favoriteTeam}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pl-5 border-l-2 border-slate-800">
                  {comment.content}
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span>{comment.likes || 0} votos</span>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                    title="Moderar / Eliminar comentario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
