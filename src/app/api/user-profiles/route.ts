import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取用户档案列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const userId = searchParams.get("user_id");

    const client = getSupabaseClient();

    let query = client
      .from("user_profiles")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (username) {
      query = query.eq("username", username);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询用户档案失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("获取用户档案失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "获取用户档案失败" },
      { status: 500 }
    );
  }
}

// POST - 创建用户档案
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      user_id, 
      username, 
      company_name, 
      contact_phone, 
      contact_email, 
      description,
      avatar_url
    } = body;

    if (!user_id || !username) {
      return NextResponse.json(
        { success: false, error: "缺少用户ID或用户名" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查用户名是否已存在
    const { data: existing } = await client
      .from("user_profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "用户名已存在" },
        { status: 400 }
      );
    }

    // 插入新档案
    const { data, error } = await client
      .from("user_profiles")
      .insert({
        user_id,
        username,
        company_name,
        contact_phone,
        contact_email,
        description,
        avatar_url,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建用户档案失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("创建用户档案失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "创建用户档案失败" },
      { status: 500 }
    );
  }
}

// PUT - 更新用户档案
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      user_id,
      username,
      company_name, 
      contact_phone, 
      contact_email, 
      description,
      avatar_url,
      is_active
    } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "缺少用户ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (username !== undefined) updateData.username = username;
    if (company_name !== undefined) updateData.company_name = company_name;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (contact_email !== undefined) updateData.contact_email = contact_email;
    if (description !== undefined) updateData.description = description;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await client
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新用户档案失败: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "用户档案不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("更新用户档案失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "更新用户档案失败" },
      { status: 500 }
    );
  }
}
