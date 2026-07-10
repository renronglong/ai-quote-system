-- ============================================================
-- 创建 sms_codes 表（短信验证码存储）
-- 用途：存储手机短信验证码，支持发送、验证、过期清理
-- ============================================================

-- 创建验证码表
CREATE TABLE IF NOT EXISTS sms_codes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,              -- 手机号
  code VARCHAR(6) NOT NULL,                -- 6位验证码
  purpose VARCHAR(30) NOT NULL DEFAULT 'register', -- 用途：register/login/resetPassword
  used BOOLEAN NOT NULL DEFAULT FALSE,     -- 是否已使用
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 创建时间
  CONSTRAINT sms_codes_phone_code_purpose UNIQUE (phone, code, purpose, used)
);

-- 创建索引：加速按手机号+用途查询、过期清理
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone_purpose ON sms_codes (phone, purpose);
CREATE INDEX IF NOT EXISTS idx_sms_codes_created_at ON sms_codes (created_at);
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone_unused ON sms_codes (phone, used) WHERE used = FALSE;

-- 启用 RLS（行级安全）
ALTER TABLE sms_codes ENABLE ROW LEVEL SECURITY;

-- 仅允许 service_role 访问（API 路由使用 service_role_key 访问）
CREATE POLICY "Service role can do anything on sms_codes"
  ON sms_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 禁止 anon 角色访问（安全加固）
CREATE POLICY "Anon users cannot access sms_codes"
  ON sms_codes
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 禁止 authenticated 角色访问
CREATE POLICY "Authenticated users cannot access sms_codes"
  ON sms_codes
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 添加注释
COMMENT ON TABLE sms_codes IS '短信验证码存储表';
COMMENT ON COLUMN sms_codes.phone IS '手机号';
COMMENT ON COLUMN sms_codes.code IS '6位数字验证码';
COMMENT ON COLUMN sms_codes.purpose IS '验证码用途：register=注册, login=登录, resetPassword=重置密码';
COMMENT ON COLUMN sms_codes.used IS '是否已使用（一次性验证码）';
COMMENT ON COLUMN sms_codes.created_at IS '创建时间，用于判断过期（5分钟有效）';
