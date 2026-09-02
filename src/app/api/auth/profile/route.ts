import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

    // 供方档案（联系人/业务电话等）存于 supplier_profiles
    // 先按 user_id 查；查不到再用注册手机号兜底（同一人多个账号时共享档案）
    let profile: any = null;
    const { data: spData } = await supabase
      .from('supplier_profiles')
      .select('company_name, contact_name, phone, address, business_license')
      .eq('user_id', userId)
      .maybeSingle();
    if (spData) {
      profile = spData;
    } else if (userData.phone) {
      const { data: spByPhone } = await supabase
        .from('supplier_profiles')
        .select('company_name, contact_name, phone, address, business_license')
        .eq('phone', userData.phone)
        .maybeSingle();
      if (spByPhone) profile = spByPhone;
    }

    // 合并：supplier_profiles 的公司资料优先，users 表兜底
    const merged = {
      company_name: profile?.company_name || userData.company_name || '',
      contact_name: profile?.contact_name || '',
      contact_phone: profile?.phone || '',
      contact_email: userData.email || '',
      address: profile?.address || userData.address || '',
    };

    return NextResponse.json({
      success: true,
      data: {
        user: userData,
        profile: merged,
        hasCompanyInfo: !!(merged.company_name),
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

    // 1. 更新 users 表（公司名、地址）
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

    // 2. upsert supplier_profiles（联系人、业务电话、公司名、地址）
    // 先按 user_id 查；查不到再按业务电话查（同一人多个账号共用同一套供方资料，
    // supplier_profiles.phone 有唯一约束，插入撞号会 409）
    const { data: existing } = await supabase
      .from('supplier_profiles')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

    let existingId = existing?.id as string | undefined;
    if (!existingId && contact_phone) {
      const { data: byPhone } = await supabase
        .from('supplier_profiles')
        .select('id')
        .eq('phone', contact_phone)
        .maybeSingle();
      if (byPhone) existingId = byPhone.id;
    }

    const spRow: Record<string, any> = {
      company_name: company_name || null,
      contact_name: contact_name || null,
      phone: contact_phone || null,
      address: address || null,
      updated_at: new Date().toISOString(),
    };

    if (existingId) {
      const { error: spErr } = await supabase
        .from('supplier_profiles')
        .update(spRow)
        .eq('id', existingId);
      if (spErr) throw new Error(`更新供方档案失败: ${spErr.message}`);
    } else {
      spRow.user_id = user_id;
      spRow.created_at = new Date().toISOString();
      const { error: spErr } = await supabase
        .from('supplier_profiles')
        .insert(spRow);
      if (spErr) throw new Error(`创建供方档案失败: ${spErr.message}`);
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
