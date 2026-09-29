import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  X,
  Edit2,
  Star,
  Search,
  MessageSquare,
  Share2,
  Check,
  Eye,
  Calendar,
  Clock,
  User,
  Flame,
  Layers,
} from 'lucide-react';
import { NewsArticle } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { AdminNewsEditorModal } from './AdminNewsEditorModal.tsx';
import { AdminNewsCommentsModal } from './AdminNewsCommentsModal.tsx';
import { useApp } from '../../context/AppContext.tsx';

export const AdminNewsManager: React.FC = () => {
  const { navigateToNews } = useApp();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterSliderOnly, setFilterSliderOnly] = useState(false);

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [commentsModalArticle, setCommentsModalArticle] = useState<NewsArticle | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const fetched = await ApiClient.getNews({ limit: 100 });
      setNews(fetched);
    } catch (err: any) {
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // One-click toggle for Featured / Slider status
  const handleToggleFeatured = async (article: NewsArticle) => {
    const newStatus = !article.isFeatured;
    // Optimistic UI update
    setNews((prev) =>
      prev.map((item) => (item.id === article.id ? { ...item, isFeatured: newStatus } : item))
    );

    try {
      const updated = await ApiClient.updateAdminNews(article.id, {
        isFeatured: newStatus,
      });
      setNews((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      showMessage(
        newStatus
          ? `⭐ "${article.title}" fijada en el slider superior.`
          : `"${article.title}" retirada del slider superior.`
      );
    } catch (err: any) {
      // Revert on error
      setNews((prev) =>
        prev.map((item) => (item.id === article.id ? { ...item, isFeatured: article.isFeatured } : item))
      );
      alert(`Error al actualizar estado en slider: ${err.message}`);
    }
  };

  const handleDeleteNews = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar permanentemente la noticia "${title}"?`)) return;
    try {
      await ApiClient.deleteAdminNews(id);
      setNews((prev) => prev.filter((n) => n.id !== id));
      showMessage('Noticia eliminada correctamente de la base de datos.');
    } catch (err: any) {
      alert(`Error al eliminar noticia: ${err.message}`);
    }
  };

  const handleSavedArticle = (saved: NewsArticle) => {
    setNews((prev) => {
      const exists = prev.some((n) => n.id === saved.id);
      if (exists) {
        return prev.map((n) => (n.id === saved.id ? saved : n));
      }
      return [saved, ...prev];
    });
    showMessage(`Artículo "${saved.title}" guardado exitosamente.`);
  };

  const handleCopyLink = (e: React.MouseEvent, article: NewsArticle) => {
    e.stopPropagation();
    const url = `${window.location.origin}/${article.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(article.id);
      showMessage('Enlace copiado al portapapeles.');
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Distinct categories
  const categories = Array.from(new Set(news.map((n) => n.category).filter(Boolean)));

  // Filtered news
  const filteredNews = news.filter((item) => {
    if (filterSliderOnly && !item.isFeatured) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.excerpt && item.excerpt.toLowerCase().includes(q)) ||
        (item.author && item.author.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalInSlider = news.filter((n) => n.isFeatured).length;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total de Artículos</span>
            <span className="text-xl font-black text-white font-mono">{news.length}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Star className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Destacadas en Slider Superior</span>
            <span className="text-xl font-black text-amber-400 font-mono">{totalInSlider}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Secciones Editoriales</span>
            <span className="text-xl font-black text-white font-mono">{categories.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xs font-black text-slate-100 uppercase tracking-wider">
              Gestor de Prensa y Artículos Editoriales
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchNews}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
              title="Recargar noticias"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setEditingArticle(null);
                setIsEditorOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Redactar Noticia</span>
            </button>
          </div>
        </div>

        {/* Search, Category Filter & Slider Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, autor o tema..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setFilterSliderOnly(!filterSliderOnly)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                filterSliderOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${filterSliderOnly ? 'fill-amber-400' : ''}`} />
              <span>{filterSliderOnly ? 'Mostrando: Solo en Slider' : 'Filtrar: Solo en Slider'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Articles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNews.length === 0 ? (
          <div className="md:col-span-2 p-10 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
            No se encontraron publicaciones con los criterios de búsqueda.
          </div>
        ) : (
          filteredNews.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                item.isFeatured
                  ? 'bg-slate-900 border-amber-500/30 shadow-md ring-1 ring-amber-500/20'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header: Thumbnail, Category & Slider Star */}
              <div className="flex gap-3">
                <div className="relative w-24 h-24 sm:w-28 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-slate-950 border border-slate-800">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {item.isFeatured && (
                    <span className="absolute top-1 left-1 p-1 rounded-md bg-amber-500/90 text-slate-950 shadow">
                      <Star className="w-3 h-3 fill-slate-950" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                      {item.category}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h3>

                  {item.subtitle && (
                    <p className="text-xs text-slate-400 line-clamp-1 italic">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Excerpt */}
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {item.excerpt}
              </p>

              {/* Metadata & Actions Row */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="truncate max-w-[120px]">{item.author}</span>
                  </span>
                  <span>•</span>
                  <span>{item.readingTimeMinutes || 4} min</span>
                </div>

                {/* Buttons Bar */}
                <div className="flex items-center gap-1.5">
                  {/* Pin to Slider button */}
                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(item)}
                    className={`p-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      item.isFeatured
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                    }`}
                    title={item.isFeatured ? 'Quitar del Slider de Portada' : 'Fijar en el Slider de Portada'}
                  >
                    <Star className={`w-3.5 h-3.5 ${item.isFeatured ? 'fill-amber-400' : ''}`} />
                  </button>

                  {/* Comments button */}
                  <button
                    type="button"
                    onClick={() => setCommentsModalArticle(item)}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    title="Moderar comentarios de los lectores"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Share link button */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(e, item)}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    title="Copiar URL del artículo"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingArticle(item);
                      setIsEditorOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors cursor-pointer"
                    title="Editar noticia"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteNews(item.id, item.title)}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
                    title="Eliminar noticia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor Modal (Create / Edit) */}
      {isEditorOpen && (
        <AdminNewsEditorModal
          article={editingArticle}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingArticle(null);
          }}
          onSaved={handleSavedArticle}
        />
      )}

      {/* Comments Moderation Modal */}
      {commentsModalArticle && (
        <AdminNewsCommentsModal
          article={commentsModalArticle}
          onClose={() => setCommentsModalArticle(null)}
        />
      )}
    </div>
  );
};
