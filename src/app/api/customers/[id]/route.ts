import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken, verifyUserToken } from '@/lib/admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * 统一操作者身份（业主 2026-11-11：客户管理开放给所有登录用户，按 owner_phone 严格隔离）。
 * 归属以服务端 HMAC token 解出的手机号为准，绝不信任前端传参。
 */
type Actor = { phone: string; isAdmin: boolean };
function getActor(req: Request): Actor | null {
  const adminPhone = verifyAdminToken(req.headers.get('x-admin-token') || '');
  if (adminPhone) return { phone: adminPhone, isAdmin: true };
  const phone = verifyUserToken(req.headers.get('x-user-token') || '');
  return phone ? { phone, isAdmin: false } : null;
}
function missingColumn(msg: string): boolean { return /owner_phone/i.test(msg || ''); }
function upgradeRequired() {
  return NextResponse.json(
    { error: '客户库尚未升级（缺少 owner_phone 列），请联系管理员执行升级 SQL', needUpgrade: true },
    { status: 503 },
  );
}

/** 归属校验：普通用户仅能操作自己的；管理员仅能操作共享库 + 自己的（看不到员工的） */
async function assertOwner(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  actor: Actor,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: row, error } = await supabase
    .from('customers')
    .select('id, owner_phone')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      response: missingColumn(error.message)
        ? upgradeRequired()
        : NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!row) return { ok: false, response: NextResponse.json({ error: '客户不存在' }, { status: 404 }) };
  const allowed = actor.isAdmin
    ? (row.owner_phone == null || row.owner_phone === actor.phone)
    : (row.owner_phone === actor.phone);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: '无权操作该客户' }, { status: 403 }) };
  }
  return { ok: true };
}

// PUT /api/customers/[id] - update customer
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = getActor(request);
    if (!actor) {
      return NextResponse.json({ error: '请先登录后再修改客户' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { company_name, contact_name, phone, address, email, remarks, customer_code } = body;

    if (!company_name || !String(company_name).trim()) {
      return NextResponse.json({ error: '公司名称不能为空' }, { status: 400 });
    }

    const supabase = getSupabase();
    const owned = await assertOwner(supabase, id, actor);
    if (!owned.ok) return owned.response;

    // If changing customer_code, check uniqueness
    if (customer_code) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('customer_code', customer_code)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: `客户编号 "${customer_code}" 已被使用` }, { status: 400 });
      }
    }

    const updateData: Record<string, any> = {
      company_name: String(company_name).trim(),
      contact_name: contact_name?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      email: email?.trim() || null,
      remarks: remarks?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (customer_code) {
      updateData.customer_code = customer_code.trim();
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[PUT /api/customers/[id]]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/customers/[id] - delete customer
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = getActor(request);
    if (!actor) {
      return NextResponse.json({ error: '请先登录后再删除客户' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabase();
    const owned = await assertOwner(supabase, id, actor);
    if (!owned.ok) return owned.response;

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/customers/[id]]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
