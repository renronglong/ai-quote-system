import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://br-lush-teal-829ebb2c.supabase2.aidap-global.cn-beijing.volces.com';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, phone, company_name, address, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: userData,
        profile: null,
        hasCompanyInfo: !!userData.company_name,
      },
    });
  } catch (err) {
    console.error('[Profile] 获取用户信息失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, company_name, contact_name, contact_phone, contact_email, address } = body;

    if (!user_id) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 更新 users 表
    const { error: userError } = await supabase
      .from('users')
      .update({
        company_name: company_name || null,
        address: address || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (userError) {
      throw new Error(`更新用户信息失败: ${userError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '公司信息保存成功',
    });
  } catch (err) {
    console.error('[Profile] 保存公司信息失败:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '保存失败' },
      { status: 500 }
    );
  }
}
