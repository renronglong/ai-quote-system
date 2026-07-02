import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL || 'https://br-lush-teal-829ebb2c.supabase2.aidap-global.cn-beijing.volces.com';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNjA2MjY2ODUsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.bQyLDE94ExM0a31w640N0GPzg0ppRJu_-z12vR1RLhY';

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// File-based fallback for when Supabase table doesn't exist
const DATA_DIR = '/tmp/inquiries';
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

function readAllInquiries() {
  ensureDataDir();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
    } catch { return null; }
  }).filter(Boolean);
}

function writeInquiry(inquiry: Record<string, unknown>) {
  ensureDataDir();
  fs.writeFileSync(getFilePath(inquiry.id as string), JSON.stringify(inquiry, null, 2));
}

function readInquiry(id: string) {
  const fp = getFilePath(id);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

// Try Supabase first, fall back to file storage
async function tableExists(): Promise<boolean> {
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from('inquiries').select('id').limit(1);
    return !error || error.code !== '42P01';
  } catch {
    return false;
  }
}

// POST - Create new inquiry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, company, email, material, process, surfaceTreatment, quantity, length, description, files } = body;

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: '姓名和电话为必填项' }, { status: 400 });
    }
    if (!description && (!files || files.length === 0)) {
      return NextResponse.json({ success: false, error: '请填写需求描述或上传图纸' }, { status: 400 });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const inquiryId = `INQ-${dateStr}-${rand}`;

    const inquiry = {
      id: inquiryId,
      name: name.trim(),
      phone: phone.trim(),
      company: company?.trim() || null,
      email: email?.trim() || null,
      material: material || null,
      process: process || null,
      surface_treatment: surfaceTreatment || null,
      quantity: quantity || null,
      length_mm: length ? parseFloat(length) : null,
      description: description?.trim() || null,
      files: files || [],
      status: 'pending',
      quote_price: null,
      quote_note: null,
      created_at: now.toISOString(),
      updated_at: null,
    };

    // Try Supabase first
    if (await tableExists()) {
      const supabase = getServiceClient();
      const { data, error } = await supabase.from('inquiries').insert(inquiry).select().single();
      if (!error) {
        return NextResponse.json({ success: true, inquiry: data });
      }
      console.error('Supabase insert error:', error);
    }

    // Fall back to file storage
    writeInquiry(inquiry);
    return NextResponse.json({ success: true, inquiry });

  } catch (err) {
    console.error('Inquiry POST error:', err);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// GET - List inquiries (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Try Supabase first
    if (await tableExists()) {
      const supabase = getServiceClient();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase.from('inquiries').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
      if (status) query = query.eq('status', status);

      const { data, error, count } = await query;
      if (!error) {
        return NextResponse.json({ success: true, inquiries: data || [], total: count || 0, page, pageSize });
      }
    }

    // Fall back to file storage
    let all = readAllInquiries();
    if (status) all = all.filter((i: Record<string, unknown>) => i.status === status);
    all.sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
    const from = (page - 1) * pageSize;
    const paged = all.slice(from, from + pageSize);

    return NextResponse.json({ success: true, inquiries: paged, total: all.length, page, pageSize });

  } catch (err) {
    console.error('Inquiry GET error:', err);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// PATCH - Update inquiry
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, quote_price, quote_note } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少询价ID' }, { status: 400 });
    }

    // Try Supabase first
    if (await tableExists()) {
      const supabase = getServiceClient();
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status) updateData.status = status;
      if (quote_price !== undefined) updateData.quote_price = quote_price;
      if (quote_note !== undefined) updateData.quote_note = quote_note;

      const { data, error } = await supabase.from('inquiries').update(updateData).eq('id', id).select().single();
      if (!error) {
        return NextResponse.json({ success: true, inquiry: data });
      }
    }

    // Fall back to file storage
    const inquiry = readInquiry(id);
    if (!inquiry) {
      return NextResponse.json({ success: false, error: '询价不存在' }, { status: 404 });
    }
    if (status) inquiry.status = status;
    if (quote_price !== undefined) inquiry.quote_price = quote_price;
    if (quote_note !== undefined) inquiry.quote_note = quote_note;
    inquiry.updated_at = new Date().toISOString();
    writeInquiry(inquiry);
    return NextResponse.json({ success: true, inquiry });

  } catch (err) {
    console.error('Inquiry PATCH error:', err);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
