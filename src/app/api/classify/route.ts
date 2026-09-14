import { NextRequest } from "next/server";

const PARSER_API = process.env.DRAWING_PARSER_URL || "http://129.204.40.114:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileId = formData.get("file_id") as string | null;

    if (!file && !fileId) {
      return new Response(JSON.stringify({ error: "未收到文件或 file_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const proxyForm = new FormData();

    if (fileId) {
      proxyForm.append("file_id", fileId);
    } else {
      const blob = new Blob([await file!.arrayBuffer()], { type: file!.type || 'application/octet-stream' });
      proxyForm.append("file", blob, file!.name);
    }

    const response = await fetch(`${PARSER_API}/api/classify/process`, {
      method: "POST",
      body: proxyForm,
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `分类服务异常: ${response.status}`, detail: errText }),
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
