import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';

// GET - List cad_requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const client = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('cad_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('查询CAD工单失败:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('获取CAD工单列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取工单列表失败' },
      { status: 500 }
    );
  }
}

// PUT - Update cad_request status and admin notes
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, admin_notes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少工单ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const updateData: Record<string, unknown> = {};

    if (status !== undefined) updateData.status = status;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有需要更新的字段' },
        { status: 400 }
      );
    }

    // Try full update first
    try {
      const { data, error } = await client
        .from('cad_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error) {
        return NextResponse.json({ success: true, data });
      }

      // If admin_notes column doesn't exist, retry without it
      if (admin_notes !== undefined && error.code === '42703') {
        console.warn('admin_notes 列不存在，降级为仅更新状态');
        const fallbackData: Record<string, unknown> = { ...updateData };
        delete fallbackData.admin_notes;

        const { data: fallbackDataResult, error: fallbackError } = await client
          .from('cad_requests')
          .update(fallbackData)
          .eq('id', id)
          .select()
          .single();

        if (!fallbackError) {
          return NextResponse.json({ success: true, data: fallbackDataResult });
        }
        console.error('更新CAD工单失败(降级后):', fallbackError);
        return NextResponse.json(
          { success: false, error: fallbackError.message },
          { status: 500 }
        );
      }

      console.error('更新CAD工单失败:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    } catch (dbErr) {
      console.error('数据库操作异常:', dbErr);
      return NextResponse.json(
        { success: false, error: dbErr instanceof Error ? dbErr.message : '更新失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('更新CAD工单失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
