import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo'
);

// 动态计算模具类型：以数据库 num_dies 为准
function computeMoldType(product_name: string | null, num_dies: number | null): string {
  if (num_dies == null || num_dies === 0) return '平模';
  return '分流模';
}

/**
 * GET /api/standard-parts
 * - 无参数: 返回所有标准件类别及数量
 * - ?category=铝圆管: 返回该类别所有规格
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // 获取所有标准件（product_name不为空的记录）
    let query = supabase
      .from('supplier_products')
      .select('id, product_name, cross_section_mm, weight_per_meter, perimeter, num_dies, remarks')
      .not('product_name', 'is', null)
      .order('weight_per_meter', { ascending: true });

    const STANDARD_CATEGORIES = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '异型材', '短型材', '电源外壳'];

    if (category) {
      if (category === '其他型材') {
        // 其他型材：返回所有非标准大类且只有1个规格的产品
        // 先获取所有数据，在内存中过滤
      } else {
        query = query.eq('product_name', category);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Standard Parts GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let products = (data || []).map((p: any) => ({
      ...p,
      mold_type: computeMoldType(p.product_name, p.num_dies),
    }));

    // 如果指定了"其他型材"类别，过滤出非标准大类且count=1的产品
    if (category === '其他型材') {
      const nameCount: Record<string, number> = {};
      for (const p of products) {
        nameCount[p.product_name] = (nameCount[p.product_name] || 0) + 1;
      }
      products = products.filter((p: any) =>
        !STANDARD_CATEGORIES.includes(p.product_name) && nameCount[p.product_name] === 1
      );
    }

    // 如果指定了category，直接返回该类别规格列表
    if (category) {
      return NextResponse.json({
        success: true,
        category,
        specs: products,
        total: products.length,
      });
    }

    // 否则返回类别汇总
    // 标准大类（保留独立显示）
    // 非标准大类（count<=1且不在标准列表中的）归入"其他型材"
    const tempMap: Record<string, { label: string; count: number; mold_type: string }> = {};
    const otherProducts: any[] = [];
    for (const p of products) {
      const name = p.product_name;
      if (!name) continue;
      if (!tempMap[name]) {
        tempMap[name] = { label: name, count: 0, mold_type: p.mold_type };
      }
      tempMap[name].count++;
    }

    const categoryMap: Record<string, { label: string; count: number; mold_type: string }> = {};
    let otherCount = 0;
    for (const [name, val] of Object.entries(tempMap)) {
      if (STANDARD_CATEGORIES.includes(name) || val.count > 1) {
        categoryMap[name] = val;
      } else {
        otherCount += val.count;
      }
    }
    if (otherCount > 0) {
      categoryMap['其他型材'] = { label: '其他型材', count: otherCount, mold_type: '平模' };
    }

    return NextResponse.json({
      success: true,
      categories: Object.entries(categoryMap).map(([key, val]) => ({
        key,
        ...val,
      })),
    });
  } catch (err: any) {
    console.error('[Standard Parts GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
