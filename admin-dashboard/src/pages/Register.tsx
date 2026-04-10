import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, Phone, User } from 'lucide-react';

import api from '../services/api';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    company_name: '',
    admin_name: '',
    email: '',
    mobile_number: '',
    user_id: '',
    password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ message: string; tenantSlug: string; previewUrl?: string | null } | null>(null);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register-tenant', formData);
      setSuccess({
        message: response.data.message,
        tenantSlug: response.data.tenant_slug,
        previewUrl: response.data.verification_preview_url,
      });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Unable to create your company account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-blue-600 p-3 text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create company account</h1>
            <p className="text-sm text-slate-500">One signup creates your workspace and the first admin user.</p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p>{success.message}</p>
            <p className="mt-1">Workspace: <span className="font-semibold">{success.tenantSlug}</span></p>
            {success.previewUrl && (
              <a href={success.previewUrl} className="mt-2 inline-block font-semibold text-emerald-800 underline">
                Open verification link
              </a>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Company name</label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3" value={formData.company_name} onChange={(e) => handleChange('company_name', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Admin full name</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3" value={formData.admin_name} onChange={(e) => handleChange('admin_name', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input type="email" className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Mobile number</label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3" value={formData.mobile_number} onChange={(e) => handleChange('mobile_number', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Admin user ID</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3" value={formData.user_id} onChange={(e) => handleChange('user_id', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input type="password" className="mt-1 w-full rounded-lg border border-slate-300 py-3 px-3" value={formData.password} onChange={(e) => handleChange('password', e.target.value)} required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm password</label>
            <input type="password" className="mt-1 w-full rounded-lg border border-slate-300 py-3 px-3" value={formData.confirm_password} onChange={(e) => handleChange('confirm_password', e.target.value)} required minLength={6} />
          </div>
          <button disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70">
            {loading ? 'Creating account...' : 'Create company account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Already have a workspace? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
