-- 材料价格表
-- 用于存储每日抓取的材料价格数据（铝锭、冷轧板、不锈钢等）

CREATE TABLE IF NOT EXISTS material_prices (
  id BIGSERIAL PRIMARY KEY,
  material TEXT NOT NULL,              -- 材料类型：铝型材、压铸铝、冷轧板等
  name TEXT NOT NULL,                  -- 具体品种名称：南海铝锭 (含票)、ADC12 等
  price INTEGER NOT NULL,              -- 均价（元/吨）
  change_amount INTEGER DEFAULT 0,     -- 涨跌额（元/吨）
  change_percent DECIMAL(5,2) DEFAULT 0, -- 涨跌幅（%）
  price_range TEXT,                    -- 价格区间：24600~24700
  source TEXT DEFAULT 'lvdingjia.com', -- 数据来源
  price_date DATE NOT NULL,            -- 价格日期
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material, name, price_date)   -- 同一材料同一品种同一天只存一条
);

-- 索引：按日期和材料类型快速查询
CREATE INDEX IF NOT EXISTS idx_material_prices_date ON material_prices(price_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_prices_material ON material_prices(material);

-- RLS 策略：允许匿名读取（API 需要）
ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON material_prices
  FOR SELECT
  TO anon
  USING (true);

-- 允许服务角色写入（CodeAct 脚本用 service_role key）
CREATE POLICY "Allow service role insert" ON material_prices
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE material_prices IS '每日材料价格数据表，由 CodeAct 脚本定时抓取更新';
