-- ============================================================
-- saved_quotes 表创建脚本
-- 在 Supabase SQL 编辑器中执行
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  product_type VARCHAR(50) NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_discount INTEGER DEFAULT 100,
  mold_discount INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_saved_quotes_user_id ON saved_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_quotes_created_at ON saved_quotes(created_at DESC);

-- RLS
ALTER TABLE saved_quotes ENABLE ROW LEVEL SECURITY;

-- 应用层通过 service_role key + user_id 校验，以下策略兼容未来 Supabase Auth
CREATE POLICY "Users can view their own saved quotes" ON saved_quotes
  FOR SELECT TO anon, authenticated
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Users can insert their own saved quotes" ON saved_quotes
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Users can update their own saved quotes" ON saved_quotes
  FOR UPDATE TO anon, authenticated
  USING (user_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Users can delete their own saved quotes" ON saved_quotes
  FOR DELETE TO anon, authenticated
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION update_saved_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_saved_quotes_updated_at ON saved_quotes;
CREATE TRIGGER trigger_update_saved_quotes_updated_at
  BEFORE UPDATE ON saved_quotes
  FOR EACH ROW EXECUTE FUNCTION update_saved_quotes_updated_at();

-- 如果表已存在，补加折扣列
ALTER TABLE saved_quotes ADD COLUMN IF NOT EXISTS product_discount INTEGER DEFAULT 100;
ALTER TABLE saved_quotes ADD COLUMN IF NOT EXISTS mold_discount INTEGER DEFAULT 100;
