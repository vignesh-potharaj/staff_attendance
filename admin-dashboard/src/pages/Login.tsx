import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Building2, Lock, User } from 'lucide-react';

const Login: React.FC = () => {
  const [tenantSlug, setTenantSlug] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendSuccess('');
    setError('');
    
    try {
      await api.post('/auth/resend-verification', {
        user_id: employeeId,
        tenant_slug: tenantSlug.trim() || undefined,
      });
      setResendSuccess('Verification email sent! Please check your inbox.');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResendSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        tenant_slug: tenantSlug.trim() || undefined,
        user_id: employeeId,
        password,
      });
      
      const { access_token, user } = response.data;
      
      if (user.role !== 'ADMIN') {
        setError('Access denied. Admin portal only.');
        return;
      }
      
      login(access_token, user);
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'An error occurred during login. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 flex items-center justify-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg"><User className="text-white w-8 h-8"/></div>
          Smart Attend Admin
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex justify-between items-center bg-opacity-90 leading-tight">
                <span>{error}</span>
                {error.includes('Verify your email') && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="ml-2 font-medium underline hover:text-red-800 flex-shrink-0"
                  >
                    {resendLoading ? 'Sending...' : 'Resend Email'}
                  </button>
                )}
              </div>
            )}
            {resendSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {resendSuccess}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Workspace</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                  placeholder="e.g. bright-traders"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Administrator ID / User ID</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                  placeholder="e.g. admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <div className="flex items-center justify-center gap-4">
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Create company account
              </Link>
              <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot password
              </Link>
            </div>
          </div>

          <div className="mt-6 text-center border-t border-gray-100 pt-6">
            <a 
              href="/staff" 
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              ← Go to Staff Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
