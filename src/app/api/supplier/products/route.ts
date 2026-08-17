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

// GET: 获取供应商产品列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplier_id');

    if (!supplierId) {
      return NextResponse.json({ error: '缺少supplier_id参数' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supplier Products GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[Supplier Products GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: 新增产品
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      supplier_id, alloy_grade, profile_type, min_width_mm, max_width_mm,
      min_height_mm, max_height_mm, max_circle_mm, min_wall_mm,
      min_order_kg, unit_price, price_unit, lead_days,
      surface_treatments, remarks,
    } = body;

    if (!supplier_id || !alloy_grade || !profile_type || unit_price === undefined) {
      return NextResponse.json(
        { error: '缺少必填字段（supplier_id, alloy_grade, profile_type, unit_price）' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const payload = {
      supplier_id,
      alloy_grade,
      profile_type,
      min_width_mm: min_width_mm || null,
      max_width_mm: max_width_mm || null,
      min_height_mm: min_height_mm || null,
      max_height_mm: max_height_mm || null,
      max_circle_mm: max_circle_mm || null,
      min_wall_mm: min_wall_mm || null,
      min_order_kg: min_order_kg || 300,
      unit_price: Number(unit_price),
      price_unit: price_unit || '元/吨',
      lead_days: lead_days || 15,
      surface_treatments: surface_treatments || [],
      remarks: remarks || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('supplier_products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[Supplier Products POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[Supplier Products POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: 更新产品
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少产品ID' }, { status: 400 });
    }

    // Clean up fields
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    const allowedFields = [
      'alloy_grade', 'profile_type', 'min_width_mm', 'max_width_mm',
      'min_height_mm', 'max_height_mm', 'max_circle_mm', 'min_wall_mm',
      'min_order_kg', 'unit_price', 'price_unit', 'lead_days',
      'surface_treatments', 'remarks', 'is_active',
    ];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        payload[field] = updates[field];
      }
    }
    if (payload.unit_price !== undefined) payload.unit_price = Number(payload.unit_price);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('supplier_products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Supplier Products PUT]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[Supplier Products PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: 删除产品
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少产品ID' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('supplier_products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Supplier Products DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Supplier Products DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
