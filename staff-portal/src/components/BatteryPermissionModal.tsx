import React from 'react';
import { Battery, ExternalLink, X } from 'lucide-react';

interface BatteryPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const openAndroidBatterySettings = () => {
  try {
    // Attempt 1: Direct Ignore Battery Optimization Settings Intent for Android
    window.location.href = 'intent:#Intent;action=android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS;end';
  } catch (err) {
    try {
      // Attempt 2: Application Details Settings Intent
      window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;end';
    } catch {
      console.warn('Could not launch system settings intent directly.');
    }
  }
};

export const BatteryPermissionModal: React.FC<BatteryPermissionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleOpenSettings = () => {
    openAndroidBatterySettings();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-scaleUp">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <Battery className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Background Battery Permission</h3>
              <p className="text-xs text-slate-500">Allow closed-app notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <p className="font-semibold text-slate-900">Allow Unrestricted Background Battery Usage?</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            To receive instant shift reminders and check-in alerts even when the app is closed, grant background battery permission in settings.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handleOpenSettings}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm active:scale-95"
          >
            <span>YES, OPEN BATTERY SETTINGS</span>
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-slate-500 hover:text-slate-700 font-semibold text-xs text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
