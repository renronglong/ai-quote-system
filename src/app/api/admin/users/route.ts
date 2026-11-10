import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAdminFromRequest, isAdminPhone } from '@/lib/admin';

// GET - 管理员查看全部用户（含积分余额）
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

    // 取全部积分余额（用户少，直接一次拉）
    const { data: balances, error: bErr } = await client
      .from('credit_balances').select('user_id,balance,total_recharged,total_consumed,updated_at');
    if (bErr) throw new Error(bErr.message);
    const balMap = new Map((balances || []).map(b => [b.user_id, b]));

    const data = (users || []).map(u => ({
      id: u.id,
      phone: u.phone,
      company_name: u.company_name || '',
      address: u.address || '',
      email: u.email || '',
      created_at: u.created_at,
      balance: balMap.get(u.id)?.balance ?? 0,
      total_recharged: balMap.get(u.id)?.total_recharged ?? 0,
      total_consumed: balMap.get(u.id)?.total_consumed ?? 0,
    }));

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
