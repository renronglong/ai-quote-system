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

// Generate a unique customer code: KH + 6-digit sequential number
async function generateCustomerCode(supabase: ReturnType<typeof getSupabase>, offset: number = 0): Promise<string> {
  const { data: rows } = await supabase
    .from('customers')
    .select('customer_code')
    .order('customer_code', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (rows && rows.length > 0 && rows[0].customer_code) {
    const lastCode = rows[0].customer_code;
    // Extract trailing number from any format (KH001, C001, or just numbers)
    const numMatch = lastCode.match(/(\d+)$/);
    if (numMatch) {
      nextNum = parseInt(numMatch[1], 10) + 1;
    }
  }

  return `KH${String(nextNum + offset).padStart(6, '0')}`;
}

export async function POST(request: Request) {
  try {
    const admin = verifyAdmin(request);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: 403 });
    }

    const body = await request.json();
    const items: any[] = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '没有要导入的数据' }, { status: 400 });
    }

    const supabase = getSupabase();
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // Pre-fetch the starting code number for auto-generation
    const startCode = await generateCustomerCode(supabase);
    let autoCodeCounter = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!item.company_name || !String(item.company_name).trim()) {
        errors.push(`第${rowNum}行: 公司名称不能为空`);
        failCount++;
        continue;
      }

      const companyName = String(item.company_name).trim();
      const contactName = item.contact_name?.trim() || null;
      const phoneVal = item.phone?.trim() || null;
      const address = item.address?.trim() || null;
      const email = item.email?.trim() || null;
      const remarks = item.remarks?.trim() || null;

      // Determine customer_code
      let customerCode = item.customer_code?.trim() || '';

      // If no customer_code provided, auto-generate one
      if (!customerCode) {
        customerCode = `KH${String(parseInt(startCode.replace('KH', ''), 10) + autoCodeCounter).padStart(6, '0')}`;
        autoCodeCounter++;
      }

      const recordPayload: Record<string, any> = {
        customer_code: customerCode,
        company_name: companyName,
        contact_name: contactName,
        phone: phoneVal,
        address: address,
        email: email,
        remarks: remarks,
        updated_at: new Date().toISOString(),
      };

      // Upsert by customer_code (unique constraint)
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('customer_code', customerCode)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error: upErr } = await supabase
          .from('customers')
          .update(recordPayload)
          .eq('id', existing.id);
        if (upErr) {
          errors.push(`第${rowNum}行 (${customerCode}): 更新失败 - ${upErr.message}`);
          failCount++;
        } else {
          successCount++;
        }
      } else {
        // Insert new record
        recordPayload.created_at = new Date().toISOString();
        const { error: insErr } = await supabase
          .from('customers')
          .insert([recordPayload]);
        if (insErr) {
          errors.push(`第${rowNum}行 (${customerCode}): 插入失败 - ${insErr.message}`);
          failCount++;
        } else {
          successCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        success_count: successCount,
        fail_count: failCount,
        errors,
      },
    });
  } catch (err: any) {
    console.error('[Customers Batch Upload]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
