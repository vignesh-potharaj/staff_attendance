import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, FileText, LogOut, Calendar, Menu, X, Settings, Megaphone } from 'lucide-react';
import { AnnouncementsModal } from './AnnouncementsModal';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';

const Layout: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);

  const initials = user?.name
    ?.split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'IN';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'Cadet Management' },
    { to: '/roaster', icon: Calendar, label: "Today's Roaster" },
    { to: '/attendance', icon: FileText, label: 'Attendance Records' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NotificationPermissionBanner />

      {/* Top Header Bar with NCC Tri-Color Accent */}
      <header className="bg-[#2D3092] text-white fixed top-0 left-0 right-0 z-30 shadow-md">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-6 h-6 text-[#FFCB06]" />
            </button>

            <div className="flex items-center gap-2.5">
              <img 
                src="/college-logo.png" 
                alt="College Emblem" 
                className="h-8 w-auto max-h-8 max-w-[36px] object-contain drop-shadow-sm shrink-0"
              />
              <img 
                src="/ncc-logo.png" 
                alt="NCC Emblem" 
                className="h-8 w-auto max-h-8 max-w-[28px] object-contain drop-shadow-sm shrink-0"
              />
              <div>
                <span className="font-black text-sm sm:text-base uppercase tracking-tight text-white block leading-tight">
                  NCC Instructor Portal
                </span>
                <span className="text-[10px] text-[#00AEEF] font-bold uppercase tracking-wider hidden sm:block">
                  Attendance & Roster Command
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAnnounceModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#EF1C25] hover:bg-[#C7131B] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all border-b-2 border-[#FFCB06] cursor-pointer active:scale-95 shrink-0"
          >
            <Megaphone className="w-4 h-4 text-[#FFCB06]" />
            <span className="hidden sm:inline">Broadcast Announcement</span>
            <span className="sm:hidden">Broadcast</span>
          </button>
        </div>

        {/* NCC Tri-Color Accent Line */}
        <div className="ncc-tricolor-bar">
          <div className="stripe-red" />
          <div className="stripe-navy" />
          <div className="stripe-skyblue" />
        </div>
      </header>

      {/* Backdrop overlay */}
      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 cursor-pointer"
          onClick={() => setOpen(false)}
          aria-label="Close navigation backdrop"
        />
      )}

      {/* Sidebar Navigation Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-[#2D3092] text-white flex flex-col transform transition-transform duration-300 border-r border-[#1E216B] shadow-2xl ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* NCC Tri-Color Top Accent Line */}
        <div className="ncc-tricolor-bar">
          <div className="stripe-red" />
          <div className="stripe-navy" />
          <div className="stripe-skyblue" />
        </div>

        {/* Drawer Header */}
        <div className="p-5 border-b border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/college-logo.png" alt="College Emblem" className="h-9 w-auto max-h-9 max-w-[40px] object-contain drop-shadow-md shrink-0" />
              <img src="/ncc-logo.png" alt="NCC Emblem" className="h-9 w-auto max-h-9 max-w-[30px] object-contain drop-shadow-md shrink-0" />
              <span className="font-black text-sm uppercase tracking-wider text-white">NCC Command</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Instructor Profile Card */}
          <div className="flex items-center gap-3 min-w-0 bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-[#EF1C25] border-2 border-[#FFCB06] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm truncate text-white">{user?.name || 'Instructor'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#FFCB06] text-[#1E216B]">
                  {user?.role || 'ADMIN'}
                </span>
                <span className="text-[11px] font-bold text-[#00AEEF]">Command Officer</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-200 font-bold hover:bg-white/10 hover:text-white transition-all text-sm cursor-pointer"
          >
            <LogOut className="w-5 h-5 text-[#EF1C25]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 pt-20 sm:pt-22 px-4 md:px-8 pb-10">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      <AnnouncementsModal
        isOpen={isAnnounceModalOpen}
        onClose={() => setIsAnnounceModalOpen(false)}
      />
    </div>
  );
};

export default Layout;
