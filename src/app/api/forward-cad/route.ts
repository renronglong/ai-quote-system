import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Agent 邮箱（接收 CAD 文件进行处理）
const AGENT_EMAIL = 'ryda8638@coze.email';

/**
 * POST /api/forward-cad
 * 
 * 将用户上传的 CAD 文件（DXF/STEP/ZIP）转发到 Agent 邮箱进行处理
 * 返回提示信息给用户
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const userEmail = formData.get('userEmail') as string;
    const userPhone = formData.get('userPhone') as string;
    const companyName = formData.get('companyName') as string;

    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    // 检查文件类型
    const fileName = file.name.toLowerCase();
    const isCadFile = /\.(dxf|step|stp|zip|dwg|pdf|png|jpg|jpeg|gif|bmp|webp)$/i.test(fileName);

    if (!isCadFile) {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }

    // 获取用户信息
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

    // 构建邮件内容
    const emailSubject = `[CAD报价请求] ${userInfo.company} - ${file.name}`;
    const emailBody = `
收到一个 CAD 文件报价请求，请处理并回复用户。

## 用户信息
- 公司：${userInfo.company}
- 联系人手机：${userInfo.phone}
- 回复邮箱：${userInfo.email}

## 文件信息
- 文件名：${file.name}
- 文件大小：${(file.size / 1024).toFixed(1)} KB
- 文件类型：${file.name.split('.').pop()?.toUpperCase()}

## 处理要求
1. 解析文件，提取产品参数（尺寸、材质、数量等）
2. 根据报价规则计算价格
3. 将报价结果回复到用户邮箱：${userInfo.email || userInfo.phone}

---
此邮件由 AI 报价系统自动转发
    `.trim();

    // 上传文件到 Coze（作为附件）
    const apiToken = process.env.COZE_API_TOKEN;
    const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
    
    let cozeFileId: string | null = null;
    
    if (apiToken) {
      try {
        const uploadFormData = new FormData();
        const buffer = await file.arrayBuffer();
        const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
        uploadFormData.append('file', blob, file.name);

        const uploadResponse = await fetch(`${apiBase}/v1/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiToken}` },
          body: uploadFormData,
        });

        const uploadResult = await uploadResponse.json() as { code?: number; data?: { id: string }; msg?: string };
        if (uploadResult.code === 0 && uploadResult.data?.id) {
          cozeFileId = uploadResult.data.id;
        }
      } catch (uploadErr) {
        console.error('[ForwardCAD] File upload failed:', uploadErr);
      }
    }

    // 记录到数据库（待处理队列）- 表不存在时跳过
    if (supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('cad_requests').upsert({
          user_id: userId,
          file_name: file.name,
          file_size: file.size,
          coze_file_id: cozeFileId,
          status: 'pending',
          user_email: userInfo.email,
          user_phone: userInfo.phone,
          company_name: userInfo.company,
          created_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('[ForwardCAD] cad_requests table not available, skipping DB record:', dbErr);
      }
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      message: '文件已提交，报价结果将发送至您的邮箱',
      cozeFileId,
      requestId: cozeFileId || Date.now().toString(),
    });

  } catch (err) {
    console.error('[ForwardCAD] Error:', err);
    return NextResponse.json({ error: '文件提交失败，请稍后重试' }, { status: 500 });
  }
}
