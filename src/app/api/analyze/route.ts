import { NextRequest } from "next/server";

// 上传图片到Coze获取file_id
async function uploadImageToCoze(imageUrl: string): Promise<{ success: boolean; fileId?: string; error?: string }> {
  const apiToken = process.env.COZE_API_TOKEN;
  const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
  const botId = process.env.COZE_BOT_ID;

  if (!apiToken || !botId) {
    return { success: false, error: '缺少API配置' };
  }

  try {
    let base64Data = imageUrl;
    let mimeType = 'image/png';

    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mimeType.split('/')[1] || 'png';
    const filename = `image_${Date.now()}.${extension}`;

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);

    const uploadResponse = await fetch(`${apiBase}/v1/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}` },
      body: formData,
    });

    const uploadResult = await uploadResponse.json() as { code?: number; data?: { id: string }; msg?: string };

    if (uploadResult.code !== 0 || !uploadResult.data?.id) {
      return { success: false, error: `图片上传失败: ${uploadResult.msg || '未知错误'}` };
    }

    return { success: true, fileId: uploadResult.data.id };
  } catch (error) {
    return { success: false, error: `图片上传异常: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "缺少图片URL" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiToken = process.env.COZE_API_TOKEN;
    const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
    const botId = process.env.COZE_BOT_ID;

    if (!apiToken || !botId) {
      return new Response(JSON.stringify({ error: "缺少API配置" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. 上传图片到Coze
    const uploadResult = await uploadImageToCoze(imageUrl);
    if (!uploadResult.success || !uploadResult.fileId) {
      return new Response(JSON.stringify({ error: uploadResult.error || "图片上传失败" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 构建分析prompt
    const systemPrompt = `你是一个专业的工程图纸和零件识别专家。请分析提供的图片，识别以下信息：

1. 材质类型（必须从以下选项中选择一个）：
   - 铝型材
   - 冷轧板
   - 不锈钢
   - 压铸铝
   - 塑胶

2. 加工工艺（必须从以下选项中选择一个）：
   - 铝挤压
   - 冲压
   - 铝压铸
   - 注塑
   - 塑料挤出
   - CNC加工
   - 车加工

3. 表面处理（必须从以下选项中选择一个）：
   - 氧化（需注明颜色，如：氧化-银白、氧化-黑色等）
   - 喷涂
   - 电泳
   - 电镀

请以JSON格式返回识别结果，格式如下：
{
  "material": "材质",
  "process": "加工工艺",
  "surface_treatment": "表面处理",
  "oxidation_color": "氧化颜色（如果表面处理是氧化）",
  "confidence": "置信度（0-1之间的数字）",
  "description": "简要描述识别依据"
}

注意：
- 如果无法确定某个属性，请在描述中说明原因
- 置信度表示你对识别结果的确信程度
- 必须严格按照JSON格式返回，不要添加任何其他文字`;

    // 按照Coze API规范：文本和图片/文件消息分开发送
    const userText = systemPrompt + '\n\n请识别这张工程图纸或零件图片的信息。';
    const imageMessage = JSON.stringify([{ type: 'image', file_id: uploadResult.fileId }]);

    // 3. 使用流式API调用Coze，避免Vercel Hobby版10秒超时
    const chatResponse = await fetch(`${apiBase}/v3/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: 'analyze_user',
        stream: true,
        auto_save_history: false,
        additional_messages: [
          {
            role: 'user',
            content: userText,
            content_type: 'text',
            type: 'question',
          },
          {
            role: 'user',
            content: imageMessage,
            content_type: 'object_string',
            type: 'question',
          },
        ],
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('[Analyze] Chat API error:', chatResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI识别请求失败", details: errorText }), {
        status: chatResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. 流式读取Coze响应，同时转发给前端（保证10秒内发出第一个字节）
    const reader = chatResponse.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: "无法读取响应流" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        // 立即发送一个心跳事件，确保10秒内发出第一个字节
        const heartbeatEvent = `data: ${JSON.stringify({ type: 'status', message: '正在分析图片...' })}\n\n`;
        controller.enqueue(encoder.encode(heartbeatEvent));

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType = '';
        let fullContent = ''; // 累积完整回答

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line || line.startsWith(':')) continue;

              if (line.startsWith('event:')) {
                currentEventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (!data || data === '[DONE]') continue;

                try {
                  const json = JSON.parse(data);
                  const eventType = currentEventType || json.event || '';

                  if (eventType === 'conversation.message.delta') {
                    const content = json.data?.content || json.content || '';
                    const reasoningContent = json.data?.reasoning_content || json.reasoning_content || '';

                    // 只处理content，忽略思考过程
                    if (content) {
                      fullContent += content;
                      // 转发增量文本给前端（打字机效果）
                      const event = `data: ${JSON.stringify({ type: 'text', content })}\n\n`;
                      controller.enqueue(encoder.encode(event));
                    }
                  } else if (eventType === 'conversation.chat.failed') {
                    const errorMsg = json.last_error?.msg || json.data?.msg || json.msg || 'AI识别失败';
                    const event = `data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`;
                    controller.enqueue(encoder.encode(event));
                  } else if (eventType === 'done' || eventType === 'conversation.chat.completed') {
                    // 流结束，解析完整的JSON结果并返回
                    let analysisResult = null;
                    try {
                      let content = fullContent.trim();
                      // 去掉markdown代码块包裹
                      if (content.startsWith('```json')) content = content.slice(7);
                      if (content.startsWith('```')) content = content.slice(3);
                      if (content.endsWith('```')) content = content.slice(0, -3);
                      analysisResult = JSON.parse(content.trim());
                    } catch {
                      // JSON解析失败，返回原始文本
                      analysisResult = { rawResponse: fullContent, parseError: true };
                    }

                    const event = `data: ${JSON.stringify({ type: 'result', analysis: analysisResult })}\n\n`;
                    controller.enqueue(encoder.encode(event));
                  } else if (eventType === 'conversation.message.completed') {
                    // 消息完成，检查是否有json.event为delta的
                    if (json.event === 'conversation.message.delta') {
                      const content = json.data?.content || '';
                      if (content) {
                        fullContent += content;
                        const event = `data: ${JSON.stringify({ type: 'text', content })}\n\n`;
                        controller.enqueue(encoder.encode(event));
                      }
                    }
                  }

                  currentEventType = '';
                } catch {
                  // JSON解析失败，忽略
                }
              }
            }
          }

          // 如果流正常结束但没有发送result事件（可能没有收到done事件），手动发送
          if (fullContent) {
            let analysisResult = null;
            try {
              let content = fullContent.trim();
              if (content.startsWith('```json')) content = content.slice(7);
              if (content.startsWith('```')) content = content.slice(3);
              if (content.endsWith('```')) content = content.slice(0, -3);
              analysisResult = JSON.parse(content.trim());
            } catch {
              analysisResult = { rawResponse: fullContent, parseError: true };
            }
            const event = `data: ${JSON.stringify({ type: 'result', analysis: analysisResult })}\n\n`;
            controller.enqueue(encoder.encode(event));
          }
        } catch (streamError) {
          console.error('[Analyze] Stream error:', streamError);
          const event = `data: ${JSON.stringify({ type: 'error', error: '流处理错误' })}\n\n`;
          controller.enqueue(encoder.encode(event));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("[Analyze] Error:", error);
    return new Response(JSON.stringify({ error: "图片识别失败" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
