import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCreditsBalance, changeCredits, RECOGNIZE_COST_CREDITS } from '@/lib/credits';

export const runtime = 'nodejs';

/**
 * CAD / 压缩包图纸解析成功后的统一扣积分端点。
 *
 * 背景：图片、PDF 走 /api/recognize-drawing 或 /api/recognize-sheet，这两个接口内部会扣 10 分；
 * 但 DXF/DWG/STEP/IGES/ZIP 走 /api/drawing-parse 或 /api/parse-batch（纯转发到解析服务），
 * 从不碰积分，导致这些格式一直免费。业主 2026-11-11 拍板「所有的都扣」。
 *
 * 口径：一次上传（一个文件）成功识别 = 扣 RECOGNIZE_COST_CREDITS(10) 分，与图片/PDF 一致；
 * 压缩包内多个零件/多个文件仍算一次上传；解析失败不扣（只有成功才调本接口）。
 * 「深度识别 /api/forward-cad」是对同一个已上传文件的人工补救，不重复扣。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!userId) {
      return NextResponse.json({ success: false, error: '请先登录后再使用图纸识别' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
    const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const before = await getCreditsBalance(supabase, userId);
    if (before < RECOGNIZE_COST_CREDITS) {
      return NextResponse.json(
        { success: false, error: '积分余额不足', quotaExceeded: true },
        { status: 429 },
      );
    }

    const after = await changeCredits(
      supabase,
      userId,
      RECOGNIZE_COST_CREDITS,
      'consume',
      '图纸解析消耗积分',
    );
    if (after === null) {
      return NextResponse.json(
        { success: false, error: '积分余额不足', quotaExceeded: true },
        { status: 429 },
      );
    }

    return NextResponse.json({ success: true, new_balance: after, cost: RECOGNIZE_COST_CREDITS });
  } catch (err) {
    console.error('[Charge] 扣减积分失败:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '扣减积分失败' },
      { status: 500 },
    );
  }
}
