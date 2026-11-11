import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 报价单存档：
// - 旧链路（/api/quote-sheet 导出）在 {userId}/{quoteNo}.json 存元数据 + xlsx/pdf
// - 新链路（「我的报价」导出弹窗点保存）在 {userId}/saved/{quoteNo}.json 存完整报价单内容，
//   供子页面 /history/sheets 按「导出报价单」的 12 列格式还原展示
const SUPA_URL = 'https://jotgxnhueagbsvfeepic.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';
const BUCKET = 'quote-sheets';
const SAVED_DIR = 'saved';

function client() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}
// 只允许安全字符，避免把 user_id / quote_no 拼成跨目录路径
function safeKey(s: unknown): s is string {
  return typeof s === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(s);
}
function totalsOf(body: any) {
  const items: any[] = Array.isArray(body?.items) ? body.items : [];
  return {
    ex_sum: Number(items.reduce((a, it) => a + (Number(it.price_ex_tax) || 0), 0).toFixed(2)),
    inc_sum: Number(items.reduce((a, it) => a + (Number(it.price_inc_tax) || 0), 0).toFixed(2)),
    mold_sum: Number(items.reduce((a, it) => a + (Number(it.mold_fee) || 0), 0).toFixed(2)),
    item_count: items.length,
  };
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!safeKey(userId)) {
    return NextResponse.json({ success: false, error: '缺少/非法 user_id' }, { status: 400 });
  }
  try {
    const sb = client();
    const [legacyRes, savedRes] = await Promise.all([
      sb.storage.from(BUCKET).list(userId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
      sb.storage.from(BUCKET).list(`${userId}/${SAVED_DIR}`, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
    ]);
    if (legacyRes.error) throw legacyRes.error;
    const legacyFiles = (legacyRes.data || []).filter(f => f.name.endsWith('.json'));
    // saved 子目录可能还不存在（老账号第一次用），此时按空列表处理
    const savedFiles = savedRes.error ? [] : (savedRes.data || []).filter(f => f.name.endsWith('.json'));

    const legacyRecords = await Promise.all(legacyFiles.slice(0, 50).map(async (f) => {
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
        saved: false,
        body: null as any,
      };
    }));

    const savedRecords = await Promise.all(savedFiles.slice(0, 100).map(async (f) => {
      const { data: blob } = await sb.storage.from(BUCKET).download(`${userId}/${SAVED_DIR}/${f.name}`);
      let meta: any = {};
      try { meta = JSON.parse(await blob!.text()); } catch { /* ignore */ }
      const body = meta.body || null;
      const t = totalsOf(body);
      return {
        quote_no: meta.quote_no || f.name.replace(/\.json$/, ''),
        customer_name: meta.customer_name || body?.customer_name || '',
        ex_sum: meta.ex_sum ?? t.ex_sum,
        inc_sum: meta.inc_sum ?? t.inc_sum,
        mold_sum: meta.mold_sum ?? t.mold_sum,
        item_count: meta.item_count ?? t.item_count,
        created_at: meta.created_at || f.created_at || null,
        xlsx_url: '',
        pdf_url: '',
        saved: true,
        body,
      };
    }));

    const records = [...legacyRecords, ...savedRecords];
    records.sort((a, b) => (String(a.created_at) < String(b.created_at) ? 1 : -1));
    return NextResponse.json({ success: true, records }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[QuoteSheets] 列表失败:', err);
    return NextResponse.json({ success: false, error: err?.message || '获取失败' }, { status: 500 });
  }
}

// 保存：把导出弹窗里的完整报价单内容落库，不生成 Excel/PDF（快），子页面按同格式还原
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const userId = payload?.user_id;
    const quoteNo = payload?.quote_no;
    const body = payload?.body;
    if (!safeKey(userId) || !safeKey(quoteNo)) {
      return NextResponse.json({ success: false, error: '缺少/非法 user_id 或 quote_no' }, { status: 400 });
    }
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: '报价单内容为空' }, { status: 400 });
    }
    const totals = totalsOf(body);
    const record = {
      quote_no: quoteNo,
      customer_name: body.customer_name || '',
      user_id: userId,
      ...totals,
      created_at: new Date().toISOString(),
      body,
    };
    const { error } = await client().storage.from(BUCKET).upload(
      `${userId}/${SAVED_DIR}/${quoteNo}.json`,
      JSON.stringify(record),
      { contentType: 'application/json', upsert: true, cacheControl: '0' },
    );
    if (error) throw error;
    return NextResponse.json({
      success: true,
      quote_no: quoteNo,
      record: { ...record, xlsx_url: '', pdf_url: '', saved: true },
    });
  } catch (err: any) {
    console.error('[QuoteSheets] 保存失败:', err);
    return NextResponse.json({ success: false, error: err?.message || '保存失败' }, { status: 500 });
  }
}

// 删除：saved 只删 json；legacy 连 xlsx/pdf 一起删
export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  const quoteNo = request.nextUrl.searchParams.get('quote_no');
  const kind = request.nextUrl.searchParams.get('kind') || 'saved';
  if (!safeKey(userId) || !safeKey(quoteNo)) {
    return NextResponse.json({ success: false, error: '缺少/非法参数' }, { status: 400 });
  }
  try {
    const files = kind === 'legacy'
      ? [`${userId}/${quoteNo}.json`, `${userId}/${quoteNo}.xlsx`, `${userId}/${quoteNo}.pdf`]
      : [`${userId}/${SAVED_DIR}/${quoteNo}.json`];
    const { error } = await client().storage.from(BUCKET).remove(files);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[QuoteSheets] 删除失败:', err);
    return NextResponse.json({ success: false, error: err?.message || '删除失败' }, { status: 500 });
  }
}
