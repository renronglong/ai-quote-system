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
 * 业主 2026-11-11：客户库新增 owner_phone 列后，所有登录用户都能导入自己的客户，
 * 按手机号严格隔离；管理员导入写入共享库(owner_phone = null)，且管理员也看不到员工的数据。
 * 归属一律取服务端 HMAC token，绝不信任前端传参。
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
/** 已有记录能否被当前操作者覆盖：普通用户仅自己的；管理员仅共享库 + 自己的 */
function canOverwrite(ownerPhone: string | null, actor: Actor): boolean {
  return actor.isAdmin
    ? (ownerPhone == null || ownerPhone === actor.phone)
    : (ownerPhone === actor.phone);
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
    const actor = getActor(request);
    if (!actor) {
      return NextResponse.json({ error: '请先登录后再导入客户' }, { status: 403 });
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
        // 归属不在这里写：更新时绝不改动既有 owner_phone（防止把别人的记录改到自己名下）
        updated_at: new Date().toISOString(),
      };

      // Upsert by customer_code (unique constraint)
      const { data: existing, error: selErr } = await supabase
        .from('customers')
        .select('id, owner_phone')
        .eq('customer_code', customerCode)
        .maybeSingle();
      if (selErr && missingColumn(selErr.message)) return upgradeRequired();

      if (existing) {
        // 归属校验：普通用户不能覆盖别人的/共享库；管理员也不能覆盖员工的数据
        if (!canOverwrite(existing.owner_phone, actor)) {
          errors.push(`第${rowNum}行 (${customerCode}): 该客户编号属于其他账号，无权覆盖`);
          failCount++;
          continue;
        }
        const { error: upErr } = await supabase
          .from('customers')
          .update(recordPayload)
          .eq('id', existing.id);
        if (upErr) {
          if (missingColumn(upErr.message)) return upgradeRequired();
          errors.push(`第${rowNum}行 (${customerCode}): 更新失败 - ${upErr.message}`);
          failCount++;
        } else {
          successCount++;
        }
      } else {
        // Insert new record：新增时才落归属，管理员写共享库(null)，普通用户写自己手机号
        recordPayload.created_at = new Date().toISOString();
        recordPayload.owner_phone = actor.isAdmin ? null : actor.phone;
        const { error: insErr } = await supabase
          .from('customers')
          .insert([recordPayload]);
        if (insErr) {
          if (missingColumn(insErr.message)) return upgradeRequired();
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
