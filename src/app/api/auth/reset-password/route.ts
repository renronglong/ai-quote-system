/**
 * POST /api/auth/reset-password
 *
 * 重置密码（服务端校验短信验证码 + service role 更新密码）
 *
 * 请求体：{ phone: string, code: string, newPassword: string }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCode } from '@/lib/sms-store';
import { hashPassword } from '@/lib/password';

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, code, newPassword } = body;

    if (!phone || !validatePhone(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: '验证码格式不正确' }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ error: '新密码至少 6 位' }, { status: 400 });
    }

    // 1. 校验短信验证码（purpose=resetPassword，成功即失效，不可重放）
    const result = await verifyCode(phone, code, 'resetPassword');
    if (!result.success) {
      return NextResponse.json({ error: result.error || '验证码错误或已过期' }, { status: 400 });
    }

    // 2. service role 更新密码
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
    const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!serviceKey) {
      console.error('[ResetPassword] service role key not set');
      return NextResponse.json({ error: '服务暂不可用' }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from('users')
      .update({ password: hashPassword(newPassword) })
      .eq('phone', phone)
      .select('id');

    if (error) {
      console.error('[ResetPassword] 更新密码失败:', error);
      return NextResponse.json({ error: '密码重置失败，请稍后重试' }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '该手机号未注册' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '密码重置成功' });
  } catch (err) {
    console.error('[ResetPassword] 异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
