import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '@/lib/admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * 服务端导入仅限管理员（写共享客户库）。
 * 员工账号的客户由前端直接写本机（localStorage），不落服务端 —— 业主 2026-10-22：
 * ① 各自只能看自己的；② 老板也不看员工的。本机的 user_id 列有外键指向 auth.users，
 * 而本系统用户在自建 users 表（两套 ID 不通），无法按账号落库，故员工数据仅存本机。
 */
function verifyAdminOnly(req: Request): { ok: boolean; error?: string } {
  const adminTok = req.headers.get('x-admin-token') || '';
  if (!verifyAdminToken(adminTok)) {
    return { ok: false, error: '员工账号的客户仅保存在本机，无需上传；共享客户库仅管理员可写入' };
  }
  return { ok: true };
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
    const adminOk = verifyAdminOnly(request);
    if (!adminOk.ok) {
      return NextResponse.json({ error: adminOk.error }, { status: 403 });
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

      // 模板里的「简码/客户编号」可作 customer_code（全局唯一，重复导入按编号更新，不产生重复记录）
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
        // 注意：user_id 列外键指向 auth.users（与本系统自建 users 表不通），不可写入，保持 null = 共享库
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

    // 同类错误合并（40 行同一个外键错会刷成一面红墙，合并成「xx错误 × 40」）
    const errCount: Record<string, number> = {};
    errors.forEach(e => { errCount[e] = (errCount[e] || 0) + 1; });
    const mergedErrors = Object.entries(errCount).map(([msg, n]) => (n > 1 ? `${msg}（共 ${n} 行）` : msg));

    return NextResponse.json({
      success: true,
      data: {
        success_count: successCount,
        fail_count: failCount,
        errors: mergedErrors,
      },
    });
  } catch (err: any) {
    console.error('[Customers Batch Upload]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
