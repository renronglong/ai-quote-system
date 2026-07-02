import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// GET - 获取单个任务详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "缺少任务ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("tasks")
      .select(`
        *,
        user_profile:user_profiles(id, username, company_name, contact_phone, contact_email)
      `)
      .eq("id", parseInt(id))
      .single();

    if (error) {
      throw new Error(`查询任务失败: ${error.message}`);
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
    console.error("获取任务详情失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "获取任务详情失败" },
      { status: 500 }
    );
  }
}

// DELETE - 删除任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "缺少任务ID" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from("tasks")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      throw new Error(`删除任务失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("删除任务失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "删除任务失败" },
      { status: 500 }
    );
  }
}
