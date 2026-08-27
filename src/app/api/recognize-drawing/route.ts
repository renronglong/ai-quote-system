import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 120;

// 豆包 API 配置
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || process.env.VOLCENGINE_API_KEY || '';
const DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-pro-260215';

// ============ 几何自动计算工具 ============

/**
 * 根据 AI 识别出的尺寸，自动估算周长/截面积/米重/外接圆/推荐模具
 * 铝合金密度默认 2.70 g/cm³ (6063)
 */
function autoComputeGeometry(params: Record<string, unknown>): Record<string, unknown> {
  const w = typeof params.width === 'number' ? params.width : null;
  const h = typeof params.height === 'number' ? params.height : null;
  const t = typeof params.wall_thickness === 'number' ? params.wall_thickness : null;
  const cav = typeof params.num_cavities === 'number' ? params.num_cavities : 0;
  const density = 2.70; // 铝合金密度 g/cm³

  const notes: string[] = [];
  const result: Record<string, unknown> = {};

  // 只有明确有空腔时才计算（cav > 0 = 有空心腔体）
  if (params.perimeter == null && w && h && t && cav >= 1) {
    // 矩形管类挤压型材（最常见）
    let cols = 1;
    let rows = 1;
    if (cav === 2) { cols = 2; rows = 1; }
    else if (cav === 3) { cols = 3; rows = 1; }
    else if (cav === 4) { cols = 2; rows = 2; }
    else if (cav === 6) { cols = 3; rows = 2; }
    else if (cav === 8) { cols = 4; rows = 2; }
    else if (cav === 9) { cols = 3; rows = 3; }
    else if (cav === 12) { cols = 4; rows = 3; }
    else {
      cols = Math.ceil(Math.sqrt(cav));
      rows = Math.ceil(cav / cols);
    }

    const innerW = w - 2 * t;
    const innerH = h - 2 * t;
    const cavityW = (innerW - (cols - 1) * t) / cols;
    const cavityH = (innerH - (rows - 1) * t) / rows;

    const outerPerimeter = 2 * (w + h);
    const innerPerimeter = cav * 2 * (cavityW + cavityH);
    const totalPerimeter = outerPerimeter + innerPerimeter;

    const outerArea = w * h;
    const cavityArea = cav * cavityW * cavityH;
    const crossSectionArea = outerArea - cavityArea;

    const meterWeight = crossSectionArea * density / 1000;

    result.perimeter = Math.round(totalPerimeter * 100) / 100;
    result.cross_section_area = Math.round(crossSectionArea * 100) / 100;
    result.meter_weight = Math.round(meterWeight * 10000) / 10000;

    const diagonal = Math.sqrt(w * w + h * h);
    result.outer_circle_diameter = Math.round(diagonal * 100) / 100;

    const recommendedDie = diagonal * 1.1 + 80;
    const standardDies = [130, 140, 160, 180, 200, 220, 250, 280, 300, 350, 400];
    const die = standardDies.find((d) => d >= recommendedDie) || standardDies[standardDies.length - 1];
    result.recommended_die = die;

    notes.push(
      `几何估算（${cols}×${rows}腔矩形管，壁厚${t}mm，密度${density}）：外周长${outerPerimeter.toFixed(1)}+内周长${innerPerimeter.toFixed(1)}=${totalPerimeter.toFixed(1)}mm；截面积${crossSectionArea.toFixed(1)}mm²；米重${meterWeight.toFixed(3)}kg/m；外接圆${diagonal.toFixed(1)}mm；推荐模具Φ${die}mm`
    );
  } else if (params.perimeter == null && w && h && cav === 0) {
    // 实心截面（无内腔），只计算外接圆和模具推荐
    // 复杂实心型材（翅片/台阶等）无法用简单矩形近似，不强行算截面积和米重
    const diagonal = Math.sqrt(w * w + h * h);
    result.outer_circle_diameter = Math.round(diagonal * 100) / 100;
    const recommendedDie = diagonal * 1.1 + 80;
    const standardDies = [130, 140, 160, 180, 200, 220, 250, 280, 300, 350, 400];
    const die = standardDies.find((d) => d >= recommendedDie) || standardDies[standardDies.length - 1];
    result.recommended_die = die;
    notes.push(`实心截面，仅计算外接圆${diagonal.toFixed(1)}mm和推荐模具Φ${die}mm；复杂实心截面无法用矩形近似，截面积和米重需人工确认`);
  }

  if (notes.length > 0) {
    const existing = typeof params.notes === 'string' ? params.notes : '';
    result.notes = existing ? `${existing}。${notes.join('；')}` : notes.join('；');
    result.geometry_auto_computed = true;
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer()) as Buffer;
    let fileName = file.name || 'drawing.png';
    let fileType = file.type || 'image/png';

    console.log(`[Recognize] 文件: ${fileName}, type: ${fileType}, size: ${buffer.length}`);

    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${fileType};base64,${base64Image}`;

    const systemPrompt = `你是铝型材工程图纸识别专家。请仔细分析这张图纸/截面图/零件图片，提取所有报价所需参数。

请逐项识别以下信息，无法确定的字段填 null：

1. product_type: extrusion(挤压型材), stamping(冲压件), die_casting(压铸件), cnc(CNC加工件), injection(注塑件)
2. material_grade: 如 6063-T5, 6061-T6, 304不锈钢, SPCC, ADC12, ABS, PP, PC, PA6, PMMA, POM
3. material_category: 铝合金, 不锈钢, 冷轧板, 压铸铝, 塑胶
4. width: 截面外形宽度mm（必须从截面轮廓视图中读取，不要将型材总长度误当宽度）
5. height: 截面外形高度mm（从截面轮廓视图中读取）
6. wall_thickness: 主要壁厚mm（如有标注）
7. length: 单根/单件长度mm（型材整体长度，通常标注在型材全貌视图上，如198.5这类大尺寸一般是长度而非宽度）
8. perimeter: 截面周长mm（图纸标注了则提取，否则null，后端会自动计算）
9. cross_section_area: 截面面积mm²（图纸标注了则提取，否则null，后端会自动计算）
10. meter_weight: 米重kg/m（注意单位：g/m需÷1000转kg/m；图纸标注了则提取，否则null，后端会自动计算）
11. num_cavities: 独立内腔数量，实心/无内腔=0，有1个独立内腔=1，有2个=2，依次递增。注意：实心截面、翅片/散热片、屏幕膜边框、台阶型材等没有内部空腔的型材，必须填0！
12. surface_treatment: 氧化本色, 氧化黑色, 阳极氧化-自然色, 粉末喷涂, 电泳, 拉丝, 抛光, 电镀, 喷砂, 无
13. processes: 加工工艺数组，如["冲压","钻孔"]，没有则[]
14. quantity: 订单数量（如有标注）
15. product_name: 产品名称（标题栏提取）
16. product_code: 产品编号/图号

必须只输出一个JSON对象，不要输出任何其他文字或markdown标记。
重要规则：
- 宽高必须从截面轮廓视图（通常是较小较详细的放大视图）中提取截面外形最大尺寸，不是内腔尺寸
- **严格区分截面尺寸和型材长度：型材总长度（如198.5等大尺寸）通常标注在整体视图上，不是截面宽度。width/height只从截面轮廓视图中读取**
- 当图纸同时显示截面视图和整体视图时，从截面视图读取width/height，从整体视图读取length
- 米重注意g/m和kg/m的换算
- **num_cavities 只数独立内腔（空洞），实心截面=0，不要混淆！**
- 实物照片尽力估算并在notes说明
- confidence为0-1的整体置信度，对实心/空心判断不确定时要降低置信度
- 周长/截面积/米重若图纸未直接标注，留 null 即可，后端会自动计算`;

    console.log(`[Recognize] 调用豆包API, model: ${DOUBAO_MODEL}`);
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
      console.error('[Recognize] 豆包API错误:', doubaoResp.status, errText);
      return NextResponse.json({ error: `AI识别服务错误: ${doubaoResp.status}` }, { status: 500 });
    }

    const doubaoResult = await doubaoResp.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    const resultContent = doubaoResult.choices?.[0]?.message?.content || '';
    if (!resultContent) {
      console.error('[Recognize] 豆包API返回空:', JSON.stringify(doubaoResult).substring(0, 500));
      return NextResponse.json({ error: 'AI识别返回为空' }, { status: 500 });
    }

    console.log(`[Recognize] 豆包返回(前300字): ${resultContent.substring(0, 300)}`);

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
      console.error('[Recognize] JSON解析失败:', e);
      return NextResponse.json({ error: '识别结果解析失败', raw_response: resultContent }, { status: 422 });
    }

    const result: Record<string, unknown> = { ...parsed };

    if (typeof result.meter_weight === 'number' && result.meter_weight > 10) {
      result.meter_weight = Math.round(result.meter_weight / 1000 * 10000) / 10000;
      result.notes = (result.notes || '') + ' [米重已从g/m转换为kg/m]';
    }

    if (typeof result.num_cavities === 'number') {
      result.die_type = result.num_cavities <= 1 ? 'flat' : 'split';
    }

    // === 几何自动计算 ===
    const geo = autoComputeGeometry(result);
    Object.assign(result, geo);

    const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
    const hasCriticalDims = typeof result.width === 'number' && typeof result.height === 'number';
    const canAutoFill = (geo.perimeter != null && hasCriticalDims) || (confidence >= 0.75 && hasCriticalDims);

    if (!canAutoFill) {
      result.needs_human = true;
      result.handoff_reason = confidence < 0.75
        ? `识别置信度${(confidence * 100).toFixed(0)}%低于阈值75%`
        : '缺少关键截面尺寸(宽/高)';
    } else {
      result.needs_human = false;
    }

    console.log(`[Recognize] 最终结果(confidence=${confidence}, autoFill=${canAutoFill}):`, JSON.stringify(result));
    return NextResponse.json({ success: true, data: result, autoFill: canAutoFill });

  } catch (err) {
    console.error('[Recognize] 异常:', err);
    return NextResponse.json({ error: '识别服务异常' }, { status: 500 });
  }
}
