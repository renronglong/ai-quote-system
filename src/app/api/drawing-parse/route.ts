import { NextRequest } from "next/server";

const PARSER_API = process.env.DRAWING_PARSER_URL || "http://129.204.40.114:8000";

const FORMAT_ENDPOINTS: Record<string, string> = {
  '.stp': '/api/parse/stp',
  '.step': '/api/parse/stp',
  '.igs': '/api/parse/stp',
  '.iges': '/api/parse/stp',
  '.x_t': '/api/parse/stp',
  '.dwg': '/api/parse/dwg',
  '.dxf': '/api/parse/dxf',
  '.pdf': '/api/parse/pdf',
};

/** 带重试的 fetch：跨国网络不稳定，失败自动重试最多 3 次 */
async function fetchWithRetry(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        // 指数退避：1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError!;
}

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
      const fileName = decodeURIComponent(request.headers.get("x-file-name") || "file.stp");
      const ext = '.' + fileName.split('.').pop()?.toLowerCase();
      const endpoint = FORMAT_ENDPOINTS[ext] || "/api/parse/upload";

      const response = await fetchWithRetry(
        `${PARSER_API}${endpoint}`,
        { method: "POST", body: proxyForm, signal: AbortSignal.timeout(120000) },
      );

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
    }

    // 原有逻辑：直接上传文件
    const blob = new Blob([await file!.arrayBuffer()], { type: file!.type || 'application/octet-stream' });
    proxyForm.append("file", blob, file!.name);
    const ext = '.' + file!.name.split('.').pop()?.toLowerCase();
    const endpoint = FORMAT_ENDPOINTS[ext] || "/api/parse/upload";

    const response = await fetchWithRetry(
      `${PARSER_API}${endpoint}`,
      { method: "POST", body: proxyForm, signal: AbortSignal.timeout(120000) },
    );

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
