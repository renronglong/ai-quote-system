import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 获取用户ID：全站统一从 query param user_id 取；兼容早期调用方的 x-user-id 头
// （2026-11-11：曾有前端只带 header，导致删除接口拿不到 user_id 直接 400）
function getUserId(request: NextRequest): string | null {
  return (
    request.nextUrl.searchParams.get('user_id') ||
    request.headers.get('x-user-id') ||
    null
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// 列表禁缓存：否则删除后浏览器/CDN 仍可能返回旧列表，业主会以为「删除无效」
function noStore(payload: any) {
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
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

    return noStore({ success: true, data: data || [] });
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

// DELETE - 删除指定报价；支持 ?ids=a,b,c 一次批量删除（业主 2026-11-11「删除选中功能无效」）
// 关键点：必须 .select('id') 拿回真正被删的行。PostgREST 的 .delete() 在 0 行命中时
// 也返回 error=null，旧实现直接 success:true，前端以为删掉了、实际一行没动。
export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('缺少用户ID', 400);

    const { searchParams } = new URL(request.url);
    const singleId = searchParams.get('id');
    const idsParam = searchParams.get('ids');
    const ids = (idsParam ? idsParam.split(',') : singleId ? [singleId] : [])
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (ids.length === 0) return errorResponse('缺少 id / ids 参数', 400);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('saved_quotes')
      .delete()
      .in('id', ids)
      .eq('user_id', userId) // 确保只能删自己的
      .select('id');

    if (error) {
      console.error('[SavedQuotes] DELETE error:', error);
      throw new Error(`删除失败: ${error.message}`);
    }
    const deletedIds = (data || []).map((r: any) => String(r.id));
    if (deletedIds.length === 0) {
      // 明确报错，不再假成功：通常是 id 不存在 / 不是本人数据 / 权限问题
      return errorResponse('未删除任何记录（记录不存在或无权删除），请刷新后重试', 404);
    }
    return noStore({ success: true, deleted: deletedIds.length, ids: deletedIds });
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
