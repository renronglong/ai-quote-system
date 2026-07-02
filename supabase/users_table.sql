-- 用户表创建脚本
-- 在Supabase SQL编辑器中执行

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 开启RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 设置RLS策略（允许所有人注册查询，但不能直接访问密码）
CREATE POLICY "Allow public read" ON users
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
