import { NextRequest, NextResponse } from 'next/server';

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

    // 上传到 Coze
    const uploadFormData = new FormData();
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    uploadFormData.append('file', blob, file.name);

    const uploadResponse = await fetch(`${apiBase}/v1/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: uploadFormData,
    });

    const result = await uploadResponse.json() as { code?: number; data?: { id: string; size?: number }; msg?: string };

    if (result.code !== 0 || !result.data?.id) {
      return NextResponse.json(
        { error: result.msg || '文件上传失败' },
        { status: 500 }
      );
    }

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
