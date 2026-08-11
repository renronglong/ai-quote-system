import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取任务列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userId = searchParams.get("user_id");
    const isAdmin = searchParams.get("is_admin") === "true";
    const taskType = searchParams.get("type");

    const client = getSupabaseClient();
    
    let query = client
      .from("tasks")
      .select(`
        *,
        user_profile:user_profiles(id, username, company_name)
      `)
      .order("created_at", { ascending: false });

    // 非管理员只能看自己的任务
    if (!isAdmin && userId) {
      query = query.eq("user_id", userId);
    }
    
    // 按状态筛选
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    
    // 按类型筛选（如 manual_quote 图纸工单）
    if (taskType) {
      query = query.eq("type", taskType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询任务失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("获取任务列表失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "获取任务列表失败" },
      { status: 500 }
    );
  }
}

// POST - 创建新任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      user_id, 
      title, 
      files, 
      conversation_log,
      type: taskType,
      user_message,
    } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "缺少用户ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 生成任务编号: T + YYYYMMDD + 3位序号
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    
    // 查询今天已有的任务数量
    const { data: todayTasks } = await client
      .from("tasks")
      .select("id")
      .like("task_code", `T${dateStr}%`);

    const seqNum = String((todayTasks?.length || 0) + 1).padStart(3, "0");
    const taskCode = `T${dateStr}${seqNum}`;

    // 插入新任务
    const insertData: Record<string, unknown> = {
      user_id,
      task_code: taskCode,
      title: title || "新任务",
      files: files || [],
      conversation_log: conversation_log || [],
      status: "pending",
    };
    if (taskType) insertData.type = taskType;
    if (user_message) insertData.admin_notes = user_message; // 复用 admin_notes 暂存用户留言

    const { data, error } = await client
      .from("tasks")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`创建任务失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("创建任务失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "创建任务失败" },
      { status: 500 }
    );
  }
}

// PUT - 更新任务（管理员操作）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id,
      status,
      admin_notes,
      result_files,
      result_summary,
      price_multiplier,
      price_override,
      product_count,
      model_cost,
      total_credits,
      conversation_log,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "缺少任务ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      updateData.status = status;
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }
    }
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
    if (result_files !== undefined) updateData.result_files = result_files;
    if (result_summary !== undefined) updateData.result_summary = result_summary;
    if (price_multiplier !== undefined) updateData.price_multiplier = price_multiplier;
    if (price_override !== undefined) updateData.price_override = price_override;
    if (product_count !== undefined) updateData.product_count = product_count;
    if (model_cost !== undefined) updateData.model_cost = model_cost;
    if (total_credits !== undefined) updateData.total_credits = total_credits;
    if (conversation_log !== undefined) updateData.conversation_log = conversation_log;

    const { data, error } = await client
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新任务失败: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "任务不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("更新任务失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "更新任务失败" },
      { status: 500 }
    );
  }
}
