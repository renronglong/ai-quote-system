/**
 * 验证码中间件工具
 *
 * 提供 Next.js API Route 中常用的验证码校验辅助函数，
 * 可被注册、登录、重置密码等路由调用。
 */

import { verifyCode } from '@/lib/sms-store';

/**
 * 在注册流程中校验验证码
 * 可直接在 signup route 中调用，替代原先未实现的 verifyCode 参数
 */
export async function verifySmsCodeForSignup(
  phone: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const result = await verifyCode(phone, code, 'register');
  if (!result.success) {
    return { valid: false, error: result.error || '验证码校验失败' };
  }
  return { valid: true };
}

/**
 * 在重置密码流程中校验验证码
 */
export async function verifySmsCodeForResetPassword(
  phone: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const result = await verifyCode(phone, code, 'resetPassword');
  if (!result.success) {
    return { valid: false, error: result.error || '验证码校验失败' };
  }
  return { valid: true };
}

/**
 * 在登录流程中校验验证码（短信验证码登录场景）
 */
export async function verifySmsCodeForLogin(
  phone: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const result = await verifyCode(phone, code, 'login');
  if (!result.success) {
    return { valid: false, error: result.error || '验证码校验失败' };
  }
  return { valid: true };
}
