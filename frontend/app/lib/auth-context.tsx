'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiFetch } from './api';

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
}

export type LoginResult =
  | { success: true; mfaRequired: false }
  | { success: true; mfaRequired: true; partialToken: string }
  | { success: false; error?: string };

interface AuthContextType {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<LoginResult>;
  validateTotp: (partialToken: string, code: string) => Promise<boolean>;
  register: (data: Record<string, unknown>) => Promise<{ userId: string } | null>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

interface LoginResponse {
  success: boolean;
  sessionToken: string | null;
  errorMessage: string | null;
  secondFactorRequired: boolean;
}

interface RegistrationResponse {
  success: boolean;
  errorMessage: string | null;
  sessionToken: string | null;
}

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function userFromToken(token: string): User | null {
  const payload = parseJwt(token);
  if (!payload) return null;
  const roles = (payload.roles as string[] | undefined) ?? [];
  return {
    id: payload.userId as string,
    name: payload.username as string,
    email: '', // JWT doesn't contain email; can be fetched later if needed
    isAdmin: roles.includes('ADMIN'),
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: 'unauthenticated',
  login: async () => ({ success: false }),
  validateTotp: async () => false,
  register: async () => null,
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  // Restore session on mount — also handles the ?token= param from OAuth redirects
  useEffect(() => {
    // OAuth callback: pick up token from URL and clear it
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('token');
    if (oauthToken) {
      params.delete('token');
      const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', cleanUrl);
      const oauthUser = userFromToken(oauthToken);
      if (oauthUser) {
        localStorage.setItem('session_token', oauthToken);
        setUser(oauthUser);
        setStatus('authenticated');
        apiFetch<{ email?: string; avatarUrl?: string | null }>(`/api/public/users/${oauthUser.id}`)
          .then(profile => {
            setUser(prev => prev ? {
              ...prev,
              ...(profile.email ? { email: profile.email } : {}),
              avatarUrl: profile.avatarUrl ?? null,
            } : prev);
          })
          .catch(() => {});
        return;
      }
    }

    // Normal session restore from localStorage
    const token = localStorage.getItem('session_token');
    if (token) {
      const restored = userFromToken(token);
      if (restored) {
        setUser(restored);
        setStatus('authenticated');
        apiFetch<{ email?: string; avatarUrl?: string | null }>(`/api/public/users/${restored.id}`)
          .then(profile => {
            setUser(prev => prev ? {
              ...prev,
              ...(profile.email ? { email: profile.email } : {}),
              avatarUrl: profile.avatarUrl ?? null,
            } : prev);
          })
          .catch(() => {});
      } else {
        localStorage.removeItem('session_token');
        setStatus('unauthenticated');
      }
    } else {
      setStatus('unauthenticated');
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: email, password }),
      });

      if (!data.success || !data.sessionToken) {
        return { success: false, error: data.errorMessage ?? undefined };
      }

      if (data.secondFactorRequired) {
        return { success: true, mfaRequired: true, partialToken: data.sessionToken };
      }

      localStorage.setItem('session_token', data.sessionToken);
      const loggedInUser = userFromToken(data.sessionToken);
      setUser(loggedInUser);
      setStatus('authenticated');
      if (loggedInUser) {
        apiFetch<{ email?: string; avatarUrl?: string | null }>(`/api/public/users/${loggedInUser.id}`)
          .then(profile => {
            setUser(prev => prev ? {
              ...prev,
              ...(profile.email ? { email: profile.email } : {}),
              avatarUrl: profile.avatarUrl ?? null,
            } : prev);
          })
          .catch(() => {});
      }
      return { success: true, mfaRequired: false };
    } catch (err) {
      console.error('[AUTH] Login failed:', err);
      return { success: false, error: err instanceof Error ? err.message : undefined };
    }
  }, []);

  const validateTotp = useCallback(async (partialToken: string, code: string): Promise<boolean> => {
    try {
      const data = await apiFetch<{ success: boolean; sessionToken: string | null }>('/api/auth/2fa/validate', {
        method: 'POST',
        body: JSON.stringify({ token: partialToken, code }),
      });
      if (!data.success || !data.sessionToken) return false;
      localStorage.setItem('session_token', data.sessionToken);
      const loggedInUser = userFromToken(data.sessionToken);
      setUser(loggedInUser);
      setStatus('authenticated');
      if (loggedInUser) {
        apiFetch<{ email?: string; avatarUrl?: string | null }>(`/api/public/users/${loggedInUser.id}`)
          .then(profile => {
            setUser(prev => prev ? {
              ...prev,
              ...(profile.email ? { email: profile.email } : {}),
              avatarUrl: profile.avatarUrl ?? null,
            } : prev);
          })
          .catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const register = useCallback(async (data: Record<string, unknown>): Promise<{ userId: string } | null> => {
    try {
      const res = await apiFetch<RegistrationResponse>('/api/auth/registration', {
        method: 'POST',
        body: JSON.stringify({
          username: data.nickname,
          email: data.email,
          password: data.password,
          name: data.name,
          nickname: data.nickname,
          address: data.address,
        }),
      });

      if (!res.success || !res.sessionToken) {
        throw new Error(res.errorMessage || 'Registration failed');
      }

      localStorage.setItem('session_token', res.sessionToken);
      const registeredUser = userFromToken(res.sessionToken);
      // Email is known from the registration form
      if (registeredUser && data.email) {
        registeredUser.email = data.email as string;
      }
      setUser(registeredUser);
      setStatus('authenticated');

      return { userId: registeredUser?.id ?? '' };
    } catch (err) {
      console.error('[AUTH] Registration failed:', err);
      throw err;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    if (!token) return;
    const current = userFromToken(token);
    if (!current) return;
    try {
      const profile = await apiFetch<{ email?: string; avatarUrl?: string | null }>(`/api/public/users/${current.id}`);
      setUser(prev => prev ? {
        ...prev,
        ...(profile.email ? { email: profile.email } : {}),
        avatarUrl: profile.avatarUrl ?? null,
      } : prev);
    } catch { /* silently ignore */ }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('session_token');
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, validateTotp, register, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
