import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import api from '../services/api';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [message, setMessage] = useState('Verifying your email...');
  const [error, setError] = useState('');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError('Verification token is missing from the link.');
        setMessage('');
        return;
      }

      try {
        const response = await api.post(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setMessage(response.data.message);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } } };
        setError(error.response?.data?.detail || 'Unable to verify your email.');
        setMessage('');
      }
    };

    void verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-slate-900">Email verification</h1>
        {message && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6">
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">Continue to sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
