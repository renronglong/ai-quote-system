import { NextRequest } from "next/server";

const PARSER_API = process.env.DRAWING_PARSER_URL || "http://api.gyparts.cn:8000";

// 注意：.igs/.iges/.x_t 以前被硬塞进 /api/parse/stp，后端新加的 IGES / Parasolid
// 端点根本不会被调用。这里改成各自的新端点。
const FORMAT_ENDPOINTS: Record<string, string> = {
  '.stp': '/api/parse/stp',
  '.step': '/api/parse/stp',
  '.igs': '/api/parse/iges',
  '.iges': '/api/parse/iges',
  '.x_t': '/api/parse/parasolid',
  '.x_b': '/api/parse/parasolid',
  '.dwg': '/api/parse/dwg',
  '.dxf': '/api/parse/dxf',
  '.pdf': '/api/parse/pdf',
};

// 后端新端点还没上线时（404）退回 STEP 解析器，保证不比改动前更差
const FALLBACK_ENDPOINT = '/api/parse/stp';

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
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError!;
}

/**
 * 调解析服务。目标端点 404（后端还没部署）时自动退回 STEP 解析器。
 * buildForm 每次重新构造 FormData —— 同一个 FormData 不能保证被 fetch 复用两次。
 */
async function postParser(buildForm: () => FormData, endpoint: string): Promise<Response> {
  let res = await fetchWithRetry(
    `${PARSER_API}${endpoint}`,
    { method: 'POST', body: buildForm(), signal: AbortSignal.timeout(120000) },
  );
  if (res.status === 404 && endpoint !== FALLBACK_ENDPOINT) {
    res = await fetchWithRetry(
      `${PARSER_API}${FALLBACK_ENDPOINT}`,
      { method: 'POST', body: buildForm(), signal: AbortSignal.timeout(120000) },
    );
  }
  return res;
}


/**
 * 把解析服务的结果对前端做一层「人话化」。
 * 典型场景：把 2D 工程图（DWG/DXF 导出的线框）误存成 STEP，FreeCAD 能读文件但没有 3D 实体，
 * 后端抛 "Shape is null" / "Null shape" / "empty shape" 之类堆栈——用户看不懂。
 */
function humanizeParseResult(result: any, fileName?: string): any {
  if (result && result.parse_success === false) {
    const raw = String(result.error || result.parse_errors || result.detail || '');
    const noSolid = /shape\s*is\s*null|null\s*shape|empty\s*shape|no\s*(valid\s*)?(solid|shape)|没有.*实体|无.*3d/i.test(raw);
    if (noSolid) {
      return {
        ...result,
        error_code: 'unsupported_format',
        message: '这个 STEP 文件里没有 3D 实体（看起来是 2D 工程图导出来的）。请上传真正的 3D 实体模型；如果只有工程图，请导出为 PDF 或图片（JPG/PNG）后再上传。',
        hint: '工程图请用 PDF/图片；STEP 必须含三维实体',
      };
    }
    // 其他解析失败：保留后端原始信息，但剥掉过长堆栈（前端只显示前 300 字）
    if (raw.length > 300) {
      return { ...result, error: raw.slice(0, 300) + '…' };
    }
  }
  return result;
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

      const response = await postParser(() => {
        const fd = new FormData();
        fd.append("file_id", fileId!);
        return fd;
      }, endpoint);

      if (!response.ok) {
        const errText = await response.text();
        return new Response(
          JSON.stringify({ error: `解析服务异常: ${response.status}`, detail: errText }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = humanizeParseResult(await response.json(), request.headers.get("x-file-name") || undefined);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 原有逻辑：直接上传文件
    const raw = await file!.arrayBuffer();
    const endpoint = FORMAT_ENDPOINTS['.' + file!.name.split('.').pop()?.toLowerCase()] || "/api/parse/upload";

    const response = await postParser(() => {
      const fd = new FormData();
      fd.append("file", new Blob([raw], { type: file!.type || 'application/octet-stream' }), file!.name);
      return fd;
    }, endpoint);

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `解析服务异常: ${response.status}`, detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = humanizeParseResult(await response.json(), file!.name);
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
