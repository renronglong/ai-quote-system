import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取产品列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const material = searchParams.get("material");
    const process = searchParams.get("process");
    const surfaceTreatment = searchParams.get("surface_treatment");
    const search = searchParams.get("search");
    const userId = searchParams.get("user_id");

    const client = getSupabaseClient();
    
    let query = client
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    // 按用户过滤
    if (userId) {
      query = query.eq("user_id", userId);
    }

    // 应用过滤条件
    if (material) {
      query = query.eq("material", material);
    }
    if (process) {
      query = query.eq("process", process);
    }
    if (surfaceTreatment) {
      query = query.eq("surface_treatment", surfaceTreatment);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,product_code.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询产品失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("获取产品列表失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取产品列表失败" },
      { status: 500 }
    );
  }
}

// POST - 创建新产品
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      product_code,
      name,
      material,
      process,
      surface_treatment,
      oxidation_color,
      cost_price,
      min_price,
      specs,
      description,
      user_id,
    } = body;

    // 验证必填字段
    if (!product_code || !name || !material || !process || !surface_treatment || !cost_price) {
      return NextResponse.json(
        { error: "缺少必填字段" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查产品编码是否已存在（同一用户下）
    let existingQuery = client
      .from("products")
      .select("id")
      .eq("product_code", product_code);
    
    if (user_id) {
      existingQuery = existingQuery.eq("user_id", user_id);
    }
    
    const { data: existingProduct } = await existingQuery.maybeSingle();

    if (existingProduct) {
      return NextResponse.json(
        { error: "产品编码已存在" },
        { status: 400 }
      );
    }

    // 插入新产品
    const insertData: Record<string, unknown> = {
      product_code,
      name,
      material,
      process,
      surface_treatment,
      oxidation_color,
      cost_price,
      min_price,
      specs,
      description,
    };
    
    if (user_id) {
      insertData.user_id = user_id;
    }

    const { data, error } = await client
      .from("products")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`创建产品失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("创建产品失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建产品失败" },
      { status: 500 }
    );
  }
}

// PUT - 更新产品
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "缺少产品ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("products")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新产品失败: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { error: "产品不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("更新产品失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新产品失败" },
      { status: 500 }
    );
  }
}

// DELETE - 删除产品
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "缺少产品ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from("products")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      throw new Error(`删除产品失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("删除产品失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除产品失败" },
      { status: 500 }
    );
  }
}
