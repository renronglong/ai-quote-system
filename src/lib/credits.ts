/**
 * 积分服务端工具库（使用 service role client 调用）
 * 积分体系：注册赠送 / 识别消耗 / 邀请奖励 / 运营定期赠送
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const SIGNUP_BONUS_CREDITS = 100;      // 注册赠送积分
export const REFERRAL_BONUS_CREDITS = 100;    // 邀请好友注册，双方各+100
export const RECOGNIZE_COST_CREDITS = 10;     // 图纸AI识别每次消耗积分

type Client = SupabaseClient;

/** 查询用户积分余额（无记录返回0） */
export async function getCreditsBalance(client: Client, userId: string): Promise<number> {
  const { data } = await client
    .from('credit_balances')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();
  return parseFloat(data?.balance || '0');
}

/**
 * 积分入账/消费通用方法
 * @param type recharge=入账(赠送/充值) consume=消费
 * @returns 新余额；consume 余额不足时返回 null（不扣减）；失败抛错
 */
export async function changeCredits(
  client: Client,
  userId: string,
  amount: number,
  type: 'recharge' | 'consume',
  description: string
): Promise<number | null> {
  const { data: row, error: selErr } = await client
    .from('credit_balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (selErr) throw new Error(`查询积分余额失败: ${selErr.message}`);

  const current = parseFloat(row?.balance || '0');
  const newBalance = type === 'consume' ? current - amount : current + amount;

  if (type === 'consume' && newBalance < 0) return null;

  const updateData: Record<string, unknown> = {
    user_id: userId,
    balance: newBalance.toString(),
    updated_at: new Date().toISOString(),
  };
  if (type === 'recharge') {
    updateData.total_recharged = (parseFloat(row?.total_recharged || '0') + amount).toString();
  } else {
    updateData.total_consumed = (parseFloat(row?.total_consumed || '0') + amount).toString();
  }
  const { error: upErr } = await client.from('credit_balances').upsert(updateData, { onConflict: 'user_id' });
  if (upErr) throw new Error(`更新积分余额失败: ${upErr.message}`);

  const { error: insErr } = await client.from('credits').insert({
    user_id: userId,
    type,
    amount: amount.toString(),
    balance_after: newBalance.toString(),
    description,
  });
  if (insErr) throw new Error(`写入积分流水失败: ${insErr.message}`);

  return newBalance;
}
