'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase-browser';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signUp: (phone: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取初始session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (phone: string, password: string): Promise<{ error: string | null }> => {
    try {
      // 使用手机号作为标识登录，先查询用户再验证密码
      const { data: userData, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (queryError || !userData) {
        return { error: '用户不存在' };
      }

      // 验证密码
      if (userData.password !== password) {
        return { error: '密码错误' };
      }

      // 使用 Supabase Auth 的 signInWithPassword（这里我们直接用邮箱方式）
      // 由于我们使用自定义用户表，需要手动创建 session
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${phone}@placeholder.com`, // 占位邮箱
        password: password,
      });

      if (error) {
        // 如果 signInWithPassword 失败，使用自定义方式登录
        // 直接设置 session
        const mockSession = {
          access_token: 'custom_token',
          refresh_token: 'custom_refresh',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: 'bearer',
          user: {
            id: userData.id,
            email: null,
            phone: userData.phone,
            created_at: userData.created_at,
          } as User,
        };
        
        // 存储 session 到 localStorage
        localStorage.setItem('custom_session', JSON.stringify({
          ...mockSession,
          user: {
            id: userData.id,
            phone: userData.phone,
            created_at: userData.created_at,
          }
        }));
        
        setSession(mockSession as Session);
        setUser(mockSession.user);
        return { error: null };
      }

      return { error: null };
    } catch (err) {
      return { error: '登录失败，请稍后重试' };
    }
  };

  const signUp = async (phone: string, password: string): Promise<{ error: string | null }> => {
    try {
      // 检查手机号是否已注册
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (existingUser) {
        return { error: '该手机号已注册' };
      }

      // 创建用户记录
      const { data, error } = await supabase
        .from('users')
        .insert({
          phone,
          password, // 生产环境应加密
          created_at: new Date().toISOString(),
        })
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
      // 验证验证码（预留接口）
      if (code !== '123456') { // 占位：实际应调用短信验证码接口
        return { error: '验证码错误' };
      }

      // 更新密码
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
