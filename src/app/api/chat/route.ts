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

// 轮询获取Coze对话结果（非流式）
async function pollChatResult(
  config: CozeConfig,
  chatId: string,
  conversationId: string,
  maxWaitMs: number = 120000,
  pollIntervalMs: number = 1000
): Promise<{ success: boolean; content?: string; error?: string }> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // 查询对话状态
      const retrieveUrl = `${config.apiBase}/v3/chat/retrieve`;
      const retrieveResponse = await fetch(retrieveUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          conversation_id: conversationId,
        }),
      });
      
      const retrieveResult = await retrieveResponse.json() as {
        code?: number;
        data?: { id: string; status: string; last_error?: { msg: string } };
        msg?: string;
      };
      
      if (retrieveResult.code !== 0) {
        return { success: false, error: `查询状态失败: ${retrieveResult.msg || '未知错误'}` };
      }
      
      const status = retrieveResult.data?.status;
      
      if (status === 'completed') {
        // 获取消息列表
        const messagesUrl = `${config.apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`;
        const messagesResponse = await fetch(messagesUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
          },
        });
        
        const messagesResult = await messagesResponse.json() as {
          code?: number;
          data?: Array<{ role: string; type: string; content: string; content_type: string }>;
          msg?: string;
        };
        
        if (messagesResult.code !== 0 || !messagesResult.data) {
          return { success: false, error: `获取消息失败: ${messagesResult.msg || '未知错误'}` };
        }
        
        // 提取assistant的answer消息
        const answerMessage = messagesResult.data.find(
          (m) => m.role === 'assistant' && m.type === 'answer'
        );
        
        if (answerMessage) {
          return { success: true, content: answerMessage.content };
        }
        
        // 如果没有answer，尝试获取所有assistant消息
        const assistantMessages = messagesResult.data.filter((m) => m.role === 'assistant');
        if (assistantMessages.length > 0) {
          return { success: true, content: assistantMessages.map(m => m.content).join('\n') };
        }
        
        return { success: false, error: '未找到Bot回复内容' };
      }
      
      if (status === 'failed') {
        const errorMsg = retrieveResult.data?.last_error?.msg || '对话处理失败';
        return { success: false, error: errorMsg };
      }
      
      // status 为 'in_progress' 或 'created'，继续轮询
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      
    } catch (error) {
      return { success: false, error: `轮询异常: ${error instanceof Error ? error.message : '未知错误'}` };
    }
  }
  
  return { success: false, error: '请求超时，请稍后重试' };
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
  const config = getCozeConfig();

  if (!config.apiToken || !config.botId) {
    return Response.json({ 
      error: '服务配置错误',
      details: '缺少COZE_API_TOKEN或COZE_BOT_ID环境变量',
      configured: false
    }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体解析失败' }, { status: 400 });
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
    return Response.json({ 
      error: '消息格式错误',
      details: 'messages必须是非空数组'
    }, { status: 400 });
  }

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

    // 构建消息
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

    // 4. 调用Coze Chat非流式API
    const chatUrl = `${config.apiBase}/v3/chat?conversation_id=${conversationId}`;
    const chatBody = {
      bot_id: config.botId,
      user_id: userId,
      stream: false,
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
        if (errorJson.code === 4000) errorMessage = '请求参数错误，请检查消息格式';
        else if (errorJson.code === 4006) errorMessage = 'Bot不存在或未发布到API';
      } catch { /* ignore */ }
      return Response.json({ error: errorMessage }, { status: 500 });
    }

    const chatResult = await chatResponse.json() as {
      code?: number;
      data?: { id: string; conversation_id: string; status: string; last_error?: { msg: string } };
      msg?: string;
    };

    if (chatResult.code !== 0 || !chatResult.data) {
      return Response.json({ 
        error: chatResult.msg || '发起对话失败' 
      }, { status: 500 });
    }

    const chatId = chatResult.data.id;
    const chatStatus = chatResult.data.status;

    // 5. 如果已完成，直接获取消息；否则轮询
    let botContent = '';
    
    if (chatStatus === 'completed') {
      // 直接获取消息
      const messagesUrl = `${config.apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`;
      const messagesResponse = await fetch(messagesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
        },
      });
      
      const messagesResult = await messagesResponse.json() as {
        code?: number;
        data?: Array<{ role: string; type: string; content: string; content_type: string }>;
        msg?: string;
      };
      
      if (messagesResult.code !== 0 || !messagesResult.data) {
        return Response.json({ 
          error: `获取消息失败: ${messagesResult.msg || '未知错误'}` 
        }, { status: 500 });
      }
      
      const answerMessage = messagesResult.data.find(
        (m) => m.role === 'assistant' && m.type === 'answer'
      );
      
      if (answerMessage) {
        botContent = answerMessage.content;
      } else {
        const assistantMessages = messagesResult.data.filter((m) => m.role === 'assistant');
        botContent = assistantMessages.map(m => m.content).join('\n');
      }
    } else if (chatStatus === 'failed') {
      const errorMsg = chatResult.data.last_error?.msg || '对话处理失败';
      return Response.json({ error: errorMsg }, { status: 500 });
    } else {
      // 轮询等待完成
      const pollResult = await pollChatResult(config, chatId, conversationId);
      if (!pollResult.success) {
        return Response.json({ error: pollResult.error }, { status: 500 });
      }
      botContent = pollResult.content || '';
    }

    // 6. 返回完整响应
    return Response.json({
      conversationId,
      content: botContent,
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    return Response.json({ 
      error: `服务器内部错误: ${error instanceof Error ? error.message : '未知错误'}` 
    }, { status: 500 });
  }
}
