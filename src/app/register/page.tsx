'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Phone, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, signUp, signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  // TODO: 上线前删除测试账号相关逻辑
  const [devCode, setDevCode] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validatePhone = (phone: string) => {
    return /^1[3-9]\d{9}$/.test(phone);
  };

  const handleSendCode = async () => {
    if (!validatePhone(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    setSending(true);
    setError(null);

    try {
      // 占位：调用短信发送接口
      // 实际实现时替换为真实接口
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, type: 'register' }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || '验证码发送失败');
        return;
      }

      setSuccessMessage('验证码已发送');
      // TODO: 上线前删除测试账号相关逻辑 - 显示测试验证码
      if (data.devCode) {
        setDevCode(data.devCode);
      }
      setCountdown(60);
      setStep('verify');
    } catch {
      setError('验证码发送失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatePhone(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为6个字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!companyName.trim()) {
      setError('请填写公司名称');
      return;
    }

    if (step === 'form') {
      // 第一步：发送验证码
      await handleSendCode();
      return;
    }

    // 第二步：验证并注册
    if (!verifyCode) {
      setError('请输入验证码');
      return;
    }

    setSubmitting(true);

    try {
      const { error: signUpError } = await signUp(phone, password, companyName, address);
      if (signUpError) {
        setError(signUpError);
        return;
      }

      setSuccessMessage('注册成功！正在自动登录...');
      
      // 自动登录
      const { error: signInError } = await signIn(phone, password);
      if (signInError) {
        setError('注册成功但自动登录失败，请手动登录');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        router.replace('/');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">AI智能报价助手</h1>
          <p className="text-slate-500 mt-2">创建账号，开始智能报价之旅</p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center text-slate-800">用户注册</CardTitle>
            <CardDescription className="text-center">
              {step === 'form' ? '输入手机号和密码创建账号' : '输入收到的验证码完成注册'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">
                  {successMessage}
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
                    disabled={submitting || step === 'verify'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="请设置密码（至少6位）" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={submitting || step === 'verify'}
                  />
                </div>
              </div>

              {step === 'form' && (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">确认密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      placeholder="请再次输入密码" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}

              {step === 'verify' && (
                <div className="space-y-2">
                  <label htmlFor="verifyCode" className="text-sm font-medium text-slate-700">验证码</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="verifyCode" 
                        type="text" 
                        placeholder="请输入验证码" 
                        value={verifyCode} 
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="pl-10"
                        disabled={submitting}
                      />
                    </div>
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={countdown > 0 || sending}
                      className="whitespace-nowrap"
                    >
                      {sending ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">验证码已发送至您的手机，10分钟内有效</p>
                  {/* TODO: 上线前删除测试账号相关逻辑 */}
                  {devCode && (
                    <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                      🔧 测试模式：验证码为 <strong>{devCode}</strong>（上线前请删除此提示）
                    </p>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                disabled={submitting || sending}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />注册中...</>
                ) : step === 'form' ? (
                  <>下一步</>
                ) : (
                  <>完成注册</>
                )}
              </Button>

              {step === 'verify' && (
                <Button 
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep('form');
                    setVerifyCode('');
                    setError(null);
                  }}
                  className="w-full"
                >
                  返回上一步
                </Button>
              )}
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                已有账号？立即登录
              </Link>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-400 mt-6">注册即表示同意我们的服务条款和隐私政策</p>
      </div>
    </div>
  );
}
