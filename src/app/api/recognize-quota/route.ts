import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCreditsBalance, RECOGNIZE_COST_CREDITS } from '@/lib/credits';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

    const balance = await getCreditsBalance(supabase, userId);

    return NextResponse.json({
      success: true,
      balance,
      remaining: Math.floor(balance / RECOGNIZE_COST_CREDITS),
      cost_per_recognition: RECOGNIZE_COST_CREDITS,
    });
  } catch (err) {
    console.error('[Quota] 异常:', err);
    return NextResponse.json({ error: '查询积分失败' }, { status: 500 });
  }
}
