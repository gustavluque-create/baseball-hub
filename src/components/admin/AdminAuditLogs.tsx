import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  User,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { AdminAuditLog } from '../../types/index.ts';
import { ApiClient } from '../../services/api.ts';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const fetched = await ApiClient.getAdminAuditLogs(100);
      setLogs(fetched);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleResetDemo = async () => {
    const confirmation = prompt(
      'ADVERTENCIA: Esta acción restablecerá todas las tablas de partidos, jugadores, estadísticas y noticias a los valores iniciales de demostración.\n\nEscriba "RESTABLECER" para confirmar:'
    );
    if (confirmation !== 'RESTABLECER') {
      alert('Operación cancelada.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await ApiClient.resetAdminDemo();
      setStatusMessage(res.message);
      await fetchLogs();
    } catch (err: any) {
      alert(`Error al restablecer sistema: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (categoryFilter === 'all') return true;
    return l.category === categoryFilter;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'auth':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'games':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'players':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'teams':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'etl':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'system':
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Top Filter & Reset Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400 font-bold">Filtrar por:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-semibold focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Todas las Categorías ({logs.length})</option>
            <option value="auth">Seguridad &amp; Acceso (Auth)</option>
            <option value="games">Partidos en Vivo (Games)</option>
            <option value="players">Roster &amp; Jugadores (Players)</option>
            <option value="teams">Equipos &amp; Logos (Teams)</option>
            <option value="etl">Ingesta ETL (Data)</option>
            <option value="system">Sistema General</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Recargar registros"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleResetDemo}
            disabled={isResetting}
            className="px-3.5 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Restablecer base de datos a los valores demo de fábrica"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Restablecer Datos Demo</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 text-xs font-bold text-slate-400 flex items-center justify-between">
          <span>Registro de Auditoría y Seguridad ({filteredLogs.length} eventos)</span>
          <span className="text-[10px] text-slate-500 font-mono">Trazabilidad inmutable</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Usuario</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Acción</th>
                <th className="py-2.5 px-3">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No hay registros de auditoría para este criterio.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}{' '}
                      <span className="text-slate-600 text-[10px]">
                        ({new Date(log.timestamp).toLocaleDateString()})
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-200 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {log.username}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getCategoryBadge(
                          log.category
                        )}`}
                      >
                        {log.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-100">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-md truncate">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
