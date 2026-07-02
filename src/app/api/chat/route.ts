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
  type?: 'question' | 'answer';
}

// 上传图片到Coze获取file_id
async function uploadImageToCoze(imageUrl: string): Promise<{ success: boolean; fileId?: string; error?: string }> {
  const config = getCozeConfig();
  
  try {
    console.log('[Upload] Starting image upload to Coze...');
    
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
    
    const getExtension = (mime: string): string => {
      const extensions: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/gif': '.gif',
        'image/bmp': '.bmp',
        'image/webp': '.webp',
      };
      return extensions[mime] || '.png';
    };
    
    const extension = getExtension(mimeType);
    const filename = `image_${Date.now()}${extension}`;
    
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);
    
    const uploadUrl = `${config.apiBase}/v1/files/upload`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.apiToken}` },
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

// 从URL下载文件并上传到Coze获取file_id
async function uploadFileFromUrlToCoze(fileUrl: string, filename: string): Promise<{ success: boolean; fileId?: string; error?: string }> {
  const config = getCozeConfig();
  
  try {
    const downloadResponse = await fetch(fileUrl);
    if (!downloadResponse.ok) {
      return { success: false, error: `下载文件失败: ${downloadResponse.status}` };
    }
    
    const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await downloadResponse.arrayBuffer());
    
    const formData = new FormData();
    const blob = new Blob([buffer], { type: contentType });
    formData.append('file', blob, filename);
    
    const uploadUrl = `${config.apiBase}/v1/files/upload`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.apiToken}` },
      body: formData,
    });
    
    const uploadResult = await uploadResponse.json() as { code?: number; data?: { id: string }; msg?: string };
    
    if (uploadResult.code !== 0 || !uploadResult.data?.id) {
      return { success: false, error: `文件上传失败: ${uploadResult.msg || '未知错误'}` };
    }
    
    return { success: true, fileId: uploadResult.data.id };
  } catch (error) {
    return { success: false, error: `文件上传异常: ${error instanceof Error ? error.message : '未知错误'}` };
  }
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
      body: JSON.stringify({ bot_id: config.botId }),
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

  // 快速校验（不涉及异步操作）
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

  // 解析请求体（快速操作）
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

  // ★ 关键改动：立即创建流并返回 Response，所有耗时异步操作放在流内部执行
  // 这样 Vercel 会在毫秒级收到 Response，不会触发 10 秒超时
  const stream = new ReadableStream({
    async start(controller) {
      // 立即发送一个状态事件，确保首个字节在毫秒内发出
      const thinkingEvent = `data: ${JSON.stringify({ type: 'status', message: '正在处理...' })}\n\n`;
      controller.enqueue(encoder.encode(thinkingEvent));

      try {
        // === 以下所有异步操作都在流内部执行 ===

        // 1. 获取或创建会话ID
        let conversationId = existingConversationId || null;
        if (!conversationId) {
          const convResult = await createConversation();
          if (!convResult.success) {
            const errorEvent = `data: ${JSON.stringify({ type: 'error', error: '创建会话失败', details: convResult.error })}\n\n`;
            controller.enqueue(encoder.encode(errorEvent));
            controller.close();
            return;
          }
          conversationId = convResult.conversationId || null;
        }

        if (!conversationId) {
          const errorEvent = `data: ${JSON.stringify({ type: 'error', error: '无法获取会话ID' })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
          return;
        }

        // 发送会话ID给前端
        const conversationEvent = `data: ${JSON.stringify({ type: 'conversation', conversationId })}\n\n`;
        controller.enqueue(encoder.encode(conversationEvent));

        // 2. 获取用户最新消息
        const lastMessage = userMessages[userMessages.length - 1];
        const userContent = lastMessage?.content || '';

        // 3. 处理文件（cozeFileId已由upload接口上传获取，直接使用）
        const additionalMessages: CozeMessage[] = [];
        let cozeFileId: string | null = preUploadedFileId || null;
        const cozeFileIds = preUploadedFileIds || null;
        let contentType: 'image' | 'file' = fileType === 'image' ? 'image' : 'file';

        if (hasFile && !cozeFileId) {
          const errorEvent = `data: ${JSON.stringify({ type: 'error', error: '文件ID缺失' })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
          return;
        }

        // 4. 构建Coze消息
        // 按照Coze API规范：纯文件/图片消息必须与纯文本消息分开发送
        if (cozeFileIds && cozeFileIds.length > 0) {
          // PDF页面图片模式：发送文字+多张图片
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
            type: 'question',
          });
          // 发送所有页面图片
          const imageObjects = cozeFileIds.map(id => ({ type: 'image' as const, file_id: id }));
          const fileContent = JSON.stringify(imageObjects);
          additionalMessages.push({
            role: 'user',
            content: fileContent,
            content_type: 'object_string',
            type: 'question',
          });
        } else if (cozeFileId) {
          // 单文件模式（图片或PDF回退）
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
            type: 'question',
          });
          const fileContent = JSON.stringify([{ type: contentType, file_id: cozeFileId }]);
          additionalMessages.push({
            role: 'user',
            content: fileContent,
            content_type: 'object_string',
            type: 'question',
          });
        } else if (extractedText) {
          // ★ 没有文件ID但有提取文字（PDF提取成功，前端决定不发送文件ID）
          // 这样Bot只看到文字，不会给出PDF链接指引
          const maxTextLength = 8000;
          const truncatedText = extractedText.length > maxTextLength 
            ? extractedText.substring(0, maxTextLength) + '\n...(内容过长已截断)' 
            : extractedText;
          const textContent = `${userContent || '请分析以下内容'}\n\n---以下是文件提取的文字内容---\n${truncatedText}\n---内容结束---`;
          
          additionalMessages.push({
            role: 'user',
            content: textContent,
            content_type: 'text',
            type: 'question',
          });
        } else {
          additionalMessages.push({
            role: 'user',
            content: userContent,
            content_type: 'text',
            type: 'question',
          });
        }

        // 5. 调用Coze Chat流式API
        const chatUrl = `${config.apiBase}/v3/chat?conversation_id=${conversationId}`;
        const chatBody = {
          bot_id: config.botId,
          user_id: userId,
          stream: true,
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
            const errorEvent = `data: ${JSON.stringify({ type: 'error', error: '请求超时', details: '处理时间过长，请稍后重试' })}\n\n`;
            controller.enqueue(encoder.encode(errorEvent));
          } else {
            const errorEvent = `data: ${JSON.stringify({ type: 'error', error: '网络请求失败' })}\n\n`;
            controller.enqueue(encoder.encode(errorEvent));
          }
          controller.close();
          return;
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
          
          const errorEvent = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
          return;
        }

        // 6. 处理Coze流式响应
        const reader = chatResponse.body?.getReader();
        if (!reader) {
          const errorEvent = `data: ${JSON.stringify({ type: 'error', error: '无法读取响应流' })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType = '';

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
                const msgType = json.type || '';
                
                if (eventType === 'conversation.message.delta') {
                  const content = json.data?.content || json.content || '';
                  if (content) {
                    const event = `data: ${JSON.stringify({ type: 'text', content })}\n\n`;
                    controller.enqueue(encoder.encode(event));
                  }
                } else if (eventType === 'conversation.message.completed') {
                  // 增量消息已在delta中发送，此处仅标记完成
                  if (msgType === 'answer') {
                    console.log('[Chat] Answer completed');
                  }
                } else if (eventType === 'conversation.chat.failed') {
                  const errorMsg = json.last_error?.msg || json.data?.msg || json.msg || '对话处理失败';
                  const errorCode = json.last_error?.code || json.data?.code || json.code;
                  
                  let friendlyErrorMsg = errorMsg;
                  if (errorMsg.includes('exception occurred') && errorMsg.includes('processing your image')) {
                    friendlyErrorMsg = '图片处理时发生异常，请确保图片格式正确且大小不超过20MB';
                  } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
                    friendlyErrorMsg = '处理超时，请稍后重试';
                  } else if (errorCode === 4000) {
                    friendlyErrorMsg = '请求参数错误，请检查消息格式后重试';
                  }
                  
                  const errorEvent = `data: ${JSON.stringify({ type: 'error', error: friendlyErrorMsg, code: errorCode })}\n\n`;
                  controller.enqueue(encoder.encode(errorEvent));
                } else if (eventType === 'done') {
                  const doneEvent = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
                  controller.enqueue(encoder.encode(doneEvent));
                } else if (eventType === 'conversation.chat.completed') {
                  const doneEvent = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
                  controller.enqueue(encoder.encode(doneEvent));
                } else if (json.event === 'conversation.message.delta') {
                  const content = json.data?.content || '';
                  if (content) {
                    const event = `data: ${JSON.stringify({ type: 'text', content })}\n\n`;
                    controller.enqueue(encoder.encode(event));
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
        console.error('[Chat] Stream error:', error);
        const errorEvent = `data: ${JSON.stringify({ type: 'error', error: '服务器内部错误' })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
      }
    },
  });

  // 立即返回 Response（毫秒级），流内的异步操作不会阻塞
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
