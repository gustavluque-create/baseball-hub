import React, { useState } from 'react';
import {
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Search,
  Trash2,
  RefreshCw,
  Code2,
  ChevronDown,
  ChevronUp,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Bug,
  Save,
  Zap,
} from 'lucide-react';
import { useDatabaseLogs, LogFilterType } from '../../hooks/useDatabaseLogs.ts';
import { DatabaseApiLogEntry } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

export const DatabaseOperationsMonitor: React.FC = () => {
  const {
    logs,
    stats,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    clearLogs,
    testSimulateWriteError,
  } = useDatabaseLogs();

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistMsg, setPersistMsg] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const handleForceSave = async () => {
    setIsPersisting(true);
    setPersistMsg(null);
    try {
      const res = await ApiClient.forcePersistDatabase();
      setPersistMsg(res.message || 'Base de datos sincronizada y guardada en disco.');
      setTimeout(() => setPersistMsg(null), 3500);
    } catch (err: any) {
      setPersistMsg(`Error al guardar: ${err.message}`);
    } finally {
      setIsPersisting(false);
    }
  };

  const getMethodBadge = (entry: DatabaseApiLogEntry) => {
    const isWrite = entry.isWriteOperation;
    let bg = 'bg-slate-800 text-slate-300 border-slate-700';

    if (entry.method === 'POST') {
      bg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    } else if (entry.method === 'PUT' || entry.method === 'PATCH') {
      bg = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    } else if (entry.method === 'DELETE') {
      bg = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    } else if (entry.method === 'GET') {
      bg = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    }

    return (
      <div className="flex items-center gap-1.5">
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider ${bg}`}>
          {entry.method}
        </span>
        {isWrite && (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase tracking-tighter">
            Escritura
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 mt-0.5">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">
                Monitor de Base de Datos y Operaciones de Escritura
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                <Activity className="w-3 h-3 text-sky-400 animate-pulse" />
                Telemetría en Vivo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Registro auditado de todas las transacciones, mutaciones (POST, PUT, DELETE) y fallos reportados por el motor de base de datos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={testSimulateWriteError}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Envía una solicitud de escritura con datos inválidos para validar que el monitor detecte y capture el error"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Simular Error de Escritura</span>
          </button>

          <button
            onClick={handleForceSave}
            disabled={isPersisting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Forzar persistencia inmediata de la base de datos a disco"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isPersisting ? 'Guardando...' : 'Guardar a Disco'}</span>
          </button>

          <button
            onClick={clearLogs}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
            title="Limpiar historial de registros en memoria"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {persistMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{persistMsg}</span>
        </div>
      )}

      {/* Real-time KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Escrituras Totales
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono text-slate-100">{stats.writes}</span>
            <span className="text-xs text-slate-500">mutaciones</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {stats.reads} lecturas realizadas
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Escrituras Exitosas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono text-emerald-400">{stats.successfulWrites}</span>
            <span className="text-xs text-emerald-500 font-bold font-mono">
              ({stats.writeSuccessRate}%)
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Persistidas en base de datos
          </span>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${
            stats.failedWrites > 0
              ? 'bg-rose-950/30 border-rose-500/50 shadow-md shadow-rose-950/30'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider block flex items-center gap-1 ${
              stats.failedWrites > 0 ? 'text-rose-400' : 'text-slate-400'
            }`}
          >
            <XCircle className="w-3 h-3" /> Escrituras Fallidas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-black font-mono ${
                stats.failedWrites > 0 ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {stats.failedWrites}
            </span>
            <span className="text-xs text-slate-500">errores devueltos</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {stats.failedWrites > 0 ? 'Requiere atención' : 'Sin errores de escritura'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Latencia Promedio
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono text-sky-400">{stats.avgLatencyMs}</span>
            <span className="text-xs text-slate-500">ms</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Tiempo de respuesta I/O
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
            Última Escritura
          </span>
          <div className="text-sm font-bold font-mono text-slate-200 mt-1 truncate">
            {stats.lastWriteTimestamp ? new Date(stats.lastWriteTimestamp).toLocaleTimeString() : 'Ninguna'}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Sincronización a disco
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setFilter('writes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'writes'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-400 hover:bg-emerald-950/30'
            }`}
          >
            <span>Solo Escrituras ({stats.writes})</span>
          </button>
          <button
            onClick={() => setFilter('failed_writes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'failed_writes'
                ? 'bg-rose-600 text-white'
                : stats.failedWrites > 0
                ? 'text-rose-400 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Escrituras Fallidas ({stats.failedWrites})</span>
          </button>
          <button
            onClick={() => setFilter('errors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'errors'
                ? 'bg-rose-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todos los Errores ({stats.failedWrites + stats.failedReads})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar endpoint, error, payload..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Logs List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span>Transacciones en Vivo</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
              {logs.length} mostradas
            </span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Haz clic en una fila para inspeccionar el payload y la respuesta devuelta
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <Zap className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
            No hay operaciones registradas con el filtro actual.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {logs.map((entry) => {
              const isExpanded = expandedLogId === entry.id;
              const isError = !entry.success;

              return (
                <div
                  key={entry.id}
                  className={`transition-colors ${
                    isError
                      ? 'bg-rose-950/20 hover:bg-rose-950/30'
                      : 'hover:bg-slate-850/50'
                  }`}
                >
                  <div
                    onClick={() => toggleExpand(entry.id)}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      {/* Success / Error Icon */}
                      <div className="shrink-0 mt-0.5 sm:mt-0">
                        {entry.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                      </div>

                      {/* Method Badge */}
                      <div className="shrink-0">{getMethodBadge(entry)}</div>

                      {/* Endpoint and Status */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-slate-200 truncate">
                            {entry.endpoint}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              entry.success
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400 font-black'
                            }`}
                          >
                            {entry.status ? `HTTP ${entry.status}` : 'ERR'}
                          </span>
                          {entry.context && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              {entry.context}
                            </span>
                          )}
                        </div>

                        {/* Error Message if Failed */}
                        {isError && entry.error && (
                          <p className="text-xs text-rose-400 font-semibold mt-1 flex items-center gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                            <span>Error: {entry.error.message}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Controls */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center text-xs text-slate-400">
                      <span className="font-mono text-[11px] text-sky-400">
                        {entry.durationMs}ms
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(entry.epochMs).toLocaleTimeString()}
                      </span>
                      <button className="p-1 text-slate-400 hover:text-slate-200">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detailed Inspection Drawer */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 space-y-3 text-xs">
                      {/* Error details callout */}
                      {isError && (
                        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-1">
                          <div className="font-bold text-rose-300 flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>Fallo en la Operación de Escritura / Base de Datos:</span>
                          </div>
                          <p className="text-rose-200 text-xs pl-5 font-mono">
                            {entry.error?.message || 'Error desconocido'}
                          </p>
                          {entry.error?.details && (
                            <div className="mt-2 pl-5">
                              <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1">
                                Detalle retornado por el servidor:
                              </span>
                              <pre className="p-2 rounded bg-black/50 text-[11px] font-mono text-rose-300 overflow-x-auto">
                                {JSON.stringify(entry.error.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Request Payload */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-slate-400 font-semibold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Code2 className="w-3.5 h-3.5 text-sky-400" />
                              Payload Enviado (Request Body)
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase">JSON</span>
                          </div>
                          {entry.requestPayload ? (
                            <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-56 scrollbar-thin">
                              {JSON.stringify(entry.requestPayload, null, 2)}
                            </pre>
                          ) : (
                            <div className="text-slate-500 italic text-[11px] p-2">
                              Sin payload en el cuerpo de la petición.
                            </div>
                          )}
                        </div>

                        {/* Response Body */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-slate-400 font-semibold text-[11px]">
                            <span className="flex items-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                              Respuesta de la Base de Datos (Response)
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase font-mono">
                              HTTP {entry.status}
                            </span>
                          </div>
                          {entry.responsePreview ? (
                            <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-56 scrollbar-thin">
                              {JSON.stringify(entry.responsePreview, null, 2)}
                            </pre>
                          ) : isError ? (
                            <div className="text-rose-400 italic text-[11px] p-2">
                              La petición fue rechazada con código HTTP {entry.status}.
                            </div>
                          ) : (
                            <div className="text-slate-500 italic text-[11px] p-2">
                              Respuesta vacía o sin datos parseables.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-mono">
                        <span>ID Transacción: {entry.id}</span>
                        <span>Timestamp: {entry.timestamp}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
