import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import StaffLayout from './components/StaffLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MarkAttendance from './pages/MarkAttendance';
import History from './pages/History';
import { useEffect } from 'react';
import { initNativePushListeners } from './services/notificationService';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  
  return token ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  useEffect(() => {
    initNativePushListeners();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/staff/dashboard" replace />} />
          <Route
            path="/staff"
            element={
              <PrivateRoute>
                <StaffLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/staff/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="mark-attendance" element={<MarkAttendance />} />
            <Route path="attendance-history" element={<History />} />
          </Route>
          <Route path="/history" element={<Navigate to="/staff/attendance-history" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
