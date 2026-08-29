import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DAILY_LIMIT = 10; // 每日免费识别次数

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const today = new Date().toISOString().split('T')[0];

    const { data: usage } = await supabase
      .from('recognition_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const used = usage?.used_count || 0;
    const bonus = usage?.bonus_count || 0;
    const remaining = Math.max(0, DAILY_LIMIT + bonus - used);

    return NextResponse.json({
      success: true,
      used,
      bonus,
      remaining,
      daily_limit: DAILY_LIMIT,
    });
  } catch (err) {
    console.error('[Quota] 异常:', err);
    return NextResponse.json({ error: '查询额度失败' }, { status: 500 });
  }
}
