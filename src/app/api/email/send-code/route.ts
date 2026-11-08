/**
 * POST /api/email/send-code
 *
 * 发送「邮箱验证码」，支持两种用途：
 *   - purpose = 'register'（默认）：邮箱注册，复用 Supabase Auth signUp 触发 Confirm 邮件（6 位 OTP）
 *   - purpose = 'login'          ：邮箱无密码登录，复用 Supabase Auth signInWithOtp 触发 Magic Link 类型 OTP
 *
 * 邮件投递由 Supabase 邮件服务 + Resend SMTP 完成，本站不自建发信服务、不接腾讯云 SES。
 *
 * 请求体：{ email: string, purpose?: 'register' | 'login' }
 * 响应：  { success: true } 或 { error, retryAfter? }
 *
 * 环境变量：
 *   NEXT_PUBLIC_SUPABASE_URL / COZE_SUPABASE_SERVICE_ROLE_KEY（业务库，查重/建号）
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY（默认 OTP 项目 anon key）
 *   EMAIL_OTP_SUPABASE_URL / EMAIL_OTP_SUPABASE_ANON_KEY（可选：指向已配好中文 6 位模板 + Resend 的专用项目）
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const businessUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const otpUrl = process.env.EMAIL_OTP_SUPABASE_URL || businessUrl;
const otpAnonKey = process.env.EMAIL_OTP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const purpose: 'register' | 'login' = body?.purpose === 'login' ? 'login' : 'register';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: '请输入正确的邮箱地址' }, { status: 400 });
    }
    if (!serviceKey || !otpAnonKey) {
      console.error('[Email/SendCode] 缺少 Supabase 配置');
      return NextResponse.json({ error: '服务配置错误，请联系管理员' }, { status: 500 });
    }

    // 业务库查重：注册时邮箱已存在 → 拒绝；登录时邮箱不存在 → 提示先注册
    const db = createClient(businessUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: existing, error: queryError } = await db
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (queryError) console.error('[Email/SendCode] 邮箱查重失败:', queryError.message);

    if (purpose === 'register') {
      if (existing) {
        return NextResponse.json({ error: '该邮箱已注册，请直接登录' }, { status: 400 });
      }
    } else {
      if (!existing) {
        return NextResponse.json({ error: '该邮箱尚未注册，请先注册' }, { status: 400 });
      }
    }

    const auth = createClient(otpUrl, otpAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let sendError: { message?: string } | null = null;
    if (purpose === 'register') {
      // signUp 触发 Confirm signup 邮件（含 6 位 {{ .Token }}）
      const tempPassword = 'Gy!' + randomBytes(18).toString('base64url') + '9aA';
      const { error } = await auth.auth.signUp({
        email,
        password: tempPassword,
        options: { data: { source: 'gyparts-email-signup' } },
      });
      sendError = error;
    } else {
      // signInWithOtp 触发 Magic Link / Email OTP（type='email'）
      const { error } = await auth.auth.signInWithOtp({
        email,
        options: { data: { source: 'gyparts-email-login' } },
      });
      sendError = error;
    }

    if (sendError) {
      const msg = (sendError.message || '').toLowerCase();
      // Supabase Auth 自带发送间隔限频
      if (msg.includes('rate') || msg.includes('too many') || msg.includes('security') || msg.includes('after')) {
        return NextResponse.json({ error: '发送过于频繁，请稍后再试', retryAfter: 60 }, { status: 429 });
      }
      console.error('[Email/SendCode] 发码失败:', sendError.message);
      return NextResponse.json({ error: '验证码发送失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '验证码已发送' });
  } catch (err) {
    console.error('[Email/SendCode] 异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
