/**
 * POST /api/sms/send
 *
 * 发送短信验证码接口
 *
 * 请求体：
 *   { phone: string, purpose?: string }
 *
 * 响应：
 *   成功: { success: true, message: '验证码已发送' }
 *   失败: { error: string, retryAfter?: number }
 */

import { NextResponse } from 'next/server';
import { sendVerificationCode } from '@/lib/tencent-sms';
import { generateCode, storeVerificationCode } from '@/lib/sms-store';

// ─── 手机号格式校验 ────────────────────────────────────────────
function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

// ─── 用途白名单 ───────────────────────────────────────────────
const VALID_PURPOSES = ['register', 'login', 'resetPassword'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, purpose = 'register' } = body;

    // 1. 参数校验
    if (!phone) {
      return NextResponse.json({ error: '请提供手机号' }, { status: 400 });
    }

    if (!validatePhone(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }

    if (!VALID_PURPOSES.includes(purpose)) {
      return NextResponse.json(
        { error: `无效的验证码用途，支持: ${VALID_PURPOSES.join(', ')}` },
        { status: 400 }
      );
    }

    // 2. 生成验证码
    const code = generateCode();

    // 3. 存储验证码（含频率限制检查）
    const storeResult = await storeVerificationCode(phone, code, purpose);
    if (!storeResult.success) {
      const status = storeResult.retryAfter ? 429 : 400;
      const responseBody: Record<string, unknown> = { error: storeResult.error };
      if (storeResult.retryAfter) {
        responseBody.retryAfter = storeResult.retryAfter;
      }
      return NextResponse.json(responseBody, { status });
    }

    // 4. 发送短信
    const smsResult = await sendVerificationCode(phone, code);
    if (!smsResult.success) {
      console.error('[SMS/Send] 短信发送失败:', smsResult.message);
      return NextResponse.json(
        { error: '验证码发送失败，请稍后重试' },
        { status: 500 }
      );
    }

    console.log(`[SMS/Send] 验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(-4)}, 用途: ${purpose}`);

    return NextResponse.json({
      success: true,
      message: '验证码已发送',
    });
  } catch (err) {
    console.error('[SMS/Send] 发送验证码异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
