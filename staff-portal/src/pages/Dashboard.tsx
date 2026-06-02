import React, { useEffect, useState } from 'react';
import { CalendarCheck, Clock, IndianRupee, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface AttendanceRecord {
  duration_hours: number;
  check_in_time?: string;
  check_out_time?: string | null;
}

interface MonthlySummary {
  total_working_hours: number;
  total_payroll: number;
  hourly_pay: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const [todayRes, monthlyRes] = await Promise.all([
          api.get(`/api/attendance/staff/${user.id}/today`),
          api.get(`/api/attendance/staff/${user.id}/monthly`),
        ]);
        setToday(todayRes.data);
        setMonthly(monthlyRes.data);
      } catch {
        console.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [user?.id]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center sm:text-left">
        <p className="text-sm font-semibold text-blue-600">Staff Dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Welcome, {user?.name}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Timer className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Today's Working Hours</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '...' : (today?.duration_hours || 0).toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-500">This Month's Total Hours</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '...' : (monthly?.total_working_hours || 0).toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <IndianRupee className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-500">This Month's Payroll</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '...' : formatCurrency(monthly?.total_payroll || 0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center">
        <CalendarCheck className="w-12 h-12 mx-auto text-blue-600 mb-4" />
        <button
          type="button"
          onClick={() => navigate('/staff/mark-attendance')}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700"
        >
          <CalendarCheck className="w-5 h-5" />
          Mark Attendance
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
