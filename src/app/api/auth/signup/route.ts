/**
 * POST /api/auth/signup
 *
 * 双通道注册：
 *   1) 手机 + 短信验证码（原有逻辑，保持不变）
 *   2) 邮箱 + 邮箱验证码（新增，OTP 由 Supabase Auth 校验）
 *
 * 邮箱分支：verifyOtp({ type: 'signup' }) 校验一次性 6 位码 → 查重 → 写 users 表。
 * users 表写入自适应两种结构（详见 supabase/migrations/email_signup_migration.sql）：
 *   - 迁移已执行（EMAIL_SIGNUP_DDL_APPLIED=true）：phone=null + display_name
 *   - 未执行：phone 用邮箱派生占位值 + company_name（兼容老结构）
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { verifySmsCodeForSignup } from '@/lib/sms-middleware';
import { changeCredits, SIGNUP_BONUS_CREDITS, REFERRAL_BONUS_CREDITS } from '@/lib/credits';
import { hashPassword } from '@/lib/password';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const otpUrl = process.env.EMAIL_OTP_SUPABASE_URL || supabaseUrl;
const otpAnonKey = process.env.EMAIL_OTP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const ddlApplied = process.env.EMAIL_SIGNUP_DDL_APPLIED === 'true';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim();

    // 邮箱分支：只给了 email（无 phone）→ 走邮箱 + 验证码
    if (email && !phone) {
      return await handleEmailSignup(body, email);
    }

    // ===== 原有手机 + 短信分支 =====
    const password = String(body?.password || '');
    const verifyCode = String(body?.verifyCode || '');
    const companyName = body?.companyName ? String(body.companyName) : '';
    const address = body?.address ? String(body.address) : '';
    const referralCode = body?.referralCode ? String(body.referralCode) : null;

    if (!validatePhone(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少为6个字符' }, { status: 400 });
    }
    if (!verifyCode) {
      return NextResponse.json({ error: '请提供短信验证码' }, { status: 400 });
    }

    // 万能验证码（通过环境变量控制，默认开启）
    const universalEnabled = process.env.UNIVERSAL_CODE_ENABLED !== 'false';
    if (!(universalEnabled && verifyCode === '888888')) {
      const smsResult = await verifySmsCodeForSignup(phone, verifyCode);
      if (!smsResult.valid) {
        return NextResponse.json({ error: smsResult.error }, { status: 400 });
      }
    }

    if (!supabaseServiceKey) {
      console.error('[Signup] Supabase service role key not set');
      return NextResponse.json({ error: '服务配置错误，请联系管理员' }, { status: 500 });
    }

    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: '请输入正确的邮箱地址' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();
    if (existingUser) {
      return NextResponse.json({ error: '该手机号已注册' }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      phone,
      password: hashPassword(password),
      created_at: new Date().toISOString(),
    };
    if (email) insertData.email = email;
    if (companyName) insertData.company_name = companyName;
    if (address) insertData.address = address;

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    insertData.referral_code = code;

    if (referralCode) {
      const { data: inviter } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();
      if (inviter) insertData.invited_by = inviter.id;
    }

    const { data, error } = await supabase.from('users').insert(insertData).select().single();
    if (error) {
      console.error('[Signup] 创建用户失败:', error);
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }

    await grantCredits(supabase, data.id, insertData.invited_by as string | undefined);

    return NextResponse.json({ success: true, user: { id: data.id, phone: data.phone, email: data.email || '' } });
  } catch (err) {
    console.error('[Signup] 注册异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

async function handleEmailSignup(body: Record<string, unknown>, email: string): Promise<NextResponse> {
  const code = String(body?.verifyCode || '').trim();
  const displayName = String(body?.displayName || '').trim();
  const password = String(body?.password || '');
  const referralCode = body?.referralCode ? String(body.referralCode) : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '请输入正确的邮箱地址' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: '请输入 6 位数字验证码' }, { status: 400 });
  }
  if (displayName && (displayName.length < 2 || displayName.length > 20)) {
    return NextResponse.json({ error: '显示名称需为 2 到 20 个字符' }, { status: 400 });
  }
  if (password.length < 6 || password.length > 32 || !password.trim()) {
    return NextResponse.json({ error: '密码长度需为 6 到 32 位' }, { status: 400 });
  }
  if (!supabaseServiceKey || !otpAnonKey) {
    console.error('[Signup] 缺少 Supabase 配置');
    return NextResponse.json({ error: '服务配置错误，请联系管理员' }, { status: 500 });
  }

  // 1) 校验 Supabase Auth 下发的邮件 OTP
  const auth = createClient(otpUrl, otpAnonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: otpError } = await auth.auth.verifyOtp({ email, token: code, type: 'signup' });
  if (otpError) {
    return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2) 邮箱唯一性
  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) console.error('[Signup] 邮箱查重失败:', lookupError.message);
  if (existingUser) {
    return NextResponse.json({ error: '该邮箱已注册' }, { status: 400 });
  }

  // 3) 组装写入（不包含 phone / display_name 的语义，下面按库结构自适应）
  const insertData: Record<string, unknown> = {
    email,
    password: hashPassword(password),
    created_at: new Date().toISOString(),
  };
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ownCode = '';
  for (let i = 0; i < 8; i++) ownCode += chars.charAt(Math.floor(Math.random() * chars.length));
  insertData.referral_code = ownCode;
  if (referralCode) {
    const { data: inviter } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCode)
      .maybeSingle();
    if (inviter) insertData.invited_by = inviter.id;
  }

  const cleanPayload = {
    ...insertData,
    phone: null,
    ...(displayName ? { display_name: displayName } : {}),
  };
  const legacyPayload = {
    ...insertData,
    phone: 'em_' + createHash('sha256').update(email).digest('hex').slice(0, 12),
    ...(displayName ? { company_name: displayName } : {}),
  };

  let data: Record<string, unknown> | null = null;
  let insertError: { message?: string } | null = null;

  if (ddlApplied) {
    const r = await supabase.from('users').insert(cleanPayload).select().single();
    data = r.data;
    insertError = r.error;
  } else {
    const first = await supabase.from('users').insert(cleanPayload).select().single();
    if (!first.error) {
      data = first.data;
    } else {
      const msg = (first.error.message || '').toLowerCase();
      const schemaMismatch = msg.includes('display_name') || msg.includes('not-null') ||
        msg.includes('null value') || msg.includes('phone');
      if (schemaMismatch) {
        const retry = await supabase.from('users').insert(legacyPayload).select().single();
        data = retry.data;
        insertError = retry.error;
      } else {
        insertError = first.error;
      }
    }
  }

  if (insertError || !data) {
    console.error('[Signup] 创建用户失败:', insertError);
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
  }

  await grantCredits(supabase, data.id as string, insertData.invited_by as string | undefined);

  return NextResponse.json({
    success: true,
    user: { id: data.id as string, email: String(data.email || ''), phone: String(data.phone || '') },
  });
}

async function grantCredits(
  supabase: any,
  userId: string,
  invitedBy?: string
) {
  try {
    await changeCredits(supabase, userId, SIGNUP_BONUS_CREDITS, 'recharge', '注册赠送积分');
    if (invitedBy) {
      await changeCredits(supabase, userId, REFERRAL_BONUS_CREDITS, 'recharge', '受邀注册奖励积分');
      await changeCredits(supabase, invitedBy, REFERRAL_BONUS_CREDITS, 'recharge', '邀请好友注册奖励积分');
    }
  } catch (creditErr) {
    console.error('[Signup] 积分发放失败:', creditErr);
  }
}
