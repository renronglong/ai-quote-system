/**
 * POST /api/email/verify-code
 *
 * 校验「邮箱验证码」并完成无密码登录。
 * 通过 Supabase Auth verifyOtp({ type: 'email' }) 校验邮件 OTP（项目可配置为 6 或 8 位），校验通过后按邮箱
 * 查业务 users 表，签发与 /api/auth/login 完全一致的会话（user / admin_token / user_token）。
 *
 * 请求体：{ email: string, code: string }
 * 响应：  { success: true, user, admin_token?, user_token } 或 { error }
 *
 * 环境变量（同 send-code）：
 *   NEXT_PUBLIC_SUPABASE_URL / COZE_SUPABASE_SERVICE_ROLE_KEY
 *   EMAIL_OTP_SUPABASE_URL / EMAIL_OTP_SUPABASE_ANON_KEY
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminPhone, signAdminToken, signUserToken } from '@/lib/admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const businessUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const otpUrl = process.env.EMAIL_OTP_SUPABASE_URL || businessUrl;
const otpAnonKey = process.env.EMAIL_OTP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const code = String(body?.code || '').trim();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: '请输入正确的邮箱地址' }, { status: 400 });
    }
    // Supabase 邮件 OTP 长度按项目配置可能为 6 或 8 位，两种都放行
    if (!/^\d{6,8}$/.test(code)) {
      return NextResponse.json({ error: '请输入邮件中的数字验证码' }, { status: 400 });
    }
    if (!serviceKey || !otpAnonKey) {
      console.error('[Email/VerifyCode] 缺少 Supabase 配置');
      return NextResponse.json({ error: '服务配置错误，请联系管理员' }, { status: 500 });
    }

    // 1) 校验 Supabase Auth 下发的邮件 OTP（type 须与 send-code 的 signInWithOtp 对应）
    const auth = createClient(otpUrl, otpAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: otpError } = await auth.auth.verifyOtp({ email, token: code, type: 'email' });
    if (otpError) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
    }

    // 2) 按邮箱查业务账号并签发会话（与 /api/auth/login 一致）
    const supabase = createClient(businessUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (queryError || !userData) {
      return NextResponse.json({ error: '该邮箱尚未注册，请先注册' }, { status: 400 });
    }

    const admin = isAdminPhone(userData.phone);
    // 邮箱注册用户可能无手机号：用 email / id 兜底，保证 token 唯一
    const tokenIdentity = userData.phone || userData.email || userData.id;
    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        phone: userData.phone,
        email: userData.email || '',
        company_name: userData.company_name,
        display_name: userData.display_name || null,
        referral_code: userData.referral_code,
        address: userData.address,
        is_admin: admin,
      },
      admin_token: admin ? signAdminToken(userData.phone) : undefined,
      user_token: signUserToken(tokenIdentity),
    });
  } catch (err) {
    console.error('[Email/VerifyCode] 异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
