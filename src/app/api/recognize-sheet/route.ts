import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCreditsBalance, changeCredits, RECOGNIZE_COST_CREDITS } from '@/lib/credits';
export const runtime = 'nodejs';
export const maxDuration = 120;

// 豆包 API 配置
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || process.env.VOLCENGINE_API_KEY || '';
const DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-pro-260215';

export async function POST(request: NextRequest) {
  try {
    // ===== 登录 + 额度校验 =====
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "请先登录后再使用图纸识别" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jotgxnhueagbsvfeepic.supabase.co";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ===== 积分校验 =====
    const balanceBefore = await getCreditsBalance(supabase, userId);
    if (balanceBefore < RECOGNIZE_COST_CREDITS) {
      return NextResponse.json({ error: "积分余额不足", quotaExceeded: true }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer()) as Buffer;
    let fileName = file.name || 'sheet_drawing.png';
    let fileType = file.type || 'image/png';

    console.log(`[RecognizeSheet] 文件: ${fileName}, type: ${fileType}, size: ${buffer.length}`);

    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${fileType};base64,${base64Image}`;

    const systemPrompt = `你是钣金/冲压件工程图纸识别专家。请仔细分析这张板材零件图纸/展开图/零件照片，提取所有报价所需参数。

板材零件特点：
- 通常是平板状金属件，由板材切割/冲压/折弯而成
- 可能有展开图（显示平板下料尺寸）或折弯后的立体视图
- 可能有孔、槽、缺口、圆角等特征
- 需要识别展开后的外形尺寸（用于材料排版计费）

请逐项识别以下信息，无法确定的字段填 null：

1. sheet_length: 展开长度mm（板材长边尺寸，从展开图或零件视图读取）
2. sheet_width: 展开宽度mm（板材短边尺寸，从展开图或零件视图读取）
3. thickness: 板材厚度mm（通常标注在侧视图或技术要求中，如 t=2.0、S=1.5）
4. material_grade: 材质牌号，如 5052-H32、6061-T6、304不锈钢、SPCC、SGCC、DC01、Q235
5. material_category: 材料类别，取值之一：铝板、不锈钢、冷轧板、镀锌板、热轧板
6. surface_treatment: 表面处理，如 氧化本色、氧化黑色、粉末喷涂、电镀、拉丝、钝化、无
7. processes: 加工工艺数组，可能的值：["激光切割","冲压落料","折弯","钻孔","攻牙","去毛刺","打磨","焊接","铆接"]。根据图纸特征判断：
   - 有折弯线或折弯视图 → 包含"折弯"
   - 有圆孔标注 → 包含"冲孔"或"钻孔"
   - 有螺纹标注 → 包含"攻牙"
   - 有焊接符号 → 包含"焊接"
   - 外形为简单轮廓 → 可能"冲压落料"
   - 外形复杂或图纸标注"激光" → "激光切割"
8. hole_count: 孔的数量（如果图纸能数出来的话）
9. bend_count: 折弯数量（如果有折弯线或折弯视图）
10. bend_length: 折弯线总长度mm（所有折弯线长度之和，用于折弯计费）
11. quantity: 订单数量（如有标注）
12. product_name: 产品名称（标题栏提取）
13. product_code: 产品编号/图号
14. tolerance: 关键公差（如有标注，如 ±0.1）
15. notes: 其他技术要求的文字说明

必须只输出一个JSON对象，不要输出任何其他文字或markdown标记。

重要规则：
- sheet_length 和 sheet_width 是展开后的外形尺寸，用于计算材料排版和理论重量
- 如果图纸是折弯后的零件视图，需要估算展开尺寸（根据折弯展开公式）
- thickness 是板材厚度，不是零件的某个方向尺寸
- material_category 根据材质牌号推断：5xxx/6xxx系铝合金→铝板，304/316→不锈钢，SPCC/DC01/冷轧→冷轧板，SGCC/镀锌→镀锌板，Q235→热轧板
- 如果图纸是照片而非工程图，尽力估算并在 notes 说明
- confidence 为 0-1 的整体置信度
- 如果识别到明确的展开尺寸和厚度，confidence 应≥0.8`;

    console.log(`[RecognizeSheet] 调用豆包API, model: ${DOUBAO_MODEL}`);
    const doubaoResp = await fetch(`${DOUBAO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DOUBAO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DOUBAO_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!doubaoResp.ok) {
      const errText = await doubaoResp.text();
      console.error('[RecognizeSheet] 豆包API错误:', doubaoResp.status, errText);
      return NextResponse.json({ error: `AI识别服务错误: ${doubaoResp.status}` }, { status: 500 });
    }

    const doubaoResult = await doubaoResp.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    const resultContent = doubaoResult.choices?.[0]?.message?.content || '';
    if (!resultContent) {
      console.error('[RecognizeSheet] 豆包API返回空:', JSON.stringify(doubaoResult).substring(0, 500));
      return NextResponse.json({ error: 'AI识别返回为空' }, { status: 500 });
    }

    console.log(`[RecognizeSheet] 豆包返回(前300字): ${resultContent.substring(0, 300)}`);

    let parsed: Record<string, unknown>;
    try {
      let clean = resultContent.trim();
      if (clean.startsWith('```json')) clean = clean.slice(7);
      if (clean.startsWith('```')) clean = clean.slice(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }
      parsed = JSON.parse(clean.trim());
    } catch (e) {
      console.error('[RecognizeSheet] JSON解析失败:', e);
      return NextResponse.json({ error: '识别结果解析失败', raw_response: resultContent }, { status: 422 });
    }

    const result: Record<string, unknown> = { ...parsed };

    // === 板材几何自动计算 ===
    const sheetL = typeof result.sheet_length === 'number' ? result.sheet_length : null;
    const sheetW = typeof result.sheet_width === 'number' ? result.sheet_width : null;
    const thick = typeof result.thickness === 'number' ? result.thickness : null;

    if (sheetL && sheetW) {
      // 计算周长（用于激光切割计费）
      result.perimeter = Math.round(2 * (sheetL + sheetW) * 100) / 100;
      // 计算面积（用于表面处理计费）
      result.area_mm2 = sheetL * sheetW;
      result.area_m2 = Math.round(sheetL * sheetW / 1000000 * 10000) / 10000;
    }

    // 计算理论重量
    if (sheetL && sheetW && thick) {
      // 根据材质类别选择密度
      const matCat = result.material_category as string;
      let density = 2.70; // 默认铝
      if (matCat === '不锈钢') density = 7.93;
      else if (matCat === '冷轧板' || matCat === '热轧板') density = 7.85;
      else if (matCat === '镀锌板') density = 7.85;

      const weightKg = (sheetL / 1000) * (sheetW / 1000) * (thick / 1000) * density * 1000;
      result.theoretical_weight_kg = Math.round(weightKg * 1000) / 1000;
    }

    const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
    const hasCriticalDims = typeof result.sheet_length === 'number' && typeof result.sheet_width === 'number' && typeof result.thickness === 'number';
    const canAutoFill = hasCriticalDims && confidence >= 0.7;

    if (!canAutoFill) {
      result.needs_human = true;
      result.handoff_reason = confidence < 0.7
        ? `识别置信度${(confidence * 100).toFixed(0)}%低于阈值70%`
        : '缺少关键尺寸(展开长/宽/厚度)';
    } else {
      result.needs_human = false;
    }

    console.log(`[RecognizeSheet] 最终结果(confidence=${confidence}, autoFill=${canAutoFill}):`, JSON.stringify(result));

    // ===== 扣减积分 + 记录识别日志 =====
    await changeCredits(supabase, userId, RECOGNIZE_COST_CREDITS, 'consume', '板材图纸AI识别消耗积分');

    const { data: logData } = await supabase
      .from("recognition_logs")
      .insert({
        user_id: userId,
        file_name: fileName,
        ai_result: result,
      })
      .select('id')
      .single();

    return NextResponse.json({
      success: true,
      data: result,
      autoFill: canAutoFill,
      recognition_id: logData?.id || null,
      new_balance: balanceBefore - RECOGNIZE_COST_CREDITS
    });

  } catch (err) {
    console.error('[RecognizeSheet] 异常:', err);
    return NextResponse.json({ error: '识别服务异常' }, { status: 500 });
  }
}
