import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarCheck, History, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';

const navItems = [
  { to: '/staff/dashboard', label: 'Cadet Dashboard', icon: BarChart3 },
  { to: '/staff/mark-attendance', label: 'Mark Attendance (Fall In / Visarjan)', icon: CalendarCheck },
  { to: '/staff/attendance-history', label: 'Attendance History', icon: History },
];

const StaffLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = user?.name
    ?.split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NotificationPermissionBanner />

      {/* Top Header Bar for Mobile */}
      <div className="bg-[#2D3092] text-white fixed top-0 left-0 right-0 z-30 h-16 px-4 flex items-center justify-between border-b-4 border-[#FFCB06] shadow-md">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center gap-2 border border-white/20 transition-all"
          aria-label="Open navigation"
        >
          <Menu className="w-6 h-6 text-[#FFCB06]" />
        </button>

        <div className="flex items-center gap-2">
          <img 
            src="/ncc-logo.png" 
            alt="NCC Emblem" 
            className="w-7 h-9 object-contain drop-shadow-sm"
          />
          <span className="font-black text-sm uppercase tracking-tight">Cadet Portal</span>
        </div>
      </div>

      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
          onClick={() => setOpen(false)}
          aria-label="Close navigation backdrop"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#2D3092] text-white flex flex-col transform transition-transform duration-300 border-r border-[#1E216B] shadow-2xl ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* NCC Tri-Color Top Accent Line */}
        <div className="ncc-tricolor-bar">
          <div className="stripe-red" />
          <div className="stripe-navy" />
          <div className="stripe-skyblue" />
        </div>

        <div className="p-5 border-b border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/ncc-logo.png" alt="NCC Emblem" className="w-8 h-10 object-contain drop-shadow-md" />
              <div>
                <span className="font-black text-sm uppercase tracking-wider block text-white">NCC Cadet Portal</span>
                <span className="text-[10px] font-bold text-[#00AEEF] uppercase tracking-widest">National Cadet Corps</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 text-slate-300 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 min-w-0 bg-white/5 p-2.5 rounded-xl border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-[#EF1C25] border-2 border-[#FFCB06] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-black text-sm truncate text-white">{user?.name}</p>
              <p className="text-xs font-bold text-[#00AEEF] truncate">Cadet ID: {user?.employee_id}</p>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-xl p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFCB06] text-[#2D3092] shrink-0 font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#FFCB06] uppercase tracking-wider">NCC Battalion / Unit</p>
              <p className="text-xs font-black text-white truncate">
                {user?.tenant_name || 'Default NCC Battalion'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${
                  isActive 
                    ? 'bg-[#EF1C25] text-white border-b-2 border-[#FFCB06] shadow-md' 
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0 text-[#FFCB06]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-200 font-bold hover:bg-white/10 hover:text-white transition-all text-sm"
          >
            <LogOut className="w-5 h-5 text-[#EF1C25]" />
            Logout
          </button>
        </div>
      </aside>

      <main className="min-h-screen pt-20 px-4 pb-8">
        <Outlet />
      </main>
    </div>
  );
};

export default StaffLayout;
