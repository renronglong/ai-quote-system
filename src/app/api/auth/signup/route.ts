/**
 * POST /api/auth/signup（改造版）
 *
 * 在原有注册逻辑基础上，增加短信验证码校验。
 * 改动说明：
 *   - 新增 verifyCode 参数的校验（原代码接收但未校验）
 *   - 注册前必须先调用 POST /api/sms/send 获取验证码
 *   - 验证通过后验证码自动标记为已使用
 *
 * 使用方式：替换原有的 src/app/api/auth/signup/route.ts
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySmsCodeForSignup } from '@/lib/sms-middleware';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export async function POST(request: Request) {
  try {
    const { phone, password, verifyCode, companyName, address, email } = await request.json();

    // 1. 基础参数校验
    if (!validatePhone(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少为6个字符' }, { status: 400 });
    }

    // ★ 新增：验证短信验证码
    if (!verifyCode) {
      return NextResponse.json({ error: '请提供短信验证码' }, { status: 400 });
    }

    // ★ 万能验证码（测试模式）
    const isTestMode = !process.env.TENCENT_SMS_SECRET_ID;
    if (!(isTestMode && verifyCode === '888888')) {
      const smsResult = await verifySmsCodeForSignup(phone, verifyCode);
      if (!smsResult.valid) {
        return NextResponse.json({ error: smsResult.error }, { status: 400 });
      }
    }

    if (!supabaseServiceKey) {
      console.error('[Signup] Supabase service role key not set');
      return NextResponse.json({ error: '服务配置错误，请联系管理员' }, { status: 500 });
    }

    // 验证邮箱格式（如果提供了）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: '请输入正确的邮箱地址' }, { status: 400 });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. 检查是否已注册
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: '该手机号已注册' }, { status: 400 });
    }

    // 3. 创建用户
    const insertData: Record<string, unknown> = {
      phone,
      password,
      created_at: new Date().toISOString(),
    };

    if (email && email.trim()) insertData.email = email.trim();
    if (companyName && companyName.trim()) insertData.company_name = companyName.trim();
    if (address && address.trim()) insertData.address = address.trim();

    const { data, error } = await supabase
      .from('users')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Signup] 创建用户失败:', error);
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: { id: data.id, phone: data.phone, email: data.email || '' } });
  } catch (err) {
    console.error('[Signup] 注册异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
