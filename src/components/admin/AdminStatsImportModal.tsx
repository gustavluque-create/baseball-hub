import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Eye,
  Sparkles,
  TrendingUp,
  Activity,
  Layers,
  Database,
  ArrowRight,
  Shield,
  Calendar,
  Check,
} from 'lucide-react';
import { Player, Team } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';
import { useApp } from '../../context/AppContext.tsx';
import { resolvePlayerPhoto, handlePlayerImgError } from '../../utils/playerPhoto.ts';

const SAMPLE_JSON_HISTORICAL_STATS = [
  {
    type: "batting",
    playerName: "Alfredo Despaigne",
    seasonYear: 2024,
    seasonId: "snb-63",
    teamShort: "GRA",
    games: 62,
    ab: 198,
    r: 45,
    h: 68,
    doubles: 14,
    triples: 1,
    hr: 20,
    rbi: 60,
    bb: 52,
    so: 35,
    sb: 1,
    war: 4.1
  },
  {
    type: "batting",
    playerName: "Alfredo Despaigne",
    seasonYear: 2023,
    seasonId: "snb-62",
    teamShort: "GRA",
    games: 50,
    ab: 165,
    r: 38,
    h: 55,
    doubles: 11,
    triples: 0,
    hr: 16,
    rbi: 49,
    bb: 44,
    so: 28,
    sb: 0,
    war: 3.5
  },
  {
    type: "pitching",
    playerName: "Carlos Juan Viera",
    seasonYear: 2024,
    seasonId: "snb-63",
    teamShort: "LTU",
    games: 17,
    gs: 15,
    w: 8,
    l: 4,
    sv: 1,
    ip: 92.1,
    h: 78,
    r: 35,
    er: 29,
    bb: 28,
    so: 74,
    hr: 5,
    war: 2.9
  },
  {
    type: "pitching",
    playerName: "Carlos Juan Viera",
    seasonYear: 2023,
    seasonId: "snb-62",
    teamShort: "LTU",
    games: 19,
    gs: 17,
    w: 10,
    l: 3,
    sv: 0,
    ip: 105.0,
    h: 84,
    r: 32,
    er: 26,
    bb: 31,
    so: 88,
    hr: 4,
    war: 3.8
  }
];

interface AdminStatsImportModalProps {
  isOpen: boolean;
  teams: Team[];
  players?: Player[];
  targetPlayerId?: string; // Optional: when opened for a specific player
  onClose: () => void;
  onImportSuccess: (importedCount: number, message: string) => void;
}

export const AdminStatsImportModal: React.FC<AdminStatsImportModalProps> = ({
  isOpen,
  teams,
  players = [],
  targetPlayerId,
  onClose,
  onImportSuccess,
}) => {
  const { triggerDataRefresh } = useApp();
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [rawText, setRawText] = useState(JSON.stringify(SAMPLE_JSON_HISTORICAL_STATS, null, 2));
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unmatchedAlerts, setUnmatchedAlerts] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const targetPlayer = targetPlayerId ? players.find((p) => p.id === targetPlayerId) : null;

  // Process and validate JSON text
  const validateAndParseJson = (text: string) => {
    setParseError(null);
    setUnmatchedAlerts([]);

    try {
      const parsed = JSON.parse(text);
      let list: any[] = [];

      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.stats)) {
          list = parsed.stats;
        } else if (Array.isArray(parsed.temporadas)) {
          list = parsed.temporadas;
        } else {
          const bList = Array.isArray(parsed.batting)
            ? parsed.batting.map((item: any) => ({ ...item, type: 'batting' }))
            : [];
          const pList = Array.isArray(parsed.pitching)
            ? parsed.pitching.map((item: any) => ({ ...item, type: 'pitching' }))
            : [];
          list = [...bList, ...pList];
        }
      }

      if (list.length === 0) {
        setParseError('El archivo JSON no contiene un arreglo de estadísticas válido o está vacío.');
        setParsedPreview([]);
        return;
      }

      // Check player matching for preview
      const previewItems = list.map((item: any, idx: number) => {
        const pId = targetPlayerId || item.playerId || item.id;
        const nameQuery = (item.playerName || item.fullName || item.player || item.Nombre || item.nombre || '').toString().trim().toLowerCase();

        let matched = pId ? players.find((p) => p.id === pId) : undefined;
        if (!matched && nameQuery) {
          matched = players.find((p) => (p.fullName || '').toLowerCase() === nameQuery);
          if (!matched) {
            matched = players.find((p) => (p.fullName || '').toLowerCase().includes(nameQuery));
          }
        }

        const rawType = (item.type || item.tipo || '').toString().toLowerCase();
        const isPitching =
          rawType.includes('pitch') ||
          rawType.includes('lanz') ||
          item.era !== undefined ||
          item.pcl !== undefined ||
          item.ip !== undefined ||
          item.inn !== undefined ||
          item.gs !== undefined ||
          (matched && (matched.position === 'SP' || matched.position === 'RP'));

        const year = Number(item.seasonYear || item.year || item.temporada || item.ano || item.año) || 2025;
        const seasonId = item.seasonId || item.temporadaId || `snb-${year}`;

        return {
          ...item,
          __index: idx,
          __matchedPlayer: matched,
          __type: isPitching ? 'pitching' : 'batting',
          __seasonYear: year,
          __seasonId: seasonId,
          __teamDisplay: item.teamShort || item.equipo || (matched ? matched.teamShort : '—'),
        };
      });

      setParsedPreview(previewItems);
    } catch (err: any) {
      setParseError(`Error de sintaxis JSON: ${err.message || 'JSON inválido'}`);
      setParsedPreview([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      validateAndParseJson(content);
    };
    reader.onerror = () => {
      setParseError('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const jsonStr = JSON.stringify(SAMPLE_JSON_HISTORICAL_STATS, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_estadisticas_temporadas_anteriores.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(JSON.stringify(SAMPLE_JSON_HISTORICAL_STATS, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSampleInEditor = () => {
    const sample = JSON.stringify(SAMPLE_JSON_HISTORICAL_STATS, null, 2);
    setRawText(sample);
    validateAndParseJson(sample);
    setActiveTab('text');
  };

  const handleExecuteImport = async () => {
    if (parsedPreview.length === 0) {
      validateAndParseJson(rawText);
      if (parsedPreview.length === 0) return;
    }

    setIsImporting(true);
    setParseError(null);
    setUnmatchedAlerts([]);

    try {
      const parsedData = JSON.parse(rawText);

      let result: any;
      if (targetPlayerId) {
        result = await ApiClient.importPlayerHistoricalStats(targetPlayerId, parsedData);
      } else {
        result = await ApiClient.importAdminHistoricalStats(parsedData);
      }

      const unmatched = Array.isArray(result?.unmatchedEntries) ? result.unmatchedEntries : [];
      if (unmatched.length > 0) {
        setUnmatchedAlerts(unmatched);
      }

      triggerDataRefresh();
      onImportSuccess(result.importedCount || 0, result.message || 'Estadísticas importadas.');

      if (unmatched.length === 0) {
        onClose();
      }
    } catch (err: any) {
      console.error('Error importing historical stats:', err);
      setParseError(err.message || 'Error al ejecutar la importación en el servidor.');
    } finally {
      setIsImporting(false);
    }
  };

  const battingCount = parsedPreview.filter((p) => p.__type === 'batting').length;
  const pitchingCount = parsedPreview.filter((p) => p.__type === 'pitching').length;
  const matchedCount = parsedPreview.filter((p) => Boolean(p.__matchedPlayer)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>Importar Estadísticas de Temporadas Anteriores (JSON)</span>
                {targetPlayer && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    Para: {targetPlayer.fullName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Agrega masivamente estadísticas de bateo y pitcheo de temporadas pasadas a los peloteros desde un archivo JSON.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Subir Archivo JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('text');
                validateAndParseJson(rawText);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'text'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Pegar Código JSON</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Descargar archivo JSON de ejemplo con campos explicados"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Descargar Plantilla JSON</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSampleInEditor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Cargar ejemplo en el editor para previsualizar"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Cargar Ejemplo</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: UPLOAD FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/80 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/20 transition-all">
                  <UploadCloud className="w-7 h-7 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Haz clic para seleccionar o arrastra tu archivo JSON aquí
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Archivos soportados: <span className="font-mono text-emerald-400">.json</span> (Arreglos de temporadas históricas de bateo o pitcheo)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Instructions box */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Estructura y Campos del Archivo JSON:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
                  <li>
                    <strong className="text-white">Identificación:</strong> Se identifica al pelotero por <code className="text-emerald-300">playerName</code> / <code className="text-emerald-300">fullName</code> o <code className="text-emerald-300">playerId</code>.
                  </li>
                  <li>
                    <strong className="text-white">Temporada:</strong> Indica el año en <code className="text-emerald-300">seasonYear</code> (ej. 2023, 2024) y opcionalmente <code className="text-emerald-300">seasonId</code> (ej. "snb-62", "snb-63").
                  </li>
                  <li>
                    <strong className="text-white">Tipo de Estadística:</strong> <code className="text-emerald-300">type: "batting"</code> o <code className="text-emerald-300">type: "pitching"</code>. Si se omite, se detecta automáticamente según los atributos presentes.
                  </li>
                  <li>
                    <strong className="text-white">Bateo:</strong> JJ (games), VB (ab), C (r), H (h), 2B (doubles), 3B (triples), HR (hr), CI (rbi), BB (bb), K (so), BR (sb), WAR (war).
                  </li>
                  <li>
                    <strong className="text-white">Pitcheo:</strong> JJ (games), JI (gs), JG (w), JP (l), JS (sv), INN (ip), H (h), C (r), CL (er), BB (bb), K (so), HR (hr), WAR (war).
                  </li>
                  <li>
                    Los promedios (<strong className="text-emerald-400">AVG, OBP, SLG, OPS</strong> o <strong className="text-sky-400">PCL/ERA, WHIP</strong>) y los <strong className="text-white">Totales de Carrera</strong> se recalculan automáticamente.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: TEXT EDITOR */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300">
                  Pega o edita el contenido JSON directamente:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyExample}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '¡Copiado!' : 'Copiar Ejemplo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => validateAndParseJson(rawText)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Validar JSON
                  </button>
                </div>
              </div>

              <textarea
                rows={10}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  validateAndParseJson(e.target.value);
                }}
                className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                placeholder='[ { "type": "batting", "playerName": "Alfredo Despaigne", "seasonYear": 2024, "ab": 198, "h": 68, "hr": 20, "rbi": 60 } ]'
              />
            </div>
          )}

          {/* Parse Error Banner */}
          {parseError && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Unmatched Items Alert */}
          {unmatchedAlerts.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-800/80 space-y-2 text-xs text-amber-300">
              <div className="flex items-center gap-2 font-bold text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Advertencia: {unmatchedAlerts.length} registros no pudieron ser emparejados</span>
              </div>
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                Los siguientes nombres en el JSON no coinciden con peloteros registrados en la liga:
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-slate-950/60 rounded-lg font-mono text-[11px]">
                {unmatchedAlerts.map((item, i) => (
                  <div key={i} className="text-amber-200">
                    • {item.reason || JSON.stringify(item.raw)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW SECTION */}
          {parsedPreview.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Vista Previa de Estadísticas ({parsedPreview.length} registros detectados)
                  </h4>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    {battingCount} Bateo
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
                    {pitchingCount} Pitcheo
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold border ${
                      matchedCount === parsedPreview.length
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}
                  >
                    {matchedCount}/{parsedPreview.length} Peloteros emparejados
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <tr>
                      <th className="p-2.5 pl-3">Pelotero</th>
                      <th className="p-2.5">Temporada</th>
                      <th className="p-2.5">Equipo</th>
                      <th className="p-2.5 text-center">Tipo</th>
                      <th className="p-2.5">Métricas Clave</th>
                      <th className="p-2.5 text-right pr-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {parsedPreview.map((item, idx) => {
                      const matched = item.__matchedPlayer;
                      const isBatting = item.__type === 'batting';

                      return (
                        <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-2.5 pl-3">
                            <div className="flex items-center gap-2">
                              {matched ? (
                                <img
                                  src={resolvePlayerPhoto(matched)}
                                  alt={matched.fullName}
                                  className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0"
                                  onError={(e) => handlePlayerImgError(e, matched)}
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                                  ?
                                </div>
                              )}
                              <span className="font-bold text-white truncate max-w-[140px]">
                                {matched ? matched.fullName : item.playerName || item.fullName || 'No identificado'}
                              </span>
                            </div>
                          </td>

                          <td className="p-2.5 font-mono text-slate-300">
                            {item.__seasonYear} ({item.__seasonId})
                          </td>

                          <td className="p-2.5 font-bold text-slate-400">
                            {item.__teamDisplay}
                          </td>

                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                isBatting
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              }`}
                            >
                              {isBatting ? 'Bateo' : 'Pitcheo'}
                            </span>
                          </td>

                          <td className="p-2.5 font-mono text-[11px] text-slate-400">
                            {isBatting ? (
                              <span>
                                {item.games ?? item.jj ?? 0} JJ • {item.ab ?? item.vb ?? 0} VB •{' '}
                                <strong className="text-white">{item.h ?? 0} H</strong> •{' '}
                                <strong className="text-amber-400">{item.hr ?? 0} HR</strong> •{' '}
                                <strong className="text-emerald-400">{item.rbi ?? item.ci ?? 0} CI</strong>
                              </span>
                            ) : (
                              <span>
                                {item.games ?? item.jj ?? 0} JJ •{' '}
                                <strong className="text-emerald-400">{item.w ?? item.wins ?? item.jg ?? 0} JG</strong> -{' '}
                                <strong className="text-rose-400">{item.l ?? item.losses ?? item.jp ?? 0} JP</strong> •{' '}
                                <strong className="text-sky-400">{item.era ?? item.pcl ?? 'PCL'}</strong> •{' '}
                                {item.ip ?? item.inn ?? 0} INN • <strong className="text-white">{item.so ?? item.k ?? 0} K</strong>
                              </span>
                            )}
                          </td>

                          <td className="p-2.5 text-right pr-3">
                            {matched ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Emparejado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400" title="No se encontró este nombre en la lista de peloteros">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">No encontrado</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {parsedPreview.length > 0 && (
              <span>
                Listos para importar:{' '}
                <strong className="text-white">{parsedPreview.length} registros históricos</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting || parsedPreview.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>
                {isImporting
                  ? 'Importando Estadísticas...'
                  : `Confirmar e Importar (${parsedPreview.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
