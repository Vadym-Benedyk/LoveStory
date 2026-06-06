import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '@/shared/api/client';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'EDITOR';
}

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore a session via refresh cookie on mount.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post('/admin/auth/refresh');
        setAccessToken(data.accessToken);
        const me = await api.get<AdminUser>('/admin/auth/me');
        setUser(me.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const { data } = await api.post('/admin/auth/login', { email, password });
        setAccessToken(data.accessToken);
        setUser(data.user);
      },
      logout: async () => {
        await api.post('/admin/auth/logout');
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
