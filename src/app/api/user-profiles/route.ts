import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取用户档案列表（从 users 表读取）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    const client = getSupabaseClient();

    let query = client
      .from("users")
      .select("id, phone, company_name, address, email, created_at")
      .order("created_at", { ascending: false });

    if (userId) {
      query = query.eq("id", userId);
    }

    const { data: users, error: uErr } = await query;
    if (uErr) throw new Error(`查询用户失败: ${uErr.message}`);

    // 取积分余额
    const { data: balances } = await client
      .from("credit_balances")
      .select("user_id,balance,total_recharged,total_consumed");
    const balMap = new Map((balances || []).map((b: any) => [b.user_id, b]));

    const data = (users || []).map((u: any) => ({
      id: u.id,
      phone: u.phone || "",
      company_name: u.company_name || "",
      address: u.address || "",
      contact_email: u.email || "",
      balance: balMap.get(u.id)?.balance ?? 0,
      total_recharged: balMap.get(u.id)?.total_recharged ?? 0,
      total_consumed: balMap.get(u.id)?.total_consumed ?? 0,
      created_at: u.created_at,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("获取用户档案失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "获取用户档案失败" },
      { status: 500 }
    );
  }
}

// POST - 创建/更新用户档案（直接写入 users 表）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, company_name, contact_phone, contact_email, address } = body;

    if (!user_id) {
      return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("users")
      .update({
        company_name: company_name || null,
        address: address || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user_id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新用户档案失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("更新用户档案失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "更新失败" },
      { status: 500 }
    );
  }
}

// PUT - 同 POST
export async function PUT(request: NextRequest) {
  return POST(request);
}
