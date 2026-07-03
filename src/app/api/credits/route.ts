import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取积分记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "缺少用户ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("credits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`查询积分记录失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("获取积分记录失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "获取积分记录失败" },
      { status: 500 }
    );
  }
}

// POST - 创建积分交易
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      user_id, 
      type, 
      amount, 
      description,
      related_task_id,
      admin_remark 
    } = body;

    if (!user_id || !type || amount === undefined) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数" },
        { status: 400 }
      );
    }

    if (!["recharge", "consume", "refund", "adjust"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "无效的交易类型" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 获取当前余额
    const { data: currentBalance } = await client
      .from("credit_balances")
      .select("*")
      .eq("user_id", user_id)
      .single();

    let currentBal = parseFloat(currentBalance?.balance || "0");
    const amountNum = parseFloat(amount);

    // 计算交易后余额
    let newBalance: number;
    if (type === "consume") {
      newBalance = currentBal - amountNum;
      if (newBalance < 0) {
        return NextResponse.json(
          { success: false, error: "积分余额不足" },
          { status: 400 }
        );
      }
    } else {
      newBalance = currentBal + amountNum;
    }

    // 插入交易记录
    const { data: creditRecord, error: creditError } = await client
      .from("credits")
      .insert({
        user_id,
        type,
        amount: amount.toString(),
        balance_after: newBalance.toString(),
        description,
        related_task_id,
        admin_remark,
      })
      .select()
      .single();

    if (creditError) {
      throw new Error(`创建积分记录失败: ${creditError.message}`);
    }

    // 更新余额表
    const updateBalanceData: Record<string, unknown> = {
      balance: newBalance.toString(),
      updated_at: new Date().toISOString(),
    };

    if (type === "recharge") {
      updateBalanceData.total_recharged = (parseFloat(currentBalance?.total_recharged || "0") + amountNum).toString();
    } else if (type === "consume") {
      updateBalanceData.total_consumed = (parseFloat(currentBalance?.total_consumed || "0") + amountNum).toString();
    }

    const { error: balanceError } = await client
      .from("credit_balances")
      .upsert({
        user_id,
        ...updateBalanceData,
      });

    if (balanceError) {
      throw new Error(`更新余额失败: ${balanceError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        credit_record: creditRecord,
        new_balance: newBalance,
      },
    });
  } catch (error) {
    console.error("创建积分交易失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "创建积分交易失败" },
      { status: 500 }
    );
  }
}
