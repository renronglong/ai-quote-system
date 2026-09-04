import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Verify admin via x-admin-token header
function verifyAdmin(req: Request): { ok: boolean; phone?: string; error?: string } {
  const token = req.headers.get('x-admin-token') || '';
  if (!token) return { ok: false, error: '未提供管理员凭证' };

  // Simple HMAC verification matching lib/admin.ts
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: '无效token' };

  try {
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const sep = payload.lastIndexOf('|');
    if (sep < 0) return { ok: false, error: '无效payload' };
    const phone = payload.slice(0, sep);
    const exp = Number(payload.slice(sep + 1));
    if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, error: 'token已过期' };

    // Check admin phone whitelist
    const ADMIN_PHONES = ['13800138000', '18929979760'];
    if (!ADMIN_PHONES.includes(phone)) return { ok: false, error: '非管理员' };

    return { ok: true, phone };
  } catch {
    return { ok: false, error: 'token解析失败' };
  }
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

// GET /api/customers - list customers with optional search
export async function GET(request: Request) {
  try {
    const admin = verifyAdmin(request);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const supabase = getSupabase();

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (keyword.trim()) {
      query = query.or(
        `company_name.ilike.%${keyword.trim()}%,contact_name.ilike.%${keyword.trim()}%,customer_code.ilike.%${keyword.trim()}%,phone.ilike.%${keyword.trim()}%`
      );
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
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
    const admin = verifyAdmin(request);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: 403 });
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
    };

    const { data, error } = await supabase
      .from('customers')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[POST /api/customers]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
