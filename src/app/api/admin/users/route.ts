import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAdminFromRequest } from '@/lib/admin';

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
