import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const SERVICE_KEY = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST() {
  const sql = `
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

ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '系统管理供应商资料' AND tablename = 'supplier_profiles') THEN
    CREATE POLICY "系统管理供应商资料" ON supplier_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '系统管理供应商产品' AND tablename = 'supplier_products') THEN
    CREATE POLICY "系统管理供应商产品" ON supplier_products FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_profiles_user_id ON supplier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
`;

  try {
    const refMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase/);
    const ref = refMatch ? refMatch[1] : '';

    const mgmtResp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (mgmtResp.ok) {
      return NextResponse.json({ success: true, message: '数据库表创建成功' });
    }

    return NextResponse.json({
      success: false,
      message: '自动建表失败，请在 Supabase SQL Editor 中手动执行',
      sql,
      hint: `打开 https://supabase.com/dashboard/project/${ref}/sql/new 粘贴SQL执行`,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err.message,
      sql,
    });
  }
}
