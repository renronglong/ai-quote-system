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
    // 业主 2026-11-13 任务表第 1 条「上传 STEP 不显示 3D」：
    // 专用识别端点只给 drawing_preview_url，不给 model_3d_url；而同上游 /api/parse/stp 会给出
    // data:model/stl;base64。这里把文件字节留一份，识别成功后补取 3D 挂到响应顶层，
    // 前端 inspect 页已有的 model_3d_url 读取逻辑即可直接渲染可旋转模型，无需改前端。
    let fileBuf: ArrayBuffer | null = null;
    let fileName = "";
    let fileType = "application/octet-stream";
    if (file && typeof file !== "string" && typeof (file as File).arrayBuffer === "function") {
      const f = file as File;
      fileBuf = await f.arrayBuffer();
      fileName = f.name || "file.stp";
      fileType = f.type || "application/octet-stream";
      proxyForm.append("file", new Blob([fileBuf], { type: fileType }), fileName);
    } else if (typeof fileId === "string" && fileId.trim()) {
      proxyForm.append("file_id", fileId.trim());
    } else {
      return new Response(JSON.stringify({ error: "需要上传 file，或提供 file_id（二选一）" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // 透传契约里的可选参数：source_type / material_grade / thickness_mm
    const optional: Record<string, string> = {};
    for (const key of ["source_type", "material_grade", "thickness_mm"]) {
      const v = incoming.get(key);
      if (typeof v === "string" && v.trim()) {
        optional[key] = v.trim();
        proxyForm.append(key, v.trim());
      }
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
    const proxyMeta: Record<string, unknown> = { type, endpoint, upstream_status: upstream.status };

    // ===== 业主 2026-11-13 任务表第 1 条：STEP 补回 3D 模型 =====
    // 5 个专用识别端点只给 drawing_preview_url，没有 model_3d_url；
    // 同一上游的 /api/parse/stp 对 .stp/.step 会返回 data:model/stl;base64（实测约 2KB）。
    // 只挑 model_3d_url（以及缺图时的 drawing_preview_url）挂到响应顶层，不覆盖专用端点的几何/价格字段，
    // 也不把 parse/stp 的其它字段混进来；补取失败一律静默，绝不影响识别主结果。
    const isStep = /\.stp$|\.step$/i.test(fileName) || optional.source_type === "step";
    if (upstream.ok && isStep && fileBuf) {
      try {
        const fd3d = new FormData();
        fd3d.append("file", new Blob([fileBuf], { type: fileType }), fileName);
        if (optional.material_grade) fd3d.append("material_grade", optional.material_grade);
        const r3d = await fetch(`${PARSER_API}/api/parse/stp`, {
          method: "POST",
          body: fd3d,
          signal: AbortSignal.timeout(20000),
        });
        if (r3d.ok) {
          const j3d = (await r3d.json()) as Record<string, unknown>;
          if (typeof j3d.model_3d_url === "string" && j3d.model_3d_url.trim()) {
            body.model_3d_url = j3d.model_3d_url;
            (proxyMeta).model3d = "parse/stp";
          }
          if (!body.drawing_preview_url && typeof j3d.drawing_preview_url === "string" && j3d.drawing_preview_url.trim()) {
            body.drawing_preview_url = j3d.drawing_preview_url;
          }
        }
      } catch {
        // 3D 是展示增强项，补取失败时保持专用端点原响应（静态图纸仍可看）
      }
    }

    return new Response(
      JSON.stringify({ ...body, _proxy: proxyMeta }),
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
