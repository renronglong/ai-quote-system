import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from "@/storage/database/supabase-client";

// Coze支持的文件格式
const SUPPORTED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const SUPPORTED_DOC_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx', '.xls'];
const SUPPORTED_EXTS = [...SUPPORTED_IMAGE_EXTS, ...SUPPORTED_DOC_EXTS];

// MIME类型到扩展名的映射
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/markdown': '.md',
};

// HEIC/HEIF的MIME类型
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

export async function POST(request: NextRequest) {
  try {
    const apiToken = process.env.COZE_API_TOKEN;
    const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';

    if (!apiToken) {
      return NextResponse.json({ error: '服务器配置缺失' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const taskMode = formData.get('task_mode') === 'true'; // 是否同时存储到Supabase供工单使用

    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    console.log(`[Upload] 收到文件: name="${file.name}", type="${file.type}", size=${file.size} bytes, taskMode=${taskMode}`);

    let fileName = file.name;
    let fileType = file.type;
    const buffer = await file.arrayBuffer();

    // 检查是否是HEIC/HEIF格式（iPhone照片）
    const isHEIC = HEIC_MIME_TYPES.includes(fileType) || 
                   fileName.toLowerCase().endsWith('.heic') || 
                   fileName.toLowerCase().endsWith('.heif');
    
    if (isHEIC) {
      console.log('[Upload] 检测到HEIC/HEIF格式，Coze不支持，需要转换');
      return NextResponse.json(
        { error: '不支持HEIC/HEIF格式，请先将图片转换为JPG或PNG格式再上传' },
        { status: 400 }
      );
    }

    // 规范化文件扩展名
    const lowerName = fileName.toLowerCase();
    const extMatch = lowerName.match(/\.[a-z0-9]+$/);
    const currentExt = extMatch ? extMatch[0] : '';

    if (currentExt && !SUPPORTED_EXTS.includes(currentExt)) {
      const inferredExt = MIME_TO_EXT[fileType];
      if (inferredExt) {
        fileName = fileName.replace(/\.[^.]*$/, '') + inferredExt;
      }
    }

    if (!currentExt) {
      const inferredExt = MIME_TO_EXT[fileType];
      if (inferredExt) {
        fileName = fileName + inferredExt;
      } else {
        fileName = fileName + '.png';
      }
    }

    if (!fileType || fileType === 'application/octet-stream') {
      const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '.png';
      const mimeFromExt = Object.entries(MIME_TO_EXT).find(([_, e]) => e === ext)?.[0];
      if (mimeFromExt) {
        fileType = mimeFromExt;
      } else {
        fileType = 'image/png';
      }
    }

    console.log(`[Upload] 最终文件名: "${fileName}", MIME: "${fileType}"`);

    // ===== 上传到 Coze =====
    const uploadFormData = new FormData();
    const blob = new Blob([buffer], { type: fileType });
    uploadFormData.append('file', blob, fileName);

    const uploadResponse = await fetch(`${apiBase}/v1/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: uploadFormData,
    });

    const result = await uploadResponse.json() as { code?: number; data?: { id: string; size?: number }; msg?: string };

    if (result.code !== 0 || !result.data?.id) {
      console.error('[Upload] Coze返回错误:', result);
      return NextResponse.json(
        { error: result.msg || '文件上传失败' },
        { status: 500 }
      );
    }

    console.log(`[Upload] Coze成功: cozeFileId=${result.data.id}`);

    // ===== 同时存储到 Supabase Storage（工单模式） =====
    let publicUrl: string | null = null;
    if (taskMode) {
      try {
        const supabase = getSupabaseClient();
        const now = new Date();
        const dateFolder = now.toISOString().slice(0, 10).replace(/-/g, '');
        const uniqueName = `${Date.now()}_${fileName}`;
        const storagePath = `${dateFolder}/${uniqueName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-files')
          .upload(storagePath, Buffer.from(buffer), {
            contentType: fileType,
            upsert: false,
          });
        
        if (uploadError) {
          console.error('[Upload] Supabase存储失败:', uploadError.message);
        } else {
          const { data: urlData } = supabase.storage
            .from('task-files')
            .getPublicUrl(storagePath);
          publicUrl = urlData.publicUrl;
          console.log(`[Upload] 已存储到Supabase: ${publicUrl}`);
        }
      } catch (storageErr) {
        console.error('[Upload] Supabase存储异常:', storageErr);
        // 不阻断主流程
      }
    }

    return NextResponse.json({
      success: true,
      cozeFileId: result.data.id,
      url: publicUrl,
      fileName: fileName,
      fileType: fileType,
      fileSize: file.size,
    });
  } catch (err) {
    console.error('[Upload] 上传失败:', err);
    return NextResponse.json(
      { error: '上传失败，请重试' },
      { status: 500 }
    );
  }
}
