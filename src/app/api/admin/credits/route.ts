import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAdminFromRequest } from '@/lib/admin';
import { changeCredits } from '@/lib/credits';

// POST - 管理员赠送/扣除积分
// body: { user_id, amount(正数赠送/负数扣除), remark }
export async function POST(request: NextRequest) {
  const adminPhone = getAdminFromRequest(request);
  if (!adminPhone) {
    return NextResponse.json({ success: false, error: '无管理员权限' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const userId: string = body.user_id;
    const amount: number = Number(body.amount);
    const remark: string = (body.remark || '').toString().slice(0, 100);

    if (!userId || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ success: false, error: '参数错误：user_id 和 amount(非0) 必填' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 校验用户存在
    const { data: userRow, error: uErr } = await client
      .from('users').select('id,phone').eq('id', userId).maybeSingle();
    if (uErr) throw new Error(uErr.message);
    if (!userRow) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });

    if (amount > 0) {
      const newBalance = await changeCredits(client, userId, amount, 'recharge',
        `管理员赠送积分${remark ? '：' + remark : ''}（操作人${adminPhone}）`);
      if (newBalance === null) throw new Error('入账失败');
      return NextResponse.json({ success: true, balance: newBalance });
    } else {
      const deduct = Math.abs(amount);
      const newBalance = await changeCredits(client, userId, deduct, 'consume',
        `管理员扣除积分${remark ? '：' + remark : ''}（操作人${adminPhone}）`);
      if (newBalance === null) {
        return NextResponse.json({ success: false, error: '用户余额不足，无法扣除' }, { status: 400 });
      }
      return NextResponse.json({ success: true, balance: newBalance });
    }
  } catch (error) {
    console.error('admin/credits 操作失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
