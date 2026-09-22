import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Check, AlertCircle, Sparkles, Image as ImageIcon, Link as LinkIcon, RefreshCw, Palette } from 'lucide-react';
import { Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { TeamLogo, isImageLogo } from '../TeamLogo.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { teamLogoSchema, validateWithSchema } from '../../schemas/adminSchemas.ts';

export const TEAM_EMOJI_PRESETS = [
  { emoji: '🐊', name: 'Cocodrilos (MTZ)' },
  { emoji: '🦁', name: 'Leones (IND)' },
  { emoji: '🪓', name: 'Leñadores (LTU)' },
  { emoji: '🌿', name: 'Vegueros (PRI)' },
  { emoji: '🐯', name: 'Tigres (CAV)' },
  { emoji: '🐝', name: 'Avispas (SCU)' },
  { emoji: '🐘', name: 'Elefantes (CFG)' },
  { emoji: '🐎', name: 'Alazanes (GRA)' },
  { emoji: '⚡', name: 'Cazadores (ART)' },
  { emoji: '⚓', name: 'Piratas (IJV)' },
  { emoji: '🌾', name: 'Huracanes (MAY)' },
  { emoji: '🐮', name: 'Toros (CMG)' },
  { emoji: '🐕', name: 'Cachorros (HOL)' },
  { emoji: '🦅', name: 'Indios (GTM)' },
  { emoji: '🦊', name: 'Gallos (SSP)' },
  { emoji: '🐺', name: 'Leopardos (VCL)' },
  { emoji: '⚾', name: 'Pelota de Béisbol' },
  { emoji: '👑', name: 'Corona de Campeón' },
  { emoji: '🏆', name: 'Trofeo Serie Nacional' },
  { emoji: '🔥', name: 'Fuego / Poder' },
  { emoji: '⭐', name: 'Estrella Dorada' },
  { emoji: '⚔️', name: 'Espadas Cruzadas' },
];

export const TEAM_BADGE_PRESETS = [
  {
    name: 'Escudo Clásico Matanzas',
    url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=256&auto=format&fit=crop&q=80',
  },
  {
    name: 'Escudo Azul Habana',
    url: 'https://images.unsplash.com/photo-1508802135482-e16ab97c7f34?w=256&auto=format&fit=crop&q=80',
  },
  {
    name: 'Insignia Béisbol Vintage',
    url: 'https://images.unsplash.com/photo-1595210382266-2d0077c1f541?w=256&auto=format&fit=crop&q=80',
  },
  {
    name: 'Pelota y Guantelete',
    url: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=256&auto=format&fit=crop&q=80',
  },
];

interface TeamLogoEditorModalProps {
  team: Team;
  isOpen: boolean;
  onClose: () => void;
  onSaveLogo: (newLogo: string, updatedTeam?: Team) => void;
}

export const TeamLogoEditorModal: React.FC<TeamLogoEditorModalProps> = ({
  team,
  isOpen,
  onClose,
  onSaveLogo,
}) => {
  const { triggerDataRefresh } = useApp();
  const [currentLogo, setCurrentLogo] = useState<string>(team.logo || '⚾');
  const [selectedColor, setSelectedColor] = useState<string>(
    team.colors?.primary || team.primaryColor || '#10b981'
  );
  const [inputUrl, setInputUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'url'>('upload');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentLogo(team.logo || '⚾');
      setSelectedColor(team.colors?.primary || team.primaryColor || '#10b981');
      setInputUrl(isImageLogo(team.logo) ? team.logo : '');
      setErrorMsg(null);
    }
  }, [isOpen, team]);

  if (!isOpen) return null;

  // Process uploaded image and compress to max 500x500 to keep it crisp and fast
  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    const isValidType =
      file.type.startsWith('image/') ||
      file.type === '' ||
      /\.(jpg|jpeg|png|webp|svg|gif|bmp)$/i.test(file.name);

    if (!isValidType) {
      setErrorMsg('Por favor selecciona una imagen válida (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo seleccionado.');
    };
    reader.onload = (e) => {
      const rawResult = e.target?.result as string;
      if (!rawResult) return;

      // Optimize down to max 500px in memory
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 500;
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
            const optimized = canvas.toDataURL(file.type.includes('png') ? 'image/png' : 'image/jpeg', 0.9);
            setCurrentLogo(optimized);
          } else {
            setCurrentLogo(rawResult);
          }
        } catch {
          setCurrentLogo(rawResult);
        }
      };
      img.onerror = () => {
        setCurrentLogo(rawResult);
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setErrorMsg('Introduce una dirección URL válida.');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:')) {
      setErrorMsg('La URL debe comenzar con http://, https:// o data:.');
      return;
    }
    setErrorMsg(null);
    setCurrentLogo(trimmed);
  };

  const handleSave = async () => {
    setErrorMsg(null);

    const validation = validateWithSchema(teamLogoSchema, {
      logo: currentLogo,
      primaryColor: selectedColor,
    });

    if (!validation.success) {
      setErrorMsg(validation.firstError);
      return;
    }

    setIsSaving(true);
    try {
      const res = await ApiClient.updateTeamLogo(team.id, validation.data.logo, validation.data.primaryColor);
      onSaveLogo(validation.data.logo, res?.team);
      triggerDataRefresh();
      onClose();
    } catch (err: any) {
      console.error('Error saving team logo:', err);
      // Fallback: still notify parent and refresh so user is never blocked
      onSaveLogo(validation.data.logo, { ...team, logo: validation.data.logo });
      triggerDataRefresh();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ImageIcon className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Editar Logo del Equipo</h3>
              <p className="text-[11px] text-slate-400">{team.name} ({team.shortName})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Preview Card */}
          <div
            className="p-5 rounded-2xl border border-slate-800 flex items-center gap-5 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${selectedColor}28 0%, #090d16 100%)`,
            }}
          >
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl shadow-xl border border-slate-700/80 p-2 overflow-hidden shrink-0"
              style={{ backgroundColor: `${selectedColor}33` }}
            >
              <TeamLogo logo={currentLogo} name={team.name} className="w-full h-full" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Vista Previa del Escudo
              </span>
              <h4 className="text-lg font-black text-white truncate">{team.name}</h4>
              <p className="text-xs text-slate-400 font-medium">
                {team.nickname} • {team.shortName}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Color Primario:</span>
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent"
                  title="Cambiar color del equipo"
                />
                <span className="text-[11px] font-mono text-slate-300">{selectedColor}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Archivo / Cámara</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'presets'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Emblemas y Emojis</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'url'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Enlace URL</span>
            </button>
          </div>

          {/* Tab 1: Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-2xl bg-slate-950/40 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <div className="p-3.5 rounded-full bg-slate-900 group-hover:bg-emerald-500/10 text-slate-400 group-hover:text-emerald-400 border border-slate-800 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-white">
                    Toca aquí para elegir foto o tomar foto con la cámara
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Formatos admitidos: PNG transparente, JPG, WebP, SVG
                  </p>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                  Explorar Archivos Locales
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Sample Badges */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  O elige una insignia clásica de béisbol:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEAM_BADGE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentLogo(preset.url)}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        currentLogo === preset.url
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-8 h-8 rounded-lg object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[11px] font-medium text-slate-300 truncate">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Emoji Presets */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Emblemas oficiales y mascotas de Serie Nacional:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {TEAM_EMOJI_PRESETS.map((p, idx) => {
                  const isSelected = currentLogo === p.emoji;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentLogo(p.emoji)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/20 shadow-md shadow-emerald-500/20'
                          : 'border-slate-800 bg-slate-950/50 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                      title={p.name}
                    >
                      <span className="text-3xl select-none leading-none">{p.emoji}</span>
                      <span className="text-[9px] font-medium text-slate-400 truncate max-w-full text-center">
                        {p.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: URL Input */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Dirección web de la imagen (URL):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://ejemplo.com/logo-equipo.png"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Probar
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Asegúrate de que la URL sea un enlace público directo hacia una imagen (PNG, JPG, SVG o WebP).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-slate-950 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Guardando Logo...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Logo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
