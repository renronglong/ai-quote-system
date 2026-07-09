import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    // 用 service role key 直接执行
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 尝试插入测试数据来验证表结构，如果表不存在会报错
    // Supabase JS client 不支持直接执行 SQL，所以用 REST 方式
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: `CREATE TABLE IF NOT EXISTS users (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, phone TEXT UNIQUE NOT NULL, password TEXT NOT NULL, company_name TEXT, address TEXT, created_at TIMESTAMPTZ DEFAULT now())` }),
    });
    
    return NextResponse.json({ 
      message: 'Setup endpoint - check Supabase SQL Editor for DDL',
      status: 'This endpoint cannot execute DDL directly via Supabase REST API'
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
