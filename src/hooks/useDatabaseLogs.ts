import { useState, useEffect, useMemo, useCallback } from 'react';
import { ApiClient } from '../services/api.ts';
import { DatabaseApiLogEntry } from '../types/index.ts';

export type LogFilterType = 'all' | 'writes' | 'failed_writes' | 'errors';

export interface DatabaseMonitorStats {
  total: number;
  writes: number;
  reads: number;
  successfulWrites: number;
  failedWrites: number;
  failedReads: number;
  writeSuccessRate: number; // percentage 0 - 100
  avgLatencyMs: number;
  lastWriteTimestamp: string | null;
  lastFailedWrite: DatabaseApiLogEntry | null;
}

export const useDatabaseLogs = () => {
  const [logs, setLogs] = useState<DatabaseApiLogEntry[]>(() => ApiClient.getLogs());
  const [filter, setFilter] = useState<LogFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Subscribe to real-time logs from ApiClient
    const unsubscribe = ApiClient.subscribeLogs((newLogs) => {
      setLogs(newLogs);

      // State hook audit: if the latest log is a failed write operation, log a state monitor alert
      if (newLogs.length > 0) {
        const latest = newLogs[0];
        if (latest.isWriteOperation && !latest.success) {
          console.warn(
            `%c[STATE HOOK MONITOR: WRITE FAILURE DETECTED] %c${latest.method} ${latest.endpoint} (Status: ${latest.status || 'Network Error'})`,
            'color: #ffffff; background: #b91c1c; font-weight: bold; padding: 2px 8px; border-radius: 4px;',
            'color: #ef4444; font-weight: bold;'
          );
          console.error('[STATE HOOK MONITOR] Error details:', latest.error);
          console.error('[STATE HOOK MONITOR] Rejected payload:', latest.requestPayload);
        }
      }
    });

    return unsubscribe;
  }, []);

  const writeLogs = useMemo(() => logs.filter((l) => l.isWriteOperation), [logs]);
  const failedWriteLogs = useMemo(() => logs.filter((l) => l.isWriteOperation && !l.success), [logs]);
  const failedLogs = useMemo(() => logs.filter((l) => !l.success), [logs]);

  const stats: DatabaseMonitorStats = useMemo(() => {
    const total = logs.length;
    const writes = writeLogs.length;
    const reads = total - writes;
    const failedWrites = failedWriteLogs.length;
    const successfulWrites = writes - failedWrites;
    const failedReads = failedLogs.length - failedWrites;
    const writeSuccessRate = writes > 0 ? Math.round((successfulWrites / writes) * 100) : 100;

    const latencies = logs.filter((l) => l.durationMs > 0).map((l) => l.durationMs);
    const avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((acc, curr) => acc + curr, 0) / latencies.length)
      : 0;

    const lastWrite = writeLogs[0] || null;
    const lastFailed = failedWriteLogs[0] || null;

    return {
      total,
      writes,
      reads,
      successfulWrites,
      failedWrites,
      failedReads,
      writeSuccessRate,
      avgLatencyMs,
      lastWriteTimestamp: lastWrite ? lastWrite.timestamp : null,
      lastFailedWrite: lastFailed,
    };
  }, [logs, writeLogs, failedWriteLogs, failedLogs]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (filter === 'writes') {
      result = result.filter((l) => l.isWriteOperation);
    } else if (filter === 'failed_writes') {
      result = result.filter((l) => l.isWriteOperation && !l.success);
    } else if (filter === 'errors') {
      result = result.filter((l) => !l.success);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => {
        const matchesEndpoint = l.endpoint.toLowerCase().includes(q);
        const matchesMethod = l.method.toLowerCase().includes(q);
        const matchesError = l.error?.message?.toLowerCase().includes(q);
        const matchesPayload = l.requestPayload
          ? JSON.stringify(l.requestPayload).toLowerCase().includes(q)
          : false;
        return matchesEndpoint || matchesMethod || matchesError || matchesPayload;
      });
    }

    return result;
  }, [logs, filter, searchQuery]);

  const clearLogs = useCallback(() => {
    ApiClient.clearLogs();
  }, []);

  // Helper to simulate and test an invalid write to verify that the monitoring pipeline accurately catches write failures
  const testSimulateWriteError = useCallback(async () => {
    try {
      console.log('[STATE HOOK] Initiating intentional test write with invalid data to test error capture...');
      await ApiClient.createAdminPlayer({
        // Missing required fullName and jerseyNumber to trigger validation failure
        position: 'SP',
        teamId: 'invalid-team-id-999',
      } as any);
    } catch (err: any) {
      console.log('[STATE HOOK] Confirmed: Expected test write failure caught successfully:', err.message);
    }
  }, []);

  return {
    logs: filteredLogs,
    rawLogs: logs,
    writeLogs,
    failedWriteLogs,
    failedLogs,
    stats,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    clearLogs,
    testSimulateWriteError,
  };
};
