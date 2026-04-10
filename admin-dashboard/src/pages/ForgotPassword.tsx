import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
      setPreviewUrl(response.data.reset_preview_url || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-500">Enter your account email and we will prepare a reset link.</p>
        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p>{message}</p>
            {previewUrl && <a href={previewUrl} className="mt-2 inline-block font-semibold underline">Open reset link</a>}
          </div>
        )}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3" required />
          </div>
          <button disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70">
            {loading ? 'Preparing reset...' : 'Send reset link'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
