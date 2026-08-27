import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';


// 根据产品属性动态计算模具类型
// 优先使用用户选择的 mold_type，否则根据 num_dies 计算：0=平模，≥1=分流模
function computeMoldType(product: any): string {
  if (product.mold_type && ['平模', '分流模'].includes(product.mold_type)) {
    return product.mold_type;
  }
  const { num_dies } = product;
  if (num_dies == null || num_dies === 0) return '平模';
  return '分流模';
}

function getSupabase() {
  if (!supabaseServiceKey) throw new Error('Supabase service role key not configured');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 解析截面尺寸字符串，返回 {width, height}
function parseCrossSection(crossSection: string | null): { width?: number; height?: number } {
  if (!crossSection) return {};
  const match = crossSection.match(/([\d.]+)\s*[×xX*]\s*([\d.]+)/);
  if (!match) return {};
  return {
    width: parseFloat(match[1]),
    height: parseFloat(match[2]),
  };
}

// 同步供应商产品到标准件库（products表）
async function syncToStandardProducts(supabase: any, spProduct: any, action: 'create' | 'update' | 'delete', supplierName?: string) {
  try {
    const spId = spProduct.id || spProduct.supplier_product_id;
    
    if (action === 'delete') {
      // 删除对应的标准件记录
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('specs->>supplier_product_id', spId)
        .maybeSingle();
      
      if (existing) {
        await supabase.from('products').delete().eq('id', existing.id);
      }
      return;
    }

    // 解析截面尺寸
    const dims = parseCrossSection(spProduct.cross_section_mm);
    
    // 构建specs
    const specs: Record<string, any> = {
      weight_per_meter: spProduct.weight_per_meter,
      perimeter: spProduct.perimeter,
      cross_section_mm: spProduct.cross_section_mm,
      num_dies: spProduct.num_dies,
      mold_type: computeMoldType(spProduct),
      supplier: supplierName || '',
      supplier_product_id: spId,
    };
    if (dims.width) specs.width = dims.width;
    if (dims.height) specs.height = dims.height;
    if (spProduct.cross_section_image_url) specs.svg_path = spProduct.cross_section_image_url;

    // 查找是否已有对应的标准件记录
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('specs->>supplier_product_id', spId)
      .maybeSingle();

    const productData = {
      product_code: spProduct.mold_number || spId,
      name: (supplierName ? supplierName + ' ' : '') + (spProduct.mold_number || spId),
      material: '6063-T5',
      process: '挤压铝型材',
      surface_treatment: (spProduct.surface_treatments && spProduct.surface_treatments.length > 0)
        ? spProduct.surface_treatments[0] : '素材',
      oxidation_color: null,
      cost_price: 0,
      min_price: 0,
      specs: specs,
      description: spProduct.remarks || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // 更新已有记录
      await supabase.from('products').update(productData).eq('id', existing.id);
    } else {
      // 创建新记录
      await supabase.from('products').insert([{
        ...productData,
        created_at: new Date().toISOString(),
      }]);
    }
  } catch (err) {
    console.error('[syncToStandardProducts] 同步标准件失败:', err);
    // 不抛出异常，避免影响主流程
  }
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
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('[Supplier Products GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const productsWithMoldType = (data || []).map((p: any) => ({
      ...p,
      mold_type: computeMoldType(p),
    }));
    return NextResponse.json({ data: productsWithMoldType });
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
      weight_per_meter, perimeter, surface_treatments, num_dies,
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
      num_dies: num_dies != null ? Number(num_dies) : 1,
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

    // 查询供应商名称用于同步
    let supplierName = '';
    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', supplier_id)
      .maybeSingle();
    if (supplierData) {
      supplierName = supplierData.name || '';
    }

    // 自动同步到标准件库
    await syncToStandardProducts(supabase, data, 'create', supplierName);

    return NextResponse.json({ data: { ...data, mold_type: computeMoldType(data) } });
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
      'cross_section_image_url', 'remarks', 'mold_type',
    ];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if ((field === 'weight_per_meter' || field === 'perimeter') && updates[field] != null) {
          payload[field] = Number(updates[field]);
        } else if (field === 'mold_type') {
          // mold_type → num_dies: 平模=0, 分流模=1
          payload['num_dies'] = updates[field] === '平模' ? 0 : 1;
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

    // 查询供应商名称用于同步
    let supplierName = '';
    if (data?.supplier_id) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', data.supplier_id)
        .maybeSingle();
      if (supplierData) {
        supplierName = supplierData.name || '';
      }
    }

    // 自动同步到标准件库
    await syncToStandardProducts(supabase, data, 'update', supplierName);

    return NextResponse.json({ data: { ...data, mold_type: computeMoldType(data) } });
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
    
    // 先获取产品信息用于同步删除
    const { data: productToDelete } = await supabase
      .from('supplier_products')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('supplier_products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Supplier Products DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 自动从标准件库删除对应记录
    if (productToDelete) {
      await syncToStandardProducts(supabase, productToDelete, 'delete');
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Supplier Products DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
