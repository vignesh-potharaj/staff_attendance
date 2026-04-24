import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import SidebarLayout from './components/SidebarLayout';
import { SuperAdminAuthProvider, useSuperAdminAuth } from './contexts/SuperAdminAuthContext';
import AuditLogs from './pages/AuditLogs';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import TenantDetail from './pages/TenantDetail';
import Tenants from './pages/Tenants';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useSuperAdminAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => (
  <BrowserRouter>
    <SuperAdminAuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SidebarLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/tenants/:id" element={<TenantDetail />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </SuperAdminAuthProvider>
  </BrowserRouter>
);

export default App;
