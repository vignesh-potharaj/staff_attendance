import React, { useEffect, useState } from 'react';
import { Award, Battery, Bell, BellOff, Building2, CalendarCheck, CheckCircle2, MapPin, ShieldCheck, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { BatteryPermissionModal } from '../components/BatteryPermissionModal';
import { checkNativeNotificationPermission, checkNativeBatteryOptimizationStatus } from '../native/batteryPlugin';
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleShiftReminders,
  subscribeUserToPush,
  triggerDelayedTestNotification,
} from '../services/notificationService';

interface CadetAttendanceSummary {
  month_present_days: number;
  overall_present_days: number;
  today?: {
    marked: boolean;
    status?: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    expected_fall_in_time?: string | null;
  } | null;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CadetAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [inAppToast, setInAppToast] = useState<{ title: string; body: string; time: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message: string | null; error: boolean }>({
    loading: false,
    message: null,
    error: false,
  });
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showBatteryModal, setShowBatteryModal] = useState(false);
  const [isBatteryIgnored, setIsBatteryIgnored] = useState<boolean>(false);
  const [pushLogs, setPushLogs] = useState<string[]>([]);
  const isDevBranch = import.meta.env.VITE_APP_ENV === 'development' || import.meta.env.DEV;

  // Dynamically sync permission state when window regains focus or visibility changes
  useEffect(() => {
    const syncPermission = async () => {
      let current = getNotificationPermission();
      try {
        const nativePerm = await checkNativeNotificationPermission();
        if (nativePerm === 'granted') {
          current = 'granted';
        }
        const batteryStatus = await checkNativeBatteryOptimizationStatus();
        setIsBatteryIgnored(batteryStatus);
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

  const addLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setPushLogs((prev) => [`[${timeStr}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handleForcePushSync = async () => {
    setSyncStatus({ loading: true, message: 'Syncing push subscription with backend...', error: false });
    addLog('Initiating force push subscription sync...');

    const res = await subscribeUserToPush(api, true);
    setSyncStatus({
      loading: false,
      message: res.message,
      error: !res.success,
    });
    addLog(res.success ? `✅ Sync Success: ${res.message}` : `❌ Sync Failed: ${res.message}`);
    setNotifPermission(getNotificationPermission());
  };

  const handleEnableNotifications = async () => {
    addLog('Requesting notification permission...');
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      addLog('Permission granted! Syncing push endpoint...');
      await handleForcePushSync();
    } else {
      addLog(`Permission result: '${perm}'`);
    }
  };

  const handleRunTestNotification = () => {
    if (getNotificationPermission() !== 'granted') {
      alert('Please enable notifications first by clicking "Enable Shift & Check-in Reminders".');
      return;
    }

    setTestCountdown(3);
    addLog('🧪 Triggered 3s delayed test notification. Exit or minimize app now!');
    triggerDelayedTestNotification(3000);

    const interval = setInterval(() => {
      setTestCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    setTimeout(() => {
      try { window.blur(); } catch {}
    }, 500);
  };



  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        // Automatically request permission and sync push subscription on startup
        subscribeUserToPush(api).then((res) => {
          if (res.success) {
            addLog('Auto-synced push subscription on startup.');
          } else {
            addLog(`Push sync notice: ${res.message}`);
          }
        }).catch((err) => {
          addLog(`Auto-sync warning: ${err}`);
        });
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
      {/* Real-time In-App Push Banner Toast */}
      {inAppToast && (
        <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-between animate-bounce border-2 border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl shrink-0">
              🔔
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Live Push Received ({inAppToast.time})</p>
              <p className="text-base font-extrabold">{inAppToast.title}</p>
              <p className="text-xs text-blue-100 mt-0.5">{inAppToast.body}</p>
            </div>
          </div>
          <button
            onClick={() => setInAppToast(null)}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="text-xs font-black text-[#00AEEF] uppercase tracking-wider">Cadet Control Panel</p>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2D3092] mt-1">Welcome, {user?.name}</h1>
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

          <button
            onClick={() => setShowBatteryModal(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-sm active:scale-95"
          >
            <Battery className="w-4 h-4 text-slate-950" />
            <span>⚡ Battery Settings (Closed-App Alerts)</span>
          </button>

          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200"
          >
            {showDiagnostics ? 'Hide Push Debugger' : '🛠️ Push Debugger'}
          </button>
        </div>
      </div>

      {/* Prominent Battery Optimization Action Card - Auto-hidden once unrestricted */}
      {!isBatteryIgnored && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
            <Battery className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">Closed-App Notifications Setup</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Allow background activity in phone battery settings to get session alerts when app is closed.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowBatteryModal(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 shrink-0"
        >
          <span>YES, OPEN BATTERY SETTINGS</span>
        </button>
      </div>
      )}

      <BatteryPermissionModal
        isOpen={showBatteryModal}
        onClose={() => setShowBatteryModal(false)}
      />

      {/* Push Notification Diagnostic & Repair Card */}
      {showDiagnostics && (
        <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl shadow-xl space-y-4 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛠️</span>
              <h3 className="text-base font-bold text-white">Push Notification Diagnostics & Repair</h3>
            </div>
            <button
              onClick={handleForcePushSync}
              disabled={syncStatus.loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {syncStatus.loading ? 'Syncing...' : '🔄 Force Re-Sync Push Subscription'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Permission State</p>
              <p className={`text-sm font-extrabold mt-1 capitalize ${notifPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {notifPermission}
              </p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Environment</p>
              <p className="text-sm font-extrabold mt-1 text-purple-400">
                {isDevBranch ? 'Development (DEV)' : 'Production'}
              </p>
            </div>
          </div>

          {syncStatus.message && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${syncStatus.error ? 'bg-red-950/80 border border-red-800 text-red-300' : 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'}`}>
              {syncStatus.message}
            </div>
          )}

          {/* Diagnostic Console Output Box */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Diagnostic Console Logs</p>
            <div className="p-3 bg-black/90 rounded-xl font-mono text-[11px] text-emerald-400 max-h-40 overflow-y-auto space-y-1 border border-slate-800">
              {pushLogs.length === 0 ? (
                <p className="text-slate-500 italic">No diagnostic events recorded yet. Click "Force Re-Sync" or "Test Push Notification" above.</p>
              ) : (
                pushLogs.map((log, i) => (
                  <p key={i} className="leading-relaxed">{log}</p>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isDevBranch && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base shrink-0">
              🧪
            </div>
            <div>
              <p className="text-sm font-bold text-purple-900">DEV Background Push Tester</p>
              <p className="text-xs text-purple-700">Triggers a test notification in 3s so you can exit/minimize the app to test notification arrival</p>
            </div>
          </div>

          <button
            onClick={handleRunTestNotification}
            className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all shrink-0"
          >
            {testCountdown !== null ? `⏰ Sending in ${testCountdown}s... Exit App!` : '🧪 Send Test Push Notification (3s Delay)'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: This Month's Attendance */}
        <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-[#2D3092] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-[#2D3092]/10 text-[#2D3092] flex items-center justify-center font-bold">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month's Attendance</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-black text-[#2D3092]">
              {loading ? '...' : (summary?.month_present_days ?? 0)}
            </p>
            <span className="text-sm font-bold text-slate-500">
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
            <span className="text-[11px] font-bold px-2.5 py-1 bg-sky-50 text-[#00AEEF] rounded-full">
              All-Time
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Attendance</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-black text-[#00AEEF]">
              {loading ? '...' : (summary?.overall_present_days ?? 0)}
            </p>
            <span className="text-sm font-bold text-slate-500">
              {(summary?.overall_present_days ?? 0) === 1 ? 'Total Session' : 'Total Sessions'}
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
          ) : (
            <p className="text-xs text-slate-500 mt-1">Mark your parade attendance with GPS verification and photo selfie</p>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => navigate('/staff/mark-attendance')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#EF1C25] text-white font-black text-base shadow-lg hover:bg-[#C7131B] border-b-2 border-[#FFCB06] transition-all cursor-pointer"
          >
            <CalendarCheck className="w-6 h-6 text-[#FFCB06]" />
            Mark Attendance (Selfie + GPS)
          </button>
        </div>
      </div>

      {/* Workspace Details Section */}
      <div className="relative bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 overflow-hidden">
        {/* NCC Tri-Color Top Accent Line */}
        <div className="ncc-tricolor-bar absolute top-0 left-0 right-0">
          <div className="stripe-red" />
          <div className="stripe-navy" />
          <div className="stripe-skyblue" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2D3092]/10 text-[#2D3092] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#2D3092]">NCC Battalion & Unit Details</h2>
              <p className="text-xs text-slate-500">Information about your assigned NCC battalion unit & session ground</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FFCB06] text-[#2D3092] w-fit shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            {user?.subscription_status === 'ACTIVE' || !user?.subscription_status ? 'Active Unit' : user.subscription_status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Workspace Info Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-xs font-bold text-[#2D3092] uppercase tracking-wider">NCC Unit / Battalion</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Unit Name</span>
                <span className="text-sm font-black text-slate-900">{user?.tenant_name || 'Default NCC Unit'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Unit Code</span>
                <span className="text-sm font-mono font-bold text-[#00AEEF] bg-[#00AEEF]/10 px-2 py-0.5 rounded">{user?.tenant_slug || 'ncc-unit'}</span>
              </div>
            </div>
          </div>

          {/* Location & Attendance Rules Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-xs font-bold text-[#2D3092] uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#EF1C25]" /> Session Ground Geofence
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Allowed Radius</span>
                <span className="text-sm font-black text-slate-900">{user?.geofence_radius_meters || 100} meters</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Verification</span>
                <span className="text-sm font-bold text-[#00AEEF]">GPS & Selfie Photo</span>
              </div>
              {user?.geofence_maps_link && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-slate-600 font-medium">Session Location</span>
                  <a
                    href={user.geofence_maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#EF1C25] hover:underline flex items-center gap-1"
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
          <div className="p-4 rounded-xl bg-[#2D3092]/5 border border-[#2D3092]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EF1C25] border-2 border-[#FFCB06] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                <UserCheck className="w-5 h-5 text-[#FFCB06]" />
              </div>
              <div>
                <p className="text-sm font-black text-[#2D3092]">{user?.name}</p>
                <p className="text-xs font-bold text-slate-500">Cadet ID: <span className="text-[#EF1C25]">{user?.employee_id}</span> • Role: <span className="uppercase">{user?.role || 'Cadet'}</span></p>
              </div>
            </div>
            {user?.email && (
              <div className="text-xs font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 font-semibold">Contact:</span> {user.email}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;



