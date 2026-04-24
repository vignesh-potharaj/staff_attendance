import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CircleDollarSign, Clock3, ShieldAlert, Users } from 'lucide-react';

import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

interface AnalyticsResponse {
  total_tenants: number;
  active_count: number;
  pending_count: number;
  suspended_count: number;
  cancelled_count: number;
  total_revenue: number;
  revenue_this_month: number;
  upcoming_renewals_in_next_7_days: Array<{ tenant_name: string; period_end: string | null }>;
  failed_payments_this_month: number;
}

const currency = (value: number) => `Rs ${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Dashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get<AnalyticsResponse>('/super-admin/analytics');
        setAnalytics(response.data);
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
        setError(detail || 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = useMemo(
    () =>
      analytics
        ? [
            { label: 'Total Tenants', value: analytics.total_tenants, icon: Building2 },
            { label: 'Active', value: analytics.active_count, icon: Users },
            { label: 'Pending', value: analytics.pending_count, icon: Clock3 },
            { label: 'Suspended', value: analytics.suspended_count, icon: ShieldAlert },
            { label: 'Revenue This Month', value: currency(analytics.revenue_this_month), icon: CircleDollarSign },
            { label: 'Total Revenue', value: currency(analytics.total_revenue), icon: CircleDollarSign },
          ]
        : [],
    [analytics]
  );

  if (loading) return <div className="text-slate-400">Loading dashboard...</div>;
  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{card.label}</p>
                <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
              </div>
              <div className="rounded-xl bg-slate-800 p-3 text-blue-300">
                <card.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Upcoming Renewals</h3>
              <p className="text-sm text-slate-400">Tenants whose billing period ends in the next 7 days.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium">Period End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {analytics?.upcoming_renewals_in_next_7_days.length ? (
                  analytics.upcoming_renewals_in_next_7_days.map(item => (
                    <tr key={`${item.tenant_name}-${item.period_end}`}>
                      <td className="px-4 py-3 text-slate-200">{item.tenant_name}</td>
                      <td className="px-4 py-3 text-slate-400">{item.period_end ? new Date(item.period_end).toLocaleDateString('en-IN') : 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan={2}>
                      No renewals due in the next 7 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-500/15 p-3 text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Recent Failed Payments</h3>
                <p className="mt-2 text-3xl font-black text-white">{analytics?.failed_payments_this_month || 0}</p>
                <p className="mt-1 text-sm text-slate-400">Failed payments recorded this month.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-lg font-bold text-white">Status Breakdown</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Active</span>
                <StatusBadge status="active" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Pending</span>
                <StatusBadge status="pending" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Suspended</span>
                <StatusBadge status="suspended" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Cancelled</span>
                <StatusBadge status="cancelled" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
