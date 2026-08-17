import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const SERVICE_KEY = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST() {
  try {
    const refMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase/);
    const ref = refMatch ? refMatch[1] : '';

    const sql = 'ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS num_dies INTEGER DEFAULT 1;';
    
    const mgmtResp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (mgmtResp.ok) {
      return NextResponse.json({ success: true, message: 'num_dies 字段添加成功' });
    }
    
    const errText = await mgmtResp.text();
    return NextResponse.json({ 
      success: false, 
      message: '执行失败',
      detail: errText,
      hint: `打开 https://supabase.com/dashboard/project/${ref}/sql/new 手动执行: ${sql}`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message });
  }
}
