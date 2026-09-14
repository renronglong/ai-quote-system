import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';

function getSupabase() {
  if (!supabaseServiceKey) throw new Error('Supabase service role key not configured');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Decode JWT payload to get user id
function decodeTokenPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Normalize surface treatments field
function normalizeSurfaceTreatments(val: string | null | undefined): string[] | null {
  if (!val || val.trim() === '' || val.trim() === '无') return null;
  return val.split(/[,，]/).map(s => s.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const payload = decodeTokenPayload(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
    }
    const userId = payload.sub;

    // Get supplier_id from suppliers table
    const supabase = getSupabase();
    const { data: supplierRow } = await supabase
      .from('suppliers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!supplierRow) {
      return NextResponse.json({ error: '未找到供应商信息，请先完成供应商注册' }, { status: 400 });
    }
    const supplierId = supplierRow.id;

    // Parse body
    const body = await request.json();
    const items: any[] = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '没有要上传的数据' }, { status: 400 });
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!item.mold_number || !String(item.mold_number).trim()) {
        errors.push(`第${rowNum}行: 模具编号不能为空`);
        failCount++;
        continue;
      }

      const moldNumber = String(item.mold_number).trim();
      const surfaceTreatments = normalizeSurfaceTreatments(item.surface_treatments);

      const recordPayload: Record<string, any> = {
        supplier_id: supplierId,
        mold_number: moldNumber,
        product_name: item.product_name?.trim() || null,
        cross_section_mm: item.cross_section_mm?.trim() || null,
        weight_per_meter: item.weight_per_meter != null && item.weight_per_meter !== '' ? Number(item.weight_per_meter) : null,
        perimeter: item.perimeter != null && item.perimeter !== '' ? Number(item.perimeter) : null,
        surface_treatments: surfaceTreatments || [],
        num_dies: item.num_dies != null ? Number(item.num_dies) : 1,
        remarks: item.remarks?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Check if exists (upsert by mold_number + supplier_id)
      const { data: existing } = await supabase
        .from('supplier_products')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('mold_number', moldNumber)
        .maybeSingle();

      if (existing) {
        // Update
        const { error: upErr } = await supabase
          .from('supplier_products')
          .update(recordPayload)
          .eq('id', existing.id);
        if (upErr) {
          errors.push(`第${rowNum}行 (${moldNumber}): 更新失败 - ${upErr.message}`);
          failCount++;
        } else {
          successCount++;
        }
      } else {
        // Insert
        recordPayload.created_at = new Date().toISOString();
        const { error: insErr } = await supabase
          .from('supplier_products')
          .insert([recordPayload]);
        if (insErr) {
          errors.push(`第${rowNum}行 (${moldNumber}): 插入失败 - ${insErr.message}`);
          failCount++;
        } else {
          successCount++;
        }
      }
    }

    return NextResponse.json({
      data: {
        success_count: successCount,
        fail_count: failCount,
        errors,
      },
    });
  } catch (err: any) {
    console.error('[Batch Upload]', err);
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
