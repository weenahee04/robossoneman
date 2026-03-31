import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/types';
import api from '@/services/api';
import { mockUser } from '@/services/mockData';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (lineAccessToken: string) => Promise<void>;
  loginDev: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USE_MOCK = !import.meta.env.VITE_API_URL;

function mapMockUser(mu: typeof mockUser): User {
  return {
    id: mu.id,
    displayName: mu.displayName,
    pictureUrl: mu.pictureUrl,
    tier: 'gold',
    totalPoints: mu.points,
    totalWashes: mu.totalWashes,
    memberSince: mu.memberSince.toISOString(),
    createdAt: mu.memberSince.toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const initialize = useCallback(async () => {
    if (USE_MOCK) {
      setState({
        user: mapMockUser(mockUser),
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }

    const token = api.getToken();
    if (!token) {
      // Auto dev-login in development
      if (import.meta.env.DEV) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/dev-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineUserId: 'dev_user_001' }),
          });
          const json = await res.json();
          if (json.data) {
            api.setToken(json.data.tokens.accessToken);
            setState({ user: json.data.user, isAuthenticated: true, isLoading: false });
            return;
          }
        } catch {
          // Backend not reachable — fall back to mock
          setState({
            user: mapMockUser(mockUser),
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const user = await api.getMe();
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      api.clearToken();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const login = useCallback(async (lineAccessToken: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const { user } = await api.loginWithLine(lineAccessToken);
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      throw err;
    }
  }, []);

  const loginDev = useCallback(async () => {
    if (USE_MOCK) {
      setState({
        user: mapMockUser(mockUser),
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'dev_user_001' }),
      });
      const json = await res.json();
      if (json.data) {
        api.setToken(json.data.tokens.accessToken);
        setState({ user: json.data.user, isAuthenticated: true, isLoading: false });
      }
    } catch {
      setState({
        user: mapMockUser(mockUser),
        isAuthenticated: true,
        isLoading: false,
      });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (USE_MOCK) return;
    try {
      const user = await api.getMe();
      setState((s) => ({ ...s, user }));
    } catch { /* ignore */ }
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...partial } } : s));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginDev,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
