import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, FileText, LogOut, Calendar, Menu, X, Settings, Megaphone } from 'lucide-react';
import { AnnouncementsModal } from './AnnouncementsModal';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';

const Layout: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'User Management' },
    { to: '/roaster', icon: Calendar, label: "Today's Roaster" },
    { to: '/attendance', icon: FileText, label: 'Attendance Records' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <NotificationPermissionBanner />
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#1A1E5C] text-white flex flex-col transform transition-transform duration-300 ease-in-out border-r border-[#121543] ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* NCC Tri-Color Top Accent Line */}
        <div className="ncc-tricolor-bar">
          <div className="stripe-red" />
          <div className="stripe-navy" />
          <div className="stripe-skyblue" />
        </div>

        <div className="p-5 flex items-center justify-between space-x-3 border-b border-[#2A318A]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#E52327] border-2 border-[#FFC800] flex items-center justify-center shadow-lg font-black text-white text-base tracking-tighter">
              NCC
            </div>
            <div>
              <span className="text-lg font-black tracking-wider text-white block leading-none">NCC CADET</span>
              <span className="text-[10px] font-bold tracking-widest text-[#00A6EB] uppercase">Attendance Portal</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-300 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 border-b border-[#2A318A] bg-[#121543]/60">
          <p className="text-xs text-slate-300 font-medium uppercase tracking-wider">Instructor Account:</p>
          <p className="font-bold text-white break-words text-sm mt-0.5">{user?.name}</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFC800] text-[#121543] mt-1.5 shadow-sm">
            {user?.role}
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-[#E52327] text-white shadow-md border-l-4 border-[#FFC800]'
                    : 'text-slate-200 hover:bg-[#2A318A] hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2A318A] bg-[#121543]/40">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-red-300 hover:bg-[#E52327] hover:text-white rounded-xl transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5 mr-3 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* NCC Tri-Color Top Accent Line */}
        <div className="ncc-tricolor-bar">
          <div className="stripe-red" />
          <div className="stripe-navy" />
          <div className="stripe-skyblue" />
        </div>

        <header className="bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 mr-3 text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-lg lg:text-xl font-black text-[#1A1E5C] truncate tracking-tight">NCC Instructor Portal</h2>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">National Cadet Corps Attendance & Roster Management</p>
            </div>
          </div>

          <button
            onClick={() => setIsAnnounceModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1E5C] hover:bg-[#2A318A] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all border-b-2 border-[#FFC800]"
          >
            <Megaphone className="w-4 h-4 text-[#FFC800]" />
            <span>Broadcast Announcement</span>
          </button>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <AnnouncementsModal
        isOpen={isAnnounceModalOpen}
        onClose={() => setIsAnnounceModalOpen(false)}
      />
      </div>
    </div>
  );
};

export default Layout;
