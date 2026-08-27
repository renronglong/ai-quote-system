import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computePHash, hammingDistance, similarityPercent } from '@/lib/image-hash';
import { parseDimensions, compareDimensions, compareWeight, computeMatchScore, SectionDimension } from '@/lib/dimension-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo'
);

// 动态计算模具类型：以数据库 num_dies 为准
function computeMoldType(product: any): string {
  const { num_dies } = product;
  if (num_dies == null || num_dies === 0) return '平模';
  return '分流模';
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, params } = body;

    if (!image && !params) {
      return NextResponse.json({ error: '请提供图片或参数' }, { status: 400 });
    }

    // Compute image hash
    let uploadedHash: string | null = null;
    if (image && image.startsWith('data:image')) {
      try {
        const base64Data = image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        uploadedHash = await computePHash(buffer);
      } catch (err) {
        console.warn('Image hash computation failed:', err);
      }
    }

    // Parse input section dimension (宽×高 or ø)
    const inputDim: SectionDimension | null = params?.cross_section_mm
      ? parseDimensions(params.cross_section_mm)
      : null;
    const inputWeight = params?.weight_per_meter ? Number(params.weight_per_meter) : null;
    const inputPerimeter = params?.perimeter ? Number(params.perimeter) : null;
    const hasParams = inputDim !== null || inputWeight !== null || inputPerimeter !== null;

    // Fetch all supplier products
    const { data: allProducts, error } = await supabase
      .from('supplier_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('DB query failed:', error);
      return NextResponse.json({ error: '查询产品失败' }, { status: 500 });
    }

    const products = (allProducts || []).filter((p: any) =>
      p.cross_section_image_url ||
      p.cross_section_mm ||
      p.weight_per_meter != null ||
      p.perimeter != null
    );

    if (products.length === 0) {
      return NextResponse.json({ success: true, matches: [], total_compared: 0, method: 'no_products' });
    }

    const matches: Array<{
      product: typeof products[0];
      score: number;
      dimScore: number;
      weightScore: number;
      imageSimilarity: number;
    }> = [];

    for (const product of products) {
      try {
        const productDim = parseDimensions(product.cross_section_mm);
        const productWeight = product.weight_per_meter != null ? Number(product.weight_per_meter) : null;
        const productPerimeter = product.perimeter != null ? Number(product.perimeter) : null;

        // Image similarity
        let imageSimilarity = 0;
        if (uploadedHash && product.cross_section_image_url) {
          try {
            const productImg = product.cross_section_image_url;
            let productBuffer: Buffer;
            if (productImg.startsWith('data:image')) {
              productBuffer = Buffer.from(productImg.split(',')[1], 'base64');
            } else if (productImg.startsWith('http')) {
              const imgRes = await fetch(productImg, { signal: AbortSignal.timeout(5000) });
              if (!imgRes.ok) continue;
              productBuffer = Buffer.from(await imgRes.arrayBuffer());
            } else {
              continue;
            }
            const productHash = await computePHash(productBuffer);
            const dist = hammingDistance(uploadedHash, productHash);
            imageSimilarity = dist < 20 ? similarityPercent(dist) : 0;
          } catch {
            // Skip image comparison
          }
        }

        const score = computeMatchScore(
          inputDim, inputWeight, inputPerimeter,
          productDim, productWeight, productPerimeter,
          imageSimilarity
        );

        if (score >= 40) {
          matches.push({
            product,
            score,
            dimScore: compareDimensions(inputDim, productDim),
            weightScore: compareWeight(inputWeight, productWeight),
            imageSimilarity,
          });
        }
      } catch (err) {
        console.warn(`Failed to process product ${product.id}:`, err);
        continue;
      }
    }

    matches.sort((a, b) => b.score - a.score);

    const topMatches = matches.slice(0, 5).map(m => ({
      id: m.product.id,
      mold_number: m.product.mold_number,
      product_name: m.product.product_name,
      cross_section_mm: m.product.cross_section_mm,
      weight_per_meter: m.product.weight_per_meter,
      perimeter: m.product.perimeter,
      surface_treatments: m.product.surface_treatments,
      cross_section_image_url: m.product.cross_section_image_url,
      mold_type: computeMoldType(m.product),
      score: m.score,
      dim_score: Math.round(m.dimScore),
      weight_score: Math.round(m.weightScore),
      image_similarity: Math.round(m.imageSimilarity),
      match_method: hasParams ? 'param' : 'image',
    }));

    return NextResponse.json({
      success: true,
      matches: topMatches,
      total_compared: products.length,
      method: hasParams ? 'param' : 'image',
      input: {
        section: inputDim,
        weight: inputWeight,
        perimeter: inputPerimeter,
      }
    });
  } catch (err: any) {
    console.error('Mold match error:', err);
    return NextResponse.json({ error: err.message || '匹配失败' }, { status: 500 });
  }
}
