import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET - Check if customers table exists and return status
export async function GET() {
  const supabase = getSupabase();
  
  // Try to query the customers table
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .limit(1);

  if (error) {
    return NextResponse.json({
      exists: false,
      error: error.message,
      message: 'customers 表不存在或无法访问',
      sql: getCreateSQL(),
    });
  }

  return NextResponse.json({
    exists: true,
    message: 'customers 表已存在',
  });
}

// POST - Attempt to create the customers table using Supabase Management API
export async function POST() {
  const supabase = getSupabase();
  
  // First check if table already exists
  const { error: checkError } = await supabase
    .from('customers')
    .select('id')
    .limit(1);

  if (!checkError) {
    return NextResponse.json({ success: true, message: 'customers 表已存在' });
  }

  // Try creating via Supabase SQL endpoint
  // Method 1: Try the /pg/query endpoint
  try {
    const resp = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: getCreateSQL() }),
    });

    if (resp.ok) {
      return NextResponse.json({ success: true, message: 'customers 表创建成功 (via /pg/query)' });
    }
  } catch {
    // Fall through
  }

  // Method 2: Try alternative endpoint format
  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: getCreateSQL() }),
    });

    if (resp.ok) {
      return NextResponse.json({ success: true, message: 'customers 表创建成功 (via rpc/exec_sql)' });
    }
  } catch {
    // Fall through
  }

  // If all methods fail, return the SQL for manual execution
  return NextResponse.json({
    success: false,
    message: '无法通过 API 自动创建表，请在 Supabase Dashboard SQL Editor 中手动执行以下 SQL',
    sql: getCreateSQL(),
    dashboard_url: `${supabaseUrl.replace('.supabase.co', '')}.supabase.co/project/default/sql`,
  });
}

function getCreateSQL(): string {
  return `-- 创建客户表
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_code TEXT,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  email TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_code)
);

-- 启用 RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 管理员完全访问策略
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin all' AND tablename = 'customers') THEN
    CREATE POLICY "admin all" ON customers FOR ALL USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
    );
  END IF;
END $$;

-- 用户读取自己的客户策略
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users read own' AND tablename = 'customers') THEN
    CREATE POLICY "users read own" ON customers FOR SELECT USING (
      user_id = auth.uid()
    );
  END IF;
END $$;

-- 为 service_role 创建绕过 RLS 的策略
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role bypass' AND tablename = 'customers') THEN
    CREATE POLICY "service_role bypass" ON customers FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;`;
}
