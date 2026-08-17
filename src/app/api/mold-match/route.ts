import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computePHash, hammingDistance, similarityPercent } from '@/lib/image-hash';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo'
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body; // base64 or URL
    
    if (!image) {
      return NextResponse.json({ error: '请提供图片' }, { status: 400 });
    }

    // Compute hash of uploaded image
    let uploadedHash: string;
    try {
      // Handle base64 with data URI prefix
      const base64Data = image.startsWith('data:') 
        ? image.split(',')[1] 
        : image;
      const buffer = Buffer.from(base64Data, 'base64');
      uploadedHash = await computePHash(buffer);
    } catch (err) {
      console.error('Hash computation failed:', err);
      return NextResponse.json({ error: '图片处理失败' }, { status: 400 });
    }

    // Fetch all supplier products with cross-section images
    const { data: products, error } = await supabase
      .from('supplier_products')
      .select('*')
      .not('cross_section_image_url', 'is', null)
      .neq('cross_section_image_url', '')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('DB query failed:', error);
      return NextResponse.json({ error: '查询产品失败' }, { status: 500 });
    }

    // Compare with each product's cross-section image
    const matches: Array<{
      product: typeof products[0];
      distance: number;
      similarity: number;
      hash: string;
    }> = [];

    for (const product of products) {
      try {
        const productImg = product.cross_section_image_url;
        if (!productImg) continue;

        let productBuffer: Buffer;
        if (productImg.startsWith('data:image')) {
          // base64
          const base64Data = productImg.split(',')[1];
          productBuffer = Buffer.from(base64Data, 'base64');
        } else if (productImg.startsWith('http')) {
          // URL - fetch the image
          const imgRes = await fetch(productImg);
          if (!imgRes.ok) continue;
          productBuffer = Buffer.from(await imgRes.arrayBuffer());
        } else {
          continue;
        }

        const productHash = await computePHash(productBuffer);
        const distance = hammingDistance(uploadedHash, productHash);
        const similarity = similarityPercent(distance);

        // Only include matches with reasonable similarity (distance < 20)
        if (distance < 20) {
          matches.push({ product, distance, similarity, hash: productHash });
        }
      } catch (err) {
        console.warn(`Failed to process product ${product.id}:`, err);
        continue;
      }
    }

    // Sort by similarity (descending)
    matches.sort((a, b) => b.similarity - a.similarity);

    // Return top 5 matches
    const topMatches = matches.slice(0, 5).map(m => ({
      id: m.product.id,
      mold_number: m.product.mold_number,
      product_name: m.product.product_name,
      cross_section_mm: m.product.cross_section_mm,
      weight_per_meter: m.product.weight_per_meter,
      perimeter: m.product.perimeter,
      surface_treatments: m.product.surface_treatments,
      similarity: m.similarity,
      cross_section_image_url: m.product.cross_section_image_url,
    }));

    return NextResponse.json({
      success: true,
      matches: topMatches,
      total_compared: products?.length || 0,
    });
  } catch (err: any) {
    console.error('Mold match error:', err);
    return NextResponse.json({ error: err.message || '匹配失败' }, { status: 500 });
  }
}
