import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || "";
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    // 从 supabaseUrl 提取 ref
    const refMatch = supabaseUrl.match(/https:\\/\\/([^.]+)\\.supabase/);
    const ref = refMatch ? refMatch[1] : "";
    
    // 尝试通过 Supabase REST API 执行 DDL
    // 先试试有没有隐藏的 SQL 执行端点
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    
    // 方法1: 通过 pg REST 的 SQL 端点
    const sql = "CREATE TABLE IF NOT EXISTS users (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, phone TEXT UNIQUE NOT NULL, password TEXT NOT NULL, company_name TEXT, address TEXT, created_at TIMESTAMPTZ DEFAULT now())";
    
    // 尝试各种可能的端点
    const attempts = [];
    
    // 试试通过 OpenAPI spec 看看有什么可用功能
    const specResp = await fetch(`${baseUrl}/rest/v1/`, {
      headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });
    const spec = await specResp.json();
    attempts.push({ method: "spec_check", paths: Object.keys(spec.paths || {}) });
    
    // 试试通过 pg net 的方式 (某些 Supabase 部署支持)
    const pgNetResp = await fetch(`${baseUrl}/pg/`, {
      headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      method: "POST",
      body: JSON.stringify({ sql })
    }).catch(() => null);
    
    if (pgNetResp) {
      attempts.push({ method: "pg_net", status: pgNetResp.status, body: await pgNetResp.text() });
    }
    
    return NextResponse.json({ 
      message: "Setup check completed",
      ref,
      attempts,
      hint: "DDL not supported via REST API"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
