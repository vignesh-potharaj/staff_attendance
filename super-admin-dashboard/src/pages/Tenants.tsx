import React, { useEffect, useMemo, useState } from 'react';
import { CircleCheck, Eye, PauseCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import StatusBadge from '../components/StatusBadge';
import api from '../services/api';

interface TenantSummary {
  id: number;
  name: string;
  slug: string;
  owner_name?: string | null;
  email?: string | null;
  phone?: string | null;
  subscription_status?: string | null;
  subscription_amount_paise?: number | null;
  current_period_end?: string | null;
  grace_period_end?: string | null;
  created_at?: string | null;
  total_payments_count: number;
  last_payment_date?: string | null;
}

const FILTERS = ['all', 'active', 'pending', 'suspended', 'cancelled'] as const;

const currency = (value?: number | null) => `Rs ${((value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Tenants: React.FC = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const response = await api.get<TenantSummary[]>('/super-admin/tenants');
      setTenants(response.data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail || 'Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const filteredTenants = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tenants.filter(tenant => {
      const statusMatches = filter === 'all' || (tenant.subscription_status || '').toLowerCase() === filter;
      const searchMatches =
        !normalizedSearch ||
        tenant.name.toLowerCase().includes(normalizedSearch) ||
        (tenant.email || '').toLowerCase().includes(normalizedSearch);
      return statusMatches && searchMatches;
    });
  }, [filter, search, tenants]);

  const markPaid = async (tenantId: number) => {
    await api.post(`/super-admin/tenants/${tenantId}/mark-paid`);
    fetchTenants();
  };

  const suspend = async (tenantId: number) => {
    await api.post(`/super-admin/tenants/${tenantId}/suspend`, { reason: 'Suspended from tenants list' });
    fetchTenants();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-sm text-slate-400">Search, filter, and take action on any business workspace.</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by business name or email"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none transition focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
              filter === item ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/70 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Business Name</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Plan Amount</th>
              <th className="px-4 py-3 text-left font-medium">Period End</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={8}>
                  Loading tenants...
                </td>
              </tr>
            ) : filteredTenants.length ? (
              filteredTenants.map(tenant => (
                <tr key={tenant.id} className="align-top text-slate-200">
                  <td className="px-4 py-4">
                    <p className="font-semibold">{tenant.name}</p>
                    <p className="text-xs text-slate-500">{tenant.slug}</p>
                  </td>
                  <td className="px-4 py-4">{tenant.owner_name || 'N/A'}</td>
                  <td className="px-4 py-4">{tenant.email || 'N/A'}</td>
                  <td className="px-4 py-4">{tenant.phone || 'N/A'}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={tenant.subscription_status} />
                  </td>
                  <td className="px-4 py-4">{currency(tenant.subscription_amount_paise)}</td>
                  <td className="px-4 py-4">{tenant.current_period_end ? new Date(tenant.current_period_end).toLocaleDateString('en-IN') : 'N/A'}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/tenants/${tenant.id}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/tenants/${tenant.id}`)}
                        className="rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/10"
                      >
                        Edit Subscription
                      </button>
                      <button
                        type="button"
                        onClick={() => void markPaid(tenant.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <CircleCheck className="h-3.5 w-3.5" />
                        Mark Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => void suspend(tenant.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                      >
                        <PauseCircle className="h-3.5 w-3.5" />
                        Suspend
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={8}>
                  No tenants match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Tenants;
