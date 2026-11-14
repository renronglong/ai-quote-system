import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAdminFromRequest, isAdminPhone, ADMIN_PHONES } from '@/lib/admin';

// GET - 管理员查看全部用户（含积分余额、报价汇总）
export async function GET(request: NextRequest) {
  const adminPhone = getAdminFromRequest(request);
  if (!adminPhone) {
    return NextResponse.json({ success: false, error: '无管理员权限' }, { status: 403 });
  }
  try {
    const client = getSupabaseClient();
    const keyword = new URL(request.url).searchParams.get('keyword')?.trim();

    // 取全部用户（users表字段）
    let q = client.from('users').select('id,phone,company_name,address,email,created_at,invited_by');
    if (keyword) {
      q = q.or(`phone.ilike.%${keyword}%,company_name.ilike.%${keyword}%`);
    }
    const { data: users, error: uErr } = await q.order('created_at', { ascending: false });
    if (uErr) throw new Error(uErr.message);

    // 管理员账号兜底：白名单内但不在 users 表的，也纳入列表
    // （业主 11-14：管理员账号也要显示基本信息和报价）
    const existingPhones = new Set((users || []).map((u: any) => u.phone));
    const syntheticAdmins: any[] = [];
    for (const phone of ADMIN_PHONES) {
      if (!existingPhones.has(phone)) {
        syntheticAdmins.push({
          id: `admin:${phone}`,
          phone,
          company_name: '系统管理员',
          address: '',
          email: '',
          created_at: null,
          invited_by: null,
        });
      }
    }
    const allUsers = [...(users || []), ...syntheticAdmins];

    // 取全部积分余额（用户少，直接一次拉）
    const { data: balances, error: bErr } = await client
      .from('credit_balances').select('user_id,balance,total_recharged,total_consumed,updated_at');
    if (bErr) throw new Error(bErr.message);
    const balMap = new Map((balances || []).map((b: any) => [b.user_id, b]));

    // 报价汇总：仅对真实用户 id 聚合 saved_quotes 的条数与金额
    // （合成管理员无真实 user_id，报价恒为 0）
    const realIds = (users || []).map((u: any) => u.id);
    const quoteMap = new Map<string, { count: number; total: number }>();
    if (realIds.length) {
      const { data: quotes, error: qErr } = await client
        .from('saved_quotes').select('user_id, result')
        .in('user_id', realIds);
      if (qErr) throw new Error(qErr.message);
      for (const row of (quotes || []) as any[]) {
        const cur = quoteMap.get(row.user_id) || { count: 0, total: 0 };
        cur.count += 1;
        const r = row.result || {};
        const amt = Number(r.total_price ?? r.unit_price ?? 0) || 0;
        cur.total += amt;
        quoteMap.set(row.user_id, cur);
      }
    }

    const data = allUsers.map((u: any) => {
      const qa = quoteMap.get(u.id) || { count: 0, total: 0 };
      return {
        id: u.id,
        phone: u.phone,
        company_name: u.company_name || '',
        address: u.address || '',
        email: u.email || '',
        created_at: u.created_at,
        balance: balMap.get(u.id)?.balance ?? 0,
        total_recharged: balMap.get(u.id)?.total_recharged ?? 0,
        total_consumed: balMap.get(u.id)?.total_consumed ?? 0,
        quote_count: qa.count,
        quote_total: Math.round(qa.total * 100) / 100,
        is_admin: isAdminPhone(u.phone),
      };
    });

    return NextResponse.json({ success: true, admin: adminPhone, count: data.length, data });
  } catch (error) {
    console.error('admin/users 查询失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

// DELETE - 管理员删除用户（不可逆）
// query: ?id=<用户uuid>
// 前端须二次确认；后端仍做管理员校验、禁止删管理员账号/当前登录账号，并清理关联数据。
export async function DELETE(request: NextRequest) {
  const adminPhone = getAdminFromRequest(request);
  if (!adminPhone) {
    return NextResponse.json({ success: false, error: '无管理员权限' }, { status: 403 });
  }
  try {
    const userId = new URL(request.url).searchParams.get('id')?.trim();
    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少用户 id' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 目标用户必须存在
    const { data: target, error: tErr } = await client
      .from('users').select('id,phone').eq('id', userId).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 安全护栏：管理员账号、以及当前操作者自己，一律不允许删除
    if (isAdminPhone(target.phone)) {
      return NextResponse.json({ success: false, error: '管理员账号不可删除' }, { status: 400 });
    }
    if (target.phone === adminPhone) {
      return NextResponse.json({ success: false, error: '不能删除当前登录的账号' }, { status: 400 });
    }

    // 清理关联数据：逐表容错（线上表结构可能与代码不完全一致，单表失败不阻断，收集进 warnings）
    // 目的：避免外键 RESTRICT 导致主表删不掉，也避免留下孤儿数据。
    const relatedTables = [
      'credit_balances', 'credits', 'saved_quotes', 'customers',
      'recognition_logs', 'recognition_feedback', 'recognition_usage',
      'supplier_profiles', 'products', 'inquiries', 'cad_requests', 'suppliers',
    ];
    const warnings: string[] = [];
    for (const table of relatedTables) {
      const { error } = await client.from(table).delete().eq('user_id', userId);
      if (error) warnings.push(`${table}: ${error.message}`);
    }
    // 短信验证码按手机号存储，单独清理
    const { error: smsErr } = await client.from('sms_codes').delete().eq('phone', target.phone);
    if (smsErr) warnings.push(`sms_codes: ${smsErr.message}`);

    const { error: dErr } = await client.from('users').delete().eq('id', userId);
    if (dErr) {
      return NextResponse.json(
        { success: false, error: `删除失败：${dErr.message}`, warnings },
        { status: 500 }
      );
    }

    if (warnings.length) console.warn('admin/users 删除关联表告警:', warnings);
    return NextResponse.json({ success: true, phone: target.phone, warnings });
  } catch (error) {
    console.error('admin/users 删除失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
