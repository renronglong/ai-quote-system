-- 2026-08-29 识图数据管道 + 登录墙 + 邀请裂变
-- 在 Supabase SQL Editor 中执行

-- 1. 识图反馈表（AI识别值 vs 用户确认值，用于训练数据积累）
CREATE TABLE IF NOT EXISTS recognition_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recognition_id TEXT NOT NULL,
  ai_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_confirmed_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 识图使用记录表（每次识别调用记录）
CREATE TABLE IF NOT EXISTS recognition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_name TEXT,
  ai_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 每日识别额度表
CREATE TABLE IF NOT EXISTS recognition_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count INTEGER NOT NULL DEFAULT 0,
  bonus_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 4. 用户表增加推荐码和邀请人字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(8) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID;

-- 5. 启用 RLS 并设置策略
ALTER TABLE recognition_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON recognition_feedback FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE recognition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON recognition_logs FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE recognition_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON recognition_usage FOR ALL TO anon USING (true) WITH CHECK (true);
