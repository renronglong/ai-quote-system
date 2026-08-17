import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
  if (!supabaseServiceKey) throw new Error('Supabase service role key not configured');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET: 获取当前用户的供应商资料
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('supplier_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // 未找到记录
      return NextResponse.json({ data: null });
    }

    if (error) {
      console.error('[Supplier Profile GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[Supplier Profile GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: 创建/更新供应商资料
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, company_name, contact_name, phone, address, business_license } = body;

    if (!user_id || !company_name || !contact_name || !phone) {
      return NextResponse.json(
        { error: '缺少必填字段（user_id, company_name, contact_name, phone）' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('supplier_profiles')
      .select('id')
      .eq('user_id', user_id)
      .single();

    const payload = {
      user_id,
      company_name,
      contact_name,
      phone,
      address: address || null,
      business_license: business_license || null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // 更新
      const { data, error } = await supabase
        .from('supplier_profiles')
        .update(payload)
        .eq('user_id', user_id)
        .select()
        .single();

      if (error) {
        console.error('[Supplier Profile UPDATE]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // 创建
      const { data, error } = await supabase
        .from('supplier_profiles')
        .insert([{ ...payload, created_at: new Date().toISOString() }])
        .select()
        .single();

      if (error) {
        console.error('[Supplier Profile INSERT]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[Supplier Profile POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
