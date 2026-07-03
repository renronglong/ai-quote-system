import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取用户子站点的公开数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!username) {
      return NextResponse.json(
        { success: false, error: "缺少用户名" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 获取用户档案（脱敏，不返回 user_id）
    const { data: profile, error: profileError } = await client
      .from("user_profiles")
      .select(`
        id,
        username,
        company_name,
        contact_phone,
        contact_email,
        description,
        avatar_url,
        is_active
      `)
      .eq("username", username)
      .eq("is_active", true)
      .single();

    if (profileError) {
      if (profileError.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "用户不存在" },
          { status: 404 }
        );
      }
      throw new Error(`查询用户档案失败: ${profileError.message}`);
    }

    // 获取该用户的已发布产品（不返回价格等敏感信息）
    const { data: products, error: productsError } = await client
      .from("products")
      .select(`
        id,
        product_code,
        name,
        material,
        process,
        surface_treatment,
        oxidation_color,
        specs,
        description,
        images,
        created_at
      `)
      .eq("user_id", profile.id)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (productsError) {
      throw new Error(`查询产品失败: ${productsError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          username: profile.username,
          company_name: profile.company_name,
          contact_phone: profile.contact_phone,
          contact_email: profile.contact_email,
          description: profile.description,
          avatar_url: profile.avatar_url,
        },
        products: products || [],
      },
    });
  } catch (error) {
    console.error("获取用户站点数据失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "获取用户站点数据失败" },
      { status: 500 }
    );
  }
}
