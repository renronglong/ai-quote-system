import { NextRequest } from 'next/server';

// ★ 使用 Edge Runtime 获得原生流式响应支持，避免 Vercel Node.js 函数的 SSE 缓冲问题
export const runtime = 'edge';
export const maxDuration = 60;

// Coze API配置
interface CozeConfig {
  apiToken: string;
  botId: string;
  apiBase: string;
}

function getCozeConfig(): CozeConfig {
  return {
    apiToken: process.env.COZE_API_TOKEN || '',
    botId: process.env.COZE_BOT_ID || '',
    apiBase: process.env.COZE_API_BASE_URL || 'https://api.coze.cn',
  };
}

// Coze消息格式
interface CozeMessage {
  role: 'user' | 'assistant';
  content: string;
  content_type: 'text' | 'object_string';
  type?: 'question' | 'answer';
}

// 创建新会话
async function createConversation(): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const config = getCozeConfig();
  try {
    const response = await fetch(`${config.apiBase}/v1/conversation/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    const result = await response.json() as { code?: number; data?: { id: string }; msg?: string };
    
    if (result.code !== 0 || !result.data?.id) {
      return { success: false, error: result.msg || '创建会话失败' };
    }
    
    return { success: true, conversationId: result.data.id };
  } catch (error) {
    return { success: false, error: `创建会话异常: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

export async function GET() {
  const config = getCozeConfig();
  
  if (!config.apiToken || !config.botId) {
    return Response.json({ 
      configured: false, 
      message: '缺少环境变量配置：COZE_API_TOKEN 或 COZE_BOT_ID' 
    });
  }
  
  return Response.json({ 
    configured: true, 
    message: 'Coze Bot已配置',
    botId: config.botId,
    apiBase: config.apiBase
  });
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const config = getCozeConfig();

  if (!config.apiToken || !config.botId) {
    return new Response(JSON.stringify({ 
      error: '服务配置错误',
      details: '缺少COZE_API_TOKEN或COZE_BOT_ID环境变量',
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
    cozeFileId: preUploadedFileId,
    cozeFileIds: preUploadedFileIds,
    fileType = 'file',
    extractedText,
    conversationId: existingConversationId,
    userId = 'default_user'
  } = body as {
    messages?: Array<{ role: string; content: string }>;
    cozeFileId?: string;
    cozeFileIds?: string[];
    fileType?: string;
    extractedText?: string;
    conversationId?: string;
    userId?: string;
  };

  const hasFile = !!preUploadedFileId;

  if (!userMessages || !Array.isArray(userMessages) || userMessages.length === 0) {
    return new Response(JSON.stringify({ error: '消息格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ★ 使用 TransformStream 创建真正的流式响应
  // Edge Runtime 原生支持流式，不会有 Vercel Node.js 函数的缓冲问题
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // 异步执行所有操作，不阻塞响应返回
  (async () => {
    try {
      // 立即发送状态事件
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'status', message: '正在处理...' })}\n\n`
      ));

      // 1. 获取或创建会话ID
      let conversationId = existingConversationId || null;
      if (!conversationId) {
        const convResult = await createConversation();
        if (!convResult.success) {
          await writer.write(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: convResult.error || '创建会话失败' })}\n\n`
          ));
          await writer.close();
          return;
        }
        conversationId = convResult.conversationId || null;
      }

      if (!conversationId) {
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', error: '无法获取会话ID' })}\n\n`
        ));
        await writer.close();
        return;
      }

      // 发送会话ID
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'conversation', conversationId })}\n\n`
      ));

      // 2. 获取用户最新消息
      const lastMessage = userMessages[userMessages.length - 1];
      const userContent = lastMessage?.content || '';

      // 3. 构建Coze消息
      const additionalMessages: CozeMessage[] = [];
      let cozeFileId: string | null = preUploadedFileId || null;
      const cozeFileIds = preUploadedFileIds || null;
      let contentType: 'image' | 'file' = fileType === 'image' ? 'image' : 'file';

      if (hasFile && !cozeFileId) {
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', error: '文件ID缺失' })}\n\n`
        ));
        await writer.close();
        return;
      }

      if (cozeFileIds && cozeFileIds.length > 0) {
        let textContent = userContent || '请分析这个文件';
        if (extractedText) {
          const maxLen = 8000;
          const truncated = extractedText.length > maxLen 
            ? extractedText.substring(0, maxLen) + '\n...(内容过长已截断)' 
            : extractedText;
          textContent = `${textContent}\n\n---以下是PDF图纸的结构化标注（由文字层提取，请优先使用这些精确数据）---\n${truncated}\n---结构化标注结束。同时上传了页面图片供识别几何形状和整体布局---`;
        }
        additionalMessages.push({ role: 'user', content: textContent, content_type: 'text', type: 'question' });
        const imageObjects = cozeFileIds.map(id => ({ type: 'image' as const, file_id: id }));
        additionalMessages.push({ role: 'user', content: JSON.stringify(imageObjects), content_type: 'object_string', type: 'question' });
      } else if (cozeFileId) {
        let textContent = userContent || '请分析这个文件';
        if (extractedText) {
          const maxLen = 8000;
          const truncated = extractedText.length > maxLen 
            ? extractedText.substring(0, maxLen) + '\n...(内容过长已截断)' 
            : extractedText;
          textContent = `${textContent}\n\n---以下是PDF图纸的结构化标注（由文字层提取，请优先使用这些精确数据）---\n${truncated}\n---结构化标注结束。同时上传了页面图片供识别几何形状和整体布局---`;
        }
        additionalMessages.push({ role: 'user', content: textContent, content_type: 'text', type: 'question' });
        additionalMessages.push({ role: 'user', content: JSON.stringify([{ type: contentType, file_id: cozeFileId }]), content_type: 'object_string', type: 'question' });
      } else if (extractedText) {
        const maxLen = 8000;
        const truncated = extractedText.length > maxLen 
          ? extractedText.substring(0, maxLen) + '\n...(内容过长已截断)' 
          : extractedText;
        const textContent = `${userContent || '请分析以下内容'}\n\n---以下是文件提取的文字内容---\n${truncated}\n---内容结束---`;
        additionalMessages.push({ role: 'user', content: textContent, content_type: 'text', type: 'question' });
      } else {
        additionalMessages.push({ role: 'user', content: userContent, content_type: 'text', type: 'question' });
      }

      // 4. 调用Coze Chat API
      // 文件消息使用非流式模式，确保能获取完整响应
      // 文字消息使用流式模式，提供更好的用户体验
      const useStream = true;
      const chatUrl = `${config.apiBase}/v3/chat?conversation_id=${conversationId}`;
      const chatBody = {
        bot_id: config.botId,
        user_id: userId,
        stream: useStream,
        additional_messages: additionalMessages,
        auto_save_history: true,
      };

      const chatResponse = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatBody),
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        let errorMessage = '对话请求失败';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.msg || errorMessage;
          if (errorJson.code === 4000) errorMessage = '请求参数错误';
          else if (errorJson.code === 4006) errorMessage = 'Bot不存在或未发布到API';
        } catch { /* ignore */ }
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`
        ));
        await writer.close();
        return;
      }

      // 5. 处理响应
      if (!useStream) {
        // 非流式模式：解析初始响应获取chat_id
        const chatResult = await chatResponse.json() as {
          code?: number;
          data?: {
            id?: string;
            conversation_id?: string;
            status?: string;
            messages?: Array<{ role: string; content: string; type: string }>;
            last_error?: { msg: string };
          };
          msg?: string;
        };
        
        if (chatResult.code !== 0 || !chatResult.data) {
          await writer.write(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: chatResult.msg || 'Bot处理失败' })}\n\n`
          ));
          await writer.close();
          return;
        }
        
        const chatId = chatResult.data.id;
        let botReply = '';
        
        // 检查初始响应是否已有完整结果
        const initialMessages = chatResult.data.messages || [];
        const initialAnswers = initialMessages.filter((m: { role: string; type: string }) => m.role === 'assistant' && m.type === 'answer');
        if (initialAnswers.length > 0) {
          botReply = initialAnswers.map((m: { content: string }) => m.content).join('\n');
        }
        
        // 如果初始响应没有内容，轮询获取结果
        if (!botReply && chatId) {
          const maxRetries = 10;
          for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等2秒
            
            const retrieveUrl = `${config.apiBase}/v3/chat/retrieve?conversation_id=${conversationId}&chat_id=${chatId}`;
            const retrieveResponse = await fetch(retrieveUrl, {
              headers: {
                'Authorization': `Bearer ${config.apiToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (retrieveResponse.ok) {
              const retrieveResult = await retrieveResponse.json() as {
                code?: number;
                data?: {
                  status?: string;
                  messages?: Array<{ role: string; content: string; type: string }>;
                };
              };
              
              const status = retrieveResult.data?.status;
              if (status === 'completed' || status === 'failed') {
                const messages = retrieveResult.data?.messages || [];
                const answers = messages.filter((m: { role: string; type: string }) => m.role === 'assistant' && m.type === 'answer');
                botReply = answers.map((m: { content: string }) => m.content).join('\n');
                break;
              }
            }
          }
        }
        
        if (botReply) {
          await writer.write(encoder.encode(
            `data: ${JSON.stringify({ type: 'text', content: botReply })}\n\n`
          ));
        } else {
          await writer.write(encoder.encode(
            `data: ${JSON.stringify({ type: 'text', content: '已收到您的文件，但暂时无法解析内容。请尝试用文字描述产品的尺寸、材质和数量，我将为您识别参数。' })}\n\n`
          ));
        }
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'done' })}\n\n`
        ));
        await writer.close();
        return;
      }
      
      // 流式模式：转发Coze流式响应到前端
      const reader = chatResponse.body?.getReader();
      if (!reader) {
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', error: '无法读取响应流' })}\n\n`
        ));
        await writer.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';
      let hasReceivedContent = false;

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
                if (content) {
                  hasReceivedContent = true;
                  await writer.write(encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content })}\n\n`
                  ));
                }
              } else if (eventType === 'conversation.message.completed') {
                // 处理 completed 消息（某些情况下 delta 不会发送，只有 completed）
                const msgType = json.data?.type || json.type || '';
                const content = json.data?.content || json.content || '';
                const role = json.data?.role || json.role || '';
                if (role === 'assistant' && content && (msgType === 'answer' || msgType === 'text')) {
                  await writer.write(encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content })}\n\n`
                  ));
                }
              } else if (eventType === 'conversation.chat.failed') {
                const errorMsg = json.last_error?.msg || json.data?.msg || json.msg || '对话处理失败';
                await writer.write(encoder.encode(
                  `data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`
                ));
              } else if (eventType === 'done' || eventType === 'conversation.chat.completed') {
                if (!hasReceivedContent) {
                  // Bot没有返回任何内容，给出提示
                  await writer.write(encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content: '已收到您的文件，但暂时无法解析内容。请尝试用文字描述产品的尺寸、材质和数量，我将为您识别参数。' })}\n\n`
                  ));
                }
                await writer.write(encoder.encode(
                  `data: ${JSON.stringify({ type: 'done' })}\n\n`
                ));
              } else if (json.event === 'conversation.message.delta') {
                const content = json.data?.content || '';
                if (content) {
                  await writer.write(encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content })}\n\n`
                  ));
                }
              } else if (json.event === 'conversation.message.completed') {
                // 备用处理 completed 消息
                const msgType = json.data?.type || json.type || '';
                const content = json.data?.content || json.content || '';
                const role = json.data?.role || json.role || '';
                if (role === 'assistant' && content && (msgType === 'answer' || msgType === 'text')) {
                  await writer.write(encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content })}\n\n`
                  ));
                }
              }
              
              currentEventType = '';
            } catch {
              // JSON解析失败，忽略
            }
          }
        }
      }

    } catch (error) {
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'error', error: `服务器内部错误: ${error instanceof Error ? error.message : '未知错误'}` })}\n\n`
      ));
    } finally {
      try { await writer.close(); } catch { /* ignore */ }
    }
  })();

  // 立即返回流式响应 - Edge Runtime 会正确转发每个 chunk
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
