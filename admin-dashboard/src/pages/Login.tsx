import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import { Lock, User } from 'lucide-react';

const Login: React.FC = () => {
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
      });
      setResendSuccess('Verification email sent! Please check your inbox.');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to resend verification email.'));
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
      setError(getApiErrorMessage(err, 'An error occurred during login. Is the server running?'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* NCC Tri-Color Top Accent Line */}
      <div className="fixed top-0 left-0 right-0 ncc-tricolor-bar z-50">
        <div className="stripe-red" />
        <div className="stripe-navy" />
        <div className="stripe-skyblue" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <img 
            src="/college-logo.png" 
            alt="College Emblem" 
            className="h-14 sm:h-16 w-auto max-h-16 max-w-[75px] object-contain drop-shadow-md"
          />
          <img 
            src="/ncc-logo.png" 
            alt="NCC Emblem" 
            className="h-14 sm:h-16 w-auto max-h-16 max-w-[55px] object-contain drop-shadow-md"
          />
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight">
          NCC INSTRUCTOR PORTAL
        </h2>
        <p className="mt-1 text-sm font-semibold text-[#00A6EB]">
          National Cadet Corps Attendance & Roster System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border-t-4 border-[#FFC800]">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex justify-between items-center bg-opacity-90 leading-tight">
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
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">
                {resendSuccess}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-[#1A1E5C] uppercase tracking-wider">Instructor ID / User ID</label>
              <div className="mt-1.5 relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="focus:ring-2 focus:ring-[#1A1E5C] focus:border-[#1A1E5C] block w-full pl-10 text-sm border-slate-300 rounded-xl py-2.5 px-3 border font-semibold text-slate-900"
                  placeholder="e.g. admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1A1E5C] uppercase tracking-wider">Password</label>
              <div className="mt-1.5 relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-2 focus:ring-[#1A1E5C] focus:border-[#1A1E5C] block w-full pl-10 text-sm border-slate-300 rounded-xl py-2.5 px-3 border font-semibold text-slate-900"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#1A1E5C] hover:bg-[#2A318A] border-b-2 border-[#FFC800] focus:outline-none transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Authenticating...' : 'Instructor Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs font-semibold">
            <div className="flex items-center justify-center gap-4">
              <Link to="/register" className="text-[#1A1E5C] hover:text-[#E52327]">
                Register Unit Account
              </Link>
              <Link to="/forgot-password" className="text-[#1A1E5C] hover:text-[#E52327]">
                Forgot Password?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
