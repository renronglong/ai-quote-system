import { NextRequest } from "next/server";

const PARSER_API = process.env.DRAWING_PARSER_URL || "http://api.gyparts.cn:8000";

/**
 * 压缩包批量解析代理：一次把多个 file_id 交给后端并发解析，
 * 替代前端 for 循环逐个调 /api/drawing-parse（32 个文件会跑到 150s 以上）。
 *
 * 入参：form-data，file_ids = JSON 数组字符串（后端就是这么约定的）
 * 出参：{ success, total, success_count, fail_count, results: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const fileIds = (body && (body.file_ids || body.fileIds)) || null;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return new Response(JSON.stringify({ error: "file_ids 不能为空" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const proxyForm = new FormData();
    proxyForm.append("file_ids", JSON.stringify(fileIds));

    const response = await fetch(`${PARSER_API}/api/parse/batch`, {
      method: "POST",
      body: proxyForm,
      signal: AbortSignal.timeout(280000),
    });

    const text = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: `批量解析服务返回异常: ${text.slice(0, 200)}` };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `批量解析服务异常: ${response.status}`, detail: payload }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(payload), {
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
