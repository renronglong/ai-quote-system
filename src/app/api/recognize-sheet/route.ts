import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCreditsBalance, changeCredits, RECOGNIZE_COST_CREDITS } from '@/lib/credits';
export const runtime = 'nodejs';
export const maxDuration = 120;

// 豆包 API 配置
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || process.env.VOLCENGINE_API_KEY || '';
const DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-pro-260215';

// K因子（折弯补偿系数），按材料类型
const K_FACTOR: Record<string, number> = {
  '铝板': 0.33,
  '不锈钢': 0.38,
  '冷轧板': 0.35,
  '镀锌板': 0.35,
  '热轧板': 0.35,
};

/**
 * 计算折弯件的展开尺寸
 * @param sections 各段直线尺寸数组 (mm)
 * @param bendAngles 每个折弯的角度数组 (度)，默认90°
 * @param thickness 板厚 (mm)
 * @param bendRadius 内弯曲半径 (mm)，默认等于板厚
 * @param materialCategory 材料类别，用于选K因子
 * @param width 宽度方向尺寸 (mm)，无折弯时的横向尺寸
 */
function computeUnfold(params: {
  sections?: number[];
  bendAngles?: number[];
  thickness: number;
  bendRadius?: number;
  materialCategory?: string;
  width?: number;
}) {
  const {
    sections = [],
    bendAngles = [],
    thickness,
    bendRadius,
    materialCategory,
    width,
  } = params;

  const R = bendRadius ?? thickness; // 内R默认=板厚
  const K = K_FACTOR[materialCategory || ''] ?? 0.35; // 默认K因子

  const result: Record<string, unknown> = {};
  const details: string[] = [];

  if (sections.length >= 2) {
    // 有折弯段：展开长度 = 各段之和 + 折弯补偿
    const straightSum = sections.reduce((a, b) => a + b, 0);
    const numBends = Math.max(bendAngles.length, sections.length - 1);
    let bendCompensation = 0;

    const bendDetails: string[] = [];
    for (let i = 0; i < numBends; i++) {
      const angle = bendAngles[i] ?? 90; // 默认90°
      const compensation = (Math.PI / 180) * angle * (R + K * thickness);
      bendCompensation += compensation;
      bendDetails.push(`${angle}°→${compensation.toFixed(2)}mm`);
    }

    const unfoldLength = straightSum + bendCompensation;
    result.unfold_length = Math.round(unfoldLength * 100) / 100;
    result.unfold_width = width ?? Math.max(...sections.filter((_, i) => i % 2 === 1).length > 0 ? sections.filter((_, i) => i % 2 === 1) : [width ?? sections[sections.length - 1]]);

    details.push(`各段: [${sections.join('+')}]mm=${straightSum}mm`);
    details.push(`折弯补偿(${numBends}刀): ${bendDetails.join('+')}=${bendCompensation.toFixed(2)}mm`);
    details.push(`K=${K}, 内R=${R}mm, 板厚=${thickness}mm`);
    details.push(`展开尺寸: ${result.unfold_length}×${result.unfold_width}mm`);
  } else {
    // 无折弯，简单矩形板
    const L = sections[0] ?? null;
    const W = width ?? null;
    if (L && W) {
      result.unfold_length = L;
      result.unfold_width = W;
      details.push(`简单矩形板，无折弯`);
      details.push(`展开尺寸: ${L}×${W}mm`);
    }
  }

  // 周长（用于激光切割计费）
  if (result.unfold_length && result.unfold_width) {
    result.perimeter = Math.round(2 * ((result.unfold_length as number) + (result.unfold_width as number)) * 100) / 100;
    result.area_mm2 = (result.unfold_length as number) * (result.unfold_width as number);
    result.area_m2 = Math.round(result.area_mm2 as number / 1000000 * 10000) / 10000;
  }

  // 理论重量
  if (result.unfold_length && result.unfold_width) {
    const densityMap: Record<string, number> = {
      '铝板': 2.70, '不锈钢': 7.93, '冷轧板': 7.85, '镀锌板': 7.85, '热轧板': 7.85,
    };
    const density = densityMap[materialCategory || ''] ?? 2.70;
    const weightKg = ((result.unfold_length as number) / 1000) * ((result.unfold_width as number) / 1000) * (thickness / 1000) * density * 1000;
    result.theoretical_weight_kg = Math.round(weightKg * 1000) / 1000;
  }

  result.unfold_detail = details.join('；');
  return result;
}

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

    const systemPrompt = `你是钣金/冲压件工程图纸识别专家。请仔细分析这张板材零件图纸/展开图/零件照片，提取所有报价所需的原始参数。

【核心原则】你只负责提取原始参数，展开尺寸由后端自动计算，你不需要计算展开尺寸。

【尺寸识别规则 - 最重要】
1. 首先判断图纸是否有折弯：
   - 无折弯（平板/异形轮廓件）：直接填 length=外轮廓最大长边, width=外轮廓最大短边。忽略孔、槽、凸耳等内部特征对尺寸的影响。
   - 有折弯：按展开方向识别各段直线尺寸填入 sections，width 填垂直于展开方向的宽度。
2. 对于不规则外形（带凸耳、缺口、异形边）：以能包围整个零件的最小矩形外轮廓为准。
3. 优先读取图纸上标注的尺寸数字，不要自己测量图片像素估算。

请逐项识别以下信息，无法确定的字段填 null：

1. material_grade: 材质牌号，如 5052-H32、6061-T6、304不锈钢、SPCC、SGCC、DC01、Q235
2. material_category: 材料类别，取值之一：铝板、不锈钢、冷轧板、镀锌板、热轧板
3. thickness: 板材厚度mm（通常标注在侧视图或技术要求中，如 t=2.0、S=1.5）
4. length: 零件外轮廓最大长度mm（无折弯件必填！）
5. width: 零件外轮廓最大宽度mm（无折弯件必填！）
6. sections: 仅折弯件需要 — 各段直线尺寸数组(mm)，按展开方向列出。
   - 无折弯件填 null 或 []
   - 有折弯件：例如L形件竖直段30mm+水平段50mm → [30, 50]
7. bend_angles: 每个折弯的角度数组(度)，无折弯填 []，有折弯默认90°
8. bend_radius: 内弯曲半径mm（图纸标注了则提取，否则填 null，后端默认取板厚）
9. surface_treatment: 表面处理，如 氧化本色、氧化黑色、粉末喷涂、电镀、拉丝、钝化、无
10. processes: 加工工艺数组，可能的值：["激光切割","冲压落料","折弯","钻孔","攻牙","去毛刺","打磨","焊接","铆接"]
11. hole_count: 孔的数量
12. bend_count: 折弯数量
13. quantity: 订单数量（如有标注）
14. product_name: 产品名称（标题栏提取）
15. product_code: 产品编号/图号
16. tolerance: 关键公差（如有标注）
17. notes: 其他技术要求的文字说明

必须只输出一个JSON对象，不要输出任何其他文字或markdown标记。

重要规则：
- length 和 width 是材料费计算的关键！必须取零件外轮廓的最大尺寸
- 图纸上标注的尺寸数字优先于视觉估算
- 对于带凸耳/凸出/缺口的异形件，外轮廓尺寸 = 能包围零件的最小矩形
- 不要把凸耳长度当成零件主尺寸，不要把零件主尺寸当成凸耳尺寸
- thickness 是板材厚度
- confidence 为 0-1 的整体置信度`;

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

    console.log(`[RecognizeSheet] 豆包返回(前500字): ${resultContent.substring(0, 500)}`);

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

    // ===== 展开尺寸计算 =====
    const parsedLength = typeof parsed.length === 'number' ? parsed.length
      : (typeof parsed.length === 'string' ? parseFloat(parsed.length) : NaN);
    const parsedWidth = typeof parsed.width === 'number' ? parsed.width
      : (typeof parsed.width === 'string' ? parseFloat(parsed.width) : NaN);
    const thickness = typeof parsed.thickness === 'number' ? parsed.thickness
      : (typeof parsed.thickness === 'string' ? parseFloat(parsed.thickness) : NaN);

    if (!isNaN(thickness) && thickness > 0) {
      const sections = Array.isArray(parsed.sections) ? parsed.sections.map(Number).filter(n => !isNaN(n) && n > 0) : [];
      const bendAngles = Array.isArray(parsed.bend_angles) ? parsed.bend_angles.map(Number).filter(n => !isNaN(n) && n > 0) : [];
      const bendRadius = typeof parsed.bend_radius === 'number' ? parsed.bend_radius : undefined;
      const width = !isNaN(parsedWidth) ? parsedWidth : undefined;

      if (sections.length >= 2) {
        // 有折弯件：走展开计算
        const unfold = computeUnfold({
          sections,
          bendAngles,
          thickness,
          bendRadius,
          materialCategory: parsed.material_category as string,
          width,
        });
        Object.assign(parsed, unfold);
        console.log(`[RecognizeSheet] 折弯件展开计算: ${JSON.stringify(unfold)}`);
      } else if (!isNaN(parsedLength) && parsedLength > 0 && !isNaN(parsedWidth) && parsedWidth > 0) {
        // 无折弯平板件：AI直接返回了 length + width，直接使用
        parsed.unfold_length = parsedLength;
        parsed.unfold_width = parsedWidth;
        parsed.perimeter = Math.round(2 * (parsedLength + parsedWidth) * 100) / 100;
        const areaMm2 = parsedLength * parsedWidth;
        parsed.area_mm2 = areaMm2;
        parsed.area_m2 = Math.round(areaMm2 / 1000000 * 10000) / 10000;
        const densityMap: Record<string, number> = {
          '铝板': 2.70, '不锈钢': 7.93, '冷轧板': 7.85, '镀锌板': 7.85, '热轧板': 7.85,
        };
        const density = densityMap[String(parsed.material_category || '')] ?? 2.70;
        const weightKg = (parsedLength / 1000) * (parsedWidth / 1000) * (thickness / 1000) * density * 1000;
        parsed.theoretical_weight_kg = Math.round(weightKg * 1000) / 1000;
        parsed.unfold_detail = `无折弯平板，外轮廓 ${parsedLength}×${parsedWidth}mm`;
        console.log(`[RecognizeSheet] 平板件直接使用: ${parsedLength}×${parsedWidth}mm`);
      } else if (sections.length === 1 && width) {
        // 单段+宽度
        const unfold = computeUnfold({
          sections: [sections[0], width],
          bendAngles: [],
          thickness,
          bendRadius,
          materialCategory: parsed.material_category as string,
          width,
        });
        Object.assign(parsed, unfold);
        console.log(`[RecognizeSheet] 单段展开: ${JSON.stringify(unfold)}`);
      }
    }

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const hasUnfold = parsed.unfold_length != null && parsed.unfold_width != null;
    const canAutoFill = hasUnfold && confidence >= 0.7;

    if (!canAutoFill) {
      parsed.needs_human = true;
      parsed.handoff_reason = confidence < 0.7
        ? `识别置信度${(confidence * 100).toFixed(0)}%低于阈值70%`
        : '无法计算展开尺寸，缺少关键尺寸参数';
    } else {
      parsed.needs_human = false;
    }

    console.log(`[RecognizeSheet] 最终结果(confidence=${confidence}, autoFill=${canAutoFill}):`, JSON.stringify(parsed));

    // ===== 扣减积分 + 记录识别日志 =====
    await changeCredits(supabase, userId, RECOGNIZE_COST_CREDITS, 'consume', '板材图纸AI识别消耗积分');

    const { data: logData } = await supabase
      .from("recognition_logs")
      .insert({
        user_id: userId,
        file_name: fileName,
        ai_result: parsed,
      })
      .select('id')
      .single();

    return NextResponse.json({
      success: true,
      data: parsed,
      autoFill: canAutoFill,
      recognition_id: logData?.id || null,
      new_balance: balanceBefore - RECOGNIZE_COST_CREDITS
    });

  } catch (err) {
    console.error('[RecognizeSheet] 异常:', err);
    return NextResponse.json({ error: '识别服务异常' }, { status: 500 });
  }
}
