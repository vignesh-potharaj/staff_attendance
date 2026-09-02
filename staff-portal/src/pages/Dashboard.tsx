import React, { useEffect, useState } from 'react';
import { Battery, Bell, BellOff, Building2, CalendarCheck, Clock, IndianRupee, MapPin, ShieldCheck, Timer, UserCheck } from 'lucide-react';
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

  // Listen for Service Worker postMessage event when a push notification arrives
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
          const payload = event.data.data;
          const timeStr = new Date().toLocaleTimeString();
          console.log('🔔 [App Window] Received push notification message from SW:', payload);
          setInAppToast({
            title: payload?.title || 'Push Notification',
            body: payload?.body || 'New alert received',
            time: timeStr,
          });
          addLog(`🔔 Push Received: "${payload?.title || 'Alert'}" - ${payload?.body || ''}`);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const nativePerm = await checkNativeNotificationPermission();
        if (getNotificationPermission() === 'granted' || nativePerm === 'granted') {
          subscribeUserToPush(api).then((res) => {
            if (res.success) {
              addLog('Auto-synced push subscription on startup.');
            }
          }).catch((err) => {
            addLog(`Auto-sync warning: ${err}`);
          });
        }
        const [todayRes, monthlyRes] = await Promise.all([
          api.get(`/attendance/staff/${user.id}/today`),
          api.get(`/attendance/staff/${user.id}/monthly`),
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
          <p className="text-sm font-semibold text-blue-600">Staff Dashboard</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Welcome, {user?.name}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              Allow background activity in phone battery settings to get shift alerts when app is closed.
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Permission State</p>
              <p className={`text-sm font-extrabold mt-1 capitalize ${notifPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {notifPermission}
              </p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Service Worker</p>
              <p className="text-sm font-extrabold mt-1 text-emerald-400">
                {'serviceWorker' in navigator ? 'Active' : 'Not Supported'}
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



