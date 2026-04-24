import React, { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';

import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface BillingStatusResponse {
  subscription_status: string;
  plan_name: string;
  amount_paise: number;
  amount_rupees: number;
  currency: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  razorpay_key_id?: string | null;
  razorpay_plan_id?: string | null;
  razorpay_subscription_id?: string | null;
  payment_required: boolean;
  latest_payment_status?: string | null;
  message?: string;
  subscription_short_url?: string | null;
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err
  ) {
    const response = (err as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail !== null) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
};

const Billing: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<BillingStatusResponse>('/billing/status');
      setBilling(response.data);
      updateUser({ subscription_status: response.data.subscription_status });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load billing status.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  const handleCheckoutRedirect = (checkoutUrl?: string | null) => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  };

  const handleCreateSubscription = async () => {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await api.post<BillingStatusResponse>('/billing/create-subscription');
      setBilling(response.data);
      updateUser({ subscription_status: response.data.subscription_status });
      if (response.data.message) {
        setMessage(response.data.message);
      }
      handleCheckoutRedirect(response.data.subscription_short_url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to start Razorpay checkout.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading billing...</div>;
  }

  const amountLabel = billing ? `Rs ${billing.amount_rupees.toFixed(2)}` : 'Rs 300.00';
  const statusLabel = billing?.subscription_status || user?.subscription_status || 'PENDING';
  const needsPayment = billing?.payment_required ?? true;

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
              <CreditCard className="h-4 w-4 text-emerald-300" />
              Razorpay subscriptions
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">Keep your workspace active.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Billing is managed per business workspace. Complete the Razorpay authorisation once, and renewals continue on your plan schedule.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 p-5">
            <p className="text-sm text-slate-300">Current status</p>
            <p className="mt-2 text-2xl font-black">{statusLabel}</p>
            <p className="mt-1 text-sm text-slate-300">{billing?.plan_name || 'Smart Attend Monthly'}</p>
          </div>
        </div>
      </section>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message || error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{billing?.plan_name || 'Smart Attend Monthly'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                This workspace is billed monthly through Razorpay. When the subscription is inactive, protected admin actions are paused until payment is completed.
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Amount</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{amountLabel}</p>
              <p className="text-sm text-slate-500">{billing?.currency || 'INR'} / month</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Last payment</p>
              <p className="mt-2 font-semibold text-slate-900">{billing?.latest_payment_status || 'No payments yet'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Current period start</p>
              <p className="mt-2 font-semibold text-slate-900">{formatDate(billing?.current_period_start)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Current period end</p>
              <p className="mt-2 font-semibold text-slate-900">{formatDate(billing?.current_period_end)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCreateSubscription}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {needsPayment ? 'Open Razorpay Checkout' : 'Refresh or manage billing'}
            </button>
            <button
              type="button"
              onClick={fetchBillingStatus}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh status
            </button>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">How access works</h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>`/billing` stays open even when payment is due, so you can always complete checkout.</p>
              <p>Protected routes return a payment-required response and can forward you directly into Razorpay checkout.</p>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm leading-6 text-amber-900">
                <p className="font-semibold">Ready for live billing</p>
                <p className="mt-1">
                  Make sure your backend has `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`, and `RAZORPAY_WEBHOOK_SECRET` configured before testing checkout.
                </p>
              </div>
            </div>
          </section>

          {billing?.subscription_short_url && (
            <a
              href={billing.subscription_short_url}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Open hosted Razorpay page
            </a>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Billing;
