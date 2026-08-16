import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 获取用户ID：优先从 header 取，其次从 query param 取
function getUserId(request: NextRequest): string | null {
  return (
    request.headers.get('x-user-id') ||
    request.nextUrl.searchParams.get('user_id') ||
    null
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// GET - 获取当前用户的所有保存报价
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('缺少用户ID', 400);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('saved_quotes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SavedQuotes] GET error:', error);
      throw new Error(`查询失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[SavedQuotes] GET exception:', err);
    return errorResponse(
      err instanceof Error ? err.message : '获取保存报价失败',
      500
    );
  }
}

// POST - 保存新报价
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = getUserId(request) || body.user_id;
    if (!userId) return errorResponse('缺少用户ID', 400);

    const { name, product_type, params, result, product_discount, mold_discount } = body;

    if (!name || !product_type) {
      return errorResponse('缺少必填字段 name/product_type', 400);
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('saved_quotes')
      .insert({
        user_id: userId,
        name,
        product_type,
        params: params || {},
        result: result || {},
        product_discount: product_discount ?? 100,
        mold_discount: mold_discount ?? 100,
      })
      .select()
      .single();

    if (error) {
      console.error('[SavedQuotes] POST error:', error);
      throw new Error(`保存失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[SavedQuotes] POST exception:', err);
    return errorResponse(
      err instanceof Error ? err.message : '保存报价失败',
      500
    );
  }
}

// DELETE - 删除指定报价
export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('缺少用户ID', 400);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('缺少 id 参数', 400);

    const client = getSupabaseClient();
    const { error } = await client
      .from('saved_quotes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // 确保只能删自己的

    if (error) {
      console.error('[SavedQuotes] DELETE error:', error);
      throw new Error(`删除失败: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[SavedQuotes] DELETE exception:', err);
    return errorResponse(
      err instanceof Error ? err.message : '删除报价失败',
      500
    );
  }
}

// PUT - 更新报价名称
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = getUserId(request) || body.user_id;
    if (!userId) return errorResponse('缺少用户ID', 400);

    const { id, name } = body;
    if (!id || !name) return errorResponse('缺少 id/name', 400);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('saved_quotes')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[SavedQuotes] PUT error:', error);
      throw new Error(`更新失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[SavedQuotes] PUT exception:', err);
    return errorResponse(
      err instanceof Error ? err.message : '更新报价失败',
      500
    );
  }
}
