import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();

    if (!supabaseServiceKey) {
      console.error('[Login] Supabase service role key not set');
      return NextResponse.json({ error: '服务配置错误，请联系管理员' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (queryError || !userData) {
      return NextResponse.json({ error: '用户不存在' }, { status: 400 });
    }

    if (userData.password !== password) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        phone: userData.phone,
        email: userData.email || '',
        company_name: userData.company_name,
        address: userData.address,
      },
    });
  } catch (err) {
    console.error('[Login] 登录异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
