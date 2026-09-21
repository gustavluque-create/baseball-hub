import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  Sliders,
  Sparkles,
  RotateCcw,
  Check,
  Image as ImageIcon,
  ZoomIn,
  SunMedium,
  Move,
  Link,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Player } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { useApp } from '../../context/AppContext.tsx';

// Curated authentic athletic baseball headshot presets for 1-click fallback
export const BASEBALL_PHOTO_PRESETS = [
  {
    id: 'p1',
    label: 'Bateador Derecho',
    url: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'p2',
    label: 'Lanzador Abridor',
    url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'p3',
    label: 'Receptor / Catcher',
    url: 'https://images.unsplash.com/photo-1508802271844-3388657d4722?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'p4',
    label: 'Jardinero Central',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'p5',
    label: 'Cuadro / Infielder',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'p6',
    label: 'Lanzador Zurdo',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'p7',
    label: 'Bateador Emergente',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'p8',
    label: 'Estrella Veterana',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=320&auto=format&fit=crop&q=80',
  },
];

interface PlayerImageEditorModalProps {
  player?: Player | null;
  initialImageUrl?: string;
  isOpen: boolean;
  onClose: () => void;
  onSavePhoto: (photoUrl: string, updatedPlayer?: Player) => void;
}

export const PlayerImageEditorModal: React.FC<PlayerImageEditorModalProps> = ({
  player,
  initialImageUrl,
  isOpen,
  onClose,
  onSavePhoto,
}) => {
  const { triggerDataRefresh } = useApp();
  const currentInitial = initialImageUrl || player?.photo || BASEBALL_PHOTO_PRESETS[0].url;

  const [imageUrl, setImageUrl] = useState<string>(currentInitial);
  const [inputUrl, setInputUrl] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [filterStyle, setFilterStyle] = useState<'none' | 'bw' | 'vintage' | 'vibrant'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'adjust' | 'presets' | 'url'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      const src = initialImageUrl || player?.photo || BASEBALL_PHOTO_PRESETS[0].url;
      setImageUrl(src);
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      setBrightness(100);
      setContrast(100);
      setFilterStyle('none');
      setErrorMsg(null);
      setInputUrl('');
    }
  }, [isOpen, player, initialImageUrl]);

  if (!isOpen) return null;

  // Handle image upload with auto-downsampling to prevent mobile memory exhaustion and 413 errors
  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    const isValid =
      file.type.startsWith('image/') ||
      file.type === '' ||
      /\.(jpg|jpeg|png|webp|svg|gif|bmp|heic)$/i.test(file.name);

    if (!isValid) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo en este dispositivo.');
    };
    reader.onload = (e) => {
      const rawResult = e.target?.result as string;
      if (!rawResult) return;

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimized = canvas.toDataURL('image/jpeg', 0.88);
            setImageUrl(optimized);
          } else {
            setImageUrl(rawResult);
          }
        } catch {
          setImageUrl(rawResult);
        }
        setScale(1);
        setOffsetX(0);
        setOffsetY(0);
        setActiveTab('adjust');
      };
      img.onerror = () => {
        setImageUrl(rawResult);
        setScale(1);
        setOffsetX(0);
        setOffsetY(0);
        setActiveTab('adjust');
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Render cropped and filtered image into clean square canvas (~360x360) with safety timeout
  const generateEditedDataUrl = (): Promise<string> => {
    // If no adjustments made, return immediately
    const noEdits =
      scale === 1 &&
      offsetX === 0 &&
      offsetY === 0 &&
      brightness === 100 &&
      contrast === 100 &&
      filterStyle === 'none';

    if (noEdits && (imageUrl.startsWith('data:') || imageUrl.startsWith('http'))) {
      return Promise.resolve(imageUrl);
    }

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (res: string) => {
        if (!resolved) {
          resolved = true;
          resolve(res);
        }
      };

      // 3.5s timeout safety against hanging images
      const timer = setTimeout(() => finish(imageUrl), 3500);

      const img = new Image();
      const isDataOrBlob = imageUrl.startsWith('data:') || imageUrl.startsWith('blob:');
      if (!isDataOrBlob) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        clearTimeout(timer);
        try {
          const size = 360;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            finish(imageUrl);
            return;
          }

          // Apply filters
          let filterStr = `brightness(${brightness}%) contrast(${contrast}%)`;
          if (filterStyle === 'bw') filterStr += ' grayscale(100%)';
          if (filterStyle === 'vintage') filterStr += ' sepia(50%) contrast(110%)';
          if (filterStyle === 'vibrant') filterStr += ' saturate(140%) contrast(105%)';
          ctx.filter = filterStr;

          // Draw image with scale and offset
          const aspect = img.width / img.height;
          let drawW = size * scale;
          let drawH = size * scale;

          if (aspect > 1) {
            drawW = size * aspect * scale;
          } else {
            drawH = (size / aspect) * scale;
          }

          const drawX = (size - drawW) / 2 + offsetX * (size / 100);
          const drawY = (size - drawH) / 2 + offsetY * (size / 100);

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          finish(dataUrl);
        } catch (err) {
          console.warn('Canvas export fallback, using raw imageUrl:', err);
          finish(imageUrl);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        console.warn('Image load failed in canvas, using original url');
        finish(imageUrl);
      };

      img.src = imageUrl;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const finalPhoto = await generateEditedDataUrl();

      let updatedPlayer: Player | undefined;
      if (player?.id) {
        try {
          const res = await ApiClient.updatePlayerPhoto(player.id, finalPhoto);
          if (res?.player) {
            updatedPlayer = res.player;
          }
        } catch (photoErr: any) {
          console.warn('Backend updatePlayerPhoto returned error, trying fallback:', photoErr);
          if (ApiClient.getAdminToken()) {
            try {
              updatedPlayer = await ApiClient.updateAdminPlayer(player.id, { photo: finalPhoto });
            } catch (adminErr) {
              console.warn('Admin update failed:', adminErr);
            }
          }
        }
      }

      onSavePhoto(finalPhoto, updatedPlayer || (player ? { ...player, photo: finalPhoto } : undefined));
      triggerDataRefresh();
      onClose();
    } catch (err: any) {
      console.error('Error al guardar foto:', err);
      // Fallback: apply locally so user is not blocked
      onSavePhoto(imageUrl, player ? { ...player, photo: imageUrl } : undefined);
      triggerDataRefresh();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyUrl = () => {
    if (!inputUrl.trim()) return;
    setImageUrl(inputUrl.trim());
    setActiveTab('adjust');
  };

  // Filter style CSS for live preview
  const getFilterCSS = () => {
    let css = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (filterStyle === 'bw') css += ' grayscale(100%)';
    if (filterStyle === 'vintage') css += ' sepia(50%) contrast(110%)';
    if (filterStyle === 'vibrant') css += ' saturate(140%) contrast(105%)';
    return css;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="player-image-editor-modal"
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>Editor &amp; Subida de Fotografía</span>
              </h2>
              <p className="text-xs text-slate-400">
                {player ? (
                  <>
                    Ajustando imagen de <strong className="text-slate-200">{player.fullName}</strong> (#{player.jerseyNumber} - {player.teamShort})
                  </>
                ) : (
                  'Configurar fotografía oficial del jugador'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left: Live Previews */}
            <div className="md:col-span-5 flex flex-col items-center gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vista Previa en Tiempo Real</span>
              </div>

              {/* Main Interactive Stage */}
              <div className="relative w-48 h-48 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-slate-900 shadow-inner group flex items-center justify-center">
                <div
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                  style={{ filter: getFilterCSS() }}
                >
                  <img
                    src={imageUrl}
                    alt="Player preview"
                    className="w-full h-full object-cover transition-transform duration-75"
                    style={{
                      transform: `scale(${scale}) translate(${offsetX}%, ${offsetY}%)`,
                    }}
                    referrerPolicy="no-referrer"
                    onError={() => {
                      setImageUrl(BASEBALL_PHOTO_PRESETS[0].url);
                      setErrorMsg('No se pudo cargar la imagen indicada; se aplicó preset de respaldo.');
                    }}
                  />
                </div>

                {/* Framing guides overlay */}
                <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl">
                  <div className="w-full h-full border border-dashed border-emerald-400/20 rounded-full" />
                </div>
              </div>

              {/* Multiple aspect previews */}
              <div className="flex items-center justify-center gap-6 w-full pt-2 border-t border-slate-800/60">
                {/* Circular Badge Preview */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-400 shadow-md bg-slate-900 flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="Circular avatar"
                      className="w-full h-full object-cover"
                      style={{
                        filter: getFilterCSS(),
                        transform: `scale(${scale}) translate(${offsetX}%, ${offsetY}%)`,
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">Alineación</span>
                </div>

                {/* Profile Card Preview */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-16 h-20 rounded-xl overflow-hidden border border-slate-700 shadow-md bg-slate-900 relative">
                    <img
                      src={imageUrl}
                      alt="Card avatar"
                      className="w-full h-full object-cover"
                      style={{
                        filter: getFilterCSS(),
                        transform: `scale(${scale}) translate(${offsetX}%, ${offsetY}%)`,
                      }}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-1">
                      <span className="text-[9px] font-bold text-amber-400 block truncate">
                        #{player?.jerseyNumber || 23}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">Ficha Perfil</span>
                </div>
              </div>
            </div>

            {/* Right: Tabs & Editing Controls */}
            <div className="md:col-span-7 space-y-4">
              {/* Navigation Subtabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`py-2 px-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'upload'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Subir Archivo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('adjust')}
                  className={`py-2 px-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'adjust'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ajustes &amp; Zoom
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className={`py-2 px-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'presets'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Galería Oficial
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('url')}
                  className={`py-2 px-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'url'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Por URL
                </button>
              </div>

              {/* TAB 1: FILE UPLOAD (DRAG & DROP + NATIVE FILE PICKER) */}
              {activeTab === 'upload' && (
                <div className="space-y-3">
                  <label
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-2xl p-6 sm:p-8 text-center bg-slate-950/40 hover:bg-slate-950/80 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group block overflow-hidden"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors pointer-events-none">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div className="pointer-events-none">
                      <p className="text-xs font-bold text-slate-200">
                        Arrastra una foto aquí o toca para seleccionar
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Toca para abrir cámara o galería (JPG, PNG, WEBP, SVG)
                      </p>
                    </div>
                    <span className="px-4 py-2 rounded-xl bg-slate-800 group-hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors shadow-sm pointer-events-none inline-flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-emerald-400" />
                      <span>Elegir archivo o tomar foto</span>
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    💡 <em>Las fotos son optimizadas y recortadas automáticamente para lucir impecables en el perfil del jugador.</em>
                  </p>
                </div>
              )}

              {/* TAB 2: ADJUSTMENTS, ZOOM & FILTERS */}
              {activeTab === 'adjust' && (
                <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  {/* Zoom Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Escala / Zoom</span>
                      </span>
                      <span className="text-emerald-400 font-mono text-[11px] font-bold">
                        {scale.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="2.5"
                      step="0.05"
                      value={scale}
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Offset Sliders (Pan X & Y) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Move className="w-3 h-3 text-slate-500" />
                          <span>Desplazar X</span>
                        </span>
                        <span className="font-mono">{offsetX}%</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="1"
                        value={offsetX}
                        onChange={(e) => setOffsetX(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Move className="w-3 h-3 text-slate-500" />
                          <span>Desplazar Y</span>
                        </span>
                        <span className="font-mono">{offsetY}%</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="1"
                        value={offsetY}
                        onChange={(e) => setOffsetY(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Brightness & Contrast */}
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <SunMedium className="w-3 h-3 text-amber-400" />
                          <span>Brillo</span>
                        </span>
                        <span className="font-mono">{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="140"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Sliders className="w-3 h-3 text-purple-400" />
                          <span>Contraste</span>
                        </span>
                        <span className="font-mono">{contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="70"
                        max="150"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Filter Presets */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    <label className="text-[11px] font-bold text-slate-400">Filtro de Imagen</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'none', label: 'Original' },
                        { id: 'vibrant', label: 'Vívido' },
                        { id: 'vintage', label: 'Sepia' },
                        { id: 'bw', label: 'B & N' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFilterStyle(f.id as any)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                            filterStyle === f.id
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setScale(1);
                      setOffsetX(0);
                      setOffsetY(0);
                      setBrightness(100);
                      setContrast(100);
                      setFilterStyle('none');
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restablecer ajustes de encuadre</span>
                  </button>
                </div>
              )}

              {/* TAB 3: PRESETS GALLERY */}
              {activeTab === 'presets' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Selecciona un retrato deportivo de béisbol de alta calidad:
                  </p>
                  <div className="grid grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                    {BASEBALL_PHOTO_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setImageUrl(preset.url);
                          setActiveTab('adjust');
                        }}
                        className={`group relative rounded-xl overflow-hidden border p-1 transition-all text-left ${
                          imageUrl === preset.url
                            ? 'border-emerald-400 ring-2 ring-emerald-500/40 bg-emerald-500/10'
                            : 'border-slate-800 hover:border-slate-600 bg-slate-950'
                        }`}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden bg-slate-900 mb-1">
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-300 block truncate">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: DIRECT URL INPUT */}
              {activeTab === 'url' && (
                <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <label className="block text-xs font-bold text-slate-300">
                    Dirección Web de la Imagen (URL)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="https://ejemplo.com/fotos/jugador.jpg"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyUrl}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0"
                    >
                      Cargar
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Acepta enlaces directos de CDN, agencias de noticias, fotos oficiales o Unsplash.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Procesando y Guardando...' : 'Aplicar y Guardar Foto'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
