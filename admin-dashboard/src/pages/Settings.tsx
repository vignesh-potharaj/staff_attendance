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
  Plus,
  Trash2,
  Edit2,
  Star,
  ExternalLink,
  X,
  Check
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SavedLocation {
  id: number;
  tenant_id: number;
  name: string;
  maps_link?: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_default: boolean;
  created_at?: string;
}

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

  // Saved locations state
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [locForm, setLocForm] = useState({
    name: '',
    maps_link: '',
    latitude: '',
    longitude: '',
    radius_meters: 100,
    is_default: false,
  });
  const [locSaving, setLocSaving] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locSuccess, setLocSuccess] = useState<string | null>(null);

  const fetchLocations = async () => {
    setLocLoading(true);
    try {
      const res = await api.get<SavedLocation[]>('/locations/');
      setSavedLocations(res.data || []);
    } catch (err) {
      console.error('Failed to fetch locations', err);
    } finally {
      setLocLoading(false);
    }
  };

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
    fetchLocations();
  }, []);

  const handleOpenAddLocation = () => {
    setEditingLocation(null);
    setLocForm({
      name: '',
      maps_link: '',
      latitude: '',
      longitude: '',
      radius_meters: 100,
      is_default: savedLocations.length === 0,
    });
    setLocError(null);
    setIsLocModalOpen(true);
  };

  const handleOpenEditLocation = (loc: SavedLocation) => {
    setEditingLocation(loc);
    setLocForm({
      name: loc.name,
      maps_link: loc.maps_link || '',
      latitude: loc.latitude ? loc.latitude.toString() : '',
      longitude: loc.longitude ? loc.longitude.toString() : '',
      radius_meters: loc.radius_meters || 100,
      is_default: loc.is_default,
    });
    setLocError(null);
    setIsLocModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocSaving(true);
    setLocError(null);
    try {
      const payload: any = {
        name: locForm.name.trim(),
        maps_link: locForm.maps_link.trim() || null,
        radius_meters: Number(locForm.radius_meters) || 100,
        is_default: locForm.is_default,
      };
      if (locForm.latitude.trim() && locForm.longitude.trim()) {
        payload.latitude = parseFloat(locForm.latitude.trim());
        payload.longitude = parseFloat(locForm.longitude.trim());
      }

      if (editingLocation) {
        await api.put(`/locations/${editingLocation.id}`, payload);
        setLocSuccess('Location updated successfully.');
      } else {
        await api.post('/locations/', payload);
        setLocSuccess('New duty location saved.');
      }
      setIsLocModalOpen(false);
      await fetchLocations();
      // Also refresh settings to reflect any updated default coordinates
      const sRes = await api.get<SettingsData>('/settings/');
      setSettings(sRes.data);
    } catch (err: unknown) {
      console.error('Failed to save location', err);
      setLocError(getApiErrorMessage(err, 'Failed to save location. Please check coordinates or Maps link.'));
    } finally {
      setLocSaving(false);
    }
  };

  const handleSetDefaultLocation = async (id: number) => {
    try {
      await api.post(`/locations/${id}/set-default`);
      await fetchLocations();
      const sRes = await api.get<SettingsData>('/settings/');
      setSettings(sRes.data);
      setLocSuccess('Default ground updated.');
    } catch (err) {
      console.error('Failed to set default location', err);
      alert(getApiErrorMessage(err, 'Failed to set default location'));
    }
  };

  const handleDeleteLocation = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.delete(`/locations/${id}`);
      await fetchLocations();
      const sRes = await api.get<SettingsData>('/settings/');
      setSettings(sRes.data);
      setLocSuccess('Location deleted successfully.');
    } catch (err) {
      console.error('Failed to delete location', err);
      alert(getApiErrorMessage(err, 'Failed to delete location'));
    }
  };

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
            {/* Saved Duty & Parade Locations Card */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-[#2D3092]/10 p-2 text-[#2D3092]">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-[#2D3092] text-base">Saved Duty & Parade Locations</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Configure grounds, unit HQ, gates, and duty stations for multi-post deployment.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddLocation}
                  className="px-3.5 py-2 rounded-xl bg-[#2D3092] hover:bg-[#3F43B5] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Duty Post</span>
                </button>
              </div>

              {locSuccess && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
                  <span>{locSuccess}</span>
                  <button type="button" onClick={() => setLocSuccess(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="mt-4 space-y-2.5">
                {locLoading ? (
                  <div className="py-6 text-center text-xs font-bold text-slate-400">Loading saved locations...</div>
                ) : savedLocations.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-600">No saved duty locations yet.</p>
                    <p className="text-[11px] text-slate-400">
                      Add your main parade ground, guard posts, or external duty venues to reuse them easily in daily rosters.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAddLocation}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add First Location
                    </button>
                  </div>
                ) : (
                  savedLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#2D3092]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm">{loc.name}</span>
                          {loc.is_default ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3" />
                              Primary Default
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultLocation(loc.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 hover:text-[#2D3092] hover:bg-blue-50 border border-slate-300 transition cursor-pointer"
                              title="Set as default unit location"
                            >
                              <Star className="w-3 h-3" />
                              Set as Default
                            </button>
                          )}
                          <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {loc.radius_meters}m radius
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                          <span>{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</span>
                          {loc.maps_link && (
                            <a
                              href={loc.maps_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00AEEF] hover:underline inline-flex items-center gap-0.5 font-sans font-semibold"
                            >
                              <span>Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEditLocation(loc)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#2D3092] hover:bg-slate-100 transition cursor-pointer"
                          title="Edit Location"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(loc.id, loc.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Delete Location"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
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
      {/* Add / Edit Location Modal */}
      {isLocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#2D3092]" />
                <h3 className="text-sm font-black text-slate-900">
                  {editingLocation ? 'Edit Duty Location' : 'Add New Duty Location'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLocModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="p-5 space-y-4">
              {locError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {locError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  value={locForm.name}
                  onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                  placeholder="e.g. Main Parade Ground, Unit HQ, Main Gate"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Google Maps Link (Optional)
                </label>
                <input
                  type="text"
                  value={locForm.maps_link}
                  onChange={(e) => setLocForm({ ...locForm, maps_link: e.target.value })}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Paste the Google Maps link to auto-extract coordinates, or enter latitude/longitude below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locForm.latitude}
                    onChange={(e) => setLocForm({ ...locForm, latitude: e.target.value })}
                    placeholder="e.g. 12.9716"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locForm.longitude}
                    onChange={(e) => setLocForm({ ...locForm, longitude: e.target.value })}
                    placeholder="e.g. 77.5946"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Geofence Radius (meters) *
                </label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  required
                  value={locForm.radius_meters}
                  onChange={(e) => setLocForm({ ...locForm, radius_meters: Number(e.target.value) || 100 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={locForm.is_default}
                    onChange={(e) => setLocForm({ ...locForm, is_default: e.target.checked })}
                    className="w-4 h-4 text-[#2D3092] border-gray-300 rounded focus:ring-[#2D3092] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Set as default primary unit ground
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLocModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={locSaving}
                  className="px-5 py-2 rounded-xl bg-[#2D3092] hover:bg-[#3F43B5] text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {locSaving ? 'Saving...' : (editingLocation ? 'Update Location' : 'Save Location')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
