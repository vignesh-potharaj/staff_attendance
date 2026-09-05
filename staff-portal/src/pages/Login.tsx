import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Lock, User } from 'lucide-react';

const Login: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        user_id: employeeId.trim(),
        password: password,
      });
      
      const { access_token, user } = response.data;
      
      login(access_token, user);
      
      // If the user is an admin, redirect them to the Admin Portal (now at root)
      if (user.role === 'admin' || user.role === 'ADMIN') {
        window.location.href = '/';
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 401) {
        setError('Invalid Cadet ID or Password');
      } else {
        setError('An error occurred during login. Is the server running?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* NCC Tri-Color Top Accent Line */}
      <div className="fixed top-0 left-0 right-0 ncc-tricolor-bar z-50">
        <div className="stripe-red" />
        <div className="stripe-navy" />
        <div className="stripe-skyblue" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-t-4 border-[#FFC800]">
        <div className="bg-white px-8 pt-10 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E52327] border-4 border-[#FFC800] shadow-xl text-white font-black text-2xl tracking-tighter mb-4">
            NCC
          </div>
          <h2 className="text-3xl font-black text-[#1A1E5C] tracking-tight">CADET PORTAL</h2>
          <p className="text-xs font-bold text-[#00A6EB] uppercase tracking-wider mt-1">National Cadet Corps Attendance</p>
        </div>

        <div className="px-8 pb-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-pulse">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-[#1A1E5C] uppercase tracking-wider">Cadet ID / Regt No</label>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1A1E5C] focus:border-transparent outline-none font-semibold text-slate-900 text-sm"
                  placeholder="Enter your Cadet ID"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1A1E5C] uppercase tracking-wider">Password</label>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1A1E5C] focus:border-transparent outline-none font-semibold text-slate-900 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-[#E52327] hover:bg-[#C1161A] border-b-2 border-[#FFC800] focus:outline-none transition-all ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
            >
              {loading ? 'Authenticating...' : 'Cadet Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a 
              href="/" 
              className="text-xs font-bold text-[#1A1E5C] hover:text-[#E52327] transition-colors"
            >
              ← Go to Instructor Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
