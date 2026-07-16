/**
 * POST /api/sms/verify
 *
 * 验证短信验证码接口
 *
 * 请求体：
 *   { phone: string, code: string, purpose?: string }
 *
 * 响应：
 *   成功: { success: true, message: '验证成功' }
 *   失败: { success: false, error: string }
 */

import { NextResponse } from 'next/server';
import { verifyCode } from '@/lib/sms-store';

// ─── 手机号格式校验 ────────────────────────────────────────────
function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

// ─── 用途白名单 ───────────────────────────────────────────────
const VALID_PURPOSES = ['register', 'login', 'resetPassword'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, code, purpose = 'register' } = body;

    // 1. 参数校验
    if (!phone) {
      return NextResponse.json({ success: false, error: '请提供手机号' }, { status: 400 });
    }

    if (!validatePhone(phone)) {
      return NextResponse.json({ success: false, error: '请输入正确的手机号' }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ success: false, error: '请提供验证码' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, error: '验证码格式不正确' }, { status: 400 });
    }

    if (!VALID_PURPOSES.includes(purpose)) {
      return NextResponse.json(
        { success: false, error: `无效的验证码用途，支持: ${VALID_PURPOSES.join(', ')}` },
        { status: 400 }
      );
    }

    // 2. 万能验证码（测试模式）
    const isTestMode = !process.env.TENCENT_SMS_SECRET_ID;
    if (isTestMode && code === '888888') {
      console.log(`[SMS/Verify] 万能验证码通过(测试模式): ${phone}, 用途: ${purpose}`);
      return NextResponse.json({ success: true, message: '验证成功' });
    }

    // 3. 验证验证码
    const result = await verifyCode(phone, code, purpose);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    console.log(`[SMS/Verify] 验证码验证成功: ${phone.slice(0, 3)}****${phone.slice(-4)}, 用途: ${purpose}`);

    return NextResponse.json({
      success: true,
      message: '验证成功',
    });
  } catch (err) {
    console.error('[SMS/Verify] 验证码验证异常:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
