import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  Clock3,
  Download,
  Lock,
  MapPin,
  Save,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SettingsData {
  business_name: string;
  tenant_slug?: string | null;
  admin_name: string;
  phone?: string | null;
  employee_id: string;
  role: string;
  geofence_maps_link?: string | null;
  geofence_latitude?: number | null;
  geofence_longitude?: number | null;
  geofence_radius_meters: number;
}

interface PreferenceData {
  weeklyDigest: boolean;
  missedCheckoutAlert: boolean;
  compactTables: boolean;
}

const DEFAULT_PREFERENCES: PreferenceData = {
  weeklyDigest: true,
  missedCheckoutAlert: true,
  compactTables: false,
};

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
  const { updateUser } = useAuth();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [formData, setFormData] = useState({
    business_name: '',
    admin_name: '',
    phone: '',
    geofence_maps_link: '',
    geofence_radius_meters: 100,
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
          geofence_maps_link: res.data.geofence_maps_link || '',
          geofence_radius_meters: res.data.geofence_radius_meters || 100,
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
    const name = formData.business_name || 'NCC';
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
        geofence_maps_link: res.data.geofence_maps_link || '',
        geofence_radius_meters: res.data.geofence_radius_meters || 100,
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

  const exportSnapshot = () => {
    const snapshot = {
      workspace: formData.business_name,
      admin: formData.admin_name,
      phone: formData.phone,
      geofence_maps_link: formData.geofence_maps_link,
      geofence_latitude: settings?.geofence_latitude,
      geofence_longitude: settings?.geofence_longitude,
      geofence_radius_meters: settings?.geofence_radius_meters,
      preferences,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ncc-unit-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-slate-600 font-bold p-6">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-2xl bg-[#2D3092] text-white overflow-hidden shadow-md border-t-4 border-[#FFCB06]">
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-white border border-[#FFCB06]">
              <ShieldCheck className="h-4 w-4 text-[#FFCB06]" />
              NCC Battalion Control Room
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight md:text-4xl">
              Tune how {formData.business_name || 'your NCC Battalion'} runs cadet attendance.
            </h1>
            <p className="mt-3 max-w-2xl text-xs font-semibold leading-6 text-slate-200">
              Update your NCC battalion identity, personalize your instructor profile, configure session ground geofencing, and manage portal preferences.
            </p>
          </div>
          <div className="border-t border-white/10 p-6 md:p-8 lg:border-l lg:border-t-0 bg-[#1E216B]/60">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#EF1C25] border-2 border-[#FFCB06] text-2xl font-black text-white shadow-lg">
                {workspaceInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black">{formData.business_name || 'NCC Unit'}</p>
                <p className="text-xs text-[#00AEEF] font-bold">{settings?.tenant_slug || 'default'} unit</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                <p className="text-slate-300 font-bold uppercase text-[10px]">Instructor</p>
                <p className="mt-1 truncate font-black text-white">{formData.admin_name}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                <p className="text-slate-300 font-bold uppercase text-[10px]">Role</p>
                <p className="mt-1 font-black text-[#FFCB06] uppercase">{settings?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${message ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message || error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 border-t-4 border-t-[#2D3092]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase text-[#2D3092] tracking-wider">
                  <Building2 className="h-4 w-4 text-[#EF1C25]" />
                  NCC Unit Identity
                </div>
                <h2 className="mt-1.5 text-xl font-black text-[#2D3092]">Battalion & Instructor Profile</h2>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#EF1C25] hover:bg-[#C7131B] px-5 py-2.5 text-sm font-bold text-white transition shadow-md border-b-2 border-[#FFCB06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Clock3 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-[#FFCB06]" />}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-[#2D3092] uppercase tracking-wider">NCC Unit / Battalion Name</span>
                <input
                  required
                  minLength={2}
                  value={formData.business_name}
                  onChange={(event) => setFormData({ ...formData, business_name: event.target.value })}
                  className="mt-2 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#2D3092] focus:outline-none focus:ring-2 focus:ring-[#2D3092]/20"
                  placeholder="e.g. 1 KAR BN NCC"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#2D3092] uppercase tracking-wider">Instructor / ANO Name</span>
                <input
                  required
                  minLength={2}
                  value={formData.admin_name}
                  onChange={(event) => setFormData({ ...formData, admin_name: event.target.value })}
                  className="mt-2 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#2D3092] focus:outline-none focus:ring-2 focus:ring-[#2D3092]/20"
                  placeholder="Instructor Name"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#2D3092] uppercase tracking-wider">Contact Mobile Number</span>
                <input
                  required
                  minLength={6}
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  className="mt-2 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#2D3092] focus:outline-none focus:ring-2 focus:ring-[#2D3092]/20"
                  placeholder="9876543210"
                />
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#2D3092] uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4 text-[#2D3092]" />
                  Sign-in Credentials
                </div>
                <p className="mt-2 text-sm font-bold text-slate-800">Instructor ID: <span className="text-[#EF1C25] font-black">{settings?.employee_id}</span></p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Role: <span className="text-[#2D3092] font-black">{settings?.role}</span></p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#00AEEF]/30 bg-[#00AEEF]/5 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#00AEEF] p-2.5 text-white shrink-0 shadow-md">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-[#2D3092] text-base">Session Ground Geofence</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 font-medium">
                    Paste a Google Maps link for the session ground. Cadets can mark attendance only within the configured radius of this location.
                  </p>
                  <label className="mt-4 block">
                    <span className="text-xs font-bold text-[#2D3092] uppercase tracking-wider">Google Maps Link</span>
                    <input
                      value={formData.geofence_maps_link}
                      onChange={(event) => setFormData({ ...formData, geofence_maps_link: event.target.value })}
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#2D3092] focus:outline-none focus:ring-2 focus:ring-[#2D3092]/20"
                      placeholder="https://www.google.com/maps/@12.9716,77.5946,18z"
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className="text-xs font-bold text-[#2D3092] uppercase tracking-wider">Geofence Radius (meters)</span>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      value={formData.geofence_radius_meters}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          geofence_radius_meters: Number(event.target.value) || 0,
                        })
                      }
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#2D3092] focus:outline-none focus:ring-2 focus:ring-[#2D3092]/20"
                      placeholder="100"
                    />
                  </label>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700">
                    {settings?.geofence_latitude != null && settings?.geofence_longitude != null ? (
                      <span>
                        Active fence: {settings.geofence_latitude.toFixed(6)}, {settings.geofence_longitude.toFixed(6)} with {settings.geofence_radius_meters}m radius.
                      </span>
                    ) : (
                      <span>No geofence is active yet. Leave the link empty to keep location enforcement disabled.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>

        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#00AEEF]" />
              <h2 className="text-base font-black text-[#2D3092] uppercase tracking-tight">Notification Alerts</h2>
            </div>
            <div className="space-y-3">
              {[
                ['weeklyDigest', 'Weekly session attendance digest'],
                ['missedCheckoutAlert', 'Missed session checkout alerts'],
                ['compactTables', 'Compact data tables'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                  <span className="text-xs font-bold text-slate-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences[key as keyof PreferenceData])}
                    onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 text-[#2D3092] focus:ring-[#2D3092]"
                  />
                </label>
              ))}
            </div>
          </section>



          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-[#2D3092]" />
              <h2 className="text-base font-black text-[#2D3092] uppercase tracking-tight">Quick Actions</h2>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={exportSnapshot}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-xs font-bold text-slate-700 transition hover:border-[#2D3092] hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-[#EF1C25]" />
                  Export Unit Settings Snapshot
                </span>
              </button>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#2D3092] uppercase">
                  <Lock className="h-4 w-4 text-slate-500" />
                  Password Security
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500 font-medium">
                  Password changes are handled securely via the login screen reset password flow.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
