import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

export interface User {
  id: number;
  name: string;
  employee_id: string;
  role: string;
  email?: string;
  phone?: string;
  hourly_pay?: number;
  daily_pay?: number;
  pay_type?: 'hourly' | 'daily';
  tenant_id?: number;
  tenant_name?: string;
  tenant_slug?: string;
  subscription_status?: string;
  geofence_maps_link?: string;
  geofence_radius_meters?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('staff_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('staff_token'));
  const [loading, setLoading] = useState(false);

  const refreshUser = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get('/auth/me');
      if (res.data) {
        setUser(res.data);
        localStorage.setItem('staff_user', JSON.stringify(res.data));
      }
    } catch {
      // Ignore background refresh errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser();
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('staff_token', newToken);
    localStorage.setItem('staff_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

