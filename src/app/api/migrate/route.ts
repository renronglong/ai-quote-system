import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * 临时迁移端点 - 执行后删除
 * POST /api/migrate 执行建表
 */
export async function POST() {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'No service key' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: string[] = [];

  // 使用 REST API 的方式无法执行 DDL
  // 改为通过 RPC 调用已有的 sql 执行能力
  // 由于 Supabase REST API 不支持 DDL，这里直接通过 JS 操作
  
  // 检查 recognition_feedback 表是否存在
  const { data: rfCheck, error: rfErr } = await supabase
    .from('recognition_feedback')
    .select('id')
    .limit(1);
  
  if (rfErr && rfErr.message?.includes('does not exist')) {
    // 表不存在 - 需要通过 Supabase SQL Editor 手动创建
    // 返回 SQL 让用户执行
    return NextResponse.json({
      success: false,
      message: '需要手动执行 SQL。请前往 Supabase SQL Editor 执行以下 SQL：',
      sql: `
-- 1. 创建 recognition_feedback 表
CREATE TABLE IF NOT EXISTS recognition_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recognition_id TEXT NOT NULL,
  ai_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_confirmed_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建 recognition_logs 表
CREATE TABLE IF NOT EXISTS recognition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_name TEXT,
  ai_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建 recognition_usage 表
CREATE TABLE IF NOT EXISTS recognition_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count INTEGER NOT NULL DEFAULT 0,
  bonus_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 4. users 表添加字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(8) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID;

-- 5. RLS 策略
ALTER TABLE recognition_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enable_all_rf" ON recognition_feedback FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE recognition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enable_all_rl" ON recognition_logs FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE recognition_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enable_all_ru" ON recognition_usage FOR ALL TO anon USING (true) WITH CHECK (true);
      `.trim(),
    });
  }

  results.push('recognition_feedback exists');
  return NextResponse.json({ success: true, results, message: '所有表已就绪' });
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to execute migration',
    status: 'ready',
  });
}
