import { NextRequest, NextResponse } from 'next/server';

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

    if (!file) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }

    console.log(`[Upload] 收到文件: name="${file.name}", type="${file.type}", size=${file.size} bytes`);

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

    // 如果扩展名不在支持列表中，尝试从MIME类型推断
    if (currentExt && !SUPPORTED_EXTS.includes(currentExt)) {
      console.log(`[Upload] 不支持的扩展名: ${currentExt}，尝试从MIME类型推断`);
      const inferredExt = MIME_TO_EXT[fileType];
      if (inferredExt) {
        fileName = fileName.replace(/\.[^.]*$/, '') + inferredExt;
        console.log(`[Upload] 扩展名已修正为: ${inferredExt}`);
      }
    }

    // 如果没有扩展名，从MIME类型添加
    if (!currentExt) {
      const inferredExt = MIME_TO_EXT[fileType];
      if (inferredExt) {
        fileName = fileName + inferredExt;
        console.log(`[Upload] 已添加扩展名: ${inferredExt}`);
      } else {
        fileName = fileName + '.png'; // 默认PNG
        console.log('[Upload] 已添加默认扩展名: .png');
      }
    }

    // 确保MIME类型正确
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

    // 上传到 Coze
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

    console.log(`[Upload] 成功: cozeFileId=${result.data.id}`);

    return NextResponse.json({
      success: true,
      cozeFileId: result.data.id,
      url: null,
    });
  } catch (err) {
    console.error('[Upload] 上传失败:', err);
    return NextResponse.json(
      { error: '上传失败，请重试' },
      { status: 500 }
    );
  }
}
