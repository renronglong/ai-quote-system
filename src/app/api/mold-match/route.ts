import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo'
);

const STANDARD_CATEGORIES = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管'];

/**
 * Parse cross_section_mm string into structured numbers.
 * Formats:
 *   Φ4 / Φ4.5          → { diameter: 4 }
 *   H8 / H9.5          → { hex: 8 }
 *   19.0×17.0          → { outer: 19, inner: 17 }  (圆管)
 *   15.0×15.0×2.0      → { width: 15, height: 15, thickness: 2 } (角铝)
 *   3.5×6.0            → { width: 3.5, height: 6 } (方/扁棒)
 *   6.0*3.5            → { hex: 6, inner: 3.5 } (六角管)
 */
function parseCrossSection(cs: string): Record<string, number> {
  if (!cs) return {};
  const s = cs.trim();
  // Φ diameter
  const phi = s.match(/[ΦφØ∅]\s*([\d.]+)/);
  if (phi) return { diameter: parseFloat(phi[1]) };
  // H hex
  const h = s.match(/^H\s*([\d.]+)/i);
  if (h) return { hex: parseFloat(h[1]) };
  // Split by × or *
  const parts = s.split(/[×xX*]/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0);
  if (parts.length === 1) return { value: parts[0] };
  if (parts.length === 2) {
    // Could be 圆管(outer×inner) or 方扁棒(w×h) or 六角管(hex×inner)
    return { d1: parts[0], d2: parts[1] };
  }
  if (parts.length >= 3) return { d1: parts[0], d2: parts[1], d3: parts[2] };
  return {};
}

/**
 * 单维度容差判定：返回差异率(0-1)，超容差返回 null
 */
function dimDiff(inputVal: number, specVal: number, tol = 0.15): number | null {
  if (!inputVal || !specVal) return null; // 任一缺失则该维度不参与判定
  const diff = Math.abs(inputVal - specVal) / specVal;
  return diff <= tol ? diff : null;
}

/**
 * 渐进式匹配：只按用户填写的参数判定，参数越少结果越多，参数越多越准。
 * 每个已填参数独立做容差判定（默认±15%），任一超差即淘汰；
 * 宽/高维度支持互换（宽*高 = 高*宽，型材可旋转90°使用）。
 * 得分 = 100 - 各维度差异率加权平均×100。
 */
function calcMatchScore(
  category: string,
  input: Record<string, number>,
  spec: any
): number {
  const parsed = parseCrossSection(spec.cross_section_mm || '');

  // 圆棒：直径单参数
  if (category === '铝圆棒') {
    const d = dimDiff(input.diameter, parsed.diameter);
    return d === null ? 0 : Math.round((1 - d) * 100);
  }

  // 六角棒：对边距单参数
  if (category === '铝六角棒') {
    const d = dimDiff(input.hex, parsed.hex);
    return d === null ? 0 : Math.round((1 - d) * 100);
  }

  // 方/扁棒：宽高，支持互换，只填一个也能匹配
  if (category === '铝方/扁棒') {
    const diffs: number[] = [];
    const w = input.width, h = input.height;
    const s1 = parsed.d1, s2 = parsed.d2;
    if (!s1 && !s2) return 0;
    if (w && h && s1 && s2) {
      // 宽高都填：正向/互换取优
      const normal = (Math.abs(w - s1) / s1 + Math.abs(h - s2) / s2) / 2;
      const swapped = (Math.abs(w - s2) / s2 + Math.abs(h - s1) / s1) / 2;
      const best = Math.min(normal, swapped);
      if (best > 0.15) return 0;
      diffs.push(best);
    } else {
      // 只填一个：匹配规格任一维度即可
      const v = w || h;
      const candidates = [s1, s2].filter(Boolean).map((sv: number) => Math.abs(v - sv) / sv);
      const best = Math.min(...candidates);
      if (best > 0.15) return 0;
      diffs.push(best);
    }
    return Math.round((1 - diffs[0]) * 100);
  }

  // 角铝：边宽/边高支持互换，壁厚独立判定
  if (category === '角铝') {
    const diffs: number[] = [];
    const w = input.width, h = input.height;
    const s1 = parsed.d1, s2 = parsed.d2;
    if (w && h && s1 && s2) {
      const normal = (Math.abs(w - s1) / s1 + Math.abs(h - s2) / s2) / 2;
      const swapped = (Math.abs(w - s2) / s2 + Math.abs(h - s1) / s1) / 2;
      const best = Math.min(normal, swapped);
      if (best > 0.15) return 0;
      diffs.push(best);
    } else if ((w || h) && (s1 || s2)) {
      const v = w || h;
      const candidates = [s1, s2].filter(Boolean).map((sv: number) => Math.abs(v - sv) / sv);
      const best = Math.min(...candidates);
      if (best > 0.15) return 0;
      diffs.push(best);
    }
    // 壁厚（双方都有时才判定，权重30%）
    const td = dimDiff(input.thickness, parsed.d3);
    if (td !== null) {
      const base = diffs.length ? diffs[0] * 0.7 : 0;
      const total = diffs.length ? base + td * 0.3 : td;
      return Math.round((1 - total) * 100);
    }
    if (!diffs.length) return 0;
    return Math.round((1 - diffs[0]) * 100);
  }

  // 圆管：外径/内径，只填外径也能匹配（参数越少结果越多）
  if (category === '铝圆管') {
    const dOuter = dimDiff(input.outer, parsed.d1);
    const dInner = dimDiff(input.inner, parsed.d2);
    if (dOuter === null && dInner === null) return 0;
    const parts: number[] = [];
    if (dOuter !== null) parts.push(dOuter);
    if (dInner !== null) parts.push(dInner);
    const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
    return Math.round((1 - avg) * 100);
  }

  // 六角管：对边距/内径，任一填写即可匹配
  if (category === '铝六角管') {
    const dHex = dimDiff(input.hex, parsed.d1);
    const dInner = dimDiff(input.inner, parsed.d2);
    if (dHex === null && dInner === null) return 0;
    const parts: number[] = [];
    if (dHex !== null) parts.push(dHex);
    if (dInner !== null) parts.push(dInner);
    const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
    return Math.round((1 - avg) * 100);
  }

  // 异型材：宽/高（支持互换）、外周长、米重 四维渐进匹配
  if (category === '异型材') {
    const specW = parsed.d1 || 0;
    const specH = parsed.d2 || 0;
    const specPerim = spec.perimeter || 0;
    const specMW = spec.weight_per_meter || 0;

    const parts: { diff: number; weight: number }[] = [];

    // 宽高：支持互换（宽*高=高*宽）
    const hasW = input.width > 0, hasH = input.height > 0;
    if ((hasW || hasH) && (specW > 0 || specH > 0)) {
      let whDiff: number | null = null;
      if (hasW && hasH && specW > 0 && specH > 0) {
        const normal = (Math.abs(input.width - specW) / specW + Math.abs(input.height - specH) / specH) / 2;
        const swapped = (Math.abs(input.width - specH) / specH + Math.abs(input.height - specW) / specW) / 2;
        const best = Math.min(normal, swapped);
        whDiff = best <= 0.15 ? best : null;
      } else {
        // 只填宽或只填高：匹配规格宽/高任一
        const v = hasW ? input.width : input.height;
        const candidates = [specW, specH].filter(x => x > 0).map(sv => Math.abs(v - sv) / sv);
        if (candidates.length) {
          const best = Math.min(...candidates);
          whDiff = best <= 0.15 ? best : null;
        }
      }
      if (whDiff === null) return 0;
      // 宽高合计权重0.7（两个都填时各0.35，单填时0.7）
      parts.push({ diff: whDiff, weight: hasW && hasH ? 0.7 : 0.7 });
    }

    // 外周长
    const pDiff = dimDiff(input.perimeter, specPerim);
    if (pDiff !== null) parts.push({ diff: pDiff, weight: 0.2 });
    else if (input.perimeter > 0 && specPerim > 0) return 0; // 填了但超差→淘汰

    // 米重（容差20%）
    if (input.meter_weight > 0 && specMW > 0) {
      const md = Math.abs(input.meter_weight - specMW) / specMW;
      if (md > 0.20) return 0;
      parts.push({ diff: md, weight: 0.1 });
    }

    if (!parts.length) return 0;
    const totalW = parts.reduce((a, p) => a + p.weight, 0);
    const avgDiff = parts.reduce((a, p) => a + p.diff * p.weight, 0) / totalW;
    return Math.round((1 - avgDiff) * 100);
  }

  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const diameter = parseFloat(searchParams.get('diameter') || '0');
    const outer = parseFloat(searchParams.get('outer') || '0');
    const inner = parseFloat(searchParams.get('inner') || '0');
    const width = parseFloat(searchParams.get('width') || '0');
    const height = parseFloat(searchParams.get('height') || '0');
    const thickness = parseFloat(searchParams.get('thickness') || '0');
    const hex = parseFloat(searchParams.get('hex') || '0');
    const perimeter = parseFloat(searchParams.get('perimeter') || '0');
    const meterWeight = parseFloat(searchParams.get('meter_weight') || '0');
    const dieType = searchParams.get('die_type'); // 'flat' | 'split' | null

    if (!category) {
      return NextResponse.json({ error: 'category required' }, { status: 400 });
    }

    // Fetch all products in category
    let query = supabase
      .from('supplier_products')
      .select('id, product_name, mold_number, cross_section_mm, weight_per_meter, perimeter, num_dies, remarks')
      .not('product_name', 'is', null)
      .limit(10000);

    if (category !== '异型材') {
      query = query.eq('product_name', category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Mold Match GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let products = data || [];
    if (category === '异型材') {
      products = products.filter((p: any) => !STANDARD_CATEGORIES.includes(p.product_name));
      // Filter by die type: flat=num_dies=0, split=num_dies>0
      if (dieType === 'flat') {
        products = products.filter((p: any) => !p.num_dies || p.num_dies === 0);
      } else if (dieType === 'split') {
        products = products.filter((p: any) => p.num_dies && p.num_dies > 0);
      }
    }

    const input: Record<string, number> = {};
    if (diameter > 0) input.diameter = diameter;
    if (outer > 0) input.outer = outer;
    if (inner > 0) input.inner = inner;
    if (width > 0) input.width = width;
    if (height > 0) input.height = height;
    if (thickness > 0) input.thickness = thickness;
    if (hex > 0) input.hex = hex;
    if (perimeter > 0) input.perimeter = perimeter;
    if (meterWeight > 0) input.meter_weight = meterWeight;

    const matches = products
      .map((spec: any) => {
        const score = calcMatchScore(category, input, spec);
        if (score === 0) return null;
        const numDies = spec.num_dies || 0;
        return {
          id: spec.id,
          cross_section_mm: spec.cross_section_mm,
          weight_per_meter: spec.weight_per_meter,
          perimeter: spec.perimeter,
          num_dies: numDies,
          mold_type: numDies > 0 ? '分流模' : '平模',
          mold_number: spec.mold_number,
          match_score: score,
          product_name: spec.product_name,
          remarks: spec.remarks,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.match_score - a.match_score)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      category,
      matches,
      total: matches.length,
    });
  } catch (err: any) {
    console.error('[Mold Match GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// Also support POST (same logic, params from body)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = new URLSearchParams();
    if (body.category) params.set('category', body.category);
    if (body.diameter) params.set('diameter', String(body.diameter));
    if (body.outer) params.set('outer', String(body.outer));
    if (body.inner) params.set('inner', String(body.inner));
    if (body.width) params.set('width', String(body.width));
    if (body.height) params.set('height', String(body.height));
    if (body.thickness) params.set('thickness', String(body.thickness));
    if (body.hex) params.set('hex', String(body.hex));
    if (body.perimeter) params.set('perimeter', String(body.perimeter));
    if (body.meter_weight) params.set('meter_weight', String(body.meter_weight));
    if (body.die_type) params.set('die_type', body.die_type);
    const url = new URL(`https://placeholder/match?${params.toString()}`);
    return GET(new NextRequest(url));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
