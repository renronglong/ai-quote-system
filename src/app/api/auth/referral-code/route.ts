import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 为没有推荐码的老用户兜底生成推荐码（登录后点击"复制邀请链接"时按需调用）
export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: queryError } = await supabase
      .from('users')
      .select('id, referral_code')
      .eq('id', user_id)
      .single();

    if (queryError || !userData) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    let code = userData.referral_code;

    if (!code) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = Array.from({ length: 8 }, () =>
          chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');
        const { data: dup } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', candidate)
          .maybeSingle();
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        return NextResponse.json({ error: '推荐码生成失败，请稍后重试' }, { status: 500 });
      }
      const { error: updateError } = await supabase
        .from('users')
        .update({ referral_code: code })
        .eq('id', user_id);
      if (updateError) {
        console.error('[ReferralCode] 更新失败:', updateError);
        return NextResponse.json({ error: '推荐码保存失败' }, { status: 500 });
      }
    }

    const origin = request.headers.get('origin') || 'https://www.gyparts.cn';
    return NextResponse.json({
      success: true,
      referral_code: code,
      referral_link: `${origin}/register?ref=${code}`,
    });
  } catch (err) {
    console.error('[ReferralCode] 异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
