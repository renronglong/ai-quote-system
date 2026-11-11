'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

/**
 * 登录页：视觉 1:1 复刻 baojia.bond/login（渐变背景 / 白卡片 / 双 tab /
 * 演示账号按钮 / 表单 / 底部介绍卡）。
 *
 * 功能沿用本站(gyparts.cn)既有认证链路：/api/auth/login + account(邮箱或手机号)
 * + password；另支持「邮箱验证码」无密码登录：/api/email/send-code 发码 +
 * /api/email/verify-code 校验并写会话。登录成功后写入 custom_session /
 * admin_token / user_token。
 * 不引入外部站点的 useAuth 方法（loginWithCode / sendCode / loginWithToken 等）。
 *
 * 该组件同时供 /login 页面与首页（未登录时）复用：
 * embedded=true 时不做路由跳转，登录成功后由 useAuth 的 auth-changed 事件
 * 更新登录态，父组件自动切回报价首页。
 */
export default function LoginPanel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 邮箱验证码发码防重复：发送中禁用 + 60 秒倒计时（与注册页口径一致）
  const [codeSending, setCodeSending] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  // 页面加载时读取已保存的凭据
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gyparts_remember');
      if (saved) {
        const { account: savedAccount, phone: savedPhone, password: savedPwd } = JSON.parse(saved);
        const savedUser = savedAccount || savedPhone;
        if (savedUser) setAccount(savedUser);
        if (savedPwd) setPassword(savedPwd);
        setRemember(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!embedded && !loading && user) {
      router.replace('/');
    }
  }, [user, loading, router, embedded]);

  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [codeCountdown]);

  // 邮箱为主，兼容老手机号账号
  const validateAccount = (v: string) => {
    const s = v.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || /^1[3-9]\d{9}$/.test(s);
  };

  const switchMode = (m: 'password' | 'code') => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const fillDemo = () => {
    setMode('password');
    setAccount('longge2623@agent.qq.com');
    setPassword('123456');
    setError(null);
    setInfo('已填入演示账号，点击登录即可');
  };

  // 把后端登录/校验返回的会话写入本地（custom_session + 双 token），并通知 context
  const applySession = (data: { user?: Record<string, unknown>; admin_token?: string; user_token?: string }) => {
    const u = data.user || {};
    const mockSession = {
      access_token: 'custom_token',
      refresh_token: 'custom_refresh',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'bearer',
      user: {
        id: u.id,
        email: u.email || null,
        phone: u.phone,
        is_admin: !!u.is_admin,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    };
    try { localStorage.setItem('custom_session', JSON.stringify(mockSession)); } catch { /* ignore */ }

    if (data.admin_token) {
      try { sessionStorage.setItem('admin_token', data.admin_token); } catch { /* ignore */ }
    } else {
      try { sessionStorage.removeItem('admin_token'); } catch { /* ignore */ }
    }
    if (data.user_token) {
      try { sessionStorage.setItem('user_token', data.user_token); localStorage.setItem('user_token', data.user_token); } catch { /* ignore */ }
    } else {
      try { sessionStorage.removeItem('user_token'); localStorage.removeItem('user_token'); } catch { /* ignore */ }
    }
    window.dispatchEvent(new Event('auth-changed'));
  };

  // 邮箱验证码（无密码）登录：发码
  const sendEmailCode = async () => {
    if (codeSending || codeCountdown > 0) return;
    const acc = account.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc)) {
      setError('请先输入正确的邮箱');
      return;
    }
    setError(null);
    setInfo(null);
    setCodeSending(true);
    try {
      const response = await fetch('/api/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc, purpose: 'login' }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || '验证码发送失败');
        return;
      }
      setInfo('验证码已发送，请查收邮箱（含垃圾邮件箱）');
      setCodeCountdown(60);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setCodeSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // 邮箱验证码（无密码）登录
    if (mode === 'code') {
      const acc = account.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc)) {
        setError('邮箱验证码登录请输入邮箱地址');
        return;
      }
      if (!/^\d{6,8}$/.test(code)) {
        setError('请输入邮件中的数字验证码');
        return;
      }
      setSubmitting(true);
      try {
        const response = await fetch('/api/email/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: acc, code }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || '登录失败');
          return;
        }
        applySession(data);
        if (!embedded) router.replace('/');
      } catch {
        setError('登录失败，请稍后重试');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateAccount(account)) {
      setError('请输入正确的邮箱或手机号');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: account.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '登录失败');
        return;
      }

      applySession(data);

      // 记住密码处理
      if (remember) {
        localStorage.setItem('gyparts_remember', JSON.stringify({ account: account.trim(), password }));
      } else {
        localStorage.removeItem('gyparts_remember');
      }

      if (!embedded) router.replace('/');
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F9FF]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#CBDDFE] via-[#E7F0FF] to-[#F5F9FF]">
      <div className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">

          {/* 标题区 */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-1">AI智能报价助手</h1>
            <p className="text-sm text-slate-500">智能报价，让工作更高效</p>
          </div>

          {/* 登录卡片 */}
          <div className="bg-white rounded-xl p-8 shadow-xl shadow-[#CBDDFE] ring-1 ring-[#B4D1FD]">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 text-center">登录账号</h2>

            {/* 一键填入演示账号 */}
            <button
              type="button"
              onClick={fillDemo}
              className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-700 hover:to-sky-600 hover:shadow-blue-500/40 active:scale-[0.99]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
              </svg>
              一键填入演示账号，体验完整功能
            </button>

            {/* 登录方式切换 */}
            <div className="flex p-1 bg-slate-100 rounded-lg mb-5">
              <button
                type="button"
                onClick={() => switchMode('password')}
                className={
                  'flex-1 py-1.5 text-sm rounded-md transition-colors ' +
                  (mode === 'password'
                    ? 'bg-white text-blue-700 font-medium shadow-sm'
                    : 'text-slate-500 hover:text-slate-700')
                }
              >
                密码登录
              </button>
              <button
                type="button"
                onClick={() => switchMode('code')}
                className={
                  'flex-1 py-1.5 text-sm rounded-md transition-colors ' +
                  (mode === 'code'
                    ? 'bg-white text-blue-700 font-medium shadow-sm'
                    : 'text-slate-500 hover:text-slate-700')
                }
              >
                邮箱验证码
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 账号 */}
              <div>
                <label htmlFor="account" className="block text-sm font-medium text-slate-600 mb-1">
                  {mode === 'password' ? '邮箱 / 手机号' : '邮箱'}
                </label>
                <input
                  id="account"
                  type="text"
                  inputMode={mode === 'password' ? 'text' : 'email'}
                  autoComplete="username"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder={mode === 'password' ? '请输入邮箱或手机号' : '请输入邮箱'}
                  disabled={submitting}
                  required
                />
                {mode === 'password' && (
                  <p className="mt-1.5 text-xs text-slate-400">老手机号账号可用「手机号 + 密码」直接登录</p>
                )}
              </div>

              {/* 密码 */}
              {mode === 'password' && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-600 mb-1">密码</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="请输入密码"
                    disabled={submitting}
                    required
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="remember"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="remember" className="text-xs text-slate-500 select-none cursor-pointer">记住密码</label>
                    </div>
                    <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                      忘记密码？
                    </Link>
                  </div>
                </div>
              )}

              {/* 验证码：邮箱验证码（无密码）登录 */}
              {mode === 'code' && (
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-slate-600 mb-1">验证码</label>
                  <div className="flex gap-2">
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm tracking-widest"
                      placeholder="邮件中的数字验证码"
                    />
                    <button
                      type="button"
                      onClick={sendEmailCode}
                      disabled={submitting || codeSending || codeCountdown > 0}
                      className="px-3 py-2.5 text-sm rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 whitespace-nowrap disabled:opacity-60"
                    >
                      {codeSending ? '发送中...' : codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                    验证码将发送至上方邮箱，10 分钟内有效；邮箱验证码仅用于已注册邮箱的无密码登录
                  </p>
                </div>
              )}

              {info && (
                <div className="text-emerald-600 text-sm text-center bg-emerald-50 rounded-lg py-2 px-3">{info}</div>
              )}
              {error && (
                <div className="text-red-500 text-sm text-center bg-red-50 rounded-lg py-2 px-3">{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? '处理中...' : mode === 'password' ? '登录' : '验证码登录'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/register" className="text-sm text-blue-600 hover:text-blue-800">
                没有账号？点击注册
              </Link>
            </div>

            <div className="mt-5 border-t border-dashed border-[#CBDDFE] pt-5">
              <Link
                href="/help"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#B4D1FD] bg-[#F5F9FF] py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-[#E7F0FF]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
                  <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5A1.5 1.5 0 0 0 20 18.5v-13Z" />
                </svg>
                查看完整功能介绍
              </Link>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                登录即表示同意
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">《用户服务协议》</Link>
                和
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">《隐私政策》</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
