import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Camera,
  Users,
  Star,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import { Player, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { playerEditSchema, validateWithSchema } from '../../schemas/adminSchemas.ts';
import { PlayerImageEditorModal } from './PlayerImageEditorModal.tsx';

interface PlayerEditModalProps {
  player: Player | null;
  teams: Team[];
  allPlayers?: Player[];
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedPlayer: Player) => void;
}

export const PlayerEditModal: React.FC<PlayerEditModalProps> = ({
  player,
  teams,
  allPlayers = [],
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState(0);
  const [position, setPosition] = useState('OF');
  const [bats, setBats] = useState<'R' | 'L' | 'S'>('R');
  const [throws, setThrows] = useState<'R' | 'L'>('R');
  const [photo, setPhoto] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState(25);
  const [height, setHeight] = useState('1.85 m');
  const [weight, setWeight] = useState('85 kg');
  const [isStar, setIsStar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);

  useEffect(() => {
    if (player) {
      setFullName(player.fullName || '');
      setTeamId(player.teamId || (teams[0] ? teams[0].id : ''));
      setJerseyNumber(player.jerseyNumber || 0);
      setPosition(player.position || 'OF');
      setBats(player.bats || 'R');
      setThrows(player.throws || 'R');
      setPhoto(player.photo || '');
      setBio(player.bio || '');
      setAge(player.age || 25);
      setHeight(player.height || '1.85 m');
      setWeight(player.weight || '85 kg');
      setIsStar(!!(player as any).isStar);
      setErrorMsg(null);
      setFieldErrors({});
    }
  }, [player, teams]);

  if (!isOpen || !player) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMsg(null);

    const validationResult = validateWithSchema(playerEditSchema, {
      fullName: fullName.trim(),
      teamId,
      jerseyNumber: Number(jerseyNumber),
      position,
      bats,
      throws,
      photo: photo || player.photo || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=256',
      bio: bio.trim(),
      age: Number(age),
      height: height.trim(),
      weight: weight.trim(),
      isStar,
    });

    if (!validationResult.success) {
      setFieldErrors(validationResult.errors);
      setErrorMsg(validationResult.firstError);
      return;
    }

    // Check 40-player limit if player is changing team
    if (teamId !== player.teamId) {
      const destPlayers = allPlayers.filter((p) => p.teamId === teamId && p.id !== player.id);
      if (destPlayers.length >= 40) {
        const destTeam = teams.find((t) => t.id === teamId);
        setErrorMsg(`El equipo ${destTeam?.name || 'de destino'} ya cuenta con el límite reglamentario de 40 jugadores.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const updated = await ApiClient.updateAdminPlayer(player.id, validationResult.data as any);

      onSaveSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Error al actualizar el jugador: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          id="player-edit-modal"
          className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  Editar Jugador: {player.fullName}
                </h2>
                <p className="text-xs text-slate-400">
                  Modifica su fotografía oficial, datos del roster y posición
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

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Photo Section with quick upload/edit button */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-slate-900 shadow-md">
                  <img
                    src={photo}
                    alt={fullName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsImageEditorOpen(true)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl flex flex-col items-center justify-center text-white text-[11px] font-bold transition-opacity cursor-pointer gap-1"
                >
                  <Camera className="w-5 h-5 text-emerald-400" />
                  <span>Cambiar</span>
                </button>
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2">
                <h4 className="text-xs font-bold text-slate-200">
                  Fotografía Oficial del Jugador
                </h4>
                <p className="text-[11px] text-slate-400">
                  Puedes subir una imagen desde tu dispositivo, recortarla, aplicar filtros o elegir una foto oficial.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsImageEditorOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Subir o Editar Fotografía</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImageEditorOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Ajustar Encuadre / Filtros</span>
                  </button>
                </div>
              </div>
            </div>

            {/* General Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.fullName;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 focus:outline-none transition-colors ${
                    fieldErrors.fullName
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-slate-800 focus:border-emerald-500'
                  }`}
                  required
                />
                {fieldErrors.fullName && (
                  <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Equipo *
                </label>
                <select
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    if (fieldErrors.teamId) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.teamId;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 font-semibold focus:outline-none transition-colors ${
                    fieldErrors.teamId
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-slate-800 focus:border-emerald-500'
                  }`}
                >
                  {teams.map((t) => {
                    const count = allPlayers.filter((p) => p.teamId === t.id && p.id !== player.id).length;
                    const isFull = count >= 40 && t.id !== player.teamId;
                    return (
                      <option key={t.id} value={t.id} disabled={isFull}>
                        {t.name} ({t.shortName}) — {count}/40 {isFull ? '• [Lleno]' : ''}
                      </option>
                    );
                  })}
                </select>
                {fieldErrors.teamId && (
                  <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.teamId}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Número de Camiseta &amp; Posición
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={jerseyNumber}
                    onChange={(e) => {
                      setJerseyNumber(Number(e.target.value));
                      if (fieldErrors.jerseyNumber) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.jerseyNumber;
                          return next;
                        });
                      }
                    }}
                    className={`w-20 px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 font-mono focus:outline-none transition-colors ${
                      fieldErrors.jerseyNumber
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-slate-800 focus:border-emerald-500'
                    }`}
                  />
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="P">P (Lanzador)</option>
                    <option value="C">C (Receptor)</option>
                    <option value="1B">1B (Primera Base)</option>
                    <option value="2B">2B (Segunda Base)</option>
                    <option value="3B">3B (Tercera Base)</option>
                    <option value="SS">SS (Torpedero)</option>
                    <option value="OF">OF (Jardinero)</option>
                    <option value="LF">LF (Jardín Izquierdo)</option>
                    <option value="CF">CF (Jardín Central)</option>
                    <option value="RF">RF (Jardín Derecho)</option>
                    <option value="DH">DH (Designado)</option>
                  </select>
                </div>
                {fieldErrors.jerseyNumber && (
                  <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.jerseyNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Bateo, Lanzamiento &amp; Estrella
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={bats}
                    onChange={(e) => setBats(e.target.value as any)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="R">Batea: Der</option>
                    <option value="L">Batea: Zur</option>
                    <option value="S">Batea: Amb</option>
                  </select>
                  <select
                    value={throws}
                    onChange={(e) => setThrows(e.target.value as any)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="R">Lanza: Der</option>
                    <option value="L">Lanza: Zur</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-amber-400 cursor-pointer pl-1">
                    <input
                      type="checkbox"
                      checked={isStar}
                      onChange={(e) => setIsStar(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Estrella</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Edad &amp; Estatura
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => {
                        setAge(Number(e.target.value));
                        if (fieldErrors.age) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.age;
                            return next;
                          });
                        }
                      }}
                      placeholder="Edad"
                      className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 focus:outline-none transition-colors ${
                        fieldErrors.age
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-slate-800 focus:border-emerald-500'
                      }`}
                    />
                    {fieldErrors.age && (
                      <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.age}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={height}
                      onChange={(e) => {
                        setHeight(e.target.value);
                        if (fieldErrors.height) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.height;
                            return next;
                          });
                        }
                      }}
                      placeholder="Estatura (ej. 1.85 m)"
                      className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 focus:outline-none transition-colors ${
                        fieldErrors.height
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-slate-800 focus:border-emerald-500'
                      }`}
                    />
                    {fieldErrors.height && (
                      <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.height}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Peso
                </label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value);
                    if (fieldErrors.weight) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.weight;
                        return next;
                      });
                    }
                  }}
                  placeholder="Peso (ej. 88 kg)"
                  className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 focus:outline-none transition-colors ${
                    fieldErrors.weight
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                {fieldErrors.weight && (
                  <p className="text-[10px] text-red-400 font-semibold mt-1">{fieldErrors.weight}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Biografía Deportiva / Notas
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Trayectoria en Series Nacionales, equipo Cuba, reconocimientos..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Guardando Cambios...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Image Editor Submodal */}
      <PlayerImageEditorModal
        player={player}
        initialImageUrl={photo}
        isOpen={isImageEditorOpen}
        onClose={() => setIsImageEditorOpen(false)}
        onSavePhoto={(newPhotoUrl, updatedP) => {
          setPhoto(newPhotoUrl);
          if (updatedP) {
            onSaveSuccess(updatedP);
          }
        }}
      />
    </>
  );
};
