import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://br-lush-teal-829ebb2c.supabase2.aidap-global.cn-beijing.volces.com';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export async function POST(request: Request) {
  try {
    const { phone, password, verifyCode } = await request.json();

    if (!validatePhone(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少为6个字符' }, { status: 400 });
    }

    if (!supabaseServiceKey) {
      console.error('[Signup] Supabase service role key not set');
      return NextResponse.json({ error: '服务配置错误，请联系管理员' }, { status: 500 });
    }

    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 检查是否已注册
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: '该手机号已注册' }, { status: 400 });
    }

    // 创建用户
    const { data, error } = await supabase
      .from('users')
      .insert({
        phone,
        password,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Signup] 创建用户失败:', error);
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: { id: data.id, phone: data.phone } });
  } catch (err) {
    console.error('[Signup] 注册异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
