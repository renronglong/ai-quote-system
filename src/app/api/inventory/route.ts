import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取库存列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const batchNumber = searchParams.get("batch_number");

    const client = getSupabaseClient();
    
    let query = client
      .from("inventory")
      .select(`
        *,
        products (
          id,
          product_code,
          name,
          material,
          process,
          surface_treatment,
          cost_price
        )
      `)
      .order("created_at", { ascending: false });

    if (productId) {
      query = query.eq("product_id", parseInt(productId));
    }
    if (batchNumber) {
      query = query.eq("batch_number", batchNumber);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询库存失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("获取库存列表失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取库存列表失败" },
      { status: 500 }
    );
  }
}

// POST - 创建库存记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      product_id,
      quantity,
      warehouse_location,
      batch_number,
      notes,
    } = body;

    if (!product_id || quantity === undefined) {
      return NextResponse.json(
        { error: "缺少必填字段" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("inventory")
      .insert({
        product_id,
        quantity,
        warehouse_location,
        batch_number,
        notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建库存记录失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("创建库存记录失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建库存记录失败" },
      { status: 500 }
    );
  }
}

// PUT - 更新库存
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "缺少库存ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("inventory")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新库存失败: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { error: "库存记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("更新库存失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新库存失败" },
      { status: 500 }
    );
  }
}

// DELETE - 删除库存记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "缺少库存ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from("inventory")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      throw new Error(`删除库存记录失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("删除库存记录失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除库存记录失败" },
      { status: 500 }
    );
  }
}
