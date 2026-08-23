import { NextRequest, NextResponse } from 'next/server';
import { pdfFirstPageToPng } from '@/lib/pdf-to-image';

export async function POST(request: NextRequest) {
  try {
    const apiToken = process.env.COZE_API_TOKEN;
    const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
    // 图纸识别专用Bot（与报价Bot不同，报价Bot的prompt是参数收集器不做识别）
    const botId = process.env.COZE_RECOG_BOT_ID || '7677190179169796123';

    if (!apiToken || !botId) {
      return NextResponse.json({ error: '服务器配置缺失' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer()) as Buffer;
    let fileName = file.name || 'drawing.png';
    let fileType = file.type || 'image/png';

    // PDF自动转PNG（Coze视觉模型只识别图片，不直接读PDF）
    if (fileName.toLowerCase().endsWith('.pdf') || fileType === 'application/pdf') {
      try {
        console.log('[Recognize] PDF检测到，正在转换为PNG...');
        buffer = await pdfFirstPageToPng(buffer, 200);
        fileName = fileName.replace(/\.pdf$/i, '.png');
        fileType = 'image/png';
        console.log(`[Recognize] PDF转换完成: ${fileName}, size: ${buffer.length}`);
      } catch (pdfErr) {
        console.error('[Recognize] PDF转图片失败:', pdfErr);
        return NextResponse.json({ error: 'PDF解析失败，请将PDF导出为图片后上传' }, { status: 422 });
      }
    }

    console.log(`[Recognize] 文件: ${fileName}, type: ${fileType}, size: ${buffer.length}`);

    // 1. 上传文件到 Coze
    const uploadForm = new FormData();
    uploadForm.append('file', new Blob([new Uint8Array(buffer)], { type: fileType }), fileName);
    const uploadResp = await fetch(`${apiBase}/v1/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: uploadForm,
    });
    const uploadResult = await uploadResp.json() as { code?: number; data?: { id: string }; msg?: string };
    if (uploadResult.code !== 0 || !uploadResult.data?.id) {
      console.error('[Recognize] Coze上传失败:', uploadResult);
      return NextResponse.json({ error: uploadResult.msg || '文件上传失败' }, { status: 500 });
    }
    const fileId = uploadResult.data.id;
    console.log(`[Recognize] Coze file_id: ${fileId}`);

    // 2. 构建识别 prompt
    const systemPrompt = `你是铝型材工程图纸识别专家。请仔细分析这张图纸/截面图/零件图片，提取所有报价所需参数。

请逐项识别以下信息，无法确定的字段填 null：

1. product_type: extrusion(挤压型材), stamping(冲压件), die_casting(压铸件), cnc(CNC加工件), injection(注塑件)
2. material_grade: 如 6063-T5, 6061-T6, 304不锈钢, SPCC, ADC12, ABS, PP, PC, PA6, PMMA, POM
3. material_category: 铝合金, 不锈钢, 冷轧板, 压铸铝, 塑胶
4. width: 截面外形宽度mm（图纸标注的最大外形尺寸）
5. height: 截面外形高度mm
6. wall_thickness: 主要壁厚mm（如有标注）
7. length: 单根/单件长度mm（图纸如有标注，否则null）
8. perimeter: 截面周长mm（图纸标注了则提取，否则null）
9. cross_section_area: 截面面积mm²（图纸标注了则提取，否则null）
10. meter_weight: 米重kg/m（注意单位：g/m需÷1000转kg/m，如411g/m=0.411）
11. num_cavities: 面域数/公头数，实心=1(平模)，空心有内腔=≥2(分流模)
12. surface_treatment: 氧化本色, 氧化黑色, 阳极氧化-自然色, 粉末喷涂, 电泳, 拉丝, 抛光, 电镀, 喷砂, 无
13. processes: 加工工艺数组，如["冲压","钻孔"]，没有则[]
14. quantity: 订单数量（如有标注）
15. product_name: 产品名称（标题栏提取）
16. product_code: 产品编号/图号

必须只输出一个JSON对象，不要输出任何其他文字或markdown标记：
{"product_type":"extrusion","material_grade":"6063-T5","material_category":"铝合金","width":89.3,"height":24.3,"wall_thickness":1.2,"length":null,"perimeter":null,"cross_section_area":null,"meter_weight":0.411,"num_cavities":2,"surface_treatment":"无","processes":[],"quantity":null,"product_name":null,"product_code":"YL-396","confidence":0.92,"notes":"识别依据"}

重要规则：
- 宽高取截面外形最大尺寸，不是内腔尺寸
- 米重注意g/m和kg/m的换算
- 面域数：实心=1，有几个独立内腔就填几
- 实物照片尽力估算并在notes说明
- confidence为0-1的整体置信度`;

    // 3. 调用 Coze Chat API（非流式 + 轮询）
    const createResp = await fetch(`${apiBase}/v3/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: 'recognize_drawing',
        stream: false,
        auto_save_history: false,
        additional_messages: [
          { role: 'user', content: systemPrompt, content_type: 'text', type: 'question' },
          { role: 'user', content: JSON.stringify([{ type: 'image', file_id: fileId }]), content_type: 'object_string', type: 'question' },
        ],
      }),
    });

    const createResult = await createResp.json() as {
      code?: number;
      data?: { id: string; conversation_id: string; status: string };
      msg?: string;
    };

    if (createResult.code !== 0 || !createResult.data?.id) {
      console.error('[Recognize] Chat创建失败:', createResult);
      return NextResponse.json({ error: createResult.msg || 'AI识别请求失败' }, { status: 500 });
    }

    const chatId = createResult.data.id;
    const conversationId = createResult.data.conversation_id;
    console.log(`[Recognize] chat_id=${chatId}, polling...`);

    // 4. 轮询等待完成
    let resultContent = '';
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 1000));

      const statusResp = await fetch(
        `${apiBase}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const statusData = await statusResp.json() as { data?: { status: string } };
      const status = statusData.data?.status;

      if (status === 'completed') {
        const msgResp = await fetch(
          `${apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        );
        const msgData = await msgResp.json() as {
          data?: Array<{ role: string; type: string; content: string }>;
        };
        const answerMsg = msgData.data?.find(m => m.role === 'assistant' && m.type === 'answer');
        if (answerMsg?.content) resultContent = answerMsg.content;
        break;
      } else if (status === 'failed' || status === 'requires_action') {
        console.error(`[Recognize] Chat失败: ${status}`);
        return NextResponse.json({ error: 'AI识别失败，请重试' }, { status: 500 });
      }
    }

    if (!resultContent) {
      return NextResponse.json({ error: '识别超时，请重试' }, { status: 504 });
    }

    console.log(`[Recognize] AI返回(前300字): ${resultContent.substring(0, 300)}`);

    // 5. 解析 JSON
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

    // 6. 后处理
    const result: Record<string, unknown> = { ...parsed };

    // 米重单位换算：>10 很可能是 g/m
    if (typeof result.meter_weight === 'number' && result.meter_weight > 10) {
      result.meter_weight = Math.round(result.meter_weight / 1000 * 10000) / 10000;
      result.notes = (result.notes || '') + ' [米重已从g/m转换为kg/m]';
    }

    // 面域数 → 模具类型
    if (typeof result.num_cavities === 'number') {
      result.die_type = result.num_cavities <= 1 ? 'flat' : 'split';
    }

    // 7. 置信度门槛：低于0.75不自动填参，转人工确认
    const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
    const hasCriticalDims = typeof result.width === 'number' && typeof result.height === 'number';
    const autoFill = confidence >= 0.75 && hasCriticalDims;

    if (!autoFill) {
      result.needs_human = true;
      result.handoff_reason = confidence < 0.75
        ? `识别置信度${(confidence*100).toFixed(0)}%低于阈值75%`
        : '缺少关键截面尺寸(宽/高)';
    } else {
      result.needs_human = false;
    }

    console.log(`[Recognize] 最终结果(confidence=${confidence}, autoFill=${autoFill}):`, JSON.stringify(result));
    return NextResponse.json({ success: true, data: result, autoFill });

  } catch (err) {
    console.error('[Recognize] 异常:', err);
    return NextResponse.json({ error: '识别服务异常' }, { status: 500 });
  }
}
