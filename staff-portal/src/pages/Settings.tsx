import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  MapPin,
  Bell,
  Check,
  XCircle,
  Lock,
  Smartphone,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendInstantNotification,
  subscribeUserToPush,
} from '../services/notificationService';

const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth();

  // Profile refresh state
  const [refreshingProfile, setRefreshingProfile] = useState(false);

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Notifications status
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleRefreshProfile = async () => {
    setRefreshingProfile(true);
    try {
      await refreshUser();
    } finally {
      setTimeout(() => setRefreshingProfile(false), 500);
    }
  };

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      await subscribeUserToPush(api, true);
    }
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      await sendInstantNotification(
        '🔔 NCC Cadet Portal Alert',
        'Test notification: Your parade reminders and alerts are working properly!',
        { tag: 'test-notification' }
      );
    } finally {
      setTimeout(() => setTestingNotification(false), 1000);
    }
  };

  // Password validation checks
  const isLengthValid = newPassword.length >= 6;
  const isDifferentFromCurrent = currentPassword ? newPassword !== currentPassword : true;
  const doPasswordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    // Basic frontend checks
    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (!isLengthValid) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password cannot be the same as your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please re-check.');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setPasswordSuccess(response.data?.message || 'Password changed successfully! Your account credentials have been updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to update password. Please check your credentials.');
      setPasswordError(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const initials = user?.name
    ?.split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 flex">
          <div className="flex-1 bg-[#EF1C25]" />
          <div className="flex-1 bg-[#2D3092]" />
          <div className="flex-1 bg-[#00AEEF]" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2D3092]">
              <span>Cadet Account Management</span>
              <span>•</span>
              <span className="text-[#00AEEF]">NCC Settings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Settings & Profile
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage your Cadet identification details, app preferences, and login security credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshProfile}
            disabled={refreshingProfile}
            className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-60"
            title="Sync profile with server"
          >
            <RefreshCw className={`w-4 h-4 text-[#2D3092] ${refreshingProfile ? 'animate-spin' : ''}`} />
            <span>{refreshingProfile ? 'Syncing...' : 'Sync Profile'}</span>
          </button>
        </div>
      </div>

      {/* Grid: 1. Cadet Profile Details  &  2. Change Password */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Basic Cadet Details & Preferences (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Cadet Information Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#2D3092]/10 text-[#2D3092]">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900">Cadet Profile</h2>
                  <p className="text-xs text-slate-500">Official registered record</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
            </div>

            {/* Profile Avatar & Regimental ID Header */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-[#EF1C25] border-2 border-[#FFCB06] text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 truncate">{user?.name || 'NCC Cadet'}</h3>
                <p className="text-xs font-bold text-[#2D3092] tracking-wide mt-0.5">
                  ID: <span className="font-mono">{user?.employee_id || '—'}</span>
                </p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-[#00AEEF]/10 text-[#00AEEF] px-2 py-0.5 rounded-md">
                    {user?.role || 'CADET'}
                  </span>
                  {user?.department && (
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-[#EF1C25]/10 text-[#EF1C25] px-2 py-0.5 rounded-md">
                      {user.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Key-Values */}
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <Building2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Battalion / Unit</p>
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {user?.tenant_name || user?.tenant_slug?.toUpperCase() || 'NCC Battalion'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <GraduationCap className="w-4 h-4 text-[#2D3092] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Academic Roll Number</p>
                  <p className="font-bold text-[#2D3092] text-sm font-mono truncate">
                    {user?.roll_number || 'Not Linked'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <BookOpen className="w-4 h-4 text-[#EF1C25] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Department / Branch</p>
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {user?.department || 'Not Linked'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <Phone className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Registered Phone</p>
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {user?.phone || 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Registered Email</p>
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {user?.email || 'Not Provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* App & Device Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF]">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">Device & Alerts</h2>
                <p className="text-xs text-slate-500">Parade drills and reminder preferences</p>
              </div>
            </div>

            {/* Notification Setting */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#2D3092]" />
                  <span className="font-bold text-xs text-slate-800">Parade Reminders</span>
                </div>
                {notifPermission === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    <Check className="w-3 h-3" /> Enabled
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    {notifPermission === 'denied' ? 'Blocked' : 'Disabled'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Receive instant alerts 15 minutes before Fall-In and Visarjan drill completion.
              </p>
              <div>
                {notifPermission !== 'granted' ? (
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-[#2D3092] hover:bg-[#1E216B] text-white transition cursor-pointer"
                  >
                    Enable Notifications
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={testingNotification}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                  >
                    {testingNotification ? 'Sending...' : 'Test Notification'}
                  </button>
                )}
              </div>
            </div>

            {/* Fall In Geofence Information */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#EF1C25]" />
                <span className="font-bold text-xs text-slate-800">Parade Ground Geofence</span>
              </div>
              <p className="text-xs text-slate-600">
                Authorized check-in boundary is set to{' '}
                <strong className="text-slate-800">{user?.geofence_radius_meters || 100} meters</strong> radius. Please enable High-Accuracy GPS on your device before marking attendance.
              </p>
            </div>

            {/* App Version Info */}
            <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
              <span>App Version: 1.2.0</span>
              <span className="font-mono text-emerald-600 font-semibold">API: Connected</span>
            </div>
          </div>

        </div>

        {/* Right Column: Change Password Section (7 cols on lg) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-7 space-y-6">
            
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="p-2.5 rounded-xl bg-[#2D3092] text-[#FFCB06] shadow-sm">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-lg text-slate-900 tracking-tight">
                  Change Password
                </h2>
                <p className="text-xs text-slate-500">
                  Update your Cadet Portal login credentials securely
                </p>
              </div>
            </div>

            {/* Success Message Banner */}
            {passwordSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-800">Password Changed Successfully!</p>
                  <p className="mt-0.5 text-emerald-700">{passwordSuccess}</p>
                </div>
              </div>
            )}

            {/* Error Message Banner */}
            {passwordError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-red-800">Unable to Change Password</p>
                  <p className="mt-0.5 text-red-700">{passwordError}</p>
                </div>
              </div>
            )}

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              
              {/* Current Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Enter current password"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#2D3092] focus:border-[#2D3092] outline-hidden transition bg-slate-50/50 hover:bg-white focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Enter new password (min. 6 characters)"
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#2D3092] focus:border-[#2D3092] outline-hidden transition bg-slate-50/50 hover:bg-white focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Re-type new password"
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#2D3092] focus:border-[#2D3092] outline-hidden transition bg-slate-50/50 hover:bg-white focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements / Strength Helper */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2 mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Password Requirements:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-1.5 ${isLengthValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    {isLengthValid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-2 h-2 rounded-full bg-slate-300 ml-0.5 mr-1" />}
                    <span>Minimum 6 characters</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${doPasswordsMatch ? 'text-emerald-700 font-semibold' : confirmPassword ? 'text-red-600' : 'text-slate-500'}`}>
                    {doPasswordsMatch ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : confirmPassword ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-300 ml-0.5 mr-1" />
                    )}
                    <span>Passwords match</span>
                  </div>

                  {currentPassword && newPassword && !isDifferentFromCurrent && (
                    <div className="sm:col-span-2 text-amber-700 text-[11px] font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>New password should be different from current password.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || !isLengthValid || !doPasswordsMatch}
                  className="flex-1 py-3 px-5 rounded-xl font-black text-sm text-white bg-[#2D3092] hover:bg-[#1E216B] active:scale-[0.99] transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#FFCB06]" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 text-[#FFCB06]" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>

                {(currentPassword || newPassword || confirmPassword) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    className="py-3 px-4 rounded-xl font-bold text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

            </form>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
