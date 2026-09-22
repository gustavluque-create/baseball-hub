import React, { useState, useEffect } from 'react';
import {
  Settings,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Database,
  FileText,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Check,
  Globe,
  Layers,
  Palette,
  Shield,
  LogOut,
  Calendar,
  Users,
  Radio,
  Newspaper,
  ShieldAlert,
  Activity,
  ArrowUpRight,
  Clock,
  Server,
  KeyRound,
  ArrowLeft,
  HardDrive,
  Save,
  RefreshCw,
} from 'lucide-react';
import { ApiClient } from '../services/api.ts';
import { IngestionValidationSummary, AdminSystemOverview } from '../types/index.ts';
import { useApp } from '../context/AppContext.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';
import { AdminLoginForm } from '../components/AdminLoginModal.tsx';
import { AdminGamesManager } from '../components/admin/AdminGamesManager.tsx';
import { AdminPlayersManager } from '../components/admin/AdminPlayersManager.tsx';
import { AdminAuditLogs } from '../components/admin/AdminAuditLogs.tsx';
import { AdminNewsManager } from '../components/admin/AdminNewsManager.tsx';
import { AdminTeamsManager } from '../components/admin/AdminTeamsManager.tsx';
import { DatabaseOperationsMonitor } from '../components/admin/DatabaseOperationsMonitor.tsx';
import { useDatabaseLogs } from '../hooks/useDatabaseLogs.ts';

const SAMPLE_CSV = `Jugador,Equipo,Posicion,VB,H,2B,3B,HR,CI,BB,K,AVG
Erisbel Arruebarrena,MTZ,SS,110,40,9,1,8,30,14,22,0.364
Alfredo Despaigne,GRA,BD,98,34,5,0,10,32,24,19,0.347
Yoelkis Guibert,SCU,OF,115,41,8,3,5,22,12,18,0.357
Dayan Garcia,ART,3B,102,36,7,1,6,27,15,16,0.353
Yosvani Alarcon,LTU,C,106,37,6,0,7,28,11,14,0.349`;

const SAMPLE_JSON = `[
  {
    "playerName": "Guillermo Avilés",
    "teamShort": "GRA",
    "position": "1B",
    "ab": 90,
    "h": 31,
    "doubles": 6,
    "triples": 1,
    "hr": 5,
    "rbi": 22,
    "bb": 18,
    "so": 16,
    "avg": 0.344
  }
]`;

export const AdminView: React.FC = () => {
  const {
    setActiveTab,
    theme,
    themeMode,
    setThemeMode,
    toggleTheme,
    language,
    setLanguage,
    density,
    setDensity,
    t,
  } = useApp();

  const { isAdminAuthenticated, adminUser, logout } = useAdminAuth();
  const { stats: monitorStats } = useDatabaseLogs();

  type AdminTab = 'overview' | 'teams' | 'games' | 'etl' | 'players' | 'news' | 'logs' | 'db_monitor' | 'settings';
  const [activeSection, setActiveSection] = useState<AdminTab>('overview');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [rawText, setRawText] = useState<string>(SAMPLE_CSV);
  const [auditSummary, setAuditSummary] = useState<IngestionValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [overviewMetrics, setOverviewMetrics] = useState<AdminSystemOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    status: string;
    filePath: string;
    exists: boolean;
    sizeBytes: number;
    lastModified?: string;
    counts: Record<string, number>;
  } | null>(null);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveDbFeedback, setSaveDbFeedback] = useState<string | null>(null);

  const loadDatabaseStatus = () => {
    ApiClient.getDatabaseStatus()
      .then((data) => setDbStatus(data))
      .catch((err) => console.error('Error fetching database status:', err));
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      setLoadingOverview(true);
      ApiClient.getAdminOverview()
        .then((data) => setOverviewMetrics(data))
        .catch((err) => console.error('Error fetching admin overview:', err))
        .finally(() => setLoadingOverview(false));
      loadDatabaseStatus();
    }
  }, [isAdminAuthenticated, activeSection]);

  const handleForcePersist = async () => {
    setIsSavingDb(true);
    setSaveDbFeedback(null);
    try {
      const res = await ApiClient.forcePersistDatabase();
      setSaveDbFeedback('¡Base de datos sincronizada y guardada en disco exitosamente!');
      if (res.info) {
        setDbStatus({ ...res.info, status: 'PERSISTENT_DISK_STORAGE' });
      }
      setTimeout(() => setSaveDbFeedback(null), 4000);
    } catch (err: any) {
      setSaveDbFeedback(`Error al guardar: ${err.message}`);
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setCommitMessage(null);
    try {
      const summary = await ApiClient.validateIngestion(rawText, format);
      setAuditSummary(summary);
    } catch (err: any) {
      alert(`Error al validar: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!auditSummary) return;
    const recordsToCommit = auditSummary.records && auditSummary.records.length > 0
      ? auditSummary.records
      : auditSummary.preview;
    if (!recordsToCommit || recordsToCommit.length === 0) return;
    setIsCommitting(true);
    try {
      const res = await ApiClient.commitIngestion(recordsToCommit);
      setCommitMessage(res.message);
    } catch (err: any) {
      alert(`Error al insertar en base de datos: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // If not authenticated, render the secure authentication gate!
  if (!isAdminAuthenticated) {
    return (
      <div className="py-12 sm:py-16 px-4 max-w-lg mx-auto space-y-6">
        <AdminLoginForm />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Admin User Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-100 tracking-tight">
                Panel de Administración del Sitio
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {adminUser?.role === 'superadmin'
                  ? 'SUPERADMINISTRADOR'
                  : adminUser?.role === 'official_scorer'
                  ? 'ANOTADOR OFICIAL'
                  : 'EDITOR'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Conectado como <strong className="text-slate-200">{adminUser?.name}</strong> • Sesión Segura Activa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button
            onClick={() => setActiveTab('home')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Volver a la portada deportiva pública"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sitio Público</span>
          </button>
          <button
            onClick={logout}
            id="admin-logout-btn"
            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Cerrar sesión de administrador"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSection('overview')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'overview'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Visión General</span>
        </button>

        <button
          onClick={() => setActiveSection('teams')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'teams'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Equipos ({overviewMetrics?.totalTeams ?? 16})</span>
        </button>

        <button
          onClick={() => setActiveSection('games')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'games'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Partidos en Vivo</span>
        </button>

        <button
          onClick={() => setActiveSection('etl')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'etl'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Ingesta ETL</span>
        </button>

        <button
          onClick={() => setActiveSection('players')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'players'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Jugadores &amp; Roster</span>
        </button>

        <button
          onClick={() => setActiveSection('news')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'news'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Newspaper className="w-3.5 h-3.5" />
          <span>Prensa &amp; Noticias</span>
        </button>

        <button
          onClick={() => setActiveSection('logs')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'logs'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Auditoría &amp; Seguridad</span>
        </button>

        <button
          onClick={() => setActiveSection('db_monitor')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'db_monitor'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Monitor DB &amp; Logs</span>
          {monitorStats.failedWrites > 0 ? (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
              {monitorStats.failedWrites} ERR
            </span>
          ) : monitorStats.writes > 0 ? (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
              {monitorStats.writes}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveSection('settings')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'settings'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Tema &amp; Ajustes</span>
        </button>
      </div>

      {/* TAB: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Partidos Totales</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                {overviewMetrics?.totalGames ?? '...'}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span>{overviewMetrics?.liveGames ?? 0} en curso ahora</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Roster &amp; Jugadores</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                {overviewMetrics?.totalPlayers ?? '...'}
              </div>
              <div className="text-[11px] text-slate-500">
                Distribuidos en {overviewMetrics?.totalTeams ?? 16} equipos
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Conexiones en Vivo</span>
                <Radio className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                {overviewMetrics?.notificationClients ?? 1}
              </div>
              <div className="text-[11px] text-amber-400 font-semibold">
                SSE &amp; Webhooks activos
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Servidor de Datos</span>
                <Server className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                OK
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Uptime: {overviewMetrics?.uptimeSeconds ? `${Math.floor(overviewMetrics.uptimeSeconds / 60)}m` : '100%'}
              </div>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Accesos Rápidos de Administración</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => setActiveSection('teams')}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Shield className="w-4 h-4" />
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-slate-200 group-hover:text-emerald-400">
                  Gestión de Equipos
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Registrar, modificar o eliminar clubes, estadios, mánagers e insignias.
                </div>
              </button>

              <button
                onClick={() => setActiveSection('games')}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-2 rounded-lg bg-red-500/10 text-red-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-slate-200 group-hover:text-emerald-400">
                  Control de Partidos en Vivo
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Actualizar marcador en vivo, entradas, outs y emitir alertas a navegadores.
                </div>
              </button>

              <button
                onClick={() => setActiveSection('etl')}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Database className="w-4 h-4" />
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-slate-200 group-hover:text-emerald-400">
                  Carga ETL de Estadísticas
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Validar e insertar tablas de bateo y pitcheo en formato CSV o JSON.
                </div>
              </button>

              <button
                onClick={() => setActiveSection('logs')}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <ShieldAlert className="w-4 h-4" />
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-slate-200 group-hover:text-emerald-400">
                  Trazabilidad &amp; Auditoría
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Historial inmutable de inicios de sesión, cambios en partidos y restablecimiento.
                </div>
              </button>
            </div>
          </div>

          {/* Database Persistence Health & Sync Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                      Almacenamiento Persistente en Base de Datos
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Activo &amp; Persistente
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Todos los cambios (equipos, jugadores, fotos, estadísticas y partidos) se guardan atómicamente en disco y se restauran automáticamente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setActiveSection('db_monitor')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all cursor-pointer"
                  title="Abrir telemetría y monitor de escrituras"
                >
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <span>Monitor de Escrituras</span>
                </button>
                <button
                  onClick={loadDatabaseStatus}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs transition-colors cursor-pointer"
                  title="Recargar estado del almacenamiento"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleForcePersist}
                  disabled={isSavingDb}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingDb ? 'Guardando...' : 'Sincronizar a Disco'}</span>
                </button>
              </div>
            </div>

            {saveDbFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{saveDbFeedback}</span>
              </div>
            )}

            {/* Storage details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Estado del Archivo</div>
                <div className="text-xs font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{dbStatus?.exists ? 'En Disco (OK)' : 'Inicializado'}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate" title={dbStatus?.filePath}>
                  database.json
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Tamaño en Disco</div>
                <div className="text-xs font-bold text-slate-200 mt-1 font-mono">
                  {dbStatus?.sizeBytes ? `${(dbStatus.sizeBytes / 1024).toFixed(1)} KB` : 'Calculando...'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Almacenamiento local</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Registros Almacenados</div>
                <div className="text-xs font-bold text-emerald-400 mt-1 font-mono">
                  {dbStatus?.counts
                    ? `${dbStatus.counts.teams || 0} eq / ${dbStatus.counts.players || 0} jug`
                    : 'Cargando...'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {dbStatus?.counts ? `${dbStatus.counts.games || 0} partidos guardados` : ''}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Última Modificación</div>
                <div className="text-xs font-bold text-slate-200 mt-1 font-mono truncate">
                  {dbStatus?.lastModified
                    ? new Date(dbStatus.lastModified).toLocaleTimeString()
                    : 'Reciente'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sincronización atómica</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TEAMS MANAGEMENT */}
      {activeSection === 'teams' && (
        <AdminTeamsManager
          onTeamsChange={() => {
            ApiClient.getAdminOverview().then(setOverviewMetrics).catch(() => {});
          }}
        />
      )}

      {/* TAB: GAMES CONTROLLER */}
      {activeSection === 'games' && <AdminGamesManager />}

      {/* TAB: PLAYERS & ROSTER */}
      {activeSection === 'players' && <AdminPlayersManager />}

      {/* TAB: NEWS & PRESS */}
      {activeSection === 'news' && <AdminNewsManager />}

      {/* TAB: AUDIT LOGS */}
      {activeSection === 'logs' && <AdminAuditLogs />}

      {/* TAB: DATABASE OPERATIONS & WRITE MONITOR */}
      {activeSection === 'db_monitor' && <DatabaseOperationsMonitor />}

      {/* SECTION 1: SETTINGS & THEME CUSTOMIZATION */}
      {activeSection === 'settings' && (
        <div className="space-y-8">
          {/* Main Theme Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  Tema Visual y Paleta Global
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Alterna entre Modo Oscuro y Modo Claro. Los colores de fondo, bordes, tipografías y gráficos se intercambian globalmente con Tailwind CSS.
                </p>
              </div>

              {/* Instant Toggle Switch */}
              <div className="flex items-center gap-3 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800 shrink-0">
                <span className="text-xs font-semibold text-slate-300">
                  {theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}
                </span>
                <button
                  id="admin-instant-theme-toggle"
                  onClick={toggleTheme}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
                    theme === 'dark' ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  aria-label="Alternar tema claro y oscuro"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform flex items-center justify-center ${
                      theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  >
                    {theme === 'dark' ? (
                      <Moon className="w-3 h-3 text-slate-900" />
                    ) : (
                      <Sun className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* 3 Interactive Theme Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Dark Option */}
              <div
                id="admin-theme-card-dark"
                onClick={() => setThemeMode('dark')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  themeMode === 'dark'
                    ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-full h-24 rounded-lg bg-slate-950 border border-slate-800 p-3 flex flex-col justify-between mb-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-emerald-500" />
                      <div className="w-14 h-2 rounded bg-slate-700" />
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 py-1">
                    <div className="h-6 rounded bg-slate-900 border border-slate-800" />
                    <div className="h-6 rounded bg-slate-900 border border-slate-800" />
                    <div className="h-6 rounded bg-slate-900 border border-slate-800" />
                  </div>
                  <div className="w-3/4 h-2 rounded bg-slate-800" />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                      <Moon className="w-4 h-4 text-emerald-400" />
                      Modo Oscuro (Dark)
                    </span>
                    {themeMode === 'dark' && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Fondo carbón y tarjetas pizarra diseñadas para baja fatiga visual.
                  </p>
                </div>
              </div>

              {/* Light Option */}
              <div
                id="admin-theme-card-light"
                onClick={() => setThemeMode('light')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  themeMode === 'light'
                    ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-full h-24 rounded-lg bg-slate-100 border border-slate-300 p-3 flex flex-col justify-between mb-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-emerald-600" />
                      <div className="w-14 h-2 rounded bg-slate-400" />
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 py-1">
                    <div className="h-6 rounded bg-white border border-slate-200 shadow-xs" />
                    <div className="h-6 rounded bg-white border border-slate-200 shadow-xs" />
                    <div className="h-6 rounded bg-white border border-slate-200 shadow-xs" />
                  </div>
                  <div className="w-3/4 h-2 rounded bg-slate-300" />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-400" />
                      Modo Claro (Light)
                    </span>
                    {themeMode === 'light' && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Fondo níveo de alta luminosidad con tarjetas blancas de alto contraste.
                  </p>
                </div>
              </div>

              {/* System Option */}
              <div
                id="admin-theme-card-system"
                onClick={() => setThemeMode('system')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  themeMode === 'system'
                    ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-full h-24 rounded-lg bg-gradient-to-r from-slate-950 via-slate-900 to-slate-200 border border-slate-700 p-3 flex flex-col justify-between mb-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-emerald-500" />
                      <div className="w-14 h-2 rounded bg-slate-500" />
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 py-1">
                    <div className="h-6 rounded bg-slate-900 border border-slate-800" />
                    <div className="h-6 rounded bg-slate-800 border border-slate-700" />
                    <div className="h-6 rounded bg-white border border-slate-200" />
                  </div>
                  <div className="w-3/4 h-2 rounded bg-slate-600" />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-sky-400" />
                      Automático (Sistema)
                    </span>
                    {themeMode === 'system' && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Sincroniza con la configuración de tu sistema operativo.
                  </p>
                </div>
              </div>
            </div>

            {/* Architecture Explainer */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-xs space-y-2">
              <div className="font-bold text-emerald-400 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Arquitectura de Conmutación de Colores con Tailwind CSS
              </div>
              <p className="text-slate-400 leading-relaxed">
                Esta aplicación aprovecha las variables CSS y la directiva <code className="text-slate-300 font-mono">@custom-variant dark</code> de Tailwind CSS v4 para remapear dinámicamente la paleta <code className="text-slate-300 font-mono">slate</code> (de 50 a 950). El cambio se aplica en el elemento raíz <code className="text-slate-300 font-mono">&lt;html&gt;</code> y persiste automáticamente en el almacenamiento local.
              </p>
            </div>
          </div>

          {/* Density & Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Densidad de Tablas y Visualizaciones
              </h3>
              <p className="text-xs text-slate-400">
                Ajusta el espaciado de las tablas de bateo, pitcheo y posiciones.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDensity('comfortable')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    density === 'comfortable'
                      ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-slate-200">Cómoda</div>
                    <div className="text-[11px] text-slate-400">Espaciado balanceado</div>
                  </div>
                  {density === 'comfortable' && <Check className="w-4 h-4 text-emerald-400" />}
                </button>

                <button
                  onClick={() => setDensity('compact')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    density === 'compact'
                      ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-slate-200">Compacta</div>
                    <div className="text-[11px] text-slate-400">Máxima densidad sabermétrica</div>
                  </div>
                  {density === 'compact' && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                Idioma de la Plataforma
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona el idioma de los menús, estadísticas y reportes.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLanguage('es')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    language === 'es'
                      ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-slate-200">Español</div>
                    <div className="text-[11px] text-slate-400">Latino &amp; Caribeño</div>
                  </div>
                  {language === 'es' && <Check className="w-4 h-4 text-emerald-400" />}
                </button>

                <button
                  onClick={() => setLanguage('en')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    language === 'en'
                      ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-slate-200">English</div>
                    <div className="text-[11px] text-slate-400">International Baseball</div>
                  </div>
                  {language === 'en' && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DATA INGESTION & ETL */}
      {activeSection === 'etl' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              Módulo de Ingesta &amp; Auditoría (ETL)
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFormat('csv');
                  setRawText(SAMPLE_CSV);
                  setAuditSummary(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Cargar Ejemplo CSV
              </button>
              <button
                onClick={() => {
                  setFormat('json');
                  setRawText(SAMPLE_JSON);
                  setAuditSummary(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Cargar Ejemplo JSON
              </button>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Soporte flexible de JSON &amp; CSV:</strong> Acepta campos como <code className="text-emerald-400">playerName</code>, <code className="text-emerald-400">fullName</code> o <code className="text-emerald-400">nombre</code>, equipos (<code className="text-emerald-400">teamShort</code>, ej. <em>GRA</em>, <em>PRI</em>, <em>IND</em>) y estadísticas. Al insertar, los jugadores se registran automáticamente en el roster de su equipo.
              </span>
            </div>
            <button
              onClick={() => setActiveSection('players')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Gestor de Jugadores &amp; Roster</span>
            </button>
          </div>

          {commitMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex items-center gap-3 text-emerald-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold text-sm">{commitMessage}</span>
        </div>
      )}

      {/* Editor & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Text Input */}
        <div className="lg:col-span-2 space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-200">
                Datos de Entrada ({format.toUpperCase()})
              </h2>
            </div>

            {/* Format toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800">
              <button
                onClick={() => setFormat('csv')}
                className={`px-2.5 py-1 text-xs font-bold rounded ${
                  format === 'csv' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`px-2.5 py-1 text-xs font-bold rounded ${
                  format === 'json' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            className="w-full bg-slate-950 text-slate-200 font-mono text-xs p-4 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 leading-relaxed"
            placeholder="Pega aquí el contenido CSV o JSON con cabeceras..."
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Soporta alias: Promedio/AVG, Jonrones/HR, CI/RBI, VB/AB, etc.
            </span>

            <button
              onClick={handleValidate}
              disabled={isValidating || !rawText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg transition-colors cursor-pointer"
            >
              {isValidating ? (
                <span className="inline-block animate-spin">⚾</span>
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
              <span>Procesar y Auditar Datos</span>
            </button>
          </div>
        </div>

        {/* Right 1 Col: Pipeline Info & Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Reglas del Ingestion Pipeline</span>
          </div>

          <div className="space-y-3 text-slate-300">
            <div>
              <strong className="text-white block mb-0.5">1. Normalización Automática</strong>
              <p className="text-slate-400 leading-relaxed">
                Mapea encabezados multilingües (AVG/BA/Promedio, HR/Jonrones/Cuadrangulares, CI/RBI).
              </p>
            </div>

            <div>
              <strong className="text-white block mb-0.5">2. Validación de Consistencia</strong>
              <p className="text-slate-400 leading-relaxed">
                Verifica que Hits no superen veces al bate (H &le; VB) y recalcula promedios matemáticos.
              </p>
            </div>

            <div>
              <strong className="text-white block mb-0.5">3. Auditoría sin Pérdida</strong>
              <p className="text-slate-400 leading-relaxed">
                Requiere confirmación explícita (Commit) antes de impactar el almacén de datos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Summary Card */}
      {auditSummary && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                Informe de Validación y Auditoría
              </h2>

              {auditSummary.validRecords > 0 && (
                <button
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Insertar {auditSummary.validRecords} Registros Válidos</span>
                </button>
              )}
            </div>

            {/* Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-slate-500 text-[11px] block">TOTAL REGISTROS</span>
                <span className="font-mono text-2xl font-black text-slate-200">
                  {auditSummary.totalRecords}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-center">
                <span className="text-emerald-400 text-[11px] font-bold block flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> VÁLIDOS
                </span>
                <span className="font-mono text-2xl font-black text-emerald-400">
                  {auditSummary.validRecords}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-center">
                <span className="text-amber-400 text-[11px] font-bold block flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> ADVERTENCIAS
                </span>
                <span className="font-mono text-2xl font-black text-amber-400">
                  {auditSummary.warnings.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 text-center">
                <span className="text-rose-400 text-[11px] font-bold block flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> ERRORES
                </span>
                <span className="font-mono text-2xl font-black text-rose-400">
                  {auditSummary.errors.length}
                </span>
              </div>
            </div>

            {/* Warnings or Errors Logs */}
            {auditSummary.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-1.5 text-xs">
                <span className="font-bold text-rose-400">Errores que impiden la inserción:</span>
                {auditSummary.errors.map((e, idx) => (
                  <p key={idx} className="text-rose-300">
                    Fila {e.row} ({e.field}): {e.message}
                  </p>
                ))}
              </div>
            )}

            {auditSummary.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1.5 text-xs">
                <span className="font-bold text-amber-400">Advertencias estadísticas:</span>
                {auditSummary.warnings.map((w, idx) => (
                  <p key={idx} className="text-amber-300">
                    Fila {w.row} ({w.field}): {w.message}
                  </p>
                ))}
              </div>
            )}

            {/* Preview Table */}
            {auditSummary.preview.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Vista Previa Normalizada ({auditSummary.preview.length} registros)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-xs font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 uppercase font-sans text-[10px]">
                        <th className="py-2.5 px-3">Jugador</th>
                        <th className="py-2.5 px-2">Eq</th>
                        <th className="py-2.5 px-2">Pos</th>
                        <th className="py-2.5 px-2 text-right">VB</th>
                        <th className="py-2.5 px-2 text-right">H</th>
                        <th className="py-2.5 px-2 text-right">2B</th>
                        <th className="py-2.5 px-2 text-right">HR</th>
                        <th className="py-2.5 px-2 text-right">CI</th>
                        <th className="py-2.5 px-2 text-right">BB</th>
                        <th className="py-2.5 px-2 text-right">K</th>
                        <th className="py-2.5 px-2 text-right">AVG</th>
                        <th className="py-2.5 px-2 text-right">OPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditSummary.preview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60">
                          <td className="py-2 px-3 font-sans font-bold text-slate-200">{row.playerName}</td>
                          <td className="py-2 px-2 text-slate-400">{row.teamShort}</td>
                          <td className="py-2 px-2 text-slate-500">{row.position}</td>
                          <td className="py-2 px-2 text-right text-slate-300">{row.ab}</td>
                          <td className="py-2 px-2 text-right font-bold text-white">{row.h}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{row.doubles}</td>
                          <td className="py-2 px-2 text-right font-bold text-amber-400">{row.hr}</td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-400">{row.rbi}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{row.bb}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{row.so}</td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-400">{row.avg.toFixed(3)}</td>
                          <td className="py-2 px-2 text-right text-slate-300">{row.ops.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
};
