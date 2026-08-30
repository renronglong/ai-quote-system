import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 历史报价单列表：读 quote-sheets 桶内 {userId}/xxx.json 元数据
const SUPA_URL = 'https://jotgxnhueagbsvfeepic.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';
const BUCKET = 'quote-sheets';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ success: false, error: '缺少 user_id' }, { status: 400 });
  }
  try {
    const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await sb.storage.from(BUCKET).list(userId, {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) throw error;
    const jsonFiles = (data || []).filter((f) => f.name.endsWith('.json'));
    const records = await Promise.all(jsonFiles.slice(0, 50).map(async (f) => {
      const { data: metaData } = await sb.storage.from(BUCKET).download(`${userId}/${f.name}`);
      let meta: any = {};
      try { meta = JSON.parse(await metaData!.text()); } catch { /* ignore */ }
      const base = f.name.replace(/\.json$/, '');
      return {
        quote_no: meta.quote_no || base,
        customer_name: meta.customer_name || '',
        ex_sum: meta.ex_sum || 0,
        inc_sum: meta.inc_sum || 0,
        mold_sum: meta.mold_sum || 0,
        item_count: meta.item_count || 0,
        created_at: meta.created_at || f.created_at || null,
        xlsx_url: `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${userId}/${encodeURIComponent(base)}.xlsx`,
        pdf_url: `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${userId}/${encodeURIComponent(base)}.pdf`,
      };
    }));
    records.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return NextResponse.json({ success: true, records });
  } catch (err: any) {
    console.error('[QuoteSheets] 列表失败:', err);
    return NextResponse.json({ success: false, error: err?.message || '获取失败' }, { status: 500 });
  }
}
