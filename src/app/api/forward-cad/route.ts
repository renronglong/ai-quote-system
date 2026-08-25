import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 90;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/forward-cad
 *
 * 深度报价流程：
 * 1. 接收用户文件
 * 2. 上传到 Coze
 * 3. 调用图纸识别Bot自动识别
 * 4. 置信度≥75%且有关键尺寸 → 返回识别结果，前端自动填表
 * 5. 置信度不足 → 记录工单，返回提示
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const userEmail = formData.get('userEmail') as string;
    const userPhone = formData.get('userPhone') as string;
    const companyName = formData.get('companyName') as string;
    const remark = formData.get('remark') as string;

    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isAllowedFile = /\.(dxf|step|stp|zip|dwg|pdf|png|jpg|jpeg|gif|bmp|webp)$/i.test(fileName);

    if (!isAllowedFile) {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }

    const apiToken = process.env.COZE_API_TOKEN;
    const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
    const botId = process.env.COZE_RECOG_BOT_ID || '7677190179169796123';

    if (!apiToken) {
      return NextResponse.json({ error: '服务器配置缺失' }, { status: 500 });
    }

    let userInfo = {
      phone: userPhone || '未提供',
      email: userEmail || '未提供',
      company: companyName || '未提供',
    };

    if (userId && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: user } = await supabase
        .from('users')
        .select('phone, email, company_name')
        .eq('id', userId)
        .single();

      if (user) {
        userInfo = {
          phone: user.phone || '未提供',
          email: user.email || '未提供',
          company: user.company_name || '未提供',
        };
      }
    }

    // 1. 上传文件到 Coze
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadFormData = new FormData();
    uploadFormData.append('file', new Blob([new Uint8Array(buffer)], { type: file.type || 'application/octet-stream' }), file.name);

    const uploadResp = await fetch(`${apiBase}/v1/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: uploadFormData,
    });
    const uploadResult = await uploadResp.json() as { code?: number; data?: { id: string }; msg?: string };

    if (uploadResult.code !== 0 || !uploadResult.data?.id) {
      console.error('[ForwardCAD] Coze上传失败:', uploadResult);
      return NextResponse.json({ error: uploadResult.msg || '文件上传失败' }, { status: 500 });
    }
    const cozeFileId = uploadResult.data.id;
    console.log(`[ForwardCAD] Coze file_id: ${cozeFileId}`);

    // 2. 调用图纸识别Bot
    const systemPrompt = `你是铝型材工程图纸识别专家。请仔细分析这张图纸/截面图/零件图片，提取所有报价所需参数。

请逐项识别以下信息，无法确定的字段填 null：

1. product_type: extrusion(挤压型材), stamping(冲压件), die_casting(压铸件), cnc(CNC加工件), injection(注塑件)
2. material_grade: 如 6063-T5, 6061-T6, 304不锈钢, SPCC, ADC12, ABS, PP, PC, PA6, PMMA, POM
3. material_category: 铝合金, 不锈钢, 冷轧板, 压铸铝, 塑胶
4. width: 截面外形宽度mm
5. height: 截面外形高度mm
6. wall_thickness: 主要壁厚mm
7. length: 单根/单件长度mm（无则null）
8. perimeter: 截面周长mm（无则null）
9. cross_section_area: 截面面积mm²（无则null）
10. meter_weight: 米重kg/m（注意g/m需÷1000，如411g/m=0.411）
11. num_cavities: 面域数/公头数，实心=1(平模)，空心有内腔=≥2(分流模)
12. surface_treatment: 氧化本色, 氧化黑色, 阳极氧化-自然色, 粉末喷涂, 电泳, 拉丝, 抛光, 电镀, 喷砂, 无
13. processes: 加工工艺数组，如["冲压","钻孔"]，没有则[]
14. quantity: 订单数量（无则null）
15. product_name: 产品名称
16. product_code: 产品编号/图号

必须只输出一个JSON对象，不要输出任何其他文字或markdown标记：
{"product_type":"extrusion","material_grade":"6063-T5","material_category":"铝合金","width":25,"height":45,"wall_thickness":0.8,"length":null,"perimeter":null,"cross_section_area":null,"meter_weight":0.375,"num_cavities":2,"surface_treatment":"无","processes":[],"quantity":null,"product_name":null,"product_code":"LF-YL-079","confidence":0.9,"notes":"识别依据"}

重要规则：
- 宽高取截面外形最大尺寸
- 米重注意g/m和kg/m换算，>10的很可能是g/m
- 面域数：实心=1，有几个独立内腔填几
- confidence为0-1的整体置信度`;

    const createResp = await fetch(`${apiBase}/v3/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: 'forward_cad_' + Date.now(),
        stream: false,
        auto_save_history: true,
        additional_messages: [
          { role: 'user', content: systemPrompt, content_type: 'text', type: 'question' },
          { role: 'user', content: JSON.stringify([{ type: 'image', file_id: cozeFileId }]), content_type: 'object_string', type: 'question' },
        ],
      }),
    });

    const createResult = await createResp.json() as {
      code?: number;
      data?: { id: string; conversation_id: string; status: string };
      msg?: string;
    };

    if (createResult.code !== 0 || !createResult.data?.id) {
      console.error('[ForwardCAD] Chat创建失败:', createResult);
      await saveCadRequest(supabaseServiceKey, supabaseUrl, {
        userId, cozeFileId, fileName: file.name, fileSize: file.size,
        userInfo, remark, status: 'pending',
      });
      return NextResponse.json({
        success: true,
        autoFill: false,
        message: 'AI识别服务暂时不可用，已提交工程师人工报价',
      });
    }

    const chatId = createResult.data.id;
    const conversationId = createResult.data.conversation_id;
    console.log(`[ForwardCAD] chat_id=${chatId}, polling...`);

    // 3. 轮询等待完成
    let resultContent = '';
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));

      const statusResp = await fetch(
        `${apiBase}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );
      const statusData = await statusResp.json() as { data?: { status: string } };
      const status = statusData.data?.status;

      if (status === 'completed') {
        const msgResp = await fetch(
          `${apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
          { headers: { Authorization: `Bearer ${apiToken}` } },
        );
        const msgData = await msgResp.json() as {
          data?: Array<{ role: string; type: string; content: string }>;
        };
        const answerMsg = msgData.data?.find(m => m.role === 'assistant' && m.type === 'answer');
        if (answerMsg?.content) resultContent = answerMsg.content;
        break;
      } else if (status === 'failed' || status === 'requires_action') {
        console.error(`[ForwardCAD] Chat失败: ${status}`);
        await saveCadRequest(supabaseServiceKey, supabaseUrl, {
          userId, cozeFileId, fileName: file.name, fileSize: file.size,
          userInfo, remark, status: 'pending',
        });
        return NextResponse.json({
          success: true,
          autoFill: false,
          message: 'AI识别失败，已提交工程师人工报价',
        });
      }
    }

    if (!resultContent) {
      await saveCadRequest(supabaseServiceKey, supabaseUrl, {
        userId, cozeFileId, fileName: file.name, fileSize: file.size,
        userInfo, remark, status: 'pending',
      });
      return NextResponse.json({
        success: true,
        autoFill: false,
        message: 'AI识别超时，已提交工程师人工报价',
      });
    }

    // 4. 解析JSON
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
      console.error('[ForwardCAD] JSON解析失败:', e, 'raw:', resultContent.substring(0, 500));
      await saveCadRequest(supabaseServiceKey, supabaseUrl, {
        userId, cozeFileId, fileName: file.name, fileSize: file.size,
        userInfo, remark, status: 'pending',
      });
      return NextResponse.json({
        success: true,
        autoFill: false,
        message: '识别结果解析失败，已提交工程师人工报价',
      });
    }

    // 5. 后处理
    if (typeof parsed.meter_weight === 'number' && parsed.meter_weight > 10) {
      parsed.meter_weight = Math.round(parsed.meter_weight / 1000 * 10000) / 10000;
      parsed.notes = ((parsed.notes as string) || '') + ' [米重已从g/m转换为kg/m]';
    }

    if (typeof parsed.num_cavities === 'number') {
      parsed.die_type = parsed.num_cavities <= 1 ? 'flat' : 'split';
    }

    // 6. 置信度判断
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const hasCriticalDims = typeof parsed.width === 'number' && typeof parsed.height === 'number';
    const autoFill = confidence >= 0.75 && hasCriticalDims;

    if (autoFill) {
      await saveCadRequest(supabaseServiceKey, supabaseUrl, {
        userId, cozeFileId, fileName: file.name, fileSize: file.size,
        userInfo, remark, status: 'auto_recognized', recognitionResult: parsed,
      });

      return NextResponse.json({
        success: true,
        autoFill: true,
        data: parsed,
        message: '深度识别完成，已自动填入参数',
      });
    } else {
      const handoffReason = confidence < 0.75
        ? `识别置信度${(confidence * 100).toFixed(0)}%低于阈值75%`
        : '缺少关键截面尺寸(宽/高)';
      parsed.handoff_reason = handoffReason;

      await saveCadRequest(supabaseServiceKey, supabaseUrl, {
        userId, cozeFileId, fileName: file.name, fileSize: file.size,
        userInfo, remark, status: 'pending', recognitionResult: parsed,
      });

      return NextResponse.json({
        success: true,
        autoFill: false,
        data: parsed,
        message: `深度识别完成但${handoffReason}，已提交工程师人工报价，将尽快联系您`,
      });
    }
  } catch (err) {
    console.error('[ForwardCAD] Error:', err);
    return NextResponse.json({ error: '文件提交失败，请稍后重试' }, { status: 500 });
  }
}

async function saveCadRequest(
  serviceKey: string,
  sUrl: string,
  opts: {
    userId: string;
    cozeFileId: string;
    fileName: string;
    fileSize: number;
    userInfo: { phone: string; email: string; company: string };
    remark: string;
    status: string;
    recognitionResult?: Record<string, unknown>;
  },
) {
  if (!serviceKey) return;
  try {
    const supabase = createClient(sUrl, serviceKey);
    await supabase.from('cad_requests').upsert({
      user_id: opts.userId || null,
      file_name: opts.fileName,
      file_size: opts.fileSize,
      coze_file_id: opts.cozeFileId,
      status: opts.status,
      user_email: opts.userInfo.email,
      user_phone: opts.userInfo.phone,
      company_name: opts.userInfo.company,
      remark: opts.remark || '',
      recognition_result: opts.recognitionResult ? JSON.stringify(opts.recognitionResult) : null,
      created_at: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.warn('[ForwardCAD] cad_requests保存失败:', dbErr);
  }
}
