import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
export async function GET() {
  const out: Record<string, unknown> = {};
  out.coze_key_present = !!process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
  out.svc_key_present = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  // 用 COZE key
  try {
    const k = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';
    const c = createClient(url, k, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await c.from('credit_balances').select('balance').limit(1);
    out.coze_key_test = error ? `ERR: ${error.message}` : 'OK';
  } catch (e) { out.coze_key_test = 'EX: ' + String(e); }
  // 用 SVC key
  try {
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const c = createClient(url, k, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await c.from('credit_balances').select('balance').limit(1);
    out.svc_key_test = error ? `ERR: ${error.message}` : 'OK';
  } catch (e) { out.svc_key_test = 'EX: ' + String(e); }
  return NextResponse.json(out);
}
