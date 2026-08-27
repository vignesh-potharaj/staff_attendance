import React, { useEffect, useState } from 'react';
import { Bell, Building2, CalendarCheck, Clock, IndianRupee, MapPin, ShieldCheck, Timer, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleShiftReminders,
} from '../services/notificationService';

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
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getNotificationPermission());

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  };

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

        // Fetch today's roaster to schedule shift reminders
        const todayDate = new Date().toISOString().split('T')[0];
        try {
          const roasterRes = await api.get('/roaster/staff/my-roaster', {
            params: { start_date: todayDate, end_date: todayDate }
          });
          if (Array.isArray(roasterRes.data) && roasterRes.data.length > 0) {
            const todayRoster = roasterRes.data[0];
            if (!todayRoster.is_leave && !todayRoster.is_week_off) {
              scheduleShiftReminders(todayRoster.start_time, todayRoster.end_time);
            }
          }
        } catch {
          // Roaster fetch is optional
        }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-blue-600">Staff Dashboard</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Welcome, {user?.name}</h1>
        </div>

        {notifPermission === 'default' && (
          <button
            onClick={handleEnableNotifications}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-medium text-sm transition-colors"
          >
            <Bell className="w-4 h-4 text-blue-600" />
            Enable Shift & Check-in Reminders
          </button>
        )}

        {notifPermission === 'granted' && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium self-start sm:self-center">
            <Bell className="w-3.5 h-3.5 text-emerald-600" />
            Notifications Active
          </div>
        )}
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

      {/* Workspace Details Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Workspace Details</h2>
              <p className="text-xs text-slate-500">Information about your assigned workplace & organization</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 w-fit">
            <ShieldCheck className="w-3.5 h-3.5" />
            {user?.subscription_status === 'ACTIVE' || !user?.subscription_status ? 'Active Workspace' : user.subscription_status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Workspace Info Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Business / Workspace</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Workspace Name</span>
                <span className="text-sm font-bold text-slate-900">{user?.tenant_name || 'Default Workspace'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Workspace Slug</span>
                <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{user?.tenant_slug || 'default'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Tenant ID</span>
                <span className="text-sm font-semibold text-slate-700">#{user?.tenant_id || 1}</span>
              </div>
            </div>
          </div>

          {/* Location & Attendance Rules Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" /> Location Policy
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Geofence Radius</span>
                <span className="text-sm font-bold text-slate-900">{user?.geofence_radius_meters || 100} meters</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Verification Method</span>
                <span className="text-sm font-semibold text-slate-700">GPS & Selfie Photo</span>
              </div>
              {user?.geofence_maps_link && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-slate-600 font-medium">Workplace Map</span>
                  <a
                    href={user.geofence_maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View Map →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Employee Profile Section */}
        <div className="pt-2 border-t border-slate-100">
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">Employee ID: <span className="font-semibold text-slate-700">{user?.employee_id}</span> • Role: <span className="capitalize">{user?.role || 'Staff'}</span></p>
              </div>
            </div>
            {user?.email && (
              <div className="text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-500">Contact:</span> {user.email}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;



