import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo'
);

const STANDARD_CATEGORIES = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管'];

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
 * Calculate match score between input dimensions and a DB spec.
 * Returns 0-100 where 100 is exact match. Returns 0 if no match possible.
 */
function calcMatchScore(
  category: string,
  input: Record<string, number>,
  spec: any
): number {
  const parsed = parseCrossSection(spec.cross_section_mm || '');

  if (category === '铝圆棒') {
    if (!input.diameter || !parsed.diameter) return 0;
    const diff = Math.abs(input.diameter - parsed.diameter) / parsed.diameter;
    if (diff > 0.15) return 0;
    return Math.round((1 - diff) * 100);
  }

  if (category === '铝六角棒') {
    if (!input.hex || !parsed.hex) return 0;
    const diff = Math.abs(input.hex - parsed.hex) / parsed.hex;
    if (diff > 0.15) return 0;
    return Math.round((1 - diff) * 100);
  }

  if (category === '铝方/扁棒') {
    if (!input.width || !input.height || !parsed.d1 || !parsed.d2) return 0;
    // Allow swap (w×h vs h×w)
    const d1 = Math.abs(input.width - parsed.d1) / parsed.d1;
    const d2 = Math.abs(input.height - parsed.d2) / parsed.d2;
    const d1s = Math.abs(input.width - parsed.d2) / parsed.d2;
    const d2s = Math.abs(input.height - parsed.d1) / parsed.d1;
    const normal = (d1 + d2) / 2;
    const swapped = (d1s + d2s) / 2;
    const best = Math.min(normal, swapped);
    if (best > 0.15) return 0;
    return Math.round((1 - best) * 100);
  }

  if (category === '角铝') {
    if (!input.width || !input.height || !parsed.d1 || !parsed.d2) return 0;
    const thickness = input.thickness || parsed.d3;
    const d1 = Math.abs(input.width - parsed.d1) / parsed.d1;
    const d2 = Math.abs(input.height - parsed.d2) / parsed.d2;
    const d1s = Math.abs(input.width - parsed.d2) / parsed.d2;
    const d2s = Math.abs(input.height - parsed.d1) / parsed.d1;
    const normal = (d1 + d2) / 2;
    const swapped = (d1s + d2s) / 2;
    let best = Math.min(normal, swapped);
    // Add thickness penalty if both have it
    if (input.thickness && parsed.d3) {
      const tdiff = Math.abs(input.thickness - parsed.d3) / parsed.d3;
      best = best * 0.7 + tdiff * 0.3;
    }
    if (best > 0.15) return 0;
    return Math.round((1 - best) * 100);
  }

  if (category === '铝圆管') {
    if (!input.outer || !input.inner || !parsed.d1 || !parsed.d2) return 0;
    const dOuter = Math.abs(input.outer - parsed.d1) / parsed.d1;
    const dInner = Math.abs(input.inner - parsed.d2) / parsed.d2;
    const avg = (dOuter + dInner) / 2;
    if (avg > 0.15) return 0;
    return Math.round((1 - avg) * 100);
  }

  if (category === '铝六角管') {
    if (!input.hex || !input.inner || !parsed.d1 || !parsed.d2) return 0;
    const dHex = Math.abs(input.hex - parsed.d1) / parsed.d1;
    const dInner = Math.abs(input.inner - parsed.d2) / parsed.d2;
    const avg = (dHex + dInner) / 2;
    if (avg > 0.15) return 0;
    return Math.round((1 - avg) * 100);
  }

  if (category === '异型材') {
    const parsed = parseCrossSection(spec.cross_section_mm || '');
    const specW = parsed.d1 || 0;
    const specH = parsed.d2 || 0;
    const specPerim = spec.perimeter || 0;
    const specMW = spec.weight_per_meter || 0;

    const hasW = input.width > 0 && specW > 0;
    const hasH = input.height > 0 && specH > 0;
    const hasP = input.perimeter > 0 && specPerim > 0;
    const hasMW = input.meter_weight > 0 && specMW > 0;

    if (!hasW && !hasH && !hasP && !hasMW) return 0;

    let totalDiff = 0;
    let weight = 0;

    if (hasW) {
      const diff = Math.abs(input.width - specW) / specW;
      if (diff > 0.15) return 0;
      totalDiff += diff * 0.35;
      weight += 0.35;
    }
    if (hasH) {
      const diff = Math.abs(input.height - specH) / specH;
      if (diff > 0.15) return 0;
      totalDiff += diff * 0.35;
      weight += 0.35;
    }
    if (hasP) {
      const diff = Math.abs(input.perimeter - specPerim) / specPerim;
      if (diff > 0.15) return 0;
      totalDiff += diff * 0.2;
      weight += 0.2;
    }
    if (hasMW) {
      const diff = Math.abs(input.meter_weight - specMW) / specMW;
      if (diff > 0.20) return 0;
      totalDiff += diff * 0.1;
      weight += 0.1;
    }

    if (weight === 0) return 0;
    return Math.round((1 - totalDiff / weight) * 100);
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
      .select('id, product_name, cross_section_mm, weight_per_meter, perimeter, num_dies, remarks')
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
