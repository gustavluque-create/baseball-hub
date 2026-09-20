import React, { useState, useEffect } from 'react';
import { Newspaper, Plus, Trash2, CheckCircle2, RefreshCw, X, Save } from 'lucide-react';
import { NewsArticle } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

export const AdminNewsManager: React.FC = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Crónica');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('Prensa Oficial Béisbol Hub');

  const fetchNews = async () => {
    setLoading(true);
    try {
      const fetched = await ApiClient.getNews({ limit: 50 });
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

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !excerpt.trim()) {
      alert('Complete el título y el resumen de la noticia.');
      return;
    }

    try {
      const created = await ApiClient.createAdminNews({
        title,
        category,
        excerpt,
        content: content || excerpt,
        author,
        publishedAt: new Date().toISOString(),
      });
      setNews((prev) => [created, ...prev]);
      setIsCreating(false);
      setTitle('');
      setExcerpt('');
      setContent('');
      showMessage('Noticia publicada exitosamente.');
    } catch (err: any) {
      alert(`Error al publicar noticia: ${err.message}`);
    }
  };

  const handleDeleteNews = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar la noticia "${title}"?`)) return;
    try {
      await ApiClient.deleteAdminNews(id);
      setNews((prev) => prev.filter((n) => n.id !== id));
      showMessage('Noticia eliminada correctamente.');
    } catch (err: any) {
      alert(`Error al eliminar noticia: ${err.message}`);
    }
  };

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  return (
    <div className="space-y-6">
      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-black text-slate-100 uppercase tracking-wider">
            Publicación de Noticias &amp; Boletines ({news.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNews}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Recargar noticias"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Redactar Noticia</span>
          </button>
        </div>
      </div>

      {/* Create News Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateNews}
          className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-emerald-400" />
              <span>Nueva Publicación Editorial</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Titular Principal</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Industriales y Matanzas definen liderato..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
              >
                <option value="Crónica">Crónica</option>
                <option value="Entrevista">Entrevista</option>
                <option value="Estadísticas">Estadísticas</option>
                <option value="Ligas Extranjeras">Ligas Extranjeras</option>
                <option value="Récords">Récords</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Resumen (Copete)</label>
            <textarea
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Breve sumario descriptivo para las portadas..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Contenido de la Noticia</label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cuerpo completo del artículo o comunicado oficial..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Publicar Noticia</span>
            </button>
          </div>
        </form>
      )}

      {/* News List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {news.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex flex-col justify-between transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase">
                  {item.category}
                </span>
                <span className="text-slate-500 font-mono">
                  {new Date(item.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-100 line-clamp-2">{item.title}</h4>
              <p className="text-xs text-slate-400 line-clamp-2">{item.excerpt}</p>
            </div>

            <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
              <span>{item.author}</span>
              <button
                onClick={() => handleDeleteNews(item.id, item.title)}
                className="p-1 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                title="Eliminar noticia"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
