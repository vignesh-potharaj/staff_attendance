import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X, HelpCircle, CheckCircle2 } from 'lucide-react';
import { openAndroidBatterySettings } from './BatteryPermissionModal';

export const NotificationPermissionBanner: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>('granted');
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkAndRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const currentPerm = Notification.permission;
    setPermission(currentPerm);

    // Ask immediately after login if not yet requested
    if (currentPerm === 'default') {
      try {
        const newPerm = await Notification.requestPermission();
        setPermission(newPerm);
      } catch (err) {
        console.error('Error requesting notification permission:', err);
      }
    }
  };

  useEffect(() => {
    checkAndRequestPermission();

    const handleFocus = () => {
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (permission === 'granted' || dismissed) {
    return null;
  }

  return (
    <>
      {/* Top Banner */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1 bg-black/10 rounded-lg shrink-0">
            <BellOff className="w-4 h-4 text-slate-950" />
          </div>
          <p className="truncate">
            <span className="font-bold font-semibold">Notifications Blocked:</span> Enable notifications in browser settings for real-time attendance alerts.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openAndroidBatterySettings}
            className="px-3 py-1 bg-slate-900 text-amber-300 rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1 shadow-sm"
          >
            <span>Battery Settings</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1 bg-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1 shadow-sm"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>How to Enable</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-black/10 rounded-lg transition-colors text-slate-950"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Enable Notifications</h3>
                  <p className="text-xs text-slate-500">Unblock browser notifications for real-time alerts</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">1</span>
                <p>Tap the <strong>Lock / Tune icon 🔒</strong> next to the URL in your browser address bar.</p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">2</span>
                <p>Select <strong>Permissions</strong> or <strong>Site Settings</strong>.</p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">3</span>
                <p>Set <strong>Notifications</strong> to <strong>Allow</strong>.</p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  if ('Notification' in window) {
                    const current = Notification.permission;
                    setPermission(current);
                    if (current === 'granted') setShowModal(false);
                  }
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>I've Enabled It (Check Again)</span>
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 font-semibold text-xs text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
