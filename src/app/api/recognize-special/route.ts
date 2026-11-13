import { NextRequest } from "next/server";

/**
 * 业主 2026-11-13《gyparts 专用材料识别接口契约》同域代理。
 *
 * 上游：http://129.204.40.114:8000 的 5 个专用端点 /api/recognize/{extrusion,sheet,casting,injection,steel}
 *   站点是 HTTPS，浏览器不能直连明文 HTTP（mixed-content 会被拦），且上游无认证，
 *   因此一律由本路由在服务端转发：前端只访问同域 /api/recognize-special?type=xxx。
 *
 * 上游地址优先级：RECOGNIZE_PARSER_URL > DRAWING_PARSER_URL > 契约默认 http://129.204.40.114:8000。
 * 若线上已配 DRAWING_PARSER_URL（现有识别链路用 api.gyparts.cn:8000），自动沿用，无需改动。
 */
const PARSER_API =
  process.env.RECOGNIZE_PARSER_URL ||
  process.env.DRAWING_PARSER_URL ||
  "http://129.204.40.114:8000";

// 白名单：前端只能指定这 5 个端点，避免任意路径转发
const ENDPOINTS: Record<string, string> = {
  extrusion: "/api/recognize/extrusion",
  sheet: "/api/recognize/sheet",
  casting: "/api/recognize/casting",
  injection: "/api/recognize/injection",
  steel: "/api/recognize/steel",
};

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "extrusion";
    const endpoint = ENDPOINTS[type];
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: `不支持的材料类型: ${type}`, supported: Object.keys(ENDPOINTS) }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const incoming = await request.formData();
    const proxyForm = new FormData();

    const file = incoming.get("file");
    const fileId = incoming.get("file_id");
    if (file && typeof file !== "string" && typeof (file as File).arrayBuffer === "function") {
      const f = file as File;
      const blob = new Blob([await f.arrayBuffer()], { type: f.type || "application/octet-stream" });
      proxyForm.append("file", blob, f.name);
    } else if (typeof fileId === "string" && fileId.trim()) {
      proxyForm.append("file_id", fileId.trim());
    } else {
      return new Response(JSON.stringify({ error: "需要上传 file，或提供 file_id（二选一）" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // 透传契约里的可选参数：source_type / material_grade / thickness_mm
    for (const key of ["source_type", "material_grade", "thickness_mm"]) {
      const v = incoming.get(key);
      if (typeof v === "string" && v.trim()) proxyForm.append(key, v.trim());
    }

    const upstream = await fetch(`${PARSER_API}${endpoint}`, {
      method: "POST",
      body: proxyForm,
      signal: AbortSignal.timeout(170000),
    });

    const text = await upstream.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { raw: text.slice(0, 4000) };
    }

    // 附一小段元信息，方便管理员排查走的是哪个专用端点（不覆盖上游同名字段语义）
    return new Response(
      JSON.stringify({ ...body, _proxy: { type, endpoint, upstream_status: upstream.status } }),
      {
        status: upstream.ok ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: `专用识别接口请求失败: ${msg}` }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
