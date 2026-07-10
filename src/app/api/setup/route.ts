import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || "";
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/);
    const ref = refMatch ? refMatch[1] : "";
    
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    
    const sql = "CREATE TABLE IF NOT EXISTS users (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, phone TEXT UNIQUE NOT NULL, password TEXT NOT NULL, company_name TEXT, address TEXT, created_at TIMESTAMPTZ DEFAULT now())";
    
    const attempts: any[] = [];
    
    const specResp = await fetch(`${baseUrl}/rest/v1/`, {
      headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });
    const spec = await specResp.json();
    attempts.push({ method: "spec_check", paths: Object.keys(spec.paths || {}) });
    
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
