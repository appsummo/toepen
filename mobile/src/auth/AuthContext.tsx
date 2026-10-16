import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../types';
import { setAuthToken } from '../api/client';
import * as authApi from '../api/auth';
import { saveToken, loadToken, clearToken } from './storage';
import { loadServerUrl } from '../config';

interface AuthState {
  user: AuthUser | null;
  booting: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);

  // Restore server URL + session on cold start.
  useEffect(() => {
    (async () => {
      await loadServerUrl();
      const token = await loadToken();
      if (token) {
        setAuthToken(token);
        try {
          const me = await authApi.fetchMe();
          setUser(me);
        } catch {
          // stale/invalid token — drop it
          setAuthToken(null);
          await clearToken();
        }
      }
      setBooting(false);
    })();
  }, []);

  async function applySession(token: string, nextUser: AuthUser): Promise<void> {
    setAuthToken(token);
    await saveToken(token);
    setUser(nextUser);
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      booting,
      login: async (username, password) => {
        const res = await authApi.login({ username, password });
        await applySession(res.token, res.user);
      },
      register: async (username, password, displayName) => {
        const res = await authApi.register({ username, password, displayName });
        await applySession(res.token, res.user);
      },
      logout: async () => {
        setAuthToken(null);
        await clearToken();
        setUser(null);
      },
      refresh: async () => {
        try {
          setUser(await authApi.fetchMe());
        } catch {
          // ignore transient failures
        }
      },
    }),
    [user, booting],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
