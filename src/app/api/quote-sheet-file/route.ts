import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 报价单文件代理（业主 2026-11-11 修复：/history/sheets 旧导出记录要在网页里预览报价单）
// 旧链路（/api/quote-sheet 直接导出）只把 xlsx/pdf 落到了 Storage，没存可还原的明细 body，
// 因此子页面原本只能下载、不能预览。这里用 service role 在服务端取文件并以 inline 返回，
// 既能给 <iframe> 内嵌预览 PDF，也能保证下载链接在「存储桶非公开」时仍然可用。
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

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const userId = p.get('user_id');
  const quoteNo = p.get('quote_no');
  const kind = p.get('kind') || 'legacy';
  const ext = (p.get('ext') || 'pdf').toLowerCase();
  if (!safeKey(userId) || !safeKey(quoteNo) || (ext !== 'pdf' && ext !== 'xlsx')) {
    return new NextResponse('bad params', { status: 400 });
  }
  const path =
    kind === 'saved'
      ? `${userId}/${SAVED_DIR}/${quoteNo}.${ext}`
      : `${userId}/${quoteNo}.${ext}`;
  try {
    const sb = client();
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error || !data) return new NextResponse('not found', { status: 404 });
    const buf = await data.arrayBuffer();
    const ct =
      ext === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const disposition = ext === 'pdf' ? 'inline' : 'attachment';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Content-Disposition': `${disposition}; filename="${quoteNo}.${ext}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[QuoteSheetFile] 取文件失败:', err);
    return new NextResponse('error', { status: 500 });
  }
}
