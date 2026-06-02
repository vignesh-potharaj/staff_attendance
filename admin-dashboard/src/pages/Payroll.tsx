import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowDownWideNarrow, IndianRupee, Pencil, Save, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import api from '../services/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];


interface PayrollSummary {
  staff_id: number;
  staff_name: string;
  employee_id: string;
  hourly_pay: number;
  total_working_hours: number;
  total_payroll: number;
}

type SortKey = 'name' | 'hours' | 'payroll';
type SortDirection = 'asc' | 'desc';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);

const Payroll: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [summaries, setSummaries] = useState<PayrollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hourlyPayDraft, setHourlyPayDraft] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fetchPayroll = async (date: Date) => {
    setLoading(true);
    try {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const res = await api.get(`/api/payroll/all?month=${month}&year=${year}`);
      setSummaries(res.data);
    } catch {
      alert('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll(selectedDate);
  }, [selectedDate]);

  const sortedSummaries = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'name') {
        return a.staff_name.localeCompare(b.staff_name) * multiplier;
      }
      if (sortKey === 'hours') {
        return (a.total_working_hours - b.total_working_hours) * multiplier;
      }
      return (a.total_payroll - b.total_payroll) * multiplier;
    });
  }, [summaries, sortDirection, sortKey]);

  const startEdit = (summary: PayrollSummary) => {
    setEditingId(summary.staff_id);
    setHourlyPayDraft(String(summary.hourly_pay || 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHourlyPayDraft('');
  };

  const saveHourlyPay = async (staffId: number) => {
    const hourlyPay = Number(hourlyPayDraft);
    if (Number.isNaN(hourlyPay) || hourlyPay < 0) {
      alert('Enter a valid hourly pay amount');
      return;
    }

    setSavingId(staffId);
    try {
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();
      const res = await api.patch(
        `/api/staff/${staffId}/hourly_pay?month=${month}&year=${year}`,
        { hourly_pay: hourlyPay }
      );
      setSummaries((current) =>
        current.map((summary) =>
          summary.staff_id === staffId ? { ...summary, ...res.data } : summary
        )
      );
      cancelEdit();
    } catch {
      alert('Failed to update hourly pay');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Payroll Structure</h2>
        <p className="text-sm text-gray-500 mt-1">Computed from approved attendance hours and staff hourly pay.</p>
      </div>

      {/* Primary Month Selector */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-100">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Payroll Period</h3>
            <p className="text-xl font-bold text-slate-800">
              {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
            }}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded-md transition-colors"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
          
          <button
            type="button"
            onClick={() => {
              setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
            }}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded-md transition-colors"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ArrowDownAZ className="w-4 h-4 text-blue-600" />
              Name
            </span>
            <select
              value={sortKey === 'name' ? sortDirection : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                setSortKey('name');
                setSortDirection(e.target.value as SortDirection);
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
            >
              <option value="">Choose order</option>
              <option value="asc">Alphabetical A-Z</option>
              <option value="desc">Alphabetical Z-A</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ArrowDownWideNarrow className="w-4 h-4 text-blue-600" />
              Working Hours
            </span>
            <select
              value={sortKey === 'hours' ? sortDirection : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                setSortKey('hours');
                setSortDirection(e.target.value as SortDirection);
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
            >
              <option value="">Choose order</option>
              <option value="desc">High to low</option>
              <option value="asc">Low to high</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-blue-600" />
              Total Payment
            </span>
            <select
              value={sortKey === 'payroll' ? sortDirection : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                setSortKey('payroll');
                setSortDirection(e.target.value as SortDirection);
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
            >
              <option value="">Choose order</option>
              <option value="desc">High to low</option>
              <option value="asc">Low to high</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading payroll...</div>
      ) : sortedSummaries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-500">
          No staff members found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSummaries.map((summary) => (
            <div key={summary.staff_id} className="bg-white border border-indigo-100 rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{summary.staff_name}</h3>
                  <p className="text-xs text-slate-500 mt-1">ID: {summary.employee_id}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  {summary.staff_name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                  <p className="text-xs uppercase font-semibold text-blue-700">Working Hours</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{summary.total_working_hours.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                  <p className="text-xs uppercase font-semibold text-emerald-700">Total Payroll</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(summary.total_payroll)}</p>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase font-semibold text-gray-600">Hourly Pay</p>
                    {editingId === summary.staff_id ? (
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={hourlyPayDraft}
                        onChange={(e) => setHourlyPayDraft(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-base font-bold text-slate-900 mt-1">{formatCurrency(summary.hourly_pay)}</p>
                    )}
                  </div>

                  {editingId === summary.staff_id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => saveHourlyPay(summary.staff_id)}
                        disabled={savingId === summary.staff_id}
                        className="p-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-md"
                        aria-label="Save hourly pay"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-md"
                        aria-label="Cancel hourly pay edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(summary)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                      aria-label="Edit hourly pay"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Payroll;
