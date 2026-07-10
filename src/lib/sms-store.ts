/**
 * 验证码存储模块
 *
 * 使用 Supabase PostgreSQL 存储 SMS 验证码。
 * 设计原则：
 *   - 验证码 5 分钟过期（通过 created_at + 5min 判断）
 *   - 同一手机号 60 秒内不可重复发送
 *   - 验证码验证成功后自动删除（一次性使用）
 *   - 每个手机号最多保留最近 5 条记录（防刷）
 *
 * 依赖数据库表：sms_codes（需先执行迁移脚本）
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── 配置常量 ─────────────────────────────────────────────────
const CODE_EXPIRE_MINUTES = 5;       // 验证码有效期（分钟）
const CODE_RESEND_INTERVAL_SEC = 60; // 重发间隔（秒）
const MAX_CODES_PER_PHONE = 5;       // 单号最大未使用验证码数

// ─── Supabase 客户端 ───────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseClient(): SupabaseClient {
  if (!supabaseServiceKey) {
    throw new Error('Supabase service role key 未配置');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── 生成6位数字验证码 ────────────────────────────────────────
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── 存储验证码 ───────────────────────────────────────────────
export interface StoreCodeResult {
  success: boolean;
  error?: string;
  retryAfter?: number; // 剩余冷却秒数
}

/**
 * 将验证码存入数据库
 * @param phone 手机号
 * @param code 验证码
 * @param purpose 用途（register / login / resetPassword）
 */
export async function storeVerificationCode(
  phone: string,
  code: string,
  purpose: string = 'register'
): Promise<StoreCodeResult> {
  const supabase = getSupabaseClient();

  // 1. 检查60秒冷却期
  const { data: recentCode } = await supabase
    .from('sms_codes')
    .select('created_at')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentCode) {
    const elapsed = (Date.now() - new Date(recentCode.created_at).getTime()) / 1000;
    if (elapsed < CODE_RESEND_INTERVAL_SEC) {
      return {
        success: false,
        error: '发送过于频繁，请稍后再试',
        retryAfter: Math.ceil(CODE_RESEND_INTERVAL_SEC - elapsed),
      };
    }
  }

  // 2. 清理该手机号过期的旧验证码
  const expireThreshold = new Date(Date.now() - CODE_EXPIRE_MINUTES * 60 * 1000).toISOString();
  await supabase
    .from('sms_codes')
    .delete()
    .eq('phone', phone)
    .lt('created_at', expireThreshold);

  // 3. 检查未使用的验证码数量（防刷）
  const { count } = await supabase
    .from('sms_codes')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('used', false);

  if (count !== null && count >= MAX_CODES_PER_PHONE) {
    return {
      success: false,
      error: '验证码发送次数过多，请稍后再试',
    };
  }

  // 4. 插入新验证码
  const { error } = await supabase
    .from('sms_codes')
    .insert({
      phone,
      code,
      purpose,
      used: false,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[SMSStore] 存储验证码失败:', error);
    return {
      success: false,
      error: '验证码存储失败',
    };
  }

  return { success: true };
}

// ─── 验证验证码 ───────────────────────────────────────────────
export interface VerifyCodeResult {
  success: boolean;
  error?: string;
}

/**
 * 验证用户输入的验证码
 * @param phone 手机号
 * @param code 用户输入的验证码
 * @param purpose 用途
 */
export async function verifyCode(
  phone: string,
  code: string,
  purpose: string = 'register'
): Promise<VerifyCodeResult> {
  const supabase = getSupabaseClient();

  // 1. 查找未使用且未过期的验证码
  const expireThreshold = new Date(Date.now() - CODE_EXPIRE_MINUTES * 60 * 1000).toISOString();

  const { data: record, error: queryError } = await supabase
    .from('sms_codes')
    .select('id, code, created_at')
    .eq('phone', phone)
    .eq('code', code)
    .eq('purpose', purpose)
    .eq('used', false)
    .gte('created_at', expireThreshold)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError) {
    console.error('[SMSStore] 查询验证码失败:', queryError);
    return { success: false, error: '验证失败，请重试' };
  }

  if (!record) {
    return { success: false, error: '验证码错误或已过期' };
  }

  // 2. 标记为已使用（一次性验证码）
  const { error: updateError } = await supabase
    .from('sms_codes')
    .update({ used: true })
    .eq('id', record.id);

  if (updateError) {
    console.error('[SMSStore] 标记验证码已用失败:', updateError);
    // 验证通过但标记失败不应阻止流程，仅记录日志
  }

  return { success: true };
}

// ─── 清理过期验证码（可由定时任务调用）─────────────────────────
export async function cleanupExpiredCodes(): Promise<number> {
  const supabase = getSupabaseClient();
  const expireThreshold = new Date(Date.now() - CODE_EXPIRE_MINUTES * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('sms_codes')
    .delete({ count: 'exact' })
    .lt('created_at', expireThreshold);

  if (error) {
    console.error('[SMSStore] 清理过期验证码失败:', error);
    return 0;
  }

  return count || 0;
}
