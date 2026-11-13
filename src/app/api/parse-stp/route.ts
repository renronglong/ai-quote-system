import { NextRequest } from "next/server";

/**
 * 业主 2026-11-13 19:xx：STEP 3D 模型「按需补取」专用端点。
 *
 * 背景：/api/recognize-special 在识别响应里顺带补取 3D（调上游 /api/parse/stp），
 * 但大 STEP（如 6840.stp，330KB）的上游 3D 解析要 30s+，与识别主请求叠加会撞中间层 ~30s 超时，
 * 导致识别响应里经常 model3d=skipped_or_timeout —— 识别页能看、但 inspect 没有 3D。
 *
 * 本端点把 3D 单独抽出来：前端在「识别页后台 / 图纸信息页」按需慢慢取（自有 55s 预算），
 * 不阻塞识别主响应。识别响应里的 3D 仍是首选快速路径，本端点是可靠兜底。
 *
 * 上游同 PARSER_API：RECOGNIZE_PARSER_URL > DRAWING_PARSER_URL > 契约默认。
 */
const PARSER_API =
  process.env.RECOGNIZE_PARSER_URL ||
  process.env.DRAWING_PARSER_URL ||
  "http://129.204.40.114:8000";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();
    const file = incoming.get("file");
    const fileId = incoming.get("file_id");
    const proxyForm = new FormData();
    let hasFile = false;
    if (file && typeof file !== "string" && typeof (file as File).arrayBuffer === "function") {
      const f = file as File;
      proxyForm.append("file", new Blob([await f.arrayBuffer()], { type: f.type || "application/octet-stream" }), f.name || "file.stp");
      hasFile = true;
    } else if (typeof fileId === "string" && fileId.trim()) {
      proxyForm.append("file_id", fileId.trim());
      hasFile = true;
    }
    if (!hasFile) {
      return new Response(JSON.stringify({ error: "需要上传 file，或提供 file_id（二选一）" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // 只取 3D，自有 55s 预算；不与其他请求争抢，单独调用上游通常 ~15s 即可返回。
    const r3d = await fetch(`${PARSER_API}/api/parse/stp`, {
      method: "POST",
      body: proxyForm,
      signal: AbortSignal.timeout(55000),
    });
    if (!r3d.ok) {
      return new Response(JSON.stringify({ error: `上游 3D 解析失败 (${r3d.status})` }), {
        status: 502, headers: { "Content-Type": "application/json" },
      });
    }
    const j = (await r3d.json()) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    if (typeof j.model_3d_url === "string" && j.model_3d_url.trim()) out.model_3d_url = j.model_3d_url;
    if (typeof j.drawing_preview_url === "string" && j.drawing_preview_url.trim()) out.drawing_preview_url = j.drawing_preview_url;
    return new Response(JSON.stringify(out), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: `3D 解析请求失败: ${msg}` }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
