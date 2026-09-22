import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Users,
  Copy,
  Download,
  Eye,
  Sparkles,
  ArrowRight,
  Database,
  Image as ImageIcon,
} from 'lucide-react';
import { Player, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

const SAMPLE_CSV_PLAYERS = `Nombre,Equipo,Numero,Posicion,Batea,Lanza,FotoURL,Edad,Bio
Yurisbel Gracial,MTZ,47,3B,R,R,https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=256,36,Tercera base estelar con experiencia internacional
Yoelkis Guibert,SCU,7,OF,L,L,https://images.unsplash.com/photo-1546519638-68e109498ffc?w=256,29,Jardinero veloz y bateador de poder de Santiago de Cuba
Frank Camilo Morejón,IND,13,C,R,R,https://images.unsplash.com/photo-1508802271844-3388657d4722?w=256,38,Receptor emblemático de los Azules de la capital
Carlos Juan Viera,LTU,84,P,R,R,https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256,35,Lanzador derecho de alta efectividad y control`;

interface AdminPlayerImportModalProps {
  isOpen: boolean;
  teams: Team[];
  onClose: () => void;
  onImportSuccess: (importedCount: number, message: string) => void;
}

export const AdminPlayerImportModal: React.FC<AdminPlayerImportModalProps> = ({
  isOpen,
  teams,
  onClose,
  onImportSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [rawText, setRawText] = useState(SAMPLE_CSV_PLAYERS);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Simple CSV parser supporting quotes and commas
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Match comma separated while respecting double quotes
      const values: string[] = [];
      let currentVal = '';
      let insideQuotes = false;

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ''));

      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] !== undefined ? values[idx] : '';
      });

      // Normalize common keys
      const normalized: any = {
        id: rowObj.id || rowObj.ID || rowObj.Id || rowObj.playerId || rowObj.PlayerId || undefined,
        fullName:
          rowObj.Nombre ||
          rowObj.nombre ||
          rowObj.fullName ||
          rowObj.playerName ||
          rowObj.player ||
          rowObj.name ||
          rowObj.jugador ||
          '',
        team: rowObj.Equipo || rowObj.equipo || rowObj.team || rowObj.teamShort || rowObj.teamId || '',
        jerseyNumber: Number(rowObj.Numero || rowObj.numero || rowObj.dorsal || rowObj.jersey || rowObj.number || 99),
        position: (rowObj.Posicion || rowObj.posicion || rowObj.position || rowObj.pos || 'OF').toUpperCase(),
        bats: (rowObj.Batea || rowObj.batea || rowObj.bats || 'R').toUpperCase(),
        throws: (rowObj.Lanza || rowObj.lanza || rowObj.throws || 'R').toUpperCase(),
        photo:
          rowObj.FotoURL ||
          rowObj.Foto ||
          rowObj.foto ||
          rowObj.photo ||
          rowObj.imageUrl ||
          'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=256&auto=format&fit=crop&q=80',
        age: Number(rowObj.Edad || rowObj.edad || rowObj.age || 26),
        bio: rowObj.Bio || rowObj.bio || rowObj.biografia || 'Jugador profesional de la Serie Nacional.',
      };

      if (normalized.fullName) {
        rows.push(normalized);
      }
    }
    return rows;
  };

  const parseJSON = (jsonText: string): any[] => {
    const data = JSON.parse(jsonText);
    const arr = Array.isArray(data) ? data : data.players || data.data || data.items || [data];
    return arr.map((item: any) => ({
      id: item.id || item.ID || item.playerId || undefined,
      fullName:
        item.fullName ||
        item.playerName ||
        item.player ||
        item.Nombre ||
        item.nombre ||
        item.name ||
        item.jugador ||
        '',
      team: item.team || item.teamId || item.teamShort || item.Equipo || item.equipo || item.team_short || '',
      jerseyNumber: Number(item.jerseyNumber || item.jersey || item.Numero || item.numero || item.number || item.dorsal || 99),
      position: (item.position || item.pos || item.Posicion || item.posicion || 'OF').toUpperCase(),
      bats: (item.bats || item.batea || item.Batea || 'R').toUpperCase(),
      throws: (item.throws || item.lanza || item.Lanza || 'R').toUpperCase(),
      photo:
        item.photo ||
        item.FotoURL ||
        item.imageUrl ||
        item.Foto ||
        item.foto ||
        'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=256&auto=format&fit=crop&q=80',
      age: Number(item.age || item.Edad || item.edad || 26),
      bio: item.bio || item.Bio || item.biografia || 'Jugador importado.',
    }));
  };

  const handleProcessPreview = (text: string, fmt: 'csv' | 'json') => {
    setParseError(null);
    try {
      let parsed: any[] = [];
      if (fmt === 'csv') {
        parsed = parseCSV(text);
      } else {
        parsed = parseJSON(text);
      }

      if (parsed.length === 0) {
        setParseError('No se encontraron registros de jugadores válidos en el archivo o texto.');
        setParsedPreview([]);
        return;
      }

      // Enrich preview with team short names
      const enriched = parsed.map((p) => {
        const teamMatch = teams.find(
          (t) =>
            t.id.toLowerCase() === (p.team || '').toLowerCase() ||
            t.shortName.toLowerCase() === (p.team || '').toLowerCase() ||
            t.name.toLowerCase().includes((p.team || '').toLowerCase())
        );
        return {
          ...p,
          matchedTeam: teamMatch ? `${teamMatch.shortName} - ${teamMatch.name}` : p.team || 'Sin asignar',
          matchedTeamId: teamMatch ? teamMatch.id : teams[0]?.id || 'mtz',
        };
      });

      setParsedPreview(enriched);
    } catch (err: any) {
      setParseError(`Error de formato al procesar datos: ${err.message}`);
      setParsedPreview([]);
    }
  };

  const handleFileUpload = (file: File) => {
    const isJson = file.name.endsWith('.json') || file.type === 'application/json';
    const detectedFormat = isJson ? 'json' : 'csv';
    setFormat(detectedFormat);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawText(content);
        handleProcessPreview(content, detectedFormat);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedPreview.length === 0) {
      alert('Primero procese o pegue un listado de jugadores válido.');
      return;
    }

    setIsImporting(true);
    setParseError(null);
    try {
      const res = await ApiClient.importAdminPlayers(parsedPreview);
      onImportSuccess(res.importedCount, res.message);
      onClose();
    } catch (err: any) {
      setParseError(`Error al ejecutar importación masiva: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(SAMPLE_CSV_PLAYERS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_PLAYERS], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_jugadores_beisbol.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="player-import-modal"
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>Importación Masiva de Jugadores (CSV / JSON)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Carga rosters completos, dorsales, posiciones, biografías y fotografías de deportistas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {parseError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Subtabs & Template Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upload');
                  if (parsedPreview.length === 0) handleProcessPreview(rawText, format);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Subir Archivo (.csv / .json)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('text');
                  if (parsedPreview.length === 0) handleProcessPreview(rawText, format);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'text'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pegar Texto Directo
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyTemplate}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copiar plantilla de ejemplo al portapapeles"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>{copied ? '¡Copiado!' : 'Copiar Plantilla'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Descargar archivo CSV de ejemplo"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Descargar CSV</span>
              </button>
            </div>
          </div>

          {/* TAB 1: FILE UPLOAD ZONE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-purple-500/70 rounded-2xl p-6 sm:p-8 text-center bg-slate-950/40 hover:bg-slate-950/80 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group"
              >
                <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    Arrastra tu archivo CSV o JSON aquí o haz clic para seleccionarlo
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permite procesar listas completas de jugadores con nombres, números, fotos y estadísticas
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors shadow-sm"
                >
                  Examinar Archivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: RAW TEXT EDITOR */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-300">Formato:</label>
                  <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFormat('csv');
                        handleProcessPreview(rawText, 'csv');
                      }}
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        format === 'csv' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormat('json');
                        handleProcessPreview(rawText, 'json');
                      }}
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        format === 'json' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      JSON
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleProcessPreview(rawText, format)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Analizar Datos</span>
                </button>
              </div>

              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  handleProcessPreview(e.target.value, format);
                }}
                className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:border-purple-500 focus:outline-none"
                placeholder="Pegar contenido aquí..."
              />
            </div>
          )}

          {/* PARSED PREVIEW TABLE */}
          {parsedPreview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Vista Previa de Importación ({parsedPreview.length} Jugadores Detectados)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Verifica que las imágenes y asignaciones de equipo sean correctas
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 max-h-60 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 min-w-[480px]">
                  <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Foto</th>
                      <th className="py-2 px-3">Dorsal</th>
                      <th className="py-2 px-3">Nombre</th>
                      <th className="py-2 px-3">Equipo</th>
                      <th className="py-2 px-3">Posición</th>
                      <th className="py-2 px-3">B/L</th>
                      <th className="py-2 px-3">Edad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {parsedPreview.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-500/40 bg-slate-800">
                            <img
                              src={p.photo}
                              alt={p.fullName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-amber-400">
                          #{p.jerseyNumber}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-100">{p.fullName}</td>
                        <td className="py-2 px-3 font-semibold text-emerald-400">{p.matchedTeam}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono font-bold">
                            {p.position}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                          {p.bats}/{p.throws}
                        </td>
                        <td className="py-2 px-3 text-slate-400">{p.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
            onClick={handleExecuteImport}
            disabled={parsedPreview.length === 0 || isImporting}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Database className="w-4 h-4" />
            <span>
              {isImporting
                ? 'Importando Roster...'
                : `Confirmar e Importar (${parsedPreview.length} Jugadores)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
