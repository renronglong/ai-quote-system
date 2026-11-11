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
 * 统一操作者身份：管理员 token 优先，否则员工 token。
 * 归属一律以服务端 HMAC token 里解出的手机号为准，绝不信任前端传参。
 * 业主 2026-11-11：客户管理开放给所有登录用户，数据按 owner_phone 严格隔离。
 */
type Actor = { phone: string; isAdmin: boolean };
function getActor(req: Request): Actor | null {
  const adminPhone = verifyAdminToken(req.headers.get('x-admin-token') || '');
  if (adminPhone) return { phone: adminPhone, isAdmin: true };
  const phone = verifyUserToken(req.headers.get('x-user-token') || '');
  return phone ? { phone, isAdmin: false } : null;
}

/** owner_phone 列未升级时的统一提示：绝不退回无过滤查询，避免跨账号泄露 */
function missingColumn(errMsg: string): boolean {
  return /owner_phone/i.test(errMsg || '');
}

function upgradeRequired() {
  return NextResponse.json(
    { error: '客户库尚未升级（缺少 owner_phone 列），请联系管理员执行升级 SQL', needUpgrade: true },
    { status: 503 },
  );
}

// Generate a unique customer code: KH + 6-digit sequential number
async function generateCustomerCode(supabase: ReturnType<typeof getSupabase>): Promise<string> {
  // Get the max customer_code and increment
  const { data: rows } = await supabase
    .from('customers')
    .select('customer_code')
    .like('customer_code', 'KH%')
    .order('customer_code', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (rows && rows.length > 0 && rows[0].customer_code) {
    const lastCode = rows[0].customer_code;
    const lastNum = parseInt(lastCode.replace('KH', ''), 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `KH${String(nextNum).padStart(6, '0')}`;
}

// GET /api/customers - 按 owner_phone 严格隔离的客户列表
export async function GET(request: Request) {
  try {
    const actor = getActor(request);
    if (!actor) {
      return NextResponse.json({ error: '请先登录后再查看客户' }, { status: 403 });
    }
    const { phone, isAdmin } = actor;

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const supabase = getSupabase();

    // 归属过滤必须在数据库层完成：普通用户只取自己的；管理员取共享库 + 自己的，
    // 绝不返回其他账号的数据。⚠️ 升级 SQL 未执行时这里会报「列不存在」，
    // 直接返回 503，绝不退回无过滤查询（宁可不可用，也不串数据）。
    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (isAdmin) {
      query = query.or(`owner_phone.is.null,owner_phone.eq.${phone}`);
    } else {
      query = query.eq('owner_phone', phone);
    }
    const { data: rows, error } = await query;
    if (error) {
      if (missingColumn(error.message)) return upgradeRequired();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 关键词与分页放在服务端内存做：客户表规模小，可避免归属 .or() 与关键词 .or()
    // 互相覆盖、以及 .in('id', 大量id) 撑爆查询 URL 的问题。
    let list: any[] = rows || [];
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(r =>
        ['company_name', 'contact_name', 'customer_code', 'phone']
          .some(k => String(r?.[k] ?? '').toLowerCase().includes(kw))
      );
    }
    const total = list.length;
    const from = (page - 1) * pageSize;
    const data = list.slice(from, from + pageSize);

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error('[GET /api/customers]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}

// POST /api/customers - create a single customer
export async function POST(request: Request) {
  try {
    const actor = getActor(request);
    if (!actor) {
      return NextResponse.json({ error: '请先登录后再新增客户' }, { status: 403 });
    }

    const body = await request.json();
    const { company_name, contact_name, phone, address, email, remarks, customer_code } = body;

    if (!company_name || !String(company_name).trim()) {
      return NextResponse.json({ error: '公司名称不能为空' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Auto-generate customer_code if not provided
    let code = customer_code?.trim() || '';
    if (!code) {
      code = await generateCustomerCode(supabase);
    }

    // Check uniqueness
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('customer_code', code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `客户编号 "${code}" 已存在` }, { status: 400 });
    }

    const insertData = {
      customer_code: code,
      company_name: String(company_name).trim(),
      contact_name: contact_name?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      email: email?.trim() || null,
      remarks: remarks?.trim() || null,
      // 归属：管理员写共享库(null)；普通用户写自己的手机号，查询/改/删都按此隔离
      owner_phone: actor.isAdmin ? null : actor.phone,
    };

    const { data, error } = await supabase
      .from('customers')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      if (missingColumn(error.message)) return upgradeRequired();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[POST /api/customers]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
