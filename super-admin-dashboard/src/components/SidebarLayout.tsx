import React, { useState } from 'react';
import { BarChart3, Building2, ClipboardList, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useSuperAdminAuth } from '../contexts/SuperAdminAuthContext';

const SidebarLayout: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { user, logout } = useSuperAdminAuth();
  const navigate = useNavigate();

  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { to: '/tenants', label: 'Tenants', icon: Building2 },
    { to: '/audit-logs', label: 'Audit Logs', icon: ClipboardList },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {open && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-2 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Smart Attend</p>
              <h1 className="text-lg font-bold">Super Admin</h1>
            </div>
          </div>
          <button className="text-slate-400 lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-800 px-6 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Signed in as</p>
          <p className="mt-2 font-semibold">{user?.email}</p>
          <span className="mt-3 inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
            {user?.role || 'super_admin'}
          </span>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
              onClick={() => setOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-slate-800 hover:text-red-200"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Operations</p>
            <h2 className="text-xl font-bold text-white">Tenant Control Center</h2>
          </div>
        </header>
        <div className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SidebarLayout;
