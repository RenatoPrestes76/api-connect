'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { AdminRole, Permission } from '@/types';
import * as authService from '@/services/auth.service';
import type { AdminMeResponse } from '@/services/auth.service';

interface AdminAuthContextValue {
  user: AdminMeResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  hasRole: (role: AdminRole) => boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

// Proactively refresh the 15-minute access token well before it expires.
const SILENT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function AdminAuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<AdminMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadUser = useCallback(async (): Promise<AdminMeResponse | null> => {
    let me = await authService.getCurrentUser();
    if (!me) {
      const refreshed = await authService.refresh();
      if (refreshed) me = await authService.getCurrentUser();
    }
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    loadUser().finally(() => setLoading(false));
  }, [loadUser]);

  useEffect(() => {
    if (!user) {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      return;
    }
    refreshTimer.current = setInterval(() => {
      void authService.refresh();
    }, SILENT_REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [user]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authService.login({ email, password });
      await loadUser();
      return result;
    },
    [loadUser]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const ok = await authService.refresh();
    if (ok) await loadUser();
    return ok;
  }, [loadUser]);

  const hasRole = useCallback((role: AdminRole) => user?.role === role, [user]);
  const hasPermission = useCallback(
    (permission: Permission) => Boolean(user?.permissions.includes(permission)),
    [user]
  );

  const value: AdminAuthContextValue = {
    user,
    loading,
    login,
    logout,
    refresh,
    hasRole,
    hasPermission,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuthContext(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuthContext must be used within an AdminAuthProvider');
  return ctx;
}
