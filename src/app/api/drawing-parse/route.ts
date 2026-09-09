import { NextRequest } from "next/server";

const PARSER_API = process.env.DRAWING_PARSER_URL || "http://129.204.40.114:8000";

// 3D CAD 格式映射到对应解析端点
const FORMAT_ENDPOINTS: Record<string, string> = {
  '.stp': '/api/parse/stp',
  '.step': '/api/parse/stp',
  '.igs': '/api/parse/stp',
  '.iges': '/api/parse/stp',
  '.x_t': '/api/parse/stp',
  '.dwg': '/api/parse/dwg',
  '.dxf': '/api/parse/dxf',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "未收到文件" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 根据文件扩展名选择解析端点
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const endpoint = FORMAT_ENDPOINTS[ext] || "/api/parse/upload";

    // 转发到 drawing_parser API
    const proxyForm = new FormData();
    const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' });
    proxyForm.append("file", blob, file.name);

    const response = await fetch(`${PARSER_API}${endpoint}`, {
      method: "POST",
      body: proxyForm,
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `解析服务异常: ${response.status}`, detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: `请求失败: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
