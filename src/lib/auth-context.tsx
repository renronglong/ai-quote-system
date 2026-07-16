'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase-browser';

// Extended user info including custom fields from the users table
export interface ExtendedUser extends User {
  phone?: string;
  company_name?: string;
  address?: string;
}

interface AuthContextType {
  user: ExtendedUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signUp: (phone: string, password: string, companyName?: string, address?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(() => {
    const saved = localStorage.getItem('custom_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Session;
        // Check if expired
        if (parsed.expires_at && parsed.expires_at > Date.now()) {
          setSession(parsed);
          setUser(parsed.user);
        } else {
          localStorage.removeItem('custom_session');
        }
      } catch {
        localStorage.removeItem('custom_session');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSession();

    // Listen for auth-changed events (e.g., after login/register from server API)
    const handleAuthChanged = () => {
      loadSession();
    };
    window.addEventListener('auth-changed', handleAuthChanged);

    // Also listen for storage events (cross-tab sync)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'custom_session') {
        loadSession();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('auth-changed', handleAuthChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadSession]);

  const signIn = async (phone: string, password: string): Promise<{ error: string | null }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || '登录失败' };
      }

      const mockSession = {
        access_token: 'custom_token',
        refresh_token: 'custom_refresh',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'bearer',
        user: {
          id: data.user.id,
          email: data.user.email || null,
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          phone: data.user.phone || '',
          company_name: data.user.company_name || '',
          address: data.user.address || '',
        },
      } as unknown as Session;

      localStorage.setItem('custom_session', JSON.stringify(mockSession));
      setSession(mockSession);
      setUser(mockSession.user);

      return { error: null };
    } catch (err) {
      return { error: '登录失败，请稍后重试' };
    }
  };

  const signUp = async (phone: string, password: string, companyName?: string, address?: string): Promise<{ error: string | null }> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, companyName, address }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || '注册失败' };
      }

      return { error: null };
    } catch (err) {
      return { error: '注册失败，请稍后重试' };
    }
  };

  const signOut = async (): Promise<void> => {
    localStorage.removeItem('custom_session');
    setSession(null);
    setUser(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (phone: string, code: string, newPassword: string): Promise<{ error: string | null }> => {
    try {
      if (code !== '123456') {
        return { error: '验证码错误' };
      }

      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('phone', phone);

      if (error) {
        return { error: '密码重置失败，请稍后重试' };
      }

      return { error: null };
    } catch (err) {
      return { error: '密码重置失败，请稍后重试' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Extended user info including custom fields from the users table
export interface ExtendedUser extends User {
  phone?: string;
  company_name?: string;
  address?: string;
}
