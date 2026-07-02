'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Phone, Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ResetStep = 'phone' | 'verify' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { user, loading, resetPassword } = useAuth();
  const [step, setStep] = useState<ResetStep>('phone');
  const [phone, setPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

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
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, type: 'reset_password' }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || '验证码发送失败');
        return;
      }

      setSuccessMessage('验证码已发送');
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

    if (step === 'phone') {
      await handleSendCode();
      return;
    }

    if (step === 'verify') {
      if (!verifyCode) {
        setError('请输入验证码');
        return;
      }
      setStep('password');
      return;
    }

    if (step === 'password') {
      if (newPassword.length < 6) {
        setError('密码长度至少为6个字符');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }

      setSubmitting(true);

      try {
        const { error } = await resetPassword(phone, verifyCode, newPassword);
        if (error) {
          setError(error);
          return;
        }

        setSuccessMessage('密码重置成功！');
        setTimeout(() => router.push('/login'), 2000);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'phone': return '验证手机号';
      case 'verify': return '输入验证码';
      case 'password': return '设置新密码';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'phone': return '输入您注册时使用的手机号';
      case 'verify': return '输入发送至您手机的验证码';
      case 'password': return '设置新的登录密码';
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">重置密码</h1>
          <p className="text-slate-500 mt-2">通过手机验证找回您的账号</p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center text-slate-800">{getStepTitle()}</CardTitle>
            <CardDescription className="text-center">{getStepDescription()}</CardDescription>
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

              {step === 'phone' && (
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
                  <p className="text-xs text-slate-500">验证码已发送至 {phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</p>
                </div>
              )}

              {step === 'password' && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">新密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="newPassword" 
                        type="password" 
                        placeholder="请输入新密码（至少6位）" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">确认密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        placeholder="请再次输入新密码" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </>
              )}

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                disabled={submitting || sending}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />处理中...</>
                ) : step === 'phone' ? (
                  <>发送验证码</>
                ) : step === 'verify' ? (
                  <>下一步</>
                ) : (
                  <>重置密码</>
                )}
              </Button>

              {step !== 'phone' && (
                <Button 
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (step === 'verify') {
                      setStep('phone');
                    } else {
                      setStep('verify');
                    }
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回上一步
                </Button>
              )}
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                想起密码了？返回登录
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
