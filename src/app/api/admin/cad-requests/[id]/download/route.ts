import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAdminFromRequest } from '@/lib/admin';

export const runtime = 'nodejs';

// GET - Get file download URL for a cad_request via Coze API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ success: false, error: '无管理员权限' }, { status: 403 });
  }
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少工单ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const { data: record, error } = await client
      .from('cad_requests')
      .select('coze_file_id, file_name')
      .eq('id', id)
      .single();

    if (error || !record) {
      return NextResponse.json(
        { success: false, error: '工单不存在' },
        { status: 404 }
      );
    }

    const cozeFileId = record.coze_file_id;
    if (!cozeFileId) {
      return NextResponse.json(
        { success: false, error: '文件ID不存在' },
        { status: 404 }
      );
    }

    const apiToken = process.env.COZE_API_TOKEN;
    const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';

    if (!apiToken) {
      return NextResponse.json(
        { success: false, error: 'Coze API Token 未配置' },
        { status: 500 }
      );
    }

    // Get download URL from Coze API
    const response = await fetch(
      `${apiBase}/v1/files/${encodeURIComponent(cozeFileId)}/download`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Coze file download error:', response.status, errText);
      return NextResponse.json(
        { success: false, error: `获取下载链接失败: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json() as {
      code?: number;
      data?: { file_url?: string; download_url?: string; url?: string };
      msg?: string;
    };

    if (result.code !== 0) {
      return NextResponse.json(
        { success: false, error: result.msg || '获取下载链接失败' },
        { status: 500 }
      );
    }

    const downloadUrl =
      result.data?.file_url ||
      result.data?.download_url ||
      result.data?.url ||
      '';

    if (!downloadUrl) {
      return NextResponse.json(
        { success: false, error: '未获取到下载链接' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      download_url: downloadUrl,
      file_name: record.file_name,
    });
  } catch (error) {
    console.error('获取文件下载链接失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取下载链接失败' },
      { status: 500 }
    );
  }
}
