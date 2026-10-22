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
 * 调用方鉴权（业主 2026-10-22 定案：客户批量导入开放给员工账号）
 * - x-admin-token：管理员（手机号白名单），可写入共享客户库，行为同旧版
 * - x-user-token ：员工（任意已登录账号），导入的客户只挂在自己 user_id 下，只能看到自己的
 * 员工身份由 token 里的手机号反查 users 表取 id，**不信任请求体传的 user_id**（防冒用他人身份导入）。
 */
async function verifyCaller(req: Request): Promise<{ ok: boolean; phone?: string; userId?: string | null; isAdmin?: boolean; error?: string }> {
  const adminTok = req.headers.get('x-admin-token') || '';
  const userTok = req.headers.get('x-user-token') || '';

  const adminPhone = verifyAdminToken(adminTok); // 白名单校验在 lib 内
  const phone = adminPhone || verifyUserToken(userTok);
  if (!phone) {
    return { ok: false, error: adminTok || userTok ? '凭证无效或已过期，请重新登录' : '请先登录后再导入' };
  }

  // 反查 users.id，作为数据归属（user_id）
  const supabase = getSupabase();
  const { data: u } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  return { ok: true, phone, userId: u?.id ?? null, isAdmin: !!adminPhone };
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
    const caller = await verifyCaller(request);
    if (!caller.ok) {
      return NextResponse.json({ error: caller.error }, { status: 403 });
    }
    const isAdmin = !!caller.isAdmin;
    const ownerUserId = caller.userId ?? null;

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

      // 员工导入：不采用模板里的「简码/客户编号」当 customer_code
      // （该列全局唯一，两个员工用了同一个简码会互相撞车），改为自动生成 KH######，
      // 去重按 (user_id + company_name)，重复导入是更新本人那条，不会新增重复记录。
      let customerCode = isAdmin ? (item.customer_code?.trim() || '') : '';

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
        // 归属：员工导入挂自己 user_id（RLS「users read own」保证只能看自己的）；管理员导入为共享客户库
        user_id: ownerUserId,
        updated_at: new Date().toISOString(),
      };

      // 查询已存在记录：管理员按 customer_code（全局唯一）；员工按 (user_id + company_name)
      let existing: any = null;
      if (isAdmin) {
        const r = await supabase
          .from('customers')
          .select('id')
          .eq('customer_code', customerCode)
          .maybeSingle();
        existing = r.data;
      } else if (ownerUserId) {
        const r = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', ownerUserId)
          .eq('company_name', companyName)
          .maybeSingle();
        existing = r.data;
      }

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
