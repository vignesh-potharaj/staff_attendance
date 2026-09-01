import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowDownWideNarrow, IndianRupee, Pencil, Save, X, ChevronLeft, ChevronRight, Calendar, Clock, SlidersHorizontal, Download } from 'lucide-react';
import api from '../services/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

type PayMode = 'hourly' | 'daily';

interface PayrollSummary {
  staff_id: number;
  staff_name: string;
  employee_id: string;
  hourly_pay: number;
  daily_pay?: number;
  pay_type?: PayMode;
  total_working_hours: number;
  total_working_days?: number;
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
  const [payRateDraft, setPayRateDraft] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const [payModes, setPayModes] = useState<Record<number, PayMode>>({});

  const fetchPayroll = async (date: Date) => {
    setLoading(true);
    try {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const res = await api.get(`/api/payroll/all?month=${month}&year=${year}`);
      setSummaries(res.data);

      const initialModes: Record<number, PayMode> = {};
      (res.data as PayrollSummary[]).forEach((item) => {
        initialModes[item.staff_id] = item.pay_type || 'hourly';
      });
      setPayModes(initialModes);
    } catch {
      alert('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll(selectedDate);
  }, [selectedDate]);

  const togglePayMode = (staffId: number, mode: PayMode) => {
    setPayModes((prev) => ({
      ...prev,
      [staffId]: mode,
    }));
  };

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
    const currentMode = payModes[summary.staff_id] || 'hourly';
    setEditingId(summary.staff_id);
    if (currentMode === 'daily') {
      const dailyPay = summary.daily_pay !== undefined ? summary.daily_pay : summary.hourly_pay * 8;
      setPayRateDraft(String(dailyPay || 0));
    } else {
      setPayRateDraft(String(summary.hourly_pay || 0));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPayRateDraft('');
  };

  const savePayRate = async (staffId: number) => {
    const rate = Number(payRateDraft);
    if (Number.isNaN(rate) || rate < 0) {
      alert('Enter a valid pay amount');
      return;
    }

    const currentMode = payModes[staffId] || 'hourly';
    setSavingId(staffId);

    try {
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();
      
      const payload = currentMode === 'daily' 
        ? { daily_pay: rate, pay_type: 'daily', hourly_pay: rate / 8 }
        : { hourly_pay: rate, pay_type: 'hourly' };

      const res = await api.patch(
        `/api/staff/${staffId}/hourly_pay?month=${month}&year=${year}`,
        payload
      );

      setSummaries((current) =>
        current.map((summary) =>
          summary.staff_id === staffId 
            ? { 
                ...summary, 
                ...res.data,
                hourly_pay: currentMode === 'daily' ? rate / 8 : rate,
                daily_pay: currentMode === 'daily' ? rate : rate * 8
              } 
            : summary
        )
      );
      cancelEdit();
    } catch {
      setSummaries((current) =>
        current.map((summary) => {
          if (summary.staff_id !== staffId) return summary;
          const newHourly = currentMode === 'daily' ? rate / 8 : rate;
          const newDaily = currentMode === 'daily' ? rate : rate * 8;
          return {
            ...summary,
            hourly_pay: newHourly,
            daily_pay: newDaily,
            pay_type: currentMode,
            total_payroll: currentMode === 'daily' 
              ? (summary.total_working_days ?? (summary.total_working_hours / 8)) * newDaily 
              : summary.total_working_hours * newHourly
          };
        })
      );
      cancelEdit();
    } finally {
      setSavingId(null);
    }
  };

  const setAllPayModes = (mode: PayMode) => {
    const updated: Record<number, PayMode> = {};
    summaries.forEach((s) => {
      updated[s.staff_id] = mode;
    });
    setPayModes(updated);
  };

  const handleExportCSV = async () => {
    try {
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();
      const res = await api.get(`/api/payroll/export/csv?month=${month}&year=${year}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payroll_Report_${year}_${String(month).padStart(2, '0')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export payroll report CSV');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Payroll Structure</h2>
          <p className="text-sm text-gray-500 mt-1">Computed from approved attendance, working hours, and staff pay rates.</p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Shift All Control */}
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 p-1.5 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 px-2 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Shift All:
            </span>
            <button
              type="button"
              onClick={() => setAllPayModes('hourly')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-slate-700 hover:bg-white hover:shadow-xs"
            >
              <Clock className="w-3.5 h-3.5 text-blue-600" /> Hourly
            </button>
            <button
              type="button"
              onClick={() => setAllPayModes('daily')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-slate-700 hover:bg-white hover:shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Days
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-all"
            title="Export Payroll Report CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

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
          {sortedSummaries.map((summary) => {
            const mode = payModes[summary.staff_id] || 'hourly';
            const isDaily = mode === 'daily';

            const workingHours = summary.total_working_hours || 0;
            const workingDays = summary.total_working_days !== undefined 
              ? summary.total_working_days 
              : Number((workingHours / 8).toFixed(2));
            
            const hourlyRate = summary.hourly_pay || 0;
            const dailyRate = summary.daily_pay !== undefined 
              ? summary.daily_pay 
              : hourlyRate * 8;

            const displayRate = isDaily ? dailyRate : hourlyRate;
            const computedPayroll = isDaily
              ? workingDays * dailyRate
              : workingHours * hourlyRate;

            const finalPayroll = summary.total_payroll > 0 ? summary.total_payroll : computedPayroll;

            return (
              <div key={summary.staff_id} className="bg-white border border-indigo-100 rounded-xl shadow-sm p-5 space-y-4 relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{summary.staff_name}</h3>
                    <p className="text-xs text-slate-500 mt-1">ID: {summary.employee_id}</p>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => togglePayMode(summary.staff_id, 'hourly')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        !isDaily
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                      title="Shift to Hourly Pay"
                    >
                      <Clock className="w-3 h-3" />
                      Hourly
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePayMode(summary.staff_id, 'daily')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        isDaily
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                      title="Shift to Daily/Days Pay"
                    >
                      <Calendar className="w-3 h-3" />
                      Days
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-3 border transition-colors ${
                    isDaily 
                      ? 'bg-emerald-50/70 border-emerald-100' 
                      : 'bg-blue-50/70 border-blue-100'
                  }`}>
                    <p className={`text-xs uppercase font-semibold flex items-center gap-1 ${
                      isDaily ? 'text-emerald-700' : 'text-blue-700'
                    }`}>
                      {isDaily ? <Calendar className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {isDaily ? 'Working Days' : 'Working Hours'}
                    </p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {isDaily ? workingDays.toFixed(2) : workingHours.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-xs uppercase font-semibold text-emerald-700">Total Payroll</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(finalPayroll)}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase font-semibold text-slate-600 flex items-center gap-1">
                        {isDaily ? 'Daily Pay (Day Rate)' : 'Hourly Pay'}
                      </p>
                      {editingId === summary.staff_id ? (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-sm font-semibold text-slate-500">₹</span>
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={payRateDraft}
                            onChange={(e) => setPayRateDraft(e.target.value)}
                            className="block w-full border border-slate-300 rounded-md py-1.5 px-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={isDaily ? 'Enter daily rate' : 'Enter hourly rate'}
                          />
                        </div>
                      ) : (
                        <p className="text-base font-bold text-slate-900 mt-1">
                          {formatCurrency(displayRate)}
                          <span className="text-xs font-normal text-slate-500 ml-1">
                            {isDaily ? '/ day' : '/ hr'}
                          </span>
                        </p>
                      )}
                    </div>

                    {editingId === summary.staff_id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => savePayRate(summary.staff_id)}
                          disabled={savingId === summary.staff_id}
                          className="p-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-md shadow-xs transition-colors"
                          aria-label="Save pay rate"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-2 text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                          aria-label="Cancel editing"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(summary)}
                        className="p-2 text-blue-600 hover:bg-blue-100/70 rounded-md transition-colors"
                        aria-label="Edit pay rate"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Payroll;
