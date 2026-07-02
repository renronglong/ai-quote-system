import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取用户积分余额
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "缺少用户ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("credit_balances")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      // 如果没有余额记录，返回默认余额
      if (error.code === "PGRST116") {
        return NextResponse.json({
          success: true,
          data: {
            user_id: userId,
            balance: "0",
            total_recharged: "0",
            total_consumed: "0",
          },
        });
      }
      throw new Error(`查询余额失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || {
        user_id: userId,
        balance: "0",
        total_recharged: "0",
        total_consumed: "0",
      },
    });
  } catch (error) {
    console.error("获取积分余额失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "获取积分余额失败" },
      { status: 500 }
    );
  }
}
