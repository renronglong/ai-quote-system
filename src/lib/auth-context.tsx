'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase-browser';

// Extended user info including custom fields from the users table
export interface RecognitionQuota {
  balance: number;
  remaining: number;
  cost_per_recognition: number;
}

export interface ExtendedUser extends User {
  phone?: string;
  company_name?: string;
  address?: string;
  referral_code?: string;
  is_admin?: boolean;
}

/** 管理员token存sessionStorage（关闭标签页失效，安全） */
export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
  } catch { return null; }
}

interface AuthContextType {
  user: ExtendedUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signUp: (phone: string, password: string, companyName?: string, address?: string, referralCode?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<{ error: string | null }>;
  quota: RecognitionQuota | null;
  checkQuota: () => Promise<void>;
  referralCode: string | null;
  referralLink: string;
  isAdmin: boolean;
  ensureReferralLink: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<RecognitionQuota | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkQuota = useCallback(async () => {
    if (!user) { setQuota(null); return; }
    try {
      const resp = await fetch(`/api/recognize-quota?userId=${user.id}`);
      if (resp.ok) {
        const data = await resp.json();
        setQuota({ balance: data.balance ?? 0, remaining: data.remaining ?? 0, cost_per_recognition: data.cost_per_recognition ?? 10 });
      }
    } catch { /* ignore */ }
  }, [user]);

  const loadSession = useCallback(() => {
    const saved = localStorage.getItem('custom_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Session;
        if (parsed.expires_at && parsed.expires_at > Date.now()) {
          setSession(parsed);
          setUser(parsed.user as ExtendedUser);
          // 提取 referral code
          const rc = (parsed.user as any)?.referral_code;
          if (rc) setReferralCode(rc);
          setIsAdmin(!!(parsed.user as any)?.is_admin);
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
    const handleAuthChanged = () => { loadSession(); };
    window.addEventListener('auth-changed', handleAuthChanged);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'custom_session') { loadSession(); }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth-changed', handleAuthChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadSession]);

  // 登录后自动查询额度
  useEffect(() => {
    if (user) checkQuota();
  }, [user, checkQuota]);

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
      if (data.admin_token) {
        try { sessionStorage.setItem('admin_token', data.admin_token); localStorage.setItem('admin_token', data.admin_token); } catch { /* ignore */ }
      } else {
        try { sessionStorage.removeItem('admin_token'); localStorage.removeItem('admin_token'); } catch { /* ignore */ }
      }
      setIsAdmin(!!data.user?.is_admin);
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
          referral_code: data.user.referral_code || '',
          is_admin: !!data.user.is_admin,
        },
      } as unknown as Session;
      localStorage.setItem('custom_session', JSON.stringify(mockSession));
      setSession(mockSession);
      setUser(mockSession.user as ExtendedUser);
      if (data.user.referral_code) setReferralCode(data.user.referral_code);
      return { error: null };
    } catch (err) {
      return { error: '登录失败，请稍后重试' };
    }
  };

  const signUp = async (phone: string, password: string, companyName?: string, address?: string, referralCodeParam?: string): Promise<{ error: string | null }> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, companyName, address, referralCode: referralCodeParam }),
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
    setQuota(null);
    setReferralCode(null);
    setIsAdmin(false);
    try { sessionStorage.removeItem('admin_token'); } catch { /* ignore */ }
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

  const referralLink = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://www.gyparts.cn'}/register?ref=${referralCode}`
    : '';

  // 兜底：老用户没有推荐码时调用接口生成，并同步更新当前会话
  const ensureReferralLink = async (): Promise<string> => {
    if (referralCode) return referralLink;
    if (!user) return '';
    try {
      const resp = await fetch('/api/auth/referral-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await resp.json();
      if (resp.ok && data.referral_code) {
        setReferralCode(data.referral_code);
        // 同步进 localStorage 会话，刷新后不丢失
        try {
          const saved = localStorage.getItem('custom_session');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.user) {
              parsed.user.referral_code = data.referral_code;
              localStorage.setItem('custom_session', JSON.stringify(parsed));
            }
          }
        } catch { /* ignore */ }
        return data.referral_link || '';
      }
    } catch { /* ignore */ }
    return '';
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, quota, checkQuota, referralCode, referralLink, isAdmin, ensureReferralLink }}>
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
