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
      supplier_id, mold_number, product_name, cross_section_mm,
      weight_per_meter, perimeter, surface_treatments,
      cross_section_image_url, remarks,
    } = body;

    if (!supplier_id) {
      return NextResponse.json({ error: '缺少supplier_id' }, { status: 400 });
    }

    const supabase = getSupabase();
    const payload = {
      supplier_id,
      mold_number: mold_number || null,
      product_name: product_name || null,
      cross_section_mm: cross_section_mm || null,
      weight_per_meter: weight_per_meter != null ? Number(weight_per_meter) : null,
      perimeter: perimeter != null ? Number(perimeter) : null,
      surface_treatments: surface_treatments || [],
      cross_section_image_url: cross_section_image_url || null,
      remarks: remarks || null,
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

    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    const allowedFields = [
      'mold_number', 'product_name', 'cross_section_mm',
      'weight_per_meter', 'perimeter', 'surface_treatments',
      'cross_section_image_url', 'remarks',
    ];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if ((field === 'weight_per_meter' || field === 'perimeter') && updates[field] != null) {
          payload[field] = Number(updates[field]);
        } else {
          payload[field] = updates[field];
        }
      }
    }

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
