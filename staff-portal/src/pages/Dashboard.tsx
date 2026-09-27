import React, { useEffect, useState } from 'react';
import { Award, Bell, BellOff, CalendarCheck, CheckCircle2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { checkNativeNotificationPermission } from '../native/batteryPlugin';
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleShiftReminders,
  subscribeUserToPush,
} from '../services/notificationService';

interface CadetAttendanceSummary {
  month_present_days: number;
  overall_present_days: number;
  month_total_sessions?: number;
  overall_total_sessions?: number;
  month_attendance_pct?: number;
  overall_attendance_pct?: number;
  month_late_count?: number;
  overall_late_count?: number;
  month_absent_count?: number;
  overall_absent_count?: number;
  today?: {
    marked: boolean;
    status?: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    expected_fall_in_time?: string | null;
  } | null;
  session?: {
    has_session: boolean;
    is_active: boolean;
    is_visarjan_passed?: boolean;
    title?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    require_location?: boolean;
    location?: {
      id: number;
      name: string;
      radius_meters: number;
      maps_link?: string;
    } | null;
  } | null;
  duty_location?: {
    id: number;
    name: string;
    radius_meters: number;
    maps_link?: string;
    is_custom_post: boolean;
  } | null;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CadetAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getNotificationPermission());

  // Dynamically sync permission state when window regains focus or visibility changes
  useEffect(() => {
    const syncPermission = async () => {
      let current = getNotificationPermission();
      try {
        const nativePerm = await checkNativeNotificationPermission();
        if (nativePerm === 'granted') {
          current = 'granted';
        }
      } catch {}
      setNotifPermission(current);
    };

    syncPermission();

    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    const interval = setInterval(syncPermission, 2000);

    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
      clearInterval(interval);
    };
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      await subscribeUserToPush(api, true);
    }
  };



  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        // Automatically request permission and sync push subscription on startup
        subscribeUserToPush(api).catch(() => {});
        const summaryRes = await api.get(`/attendance/staff/${user.id}/summary`);
        setSummary(summaryRes.data);

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
          <p className="text-xs font-black text-[#00AEEF] uppercase tracking-wider">Cadet Control Panel</p>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2D3092] mt-1">Welcome, {user?.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap justify-center sm:justify-start">
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
              Regt: <span className="text-[#EF1C25] font-black">{user?.employee_id}</span>
            </span>
            {user?.roll_number && (
              <span className="text-xs font-mono font-bold text-[#2D3092] bg-[#2D3092]/10 px-2.5 py-0.5 rounded-lg border border-[#2D3092]/20 shadow-2xs">
                Roll: {user.roll_number}
              </span>
            )}
            {user?.department && (
              <span className="text-xs font-bold text-[#EF1C25] bg-[#EF1C25]/10 px-2.5 py-0.5 rounded-lg border border-[#EF1C25]/20 shadow-2xs">
                Dept: {user.department}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifPermission === 'default' && (
            <button
              onClick={handleEnableNotifications}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-medium text-sm transition-colors"
            >
              <Bell className="w-4 h-4 text-blue-600" />
              Enable Session & Attendance Reminders
            </button>
          )}

          {notifPermission === 'granted' && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium">
              <Bell className="w-3.5 h-3.5 text-emerald-600" />
              Notifications Active
            </div>
          )}

          {notifPermission === 'denied' && (
            <button
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              title="Click to sync notification permissions with browser/app"
            >
              <BellOff className="w-3.5 h-3.5 text-amber-600" />
              <span>Notifications Blocked (Click to Sync)</span>
            </button>
          )}

        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: This Month's Attendance */}
        <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-[#2D3092] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-[#2D3092]/10 text-[#2D3092] flex items-center justify-center font-bold">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1.5">
              {summary?.month_attendance_pct != null && (
                <span className="text-[11px] font-bold px-2 py-0.5 bg-[#2D3092]/10 text-[#2D3092] rounded-full">
                  {summary.month_attendance_pct}%
                </span>
              )}
              <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month's Attendance</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p className="text-3xl font-black text-[#2D3092]">
              {loading ? '...' : (summary?.month_present_days ?? 0)}
            </p>
            {summary?.month_total_sessions != null && (
              <span className="text-lg font-bold text-slate-400">
                / {summary.month_total_sessions}
              </span>
            )}
            <span className="text-sm font-bold text-slate-500 ml-1">
              {(summary?.month_present_days ?? 0) === 1 ? 'Session Attended' : 'Sessions Attended'}
            </span>
          </div>
        </div>

        {/* Card 2: Overall Attendance */}
        <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-[#00AEEF] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center font-bold">
              <Award className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1.5">
              {summary?.overall_attendance_pct != null && (
                <span className="text-[11px] font-bold px-2 py-0.5 bg-[#00AEEF]/10 text-[#00AEEF] rounded-full">
                  {summary.overall_attendance_pct}%
                </span>
              )}
              <span className="text-[11px] font-bold px-2.5 py-1 bg-sky-50 text-[#00AEEF] rounded-full">
                All-Time
              </span>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Attendance</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p className="text-3xl font-black text-[#00AEEF]">
              {loading ? '...' : (summary?.overall_present_days ?? 0)}
            </p>
            {summary?.overall_total_sessions != null && (
              <span className="text-lg font-bold text-slate-400">
                / {summary.overall_total_sessions}
              </span>
            )}
            <span className="text-sm font-bold text-slate-500 ml-1">
              {(summary?.overall_present_days ?? 0) === 1 ? 'Session Attended' : 'Sessions Attended'}
            </span>
          </div>
        </div>
      </div>

      <div className="relative bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center space-y-4 overflow-hidden">
        {/* NCC Tri-Color Top Accent Line */}
        <div className="ncc-tricolor-bar absolute top-0 left-0 right-0">
          <div className="stripe-red" />
          <div className="stripe-navy" />
          <div className="stripe-skyblue" />
        </div>

        <CalendarCheck className="w-12 h-12 mx-auto text-[#EF1C25] mt-1" />
        <div>
          <h3 className="text-lg font-black text-[#2D3092] uppercase tracking-tight">Parade & Drill Attendance</h3>
          {summary?.today?.marked ? (
            <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Today's Parade: Recorded ({summary.today.status})</span>
              {summary.today.check_in_time && (
                <span className="text-emerald-800">
                  • Fall-In: {new Date(summary.today.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ) : summary?.session?.is_active ? (
            <div className="space-y-1.5 mt-2">
              {summary.session.is_visarjan_passed ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Session Concluded: {summary.session.title || 'Parade / Drill'} (Visarjan Ended)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Live Session: {summary.session.title || 'Parade / Drill'} (OPEN)</span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Drill Timings: {summary.session.start_time || '07:00'} → {summary.session.end_time || '09:30'}
                {summary.session.is_visarjan_passed ? (
                  <span className="text-rose-600 font-bold ml-1">• Visarjan time has passed. Fall-In attendance is closed.</span>
                ) : (
                  <span> • Mark your attendance with GPS + Selfie</span>
                )}
              </p>
              {summary.session.require_location === false ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>Open Location Mode (Instructor disabled geofence for multi-station deployment)</span>
                </div>
              ) : summary.duty_location ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#2D3092] text-xs font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-[#EF1C25]" />
                  <span>
                    {summary.duty_location.is_custom_post ? 'Assigned Duty Post' : 'Parade Ground'}: <strong className="font-bold text-[#2D3092]">{summary.duty_location.name}</strong> (within {summary.duty_location.radius_meters}m)
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1 mt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold">
                <span>⚪ No Active Session Today</span>
              </div>
              <p className="text-xs text-slate-500">
                Parades are held on-demand. Fall-In opens when an instructor activates a drill session.
              </p>
            </div>
          )}
        </div>
        <div>
          {summary?.today?.marked ? (
            <button
              type="button"
              onClick={() => navigate('/staff/mark-attendance')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>View / Visarjan (Check-Out)</span>
            </button>
          ) : summary?.session?.is_active ? (
            summary.session.is_visarjan_passed ? (
              <button
                type="button"
                onClick={() => alert(`Parade session concluded. Visarjan time was ${summary?.session?.end_time || '12:30'}. Attendance can no longer be marked.`)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-slate-100 text-slate-500 font-bold text-sm border border-slate-300 transition-all cursor-pointer hover:bg-slate-200"
              >
                <CalendarCheck className="w-5 h-5 text-slate-400" />
                <span>Fall-In Closed (Visarjan Ended)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/staff/mark-attendance')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#EF1C25] text-white font-black text-base shadow-lg hover:bg-[#C7131B] border-b-2 border-[#FFCB06] transition-all cursor-pointer active:scale-95"
              >
                <CalendarCheck className="w-6 h-6 text-[#FFCB06]" />
                <span>Mark Attendance (Selfie + GPS)</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => alert('No active parade or drill session today. Fall-in is closed until your instructor activates a session.')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-slate-100 text-slate-500 font-bold text-sm border border-slate-200 transition-all cursor-pointer hover:bg-slate-200"
            >
              <CalendarCheck className="w-5 h-5 text-slate-400" />
              <span>Fall-In Closed (No Session Today)</span>
            </button>
          )}
        </div>
      </div>


    </div>
  );
};

export default Dashboard;



