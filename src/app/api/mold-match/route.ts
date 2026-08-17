import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computePHash, hammingDistance, similarityPercent } from '@/lib/image-hash';
import { parseDimensions, computeMatchScore } from '@/lib/dimension-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo'
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, params } = body;
    // image: base64 string (optional, for fallback image matching)
    // params: { cross_section_mm, weight_per_meter, perimeter } (optional, for param matching)

    if (!image && !params) {
      return NextResponse.json({ error: '请提供图片或参数' }, { status: 400 });
    }

    // Compute image hash (if image provided)
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

    // Parse input parameters
    const inputDims = params?.cross_section_mm ? parseDimensions(params.cross_section_mm) : [];
    const inputWeight = params?.weight_per_meter ? Number(params.weight_per_meter) : null;
    const inputPerimeter = params?.perimeter ? Number(params.perimeter) : null;

    const hasParams = inputDims.length > 0 || inputWeight !== null || inputPerimeter !== null;

    // Fetch all supplier products
    const { data: allProducts, error } = await supabase
      .from('supplier_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('DB query failed:', error);
      return NextResponse.json({ error: '查询产品失败' }, { status: 500 });
    }

    // Filter: at least one of: has cross-section image OR has dimension data
    const products = (allProducts || []).filter(p => 
      p.cross_section_image_url || 
      p.cross_section_mm || 
      p.weight_per_meter != null ||
      p.perimeter != null
    );

    if (products.length === 0) {
      return NextResponse.json({ success: true, matches: [], total_compared: 0, method: 'no_products' });
    }

    // Compare each product
    const matches: Array<{
      product: typeof products[0];
      score: number;
      dimScore: number;
      weightScore: number;
      imageSimilarity: number;
    }> = [];

    for (const product of products) {
      try {
        // Parse product dimensions
        const productDims = parseDimensions(product.cross_section_mm);
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
          } catch (err) {
            // Skip image comparison for this product
          }
        }

        // Compute overall match score (dimension → weight → image priority)
        const score = computeMatchScore(
          inputDims, inputWeight, inputPerimeter,
          productDims, productWeight, productPerimeter,
          imageSimilarity
        );

        // Only include if score >= 40 (reasonable match)
        if (score >= 40) {
          const { compareDimensions, compareWeight } = await import('@/lib/dimension-parser');
          matches.push({
            product,
            score,
            dimScore: compareDimensions(inputDims, productDims),
            weightScore: compareWeight(inputWeight, productWeight),
            imageSimilarity,
          });
        }
      } catch (err) {
        console.warn(`Failed to process product ${product.id}:`, err);
        continue;
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Return top 5 matches
    const topMatches = matches.slice(0, 5).map(m => ({
      id: m.product.id,
      mold_number: m.product.mold_number,
      product_name: m.product.product_name,
      cross_section_mm: m.product.cross_section_mm,
      weight_per_meter: m.product.weight_per_meter,
      perimeter: m.product.perimeter,
      surface_treatments: m.product.surface_treatments,
      cross_section_image_url: m.product.cross_section_image_url,
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
        dims: inputDims,
        weight: inputWeight,
        perimeter: inputPerimeter,
      }
    });
  } catch (err: any) {
    console.error('Mold match error:', err);
    return NextResponse.json({ error: err.message || '匹配失败' }, { status: 500 });
  }
}
