import { NextRequest } from 'next/server';

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
}

// 创建新会话
async function createConversation(config: CozeConfig): Promise<{ success: boolean; conversationId?: string; error?: string }> {
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
      configured: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ 
      error: '消息格式错误',
      details: 'messages必须是非空数组'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ★ 非流式方案：先完成所有异步操作，收集完整结果，最后一次性返回JSON
  // 这样避免Vercel Serverless对SSE流式响应的缓冲/截断问题
  
  try {
    // 1. 获取或创建会话ID
    let conversationId = existingConversationId || null;
    if (!conversationId) {
      const convResult = await createConversation(config);
      if (!convResult.success) {
        return Response.json({ error: convResult.error || '创建会话失败' }, { status: 500 });
      }
      conversationId = convResult.conversationId || null;
    }

    if (!conversationId) {
      return Response.json({ error: '无法获取会话ID' }, { status: 500 });
    }

    // 2. 获取用户最新消息
    const lastMessage = userMessages[userMessages.length - 1];
    const userContent = lastMessage?.content || '';

    // 3. 构建Coze消息
    const additionalMessages: CozeMessage[] = [];
    let cozeFileId: string | null = preUploadedFileId || null;
    const cozeFileIds = preUploadedFileIds || null;
    let contentType: 'image' | 'file' = fileType === 'image' ? 'image' : 'file';

    if (hasFile && !cozeFileId) {
      return Response.json({ error: '文件ID缺失' }, { status: 400 });
    }

    if (cozeFileIds && cozeFileIds.length > 0) {
      let textContent = userContent || '请分析这个文件';
      if (extractedText) {
        const maxTextLength = 8000;
        const truncatedText = extractedText.length > maxTextLength 
          ? extractedText.substring(0, maxTextLength) + '\n...(内容过长已截断)' 
          : extractedText;
        textContent = `${textContent}\n\n---以下是PDF图纸的结构化标注（由文字层提取，请优先使用这些精确数据）---\n${truncatedText}\n---结构化标注结束。同时上传了页面图片供识别几何形状和整体布局---`;
      }
      additionalMessages.push({
        role: 'user',
        content: textContent,
        content_type: 'text',
      });
      const imageObjects = cozeFileIds.map(id => ({ type: 'image' as const, file_id: id }));
      additionalMessages.push({
        role: 'user',
        content: JSON.stringify(imageObjects),
        content_type: 'object_string',
      });
    } else if (cozeFileId) {
      let textContent = userContent || '请分析这个文件';
      if (extractedText) {
        const maxTextLength = 8000;
        const truncatedText = extractedText.length > maxTextLength 
          ? extractedText.substring(0, maxTextLength) + '\n...(内容过长已截断)' 
          : extractedText;
        textContent = `${textContent}\n\n---以下是PDF图纸的结构化标注（由文字层提取，请优先使用这些精确数据）---\n${truncatedText}\n---结构化标注结束。同时上传了页面图片供识别几何形状和整体布局---`;
      }
      additionalMessages.push({
        role: 'user',
        content: textContent,
        content_type: 'text',
      });
      additionalMessages.push({
        role: 'user',
        content: JSON.stringify([{ type: contentType, file_id: cozeFileId }]),
        content_type: 'object_string',
      });
    } else if (extractedText) {
      const maxTextLength = 8000;
      const truncatedText = extractedText.length > maxTextLength 
        ? extractedText.substring(0, maxTextLength) + '\n...(内容过长已截断)' 
        : extractedText;
      const textContent = `${userContent || '请分析以下内容'}\n\n---以下是文件提取的文字内容---\n${truncatedText}\n---内容结束---`;
      additionalMessages.push({
        role: 'user',
        content: textContent,
        content_type: 'text',
      });
    } else {
      additionalMessages.push({
        role: 'user',
        content: userContent,
        content_type: 'text',
      });
    }

    // 4. 调用Coze Chat流式API，但在服务端收集完整响应后一次性返回
    const chatUrl = `${config.apiBase}/v3/chat?conversation_id=${conversationId}`;
    const chatBody = {
      bot_id: config.botId,
      user_id: userId,
      stream: true,  // 仍然用stream调用Coze，但在服务端收集完整结果
      additional_messages: additionalMessages,
      auto_save_history: true,
    };

    const controller2 = new AbortController();
    const timeoutId = setTimeout(() => controller2.abort(), 180000);

    let chatResponse: Response;
    try {
      chatResponse = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatBody),
        signal: controller2.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return Response.json({ error: '请求超时，请稍后重试' }, { status: 504 });
      }
      return Response.json({ error: '网络请求失败' }, { status: 502 });
    }
    clearTimeout(timeoutId);

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      let errorMessage = '对话请求失败';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.msg || errorMessage;
        if (errorJson.code === 4000) errorMessage = '请求参数错误，请检查消息格式';
        else if (errorJson.code === 4006) errorMessage = 'Bot不存在或未发布到API';
      } catch { /* ignore */ }
      return Response.json({ error: errorMessage }, { status: 502 });
    }

    // 5. 读取Coze流式响应，收集完整的answer文本
    const reader = chatResponse.body?.getReader();
    if (!reader) {
      return Response.json({ error: '无法读取响应流' }, { status: 500 });
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';
    let fullAnswer = '';

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
              if (content) fullAnswer += content;
            } else if (eventType === 'conversation.chat.failed') {
              const errorMsg = json.last_error?.msg || json.data?.msg || json.msg || '对话处理失败';
              return Response.json({ error: errorMsg }, { status: 500 });
            }
            
            currentEventType = '';
          } catch {
            // JSON解析失败，忽略
          }
        }
      }
    }

    // 6. 一次性返回完整JSON响应
    return Response.json({
      conversationId,
      content: fullAnswer,
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    return Response.json({ 
      error: `服务器内部错误: ${error instanceof Error ? error.message : '未知错误'}` 
    }, { status: 500 });
  }
}
