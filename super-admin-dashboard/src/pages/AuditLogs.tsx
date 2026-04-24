import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import api from '../services/api';

interface AuditLogEntry {
  id: number;
  action: string;
  tenant_id?: number | null;
  tenant_name?: string | null;
  changed_fields: string[];
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  notes?: string | null;
  performed_at: string;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get<AuditLogEntry[]>('/super-admin/audit-logs');
        setLogs(response.data);
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
        setError(detail || 'Failed to load audit logs.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedAction = actionFilter.trim().toLowerCase();
    return logs.filter(log => {
      const actionMatches = !normalizedAction || log.action.toLowerCase().includes(normalizedAction);
      const tenantMatches = !normalizedSearch || (log.tenant_name || '').toLowerCase().includes(normalizedSearch);
      return actionMatches && tenantMatches;
    });
  }, [actionFilter, logs, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-slate-400">Every super-admin mutation is recorded here.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Filter by tenant name"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none transition focus:border-blue-500"
            />
          </div>
          <input
            value={actionFilter}
            onChange={event => setActionFilter(event.target.value)}
            placeholder="Filter by action type"
            className="min-w-[220px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none transition focus:border-blue-500"
          />
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/70 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Tenant Name</th>
              <th className="px-4 py-3 text-left font-medium">Changed Fields</th>
              <th className="px-4 py-3 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>
                  Loading audit logs...
                </td>
              </tr>
            ) : filteredLogs.length ? (
              filteredLogs.map(log => (
                <tr key={log.id}>
                  <td className="px-4 py-4 text-slate-300">{new Date(log.performed_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-4 text-slate-200">{log.action}</td>
                  <td className="px-4 py-4 text-slate-200">{log.tenant_name || 'N/A'}</td>
                  <td className="px-4 py-4 text-slate-400">{log.changed_fields.length ? log.changed_fields.join(', ') : 'No field changes'}</td>
                  <td className="px-4 py-4 text-slate-400">{log.notes || 'N/A'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>
                  No audit entries match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;
