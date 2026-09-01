'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Phone, Lock, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 页面加载时读取已保存的凭据
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gyparts_remember');
      if (saved) {
        const { phone: savedPhone, password: savedPwd } = JSON.parse(saved);
        if (savedPhone) setPhone(savedPhone);
        if (savedPwd) setPassword(savedPwd);
        setRemember(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const validatePhone = (phone: string) => {
    return /^1[3-9]\d{9}$/.test(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatePhone(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    setSubmitting(true);

    try {
      // 调用服务端登录接口
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '登录失败');
        return;
      }

      // 登录成功，存储会话
      const mockSession = {
        access_token: 'custom_token',
        refresh_token: 'custom_refresh',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'bearer',
        user: {
          id: data.user.id,
          email: null,
          phone: data.user.phone,
          is_admin: !!data.user.is_admin,
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      };

      localStorage.setItem('custom_session', JSON.stringify(mockSession));

      // 管理员token存入sessionStorage（刷新不丢，关闭标签页失效）
      if (data.admin_token) {
        try { sessionStorage.setItem('admin_token', data.admin_token); } catch { /* ignore */ }
      } else {
        try { sessionStorage.removeItem('admin_token'); } catch { /* ignore */ }
      }

      // 记住密码处理
      if (remember) {
        localStorage.setItem('gyparts_remember', JSON.stringify({ phone, password }));
      } else {
        localStorage.removeItem('gyparts_remember');
      }

      // 触发 auth context 更新
      window.dispatchEvent(new Event('auth-changed'));
      router.replace('/');
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-100 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">AI智能报价助手</h1>
          <p className="text-slate-500 mt-2">智能报价，让工作更高效</p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center text-slate-800">用户登录</CardTitle>
            <CardDescription className="text-center">输入您的账号信息登录系统</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-slate-700">手机号</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="请输入手机号" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">密码</label>
                  <Link 
                    href="/forgot-password" 
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="请输入密码" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* 记住密码 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="remember" className="text-sm text-slate-600 select-none cursor-pointer">
                  记住密码
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />登录中...</>
                ) : (
                  <><LogIn className="w-4 h-4 mr-2" />登录</>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/register" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                还没有账号？立即注册
              </Link>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-400 mt-6">
          登录即表示同意
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">《用户服务协议》</Link>
          和
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">《隐私政策》</Link>
        </p>
      </div>
    </div>
  );
}
