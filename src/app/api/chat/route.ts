import { NextRequest } from 'next/server';

// ★ 使用 Edge Runtime 获得原生流式响应支持，避免 Vercel Node.js 函数的 SSE 缓冲问题
export const runtime = 'edge';
export const maxDuration = 60;

// ===== 豆包（火山方舟 Ark）配置 =====
// 2026-10-29 起右下角 AI 对话直连豆包，不再依赖 Coze Bot（PAT 过期维护成本高）
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || process.env.VOLCENGINE_API_KEY || '';
const DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-pro-260215';

const SYSTEM_PROMPT = `你是「工品报价 AI 助手」，服务于铝型材与五金加工厂的在线报价系统 gyparts.cn。

你的唯一职责：从用户上传的图纸图片或文字描述中识别产品参数，输出结构化结果，供后台系统自动计算报价。你不负责算价，也不要编造价格。

【识别要点】
- 材质牌号（6063-T5 / 6061-T6 / 304 不锈钢 / 锌合金 / 塑料等）
- 产品类型：挤压型材、压铸件、CNC 机加工、冲压件
- 截面尺寸：宽 × 高（mm），圆形写外径，管材注明壁厚
- 单根长度（mm）
- 壁厚（mm，空心截面必须有）
- 订单数量（件）
- 表面处理：氧化本色 / 阳极氧化-黑色 / 阳极氧化-自然色 / 粉末喷涂 / 电泳 / 拉丝 / 抛光 / 电镀 / 无
- 二次加工：钻孔、攻牙、锯切、折弯等（如图纸标注）

【回复格式】
第一部分：用简洁中文说明识别到的关键参数和不确定项（不超过 6 行，不要客套开场白，不要说"我来帮你分析"）。
第二部分：只要识别到 3 个及以上有效参数，就在回复末尾追加参数块，格式严格如下（前端靠它自动回填左侧表单）：

【FORM_PARAMS】
material_grade: 6063-T5
product_type: extrusion
width: 38.7
height: 21.7
length: 100
wall_thickness: 1.5
quantity: 1000
surface_treatment: 阳极氧化-黑色
【/FORM_PARAMS】

【硬性规则】
1. 单位统一 mm，只写数字，不要带单位。
2. 识别不出来的字段直接省略该行，绝对不要编造尺寸或数量。
3. product_type 只能取：extrusion（挤压型材）、die-casting（压铸）、cnc（机加工）、stamping（冲压）。
4. 纯闲聊、咨询类问题（如"你能做什么""怎么报价"）不要输出参数块。
5. 图纸模糊或信息不足时，明确说缺什么参数，请用户补充或改用图纸识别功能。
6. 不要输出文件链接，不要复述上传过程。
7. 米重参考公式：截面积(mm²) × 0.00271 = kg/m。`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type DoubaoContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export async function GET() {
  if (!DOUBAO_API_KEY) {
    return Response.json({
      configured: false,
      provider: 'doubao',
      message: '缺少环境变量配置：DOUBAO_API_KEY',
    });
  }

  return Response.json({
    configured: true,
    provider: 'doubao',
    message: '豆包已配置',
    model: DOUBAO_MODEL,
    apiBase: DOUBAO_BASE_URL,
  });
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  if (!DOUBAO_API_KEY) {
    return new Response(JSON.stringify({
      error: '服务配置错误',
      details: '缺少 DOUBAO_API_KEY 环境变量',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求体解析失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    messages: userMessages,
    images,
    fileUrls,
    extractedText,
    conversationId: existingConversationId,
  } = body as {
    messages?: ChatMessage[];
    images?: string[];
    fileUrls?: string[];
    extractedText?: string;
    conversationId?: string;
  };

  if (!userMessages || !Array.isArray(userMessages) || userMessages.length === 0) {
    return new Response(JSON.stringify({ error: '消息格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ★ 使用 TransformStream 创建真正的流式响应
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const writeEvent = async (payload: Record<string, unknown>) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  (async () => {
    try {
      await writeEvent({ type: 'status', message: '正在处理...' });

      // 会话 ID 仅作为前端上下文标识；豆包无服务端会话，历史消息由前端全量带上
      const conversationId = existingConversationId
        || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}`);
      await writeEvent({ type: 'conversation', conversationId });

      // ===== 组装豆包消息 =====
      const base64Images = (images || []).filter(
        (u) => typeof u === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(u),
      );
      // 压缩包/批量场景：前端拿到的是 Supabase 公网 URL，豆包同样可以直接读
      const urlImages = (fileUrls || []).filter(
        (u) => typeof u === 'string' && /^https?:\/\//i.test(u) && /\.(jpe?g|png|webp)(\?|$)/i.test(u),
      );
      const imageList = [...base64Images, ...urlImages].slice(0, 3);

      const history: ChatMessage[] = userMessages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content }));

      // 丢弃末尾的空助手占位消息
      while (history.length > 0 && history[history.length - 1].role === 'assistant' && !history[history.length - 1].content.trim()) {
        history.pop();
      }

      if (history.length === 0) {
        await writeEvent({ type: 'error', error: '消息内容为空' });
        await writer.close();
        return;
      }

      // 只保留最近 10 轮，控制上下文长度
      const trimmed = history.slice(-20);

      // 最后一条用户消息附加图纸文字层内容
      const lastIdx = trimmed.length - 1;
      const lastMsg = trimmed[lastIdx];
      let lastText = lastMsg.content || '';
      if (extractedText && extractedText.trim()) {
        const maxLen = 8000;
        const truncated = extractedText.length > maxLen
          ? extractedText.substring(0, maxLen) + '\n...(内容过长已截断)'
          : extractedText;
        lastText = `${lastText || '请分析以下图纸参数'}\n\n---以下是图纸的结构化标注（文字层提取，请优先使用这些精确数据）---\n${truncated}\n---结构化标注结束---`;
      }
      if (lastMsg.role === 'user' && imageList.length === 0) {
        trimmed[lastIdx] = { role: 'user', content: lastText || '请分析这个产品' };
      }

      const doubaoMessages: Array<{ role: string; content: string | DoubaoContentPart[] }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...trimmed.slice(0, lastIdx).map((m) => ({ role: m.role, content: m.content })),
      ];

      if (imageList.length > 0) {
        const parts: DoubaoContentPart[] = [
          { type: 'text', text: lastText || '请识别这张图纸的产品参数' },
          ...imageList.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ];
        doubaoMessages.push({ role: 'user', content: parts });
      } else {
        doubaoMessages.push({ role: 'user', content: lastText || '请分析这个产品' });
      }

      // ===== 调用豆包流式接口 =====
      const resp = await fetch(`${DOUBAO_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DOUBAO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DOUBAO_MODEL,
          messages: doubaoMessages,
          stream: true,
          temperature: 0.3,
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('[Chat] 豆包API错误:', resp.status, errorText.substring(0, 500));
        let errorMessage = `对话请求失败（HTTP ${resp.status}），请稍后重试`;
        if (resp.status === 401 || resp.status === 403) errorMessage = 'AI 服务鉴权失败，请联系管理员检查密钥';
        else if (resp.status === 429) errorMessage = '对话频率过高，请稍后再试';
        else if (resp.status === 400) errorMessage = '请求参数有误，请重新上传图片或简化描述';
        else {
          try {
            const j = JSON.parse(errorText);
            if (j?.error?.message) errorMessage = String(j.error.message).slice(0, 200);
          } catch { /* ignore */ }
        }
        await writeEvent({ type: 'error', error: errorMessage });
        await writer.close();
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        await writeEvent({ type: 'error', error: '无法读取响应流' });
        await writer.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let hasReceivedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith(':')) continue;
          if (!trimmedLine.startsWith('data:')) continue;

          const data = trimmedLine.slice(5).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            const content = delta?.content;
            if (content) {
              hasReceivedContent = true;
              await writeEvent({ type: 'text', content });
            }
            const finishReason = json.choices?.[0]?.finish_reason;
            if (finishReason === 'content_filter') {
              await writeEvent({ type: 'text', content: '\n\n（内容触发安全策略，已被截断，请调整描述后重试）' });
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      }

      if (!hasReceivedContent) {
        await writeEvent({
          type: 'text',
          content: '没能识别出有效内容。可以补充产品的尺寸、材质和数量，或者改用「图纸识别」上传清晰的图纸照片。',
        });
      }

      await writeEvent({ type: 'done' });
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error('[Chat] 未捕获异常:', detail, error instanceof Error ? error.stack : '');
      await writeEvent({ type: 'error', error: `对话失败（${detail}）` });
    } finally {
      try { await writer.close(); } catch { /* ignore */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
