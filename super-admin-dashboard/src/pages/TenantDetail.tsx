import React, { useEffect, useState } from 'react';
import { Bell, CircleCheck, PauseCircle, Save } from 'lucide-react';
import { useParams } from 'react-router-dom';

import StatusBadge from '../components/StatusBadge';
import api from '../services/api';

interface PaymentRecord {
  id: number;
  amount_paise: number;
  currency: string;
  status: string;
  payment_method?: string | null;
  paid_at?: string | null;
  failure_reason?: string | null;
  notes?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_invoice_id?: string | null;
  razorpay_subscription_id?: string | null;
  created_at?: string | null;
}

interface TenantDetailResponse {
  id: number;
  name: string;
  slug: string;
  owner_name?: string | null;
  email?: string | null;
  phone?: string | null;
  subscription_status?: string | null;
  subscription_amount_paise?: number | null;
  subscription_current_start?: string | null;
  current_period_end?: string | null;
  grace_period_end?: string | null;
  subscription_notes?: string | null;
  suspension_reason?: string | null;
  payments: PaymentRecord[];
}

const currency = (value?: number | null) => `Rs ${((value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toInputDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const TenantDetail: React.FC = () => {
  const { id } = useParams();
  const [tenant, setTenant] = useState<TenantDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subscription_status: 'pending',
    subscription_amount_paise: 30000,
    current_period_end: '',
    grace_period_end: '',
    notes: '',
  });

  const fetchTenant = async () => {
    setLoading(true);
    try {
      const response = await api.get<TenantDetailResponse>(`/super-admin/tenants/${id}`);
      setTenant(response.data);
      setForm({
        subscription_status: (response.data.subscription_status || 'pending').toLowerCase(),
        subscription_amount_paise: response.data.subscription_amount_paise || 30000,
        current_period_end: toInputDate(response.data.current_period_end),
        grace_period_end: toInputDate(response.data.grace_period_end),
        notes: response.data.subscription_notes || '',
      });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail || 'Failed to load tenant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      void fetchTenant();
    }
  }, [id]);

  const saveSubscription = async () => {
    setSaving(true);
    try {
      await api.patch(`/super-admin/tenants/${id}/subscription`, {
        subscription_status: form.subscription_status,
        subscription_amount_paise: Number(form.subscription_amount_paise),
        current_period_end: form.current_period_end || null,
        grace_period_end: form.grace_period_end || null,
        notes: form.notes,
      });
      await fetchTenant();
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (path: string, body?: object) => {
    await api.post(`/super-admin/tenants/${id}/${path}`, body || {});
    await fetchTenant();
  };

  if (loading) return <div className="text-slate-400">Loading tenant...</div>;
  if (error || !tenant) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error || 'Tenant not found.'}</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{tenant.name}</h1>
            <p className="mt-2 text-sm text-slate-400">{tenant.slug}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
              <span>{tenant.owner_name || 'N/A'}</span>
              <span>{tenant.email || 'N/A'}</span>
              <span>{tenant.phone || 'N/A'}</span>
            </div>
          </div>
          <StatusBadge status={tenant.subscription_status} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold text-white">Subscription</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-2"><StatusBadge status={tenant.subscription_status} /></div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Amount</p>
                <p className="mt-2 text-lg font-bold text-white">{currency(tenant.subscription_amount_paise)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Period Start</p>
                <p className="mt-2 text-sm text-slate-200">{tenant.subscription_current_start ? new Date(tenant.subscription_current_start).toLocaleDateString('en-IN') : 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Period End</p>
                <p className="mt-2 text-sm text-slate-200">{tenant.current_period_end ? new Date(tenant.current_period_end).toLocaleDateString('en-IN') : 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Grace Period End</p>
                <p className="mt-2 text-sm text-slate-200">{tenant.grace_period_end ? new Date(tenant.grace_period_end).toLocaleDateString('en-IN') : 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Suspension Reason</p>
                <p className="mt-2 text-sm text-slate-200">{tenant.suspension_reason || 'None'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Edit Subscription</h2>
                <p className="text-sm text-slate-400">Update status, pricing, dates, and notes inline.</p>
              </div>
              <button
                type="button"
                onClick={() => void saveSubscription()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:bg-blue-300"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Status</span>
                <select
                  value={form.subscription_status}
                  onChange={event => setForm(current => ({ ...current, subscription_status: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Plan Amount (paise)</span>
                <input
                  type="number"
                  value={form.subscription_amount_paise}
                  onChange={event => setForm(current => ({ ...current, subscription_amount_paise: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Current Period End</span>
                <input
                  type="date"
                  value={form.current_period_end}
                  onChange={event => setForm(current => ({ ...current, current_period_end: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Grace Period End</span>
                <input
                  type="date"
                  value={form.grace_period_end}
                  onChange={event => setForm(current => ({ ...current, grace_period_end: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-300">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold text-white">Payment History</h2>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Method</th>
                    <th className="px-4 py-3 text-left font-medium">Paid At</th>
                    <th className="px-4 py-3 text-left font-medium">Failure Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {tenant.payments.length ? (
                    tenant.payments.map(payment => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-slate-200">{currency(payment.amount_paise)}</td>
                        <td className="px-4 py-3 text-slate-200">{payment.status}</td>
                        <td className="px-4 py-3 text-slate-400">{payment.payment_method || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-400">{payment.paid_at ? new Date(payment.paid_at).toLocaleString('en-IN') : 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-400">{payment.failure_reason || 'N/A'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-4 text-slate-400" colSpan={5}>
                        No payments recorded for this tenant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <button
            type="button"
            onClick={() => void runAction('mark-paid')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
          >
            <CircleCheck className="h-4 w-4" />
            Mark as Paid
          </button>
          <button
            type="button"
            onClick={() => void runAction('suspend', { reason: 'Suspended from tenant detail page' })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/15"
          >
            <PauseCircle className="h-4 w-4" />
            Suspend
          </button>
          <button
            type="button"
            onClick={() => void runAction('send-payment-reminder')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/15"
          >
            <Bell className="h-4 w-4" />
            Send Payment Reminder
          </button>
        </aside>
      </div>
    </div>
  );
};

export default TenantDetail;
