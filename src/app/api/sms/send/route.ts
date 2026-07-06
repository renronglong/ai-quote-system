import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创建 Supabase 服务端客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://br-lush-teal-829ebb2c.supabase2.aidap-global.cn-beijing.volces.com';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNjA2MjY2ODUsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.bQyLDE94ExM0a31w640N0GPzg0ppRJu_-z12vR1RLhY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 验证码存储（生产环境应使用Redis）
const verificationCodes = new Map<string, { code: string; expires: number }>();

// ========== 临时测试账号白名单 ==========
// TODO: 上线前删除测试账号！腾讯云短信签名报备通过后需移除此白名单
const TEST_PHONE = '13800138000';
const TEST_CODE = '888888';
// ========================================

function generateCode(): string {
  // 生成6位数字验证码
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export async function POST(request: NextRequest) {
  try {
    const { phone, type } = await request.json();

    // 验证手机号格式
    if (!validatePhone(phone)) {
      return NextResponse.json(
        { error: '请输入正确的手机号' },
        { status: 400 }
      );
    }

    // 验证类型
    if (!['register', 'reset_password', 'login'].includes(type)) {
      return NextResponse.json(
        { error: '无效的验证类型' },
        { status: 400 }
      );
    }

    // 如果是注册类型，检查手机号是否已存在
    if (type === 'register') {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (existingUser) {
        return NextResponse.json(
          { error: '该手机号已注册' },
          { status: 400 }
        );
      }
    }

    // ========== 临时测试账号白名单 ==========
    // TODO: 上线前删除测试账号！
    if (phone === TEST_PHONE) {
      const code = TEST_CODE;
      const expires = Date.now() + 10 * 60 * 1000;
      verificationCodes.set(phone, { code, expires });
      
      console.log(`[SMS] 测试账号验证码 ${code} 已发送至 ${phone}`);
      
      // 测试账号始终返回验证码，方便测试
      return NextResponse.json({
        success: true,
        message: '验证码已发送',
        devCode: code
      });
    }
    // ========================================

    // 生成验证码
    const code = generateCode();
    const expires = Date.now() + 10 * 60 * 1000; // 10分钟过期

    // 存储验证码
    verificationCodes.set(phone, { code, expires });

    // 占位：实际应调用腾讯云短信API发送验证码
    // 腾讯云短信报备中，预留接口
    // const tencentCloudResult = await sendSMS(phone, code);
    
    console.log(`[SMS] 验证码 ${code} (类型: ${type}) 已发送至 ${phone}`);
    console.log('[SMS] 注意: 腾讯云短信报备中，当前为模拟发送');

    // 开发环境返回验证码以便测试
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        success: true,
        message: '验证码已发送',
        devCode: code // 仅开发环境
      });
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送'
    });

  } catch (error) {
    console.error('[SMS] 发送验证码失败:', error);
    return NextResponse.json(
      { error: '验证码发送失败，请稍后重试' },
      { status: 500 }
    );
  }
}

// 验证验证码（供其他路由调用）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  const code = searchParams.get('code');

  if (!phone || !code) {
    return NextResponse.json(
      { error: '缺少参数' },
      { status: 400 }
    );
  }

  // ========== 临时测试账号白名单 ==========
  // TODO: 上线前删除测试账号！
  if (phone === TEST_PHONE && code === TEST_CODE) {
    return NextResponse.json({ valid: true });
  }
  // ========================================

  const stored = verificationCodes.get(phone);

  if (!stored) {
    return NextResponse.json(
      { valid: false, error: '验证码不存在或已过期' },
      { status: 400 }
    );
  }

  if (Date.now() > stored.expires) {
    verificationCodes.delete(phone);
    return NextResponse.json(
      { valid: false, error: '验证码已过期' },
      { status: 400 }
    );
  }

  if (stored.code !== code) {
    return NextResponse.json(
      { valid: false, error: '验证码错误' },
      { status: 400 }
    );
  }

  // 验证成功后删除验证码
  verificationCodes.delete(phone);

  return NextResponse.json({ valid: true });
}
