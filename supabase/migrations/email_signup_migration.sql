-- gyparts 邮箱注册/登录改造 · 数据库迁移
-- 执行前：先在 Supabase 表编辑器导出 users 表全量备份（CSV），或使用项目自带备份能力。
-- 本脚本全部是「加法型」变更：不改已有数据、不删列、不删表。
-- 执行后：在 Vercel 增加环境变量 EMAIL_SIGNUP_DDL_APPLIED=true 并重新部署。

-- 1) 手机号改为可空（邮箱注册不填手机号）
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- 2) 显示名称
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name varchar(64);

-- 3) 邮箱唯一索引（部分索引，忽略 null；写入统一转小写）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON public.users (lower(email)) WHERE email IS NOT NULL;

-- 验收查询
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position;
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
