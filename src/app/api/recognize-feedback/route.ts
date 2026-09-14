import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/recognize-feedback
 * 记录 AI 识别值 vs 用户最终确认值，用于积累训练数据
 */
export async function POST(request: NextRequest) {
  try {
    const { recognition_id, ai_values, user_confirmed_values, user_id } = await request.json();

    if (!recognition_id || !ai_values || !user_confirmed_values) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase.from('recognition_feedback').insert({
      recognition_id,
      ai_values,
      user_confirmed_values,
      user_id: user_id || null,
    });

    if (error) {
      console.error('[Feedback] 写入失败:', error);
      return NextResponse.json({ error: '反馈记录失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Feedback] 异常:', err);
    return NextResponse.json({ error: '服务器异常' }, { status: 500 });
  }
}
