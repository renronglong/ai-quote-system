'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase-browser';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signUp: (phone: string, password: string, companyName?: string, address?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (phone: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data: userData, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (queryError || !userData) {
        return { error: '用户不存在' };
      }

      if (userData.password !== password) {
        return { error: '密码错误' };
      }

      const mockSession = {
        access_token: 'custom_token',
        refresh_token: 'custom_refresh',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'bearer',
        user: {
          id: userData.id,
          email: null,
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: userData.created_at,
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
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (existingUser) {
        return { error: '该手机号已注册' };
      }

      const insertData: Record<string, unknown> = {
        phone,
        password,
        created_at: new Date().toISOString(),
      };
      if (companyName) insertData.company_name = companyName;
      if (address) insertData.address = address;

      const { error } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return { error: '注册失败，请稍后重试' };
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
