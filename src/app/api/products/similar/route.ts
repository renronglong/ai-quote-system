import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * GET /api/products/similar?width=50&height=30&length=6000&material=铝合金&process=铝挤压&limit=5
 * 根据尺寸和工艺搜索相近规格产品
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const width = parseFloat(searchParams.get("width") || "0");
    const height = parseFloat(searchParams.get("height") || "0");
    const length = parseFloat(searchParams.get("length") || "0");
    const material = searchParams.get("material") || "";
    const processType = searchParams.get("process") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    // 至少需要一个维度有值
    if (!width && !height && !length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const client = getSupabaseClient();

    // 获取产品列表（按材料/工艺过滤）
    let query = client
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (material) {
      query = query.ilike("material", `%${material}%`);
    }
    if (processType) {
      query = query.ilike("process", `%${processType}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const products = (data || []).map((p) => {
      let specs: Record<string, unknown> = {};
      if (typeof p.specs === "string") {
        try { specs = JSON.parse(p.specs); } catch { /* skip */ }
      } else if (p.specs) {
        specs = p.specs as Record<string, unknown>;
      }
      return { ...p, parsed_specs: specs };
    });

    // 计算相似度并排序
    const scored = products
      .map((p) => {
        const s = p.parsed_specs;
        const pw = Number(s.width) || 0;
        const ph = Number(s.height) || 0;
        const pl = Number(s.length) || 0;

        let score = 0;
        let matchCount = 0;

        if (width && pw) {
          const diff = Math.abs(width - pw) / Math.max(width, 1);
          if (diff <= 0.3) {
            score += (1 - diff) * 40;
            matchCount++;
          } else {
            return null;
          }
        }
        if (height && ph) {
          const diff = Math.abs(height - ph) / Math.max(height, 1);
          if (diff <= 0.3) {
            score += (1 - diff) * 30;
            matchCount++;
          } else {
            return null;
          }
        }
        if (length && pl) {
          const diff = Math.abs(length - pl) / Math.max(length, 1);
          if (diff <= 0.3) {
            score += (1 - diff) * 30;
            matchCount++;
          } else {
            return null;
          }
        }

        if (matchCount === 0) return null;

        return {
          id: p.id,
          product_code: p.product_code,
          name: p.name,
          material: p.material,
          process: p.process,
          surface_treatment: p.surface_treatment,
          oxidation_color: p.oxidation_color,
          cost_price: p.cost_price,
          min_price: p.min_price,
          specs: s,
          supplier: (s.supplier as string) || "",
          description: p.description,
          similarity: Math.round(score),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.similarity ?? 0) - (a?.similarity ?? 0))
      .slice(0, limit);

    return NextResponse.json({ success: true, data: scored });
  } catch (error) {
    console.error("搜索相近产品失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "搜索失败" },
      { status: 500 }
    );
  }
}
