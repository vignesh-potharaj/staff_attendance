import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import TodayRoaster from './pages/TodayRoaster';
import RoasterDisplay from './pages/RoasterDisplay';
import Attendance from './pages/Attendance';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="roaster" element={<TodayRoaster />} />
            <Route path="roaster-view" element={<RoasterDisplay />} />
            <Route path="roaster-management" element={<TodayRoaster />} />
            <Route path="attendance" element={<Attendance />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
