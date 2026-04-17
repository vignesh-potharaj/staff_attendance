import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  Clock3,
  Download,
  Lock,
  Mail,
  Palette,
  Save,
  ShieldCheck,
  Trash2,
  Wand2,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SettingsData {
  business_name: string;
  tenant_slug?: string | null;
  admin_name: string;
  email?: string | null;
  phone?: string | null;
  employee_id: string;
  role: string;
}

interface PreferenceData {
  lateThreshold: number;
  checkInWindow: number;
  weeklyDigest: boolean;
  missedCheckoutAlert: boolean;
  compactTables: boolean;
  accent: string;
}

const DEFAULT_PREFERENCES: PreferenceData = {
  lateThreshold: 10,
  checkInWindow: 30,
  weeklyDigest: true,
  missedCheckoutAlert: true,
  compactTables: false,
  accent: 'blue',
};

const ACCENTS = [
  { id: 'blue', name: 'Blue', className: 'bg-blue-600' },
  { id: 'emerald', name: 'Emerald', className: 'bg-emerald-500' },
  { id: 'rose', name: 'Rose', className: 'bg-rose-500' },
  { id: 'slate', name: 'Slate', className: 'bg-slate-800' },
];

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
  ) {
    return (err as { response: { data: { detail: string } } }).response.data.detail;
  }

  return fallback;
};

const Settings: React.FC = () => {
  const { logout, updateUser } = useAuth();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [formData, setFormData] = useState({
    business_name: '',
    admin_name: '',
    phone: '',
  });
  const [preferences, setPreferences] = useState<PreferenceData>(() => {
    const stored = localStorage.getItem('smartAttendPreferences');
    if (!stored) return DEFAULT_PREFERENCES;
    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setError(null);
        const res = await api.get<SettingsData>('/settings/');
        setSettings(res.data);
        setFormData({
          business_name: res.data.business_name,
          admin_name: res.data.admin_name,
          phone: res.data.phone || '',
        });
      } catch (err) {
        console.error(err);
        setError('Failed to load settings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem('smartAttendPreferences', JSON.stringify(preferences));
  }, [preferences]);

  const workspaceInitials = useMemo(() => {
    const name = formData.business_name || 'SA';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [formData.business_name]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await api.put<SettingsData>('/settings/', formData);
      setSettings(res.data);
      setFormData({
        business_name: res.data.business_name,
        admin_name: res.data.admin_name,
        phone: res.data.phone || '',
      });
      updateUser({ name: res.data.admin_name });
      localStorage.setItem('smartAttendWorkspaceName', res.data.business_name);
      setMessage('Settings saved successfully.');
    } catch (err: unknown) {
      console.error(err);
      setError(getApiErrorMessage(err, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    const confirmed = window.confirm('This will permanently delete this workspace, users, rosters, and attendance records. Continue?');
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await api.delete('/settings/account', { data: { confirmation: deleteText } });
      logout();
      window.location.href = '/register';
    } catch (err: unknown) {
      console.error(err);
      setError(getApiErrorMessage(err, 'Failed to delete account.'));
      setDeleting(false);
    }
  };

  const exportSnapshot = () => {
    const snapshot = {
      workspace: formData.business_name,
      admin: formData.admin_name,
      phone: formData.phone,
      preferences,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smart-attend-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-2xl bg-slate-950 text-white overflow-hidden shadow-sm">
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Workspace control room
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
              Tune how {formData.business_name || 'your business'} runs attendance.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Update your business identity, personalize your admin profile, choose dashboard behavior, and manage account-level actions from one place.
            </p>
          </div>
          <div className="border-t border-white/10 p-6 md:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl font-black text-slate-950">
                {workspaceInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{formData.business_name || 'Workspace'}</p>
                <p className="text-sm text-slate-300">{settings?.tenant_slug || 'default'} workspace</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-slate-400">Admin</p>
                <p className="mt-1 truncate font-semibold">{formData.admin_name}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-slate-400">Role</p>
                <p className="mt-1 font-semibold">{settings?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message || error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <form onSubmit={handleSave} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                  <Building2 className="h-4 w-4" />
                  Workspace identity
                </div>
                <h2 className="mt-2 text-xl font-bold text-slate-900">Business and admin profile</h2>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving ? <Clock3 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Business name</span>
                <input
                  required
                  minLength={2}
                  value={formData.business_name}
                  onChange={(event) => setFormData({ ...formData, business_name: event.target.value })}
                  className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Example Retail Pvt Ltd"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Your name</span>
                <input
                  required
                  minLength={2}
                  value={formData.admin_name}
                  onChange={(event) => setFormData({ ...formData, admin_name: event.target.value })}
                  className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Admin name"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Mobile number</span>
                <input
                  required
                  minLength={6}
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="9876543210"
                />
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Mail className="h-4 w-4 text-slate-500" />
                  Sign-in details
                </div>
                <p className="mt-2 break-words text-sm text-slate-600">{settings?.email || 'No email saved'}</p>
                <p className="mt-1 text-xs text-slate-500">User ID: {settings?.employee_id}</p>
              </div>
            </div>
          </form>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-6 flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-amber-600" />
              <div>
                <h2 className="text-xl font-bold text-slate-900">Attendance rules</h2>
                <p className="text-sm text-slate-500">These preferences are saved on this browser for dashboard behavior.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Late mark threshold</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={preferences.lateThreshold}
                    onChange={(event) => setPreferences({ ...preferences, lateThreshold: Number(event.target.value) })}
                    className="w-full accent-blue-600"
                  />
                  <span className="w-16 rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-semibold text-slate-700">
                    {preferences.lateThreshold}m
                  </span>
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Check-in grace window</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={10}
                    value={preferences.checkInWindow}
                    onChange={(event) => setPreferences({ ...preferences, checkInWindow: Number(event.target.value) })}
                    className="w-full accent-blue-600"
                  />
                  <span className="w-16 rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-semibold text-slate-700">
                    {preferences.checkInWindow}m
                  </span>
                </div>
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Alerts</h2>
            </div>
            <div className="space-y-3">
              {[
                ['weeklyDigest', 'Weekly attendance digest'],
                ['missedCheckoutAlert', 'Missed checkout alerts'],
                ['compactTables', 'Compact data tables'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences[key as keyof PreferenceData])}
                    onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Palette className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-bold text-slate-900">Dashboard accent</h2>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  onClick={() => setPreferences({ ...preferences, accent: accent.id })}
                  title={accent.name}
                  className={`flex h-12 items-center justify-center rounded-lg border-2 ${preferences.accent === accent.id ? 'border-slate-900' : 'border-transparent'}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${accent.className}`}>
                    {preferences.accent === accent.id && <Check className="h-4 w-4 text-white" />}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Quick actions</h2>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={exportSnapshot}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-600" />
                  Export settings snapshot
                </span>
              </button>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Lock className="h-4 w-4 text-slate-500" />
                  Password security
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-500">
                  Password changes are handled through the secure reset flow from the login screen.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-red-200 bg-red-50 p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Danger zone
            </div>
            <h2 className="mt-2 text-xl font-bold text-red-950">Delete this account</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-red-800">
              This permanently removes the workspace, all users, roster entries, and attendance records. Type DELETE to unlock the action.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <input
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-red-300 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
              placeholder="Type DELETE"
            />
            <button
              type="button"
              disabled={deleteText !== 'DELETE' || deleting}
              onClick={handleDeleteAccount}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting' : 'Delete account'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
