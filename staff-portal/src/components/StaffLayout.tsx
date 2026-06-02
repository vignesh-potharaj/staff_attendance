import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarCheck, History, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/staff/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/staff/mark-attendance', label: 'Mark Attendance', icon: CalendarCheck },
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
    .toUpperCase() || 'S';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-30 p-3 rounded-xl bg-white text-slate-800 border border-slate-200 shadow-lg hover:bg-slate-100"
        aria-label="Open navigation"
      >
        <Menu className="w-6 h-6" />
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
          aria-label="Close navigation backdrop"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white flex flex-col transform transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">ID: {user?.employee_id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 text-slate-400 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-300 hover:bg-slate-800"
          >
            <LogOut className="w-5 h-5" />
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
