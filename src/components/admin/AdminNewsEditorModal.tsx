import React, { useState } from 'react';
import {
  X,
  Save,
  Newspaper,
  Image as ImageIcon,
  Flame,
  Star,
  Clock,
  User,
  Tag,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { NewsArticle } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { newsArticleSchema, validateWithSchema } from '../../schemas/adminSchemas.ts';

interface AdminNewsEditorModalProps {
  article?: NewsArticle | null;
  onClose: () => void;
  onSaved: (savedArticle: NewsArticle) => void;
}

// Preset high quality baseball photography
const PRESET_IMAGES = [
  {
    label: 'Swing de Bateo',
    url: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=900&auto=format&fit=crop&q=80',
  },
  {
    label: 'Diamante y Terreno',
    url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
  },
  {
    label: 'Guante y Pelota',
    url: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&auto=format&fit=crop&q=80',
  },
  {
    label: 'Juego Nocturno Luces',
    url: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=800&auto=format&fit=crop&q=80',
  },
  {
    label: 'Acción en Base',
    url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&auto=format&fit=crop&q=80',
  },
  {
    label: 'Lanzador en Movimiento',
    url: 'https://images.unsplash.com/photo-1596727147705-61a532a659bd?w=800&auto=format&fit=crop&q=80',
  },
];

export const AdminNewsEditorModal: React.FC<AdminNewsEditorModalProps> = ({
  article,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(article);

  // Form states
  const [title, setTitle] = useState(article?.title || '');
  const [subtitle, setSubtitle] = useState(article?.subtitle || '');
  const [category, setCategory] = useState(article?.category || 'Crónica');
  const [excerpt, setExcerpt] = useState(article?.excerpt || '');
  const [content, setContent] = useState(article?.content || '');
  const [author, setAuthor] = useState(article?.author || 'Prensa Oficial Béisbol Hub');
  const [image, setImage] = useState(
    article?.image || PRESET_IMAGES[0].url
  );
  const [isFeatured, setIsFeatured] = useState<boolean>(
    article?.isFeatured !== undefined ? article.isFeatured : true
  );
  const [imageHeight, setImageHeight] = useState<'tall' | 'medium' | 'wide' | 'panoramic'>(
    article?.imageHeight || 'tall'
  );
  const [tagsInput, setTagsInput] = useState(
    article?.tags ? article.tags.join(', ') : 'Béisbol, Serie Nacional, Pelota Cubana'
  );
  const [readingTime, setReadingTime] = useState<number>(
    article?.readingTimeMinutes || 4
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate reading time based on word count
  const handleAutoEstimateReadingTime = () => {
    const fullText = `${title} ${subtitle} ${excerpt} ${content}`;
    const words = fullText.trim().split(/\s+/).filter(Boolean).length;
    const est = Math.max(1, Math.ceil(words / 180));
    setReadingTime(est);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const validation = validateWithSchema(newsArticleSchema, {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      category: category.trim(),
      excerpt: excerpt.trim(),
      content: (content || excerpt).trim(),
      author: author.trim(),
      image: image.trim() || undefined,
      isFeatured,
      readingTimeMinutes: readingTime,
      imageHeight,
      tags: parsedTags,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      setFormError(validation.firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<NewsArticle> = {
        title: validation.data.title,
        subtitle: validation.data.subtitle,
        category: validation.data.category,
        excerpt: validation.data.excerpt,
        content: validation.data.content,
        author: validation.data.author,
        image: validation.data.image || PRESET_IMAGES[0].url,
        isFeatured,
        imageHeight,
        readingTimeMinutes: readingTime,
        tags: parsedTags.length > 0 ? parsedTags : ['Béisbol'],
        publishedAt: article?.publishedAt || new Date().toISOString(),
      };

      let savedResult: NewsArticle;
      if (isEditing && article) {
        savedResult = await ApiClient.updateAdminNews(article.id, payload);
      } else {
        savedResult = await ApiClient.createAdminNews(payload);
      }

      onSaved(savedResult);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el artículo periodístico.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Newspaper className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-white font-black text-sm tracking-wide">
                {isEditing ? 'Editar Noticia / Publicación' : 'Redactar Nueva Noticia Editorial'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Aparecerá en el portal de noticias y en el slider superior de la página principal
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

        {/* Global Validation Error Banner */}
        {formError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Featured in Slider Hero Checkbox Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Star className={`w-5 h-5 ${isFeatured ? 'fill-emerald-400 text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Destacar en el Slider Superior de Noticias
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Al activarlo, este artículo se presentará en formato gigante en el carrusel de cabecera de la página.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFeatured(!isFeatured)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isFeatured ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isFeatured ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Titular Principal (Headline) *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (fieldErrors.title) {
                    setFieldErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.title;
                      return updated;
                    });
                  }
                }}
                placeholder="ej. Matanzas asegura serie ante Industriales con jonrón agónico..."
                className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white font-bold focus:outline-none transition-colors ${
                  fieldErrors.title
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
              {fieldErrors.title && (
                <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="Crónica">Crónica</option>
                <option value="Entrevista">Entrevista</option>
                <option value="Estadísticas">Estadísticas</option>
                <option value="Oficial">Oficial</option>
                <option value="Ligas Extranjeras">Ligas Extranjeras</option>
                <option value="Récords">Récords</option>
                <option value="Opinión">Opinión</option>
              </select>
            </div>
          </div>

          {/* Subtitle / Bajada */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              Subtítulo o Bajada (Opcional)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Un gancho secundario que complementa el titular en el slider..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Excerpt / Resumen */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              Resumen Editorial (Copete) *
            </label>
            <textarea
              rows={2}
              value={excerpt}
              onChange={(e) => {
                setExcerpt(e.target.value);
                if (fieldErrors.excerpt) {
                  setFieldErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.excerpt;
                    return updated;
                  });
                }
              }}
              placeholder="Breve sumario descriptivo que aparecerá en tarjetas y vistas previas..."
              className={`w-full px-3.5 py-2 bg-slate-950 border rounded-xl text-xs text-slate-200 focus:outline-none transition-colors ${
                fieldErrors.excerpt
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-800 focus:border-emerald-500'
              }`}
            />
            {fieldErrors.excerpt && (
              <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.excerpt}</p>
            )}
          </div>

          {/* Full Body Content */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              Cuerpo Completo del Artículo *
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fieldErrors.content) {
                  setFieldErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.content;
                    return updated;
                  });
                }
              }}
              placeholder="Escribe aquí el texto detallado de la crónica o comunicado..."
              className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-slate-100 font-sans leading-relaxed focus:outline-none transition-colors ${
                fieldErrors.content
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-800 focus:border-emerald-500'
              }`}
            />
            {fieldErrors.content && (
              <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.content}</p>
            )}
          </div>

          {/* Image URL, Presets & Live Preview */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Fotografía de Portada
            </span>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                URL de Imagen o Enlace Externo
              </label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Quick Image Presets */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
                Fotos Rápidas Recomendadas:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {PRESET_IMAGES.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setImage(preset.url)}
                    className={`relative rounded-lg overflow-hidden border p-1 text-left transition-all cursor-pointer ${
                      image === preset.url
                        ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-slate-900'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="h-12 w-full rounded overflow-hidden mb-1">
                      <img
                        src={preset.url}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-300 block truncate">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Preview of Selected Image */}
            {image && (
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">
                  Vista Previa de Imagen:
                </span>
                <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-800">
                  <img
                    src={image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-2.5">
                    <span className="text-[11px] text-white font-semibold">
                      {title || 'Título de ejemplo para la imagen'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata: Author, Reading Time, Height, Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Autor / Redactor</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="ej. Yasel Porto / Prensa Béisbol Hub"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-400">Lectura (min)</label>
                <button
                  type="button"
                  onClick={handleAutoEstimateReadingTime}
                  className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                >
                  Auto-calcular
                </button>
              </div>
              <input
                type="number"
                min={1}
                max={60}
                value={readingTime}
                onChange={(e) => setReadingTime(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Altura en Mosaico</label>
              <select
                value={imageHeight}
                onChange={(e) => setImageHeight(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:border-emerald-500 focus:outline-none"
              >
                <option value="tall">Alta (Heroica)</option>
                <option value="medium">Mediana</option>
                <option value="wide">Ancha</option>
                <option value="panoramic">Panorámica</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Etiquetas (Tags)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Separadas por coma..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Publicar Noticia'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
