import { NextRequest, NextResponse } from 'next/server';
import { parseDxfForSheetMetal } from '@/lib/dxf-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Content-Type 必须为 multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未收到文件，请上传 .dxf 文件' },
        { status: 400 }
      );
    }

    // 校验文件扩展名
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.dxf')) {
      return NextResponse.json(
        { success: false, error: '仅支持 .dxf 格式文件' },
        { status: 400 }
      );
    }

    // 校验文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `文件过大（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）` },
        { status: 400 }
      );
    }

    // 读取 DXF 文本内容
    const dxfContent = await file.text();
    if (!dxfContent || dxfContent.length < 10) {
      return NextResponse.json(
        { success: false, error: 'DXF 文件内容为空或损坏' },
        { status: 400 }
      );
    }

    // 调用解析器
    const result = parseDxfForSheetMetal(dxfContent);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '解析失败' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (err) {
    console.error('[parse-dxf] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : '服务器内部错误',
      },
      { status: 500 }
    );
  }
}
