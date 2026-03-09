'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiFetch } from './api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: Record<string, unknown>) => Promise<{ userId: string } | null>;
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
  return {
    id: payload.userId as string,
    name: payload.username as string,
    email: '', // JWT doesn't contain email; can be fetched later if needed
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: 'unauthenticated',
  login: async () => false,
  register: async () => null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  // Restore session from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (token) {
      const restored = userFromToken(token);
      if (restored) {
        setUser(restored);
        setStatus('authenticated');
      } else {
        localStorage.removeItem('session_token');
        setStatus('unauthenticated');
      }
    } else {
      setStatus('unauthenticated');
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: email, password }),
      });

      if (!data.success || !data.sessionToken) {
        return false;
      }

      localStorage.setItem('session_token', data.sessionToken);
      const loggedInUser = userFromToken(data.sessionToken);
      setUser(loggedInUser);
      setStatus('authenticated');
      return true;
    } catch (err) {
      console.error('[AUTH] Login failed:', err);
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
      setUser(registeredUser);
      setStatus('authenticated');
      return { userId: registeredUser?.id ?? '' };
    } catch (err) {
      console.error('[AUTH] Registration failed:', err);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('session_token');
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
