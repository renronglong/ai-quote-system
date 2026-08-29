-- =============================================================
-- 积分体系：注册赠送 / 图纸识别消耗 / 邀请奖励 / 运营定期赠送
-- 所有读写均由服务端 API 使用 service_role key 完成（绕过RLS）
-- =============================================================

-- 1. 积分余额表
CREATE TABLE IF NOT EXISTS credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_recharged NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_consumed NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 积分流水表
CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recharge','consume','refund','adjust')),
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  related_task_id UUID,
  admin_remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credits_user ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_created ON credits(created_at DESC);

-- 3. RLS：启用但默认拒绝匿名/普通用户直接访问（仅服务端可读写）
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

-- 可选：登录用户可查自己的积分余额（前端若直接查表用；当前走API，可不开）
DROP POLICY IF EXISTS "用户查看自己积分余额" ON credit_balances;
CREATE POLICY "用户查看自己积分余额" ON credit_balances
  FOR SELECT USING (auth.uid() = user_id);

-- 历史每日识别额度表不再使用（保留数据不删）：
-- recognition_usage 的 used_count/bonus_count 逻辑已废弃，额度改走积分。
