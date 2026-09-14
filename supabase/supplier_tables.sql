-- 供应商自助入驻模块 - 数据库迁移脚本
-- 在 Supabase SQL Editor 中执行此脚本

-- ==========================================
-- 1. 供应商资料表
-- ==========================================
CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  address TEXT,
  business_license TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. 供应商产品表（挤压铝型材）
-- ==========================================
CREATE TABLE IF NOT EXISTS supplier_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  alloy_grade TEXT NOT NULL,
  profile_type TEXT NOT NULL,
  min_width_mm DECIMAL,
  max_width_mm DECIMAL,
  min_height_mm DECIMAL,
  max_height_mm DECIMAL,
  max_circle_mm DECIMAL,
  min_wall_mm DECIMAL,
  min_order_kg DECIMAL DEFAULT 300,
  unit_price DECIMAL NOT NULL,
  price_unit TEXT DEFAULT '元/吨',
  lead_days INTEGER DEFAULT 15,
  surface_treatments TEXT[],
  remarks TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. RLS策略
-- ==========================================
ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

-- 供应商资料表策略
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '供应商查看自己资料' AND tablename = 'supplier_profiles') THEN
    CREATE POLICY "供应商查看自己资料" ON supplier_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '供应商修改自己资料' AND tablename = 'supplier_profiles') THEN
    CREATE POLICY "供应商修改自己资料" ON supplier_profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '供应商插入自己资料' AND tablename = 'supplier_profiles') THEN
    CREATE POLICY "供应商插入自己资料" ON supplier_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 供应商产品表策略
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '供应商查看自己产品' AND tablename = 'supplier_products') THEN
    CREATE POLICY "供应商查看自己产品" ON supplier_products FOR SELECT USING (
      supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '供应商管理自己产品' AND tablename = 'supplier_products') THEN
    CREATE POLICY "供应商管理自己产品" ON supplier_products FOR ALL USING (
      supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- 允许系统（service_role）读写所有数据（API路由使用service_role绕过RLS）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '系统读取供应商资料' AND tablename = 'supplier_profiles') THEN
    CREATE POLICY "系统读取供应商资料" ON supplier_profiles FOR SELECT TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '系统管理供应商资料' AND tablename = 'supplier_profiles') THEN
    CREATE POLICY "系统管理供应商资料" ON supplier_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '系统读取供应商产品' AND tablename = 'supplier_products') THEN
    CREATE POLICY "系统读取供应商产品" ON supplier_products FOR SELECT TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '系统管理供应商产品' AND tablename = 'supplier_products') THEN
    CREATE POLICY "系统管理供应商产品" ON supplier_products FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_user_id ON supplier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
