import { createContext, useContext, useMemo, useState } from 'react';
import type { FC, ReactNode } from 'react';

interface SuperAdminUser {
  email: string;
  role: string;
}

interface SuperAdminAuthContextValue {
  token: string | null;
  user: SuperAdminUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: SuperAdminUser) => void;
  logout: () => void;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextValue | undefined>(undefined);

export const SuperAdminAuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('super_admin_token'));
  const [user, setUser] = useState<SuperAdminUser | null>(() => {
    const raw = localStorage.getItem('super_admin_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SuperAdminUser;
    } catch {
      return null;
    }
  });

  const value = useMemo<SuperAdminAuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login: (nextToken, nextUser) => {
        localStorage.setItem('super_admin_token', nextToken);
        localStorage.setItem('super_admin_user', JSON.stringify(nextUser));
        setToken(nextToken);
        setUser(nextUser);
      },
      logout: () => {
        localStorage.removeItem('super_admin_token');
        localStorage.removeItem('super_admin_user');
        setToken(null);
        setUser(null);
      },
    }),
    [token, user]
  );

  return <SuperAdminAuthContext.Provider value={value}>{children}</SuperAdminAuthContext.Provider>;
};

export const useSuperAdminAuth = () => {
  const context = useContext(SuperAdminAuthContext);
  if (!context) {
    throw new Error('useSuperAdminAuth must be used within SuperAdminAuthProvider');
  }
  return context;
};
