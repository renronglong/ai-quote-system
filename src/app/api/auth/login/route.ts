import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminPhone, signAdminToken, signUserToken } from '@/lib/admin';
import { verifyPassword, isLegacyPlaintext, hashPassword } from '@/lib/password';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    const { phone, email, account, password } = await request.json();
    // 账号标识：邮箱优先，兼容手机号（业主 2026-11-06：登录改邮箱账号体系，老手机号账号继续可登）
    const identifier = String(email || account || phone || '').trim();
    if (!identifier) {
      return NextResponse.json({ error: '请输入邮箱或手机号' }, { status: 400 });
    }
    const isEmail = identifier.includes('@');

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
      .eq(isEmail ? 'email' : 'phone', isEmail ? identifier.toLowerCase() : identifier)
      .single();

    if (queryError || !userData) {
      return NextResponse.json({ error: '用户不存在' }, { status: 400 });
    }

    if (!verifyPassword(password, userData.password)) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    // 历史明文密码：登录成功顺手升级为 scrypt 哈希
    if (isLegacyPlaintext(userData.password)) {
      await supabase.from('users').update({ password: hashPassword(password) }).eq('id', userData.id);
    }

    const admin = isAdminPhone(userData.phone);
    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        phone: userData.phone,
        email: userData.email || '',
        company_name: userData.company_name,
        referral_code: userData.referral_code,
        address: userData.address,
        is_admin: admin,
      },
      admin_token: admin ? signAdminToken(userData.phone) : undefined,
      // 员工 token：所有登录成功的账号都签发（业主 2026-10-22：客户批量导入开放给员工账号）
      user_token: signUserToken(userData.phone),
    });
  } catch (err) {
    console.error('[Login] 登录异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
