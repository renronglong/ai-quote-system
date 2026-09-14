import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function verifyAdmin(req: Request): { ok: boolean; phone?: string; error?: string } {
  const token = req.headers.get('x-admin-token') || '';
  if (!token) return { ok: false, error: '未提供管理员凭证' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: '无效token' };

  try {
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const sep = payload.lastIndexOf('|');
    if (sep < 0) return { ok: false, error: '无效payload' };
    const phone = payload.slice(0, sep);
    const exp = Number(payload.slice(sep + 1));
    if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, error: 'token已过期' };

    const ADMIN_PHONES = ['13800138000', '18929979760'];
    if (!ADMIN_PHONES.includes(phone)) return { ok: false, error: '非管理员' };

    return { ok: true, phone };
  } catch {
    return { ok: false, error: 'token解析失败' };
  }
}

// PUT /api/customers/[id] - update customer
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = verifyAdmin(request);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { company_name, contact_name, phone, address, email, remarks, customer_code } = body;

    if (!company_name || !String(company_name).trim()) {
      return NextResponse.json({ error: '公司名称不能为空' }, { status: 400 });
    }

    const supabase = getSupabase();

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
    const admin = verifyAdmin(request);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabase();

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
