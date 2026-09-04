import { getAluminumPrice } from '@/lib/pricing/aluminum-price';
import { NextRequest } from 'next/server';

// ============================================================
// 报价计算 API v1 — 供 Coze Bot 插件调用
// 端点: POST /api/v1/quote/calculate
// 支持四种产品类型: sheet_metal | die_casting | zinc_alloy | injection
// ============================================================


// ---- 默认不锈钢基准价（元/吨），获取失败时降级 ----
const DEFAULT_STEEL_304_PRICE = 14500;

// ---- 默认热卷期货价（元/吨） ----
const DEFAULT_HOT_ROLL_PRICE = 3800;

// ---- 默认模具钢价（元/吨），H13均价约18000 ----
const DEFAULT_DIE_STEEL_PRICE = 18000;

// ---- 模具钢密度（吨/m³），H13工具钢约7.85 ----
const DIE_STEEL_DENSITY = 7.85;
const DIE_MATERIAL_WASTE_FACTOR = 1.2; // 材料损耗系数（20%）

// ---- CORS 头，允许 Coze Bot 及任意来源调用 ----
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---- 报价规则配置（从 Supabase Storage 读取，失败时使用内嵌默认值） ----
const PRICING_CONFIG_URL =
  'https://jotgxnhueagbsvfeepic.supabase.co/storage/v1/object/public/pricing-config/pricing_rules_v2.json';

// ============================================================
// 类型定义
// ============================================================

/** 请求体类型 */
interface QuoteRequest {
  product_type: 'sheet_metal' | 'die_casting' | 'zinc_alloy' | 'injection' | 'extrusion';
  material: {
    category: string; // 铝板 | 冷板SPCC | 不锈钢 | 压铸铝ADC12 | 锌合金ZA-8 | ABS | PC | PA | POM | PP | PMMA
    grade?: string;   // 牌号，如 5系(5052)、304 等
  };
  dimensions?: {
    length_mm: number;
    width_mm: number;
    height_mm?: number;
    wall_thickness_mm?: number;
    standard_category?: string;  // 挤出标准件小类：铝圆棒/铝方/扁棒/铝六角棒/角铝/铝圆管/铝六角管/铝方管
    diameter_mm?: number;        // 铝圆棒直径
    hex_flat_mm?: number;        // 铝六角棒/铝六角管对边距
    outer_diameter_mm?: number;  // 铝圆管外径
    inner_diameter_mm?: number;  // 铝圆管/铝六角管内径
    cross_section_area_mm2?: number; // 截面积 mm²（挤压铝型材）
    material_size_type?: 'long' | 'short'; // 长料(≥3000mm) / 小料(<3000mm)
    perimeter_mm?: number;    // 产品外周长(mm)
    inner_perimeter_mm?: number; // 内孔周长之和(mm)，中空分流模用于模具费精算
    num_dies?: number;    // 公头数（0=平模，≥1=分流模）
    die_type?: 'flat' | 'split'; // 模具类型：平模/分流模
    meter_weight_kg_per_m?: number; // 用户手动输入的米重(kg/m)
    net_weight_g?: number; // 产品净重(g)，用于计算材料利用率
    die_steel_price?: number; // 模具钢价(元/吨)，可选，默认18000
  };
  volume_cm3?: number;       // 体积 cm³
  surface_area_cm2?: number; // 表面积 cm²
  quantity: number;
  surface_treatment?: {
    type: string;  // 氧化本色 | 氧化上色 | 喷砂 | 拉丝 | 喷涂/喷粉 | 磷化 | 镀锌/镀镍 | 抛光/镀铬
    color?: string | null;
  } | null;
  process?: {
    type?: string;       // 冲压 | 激光切割 | 压铸 | 注塑
    secondary_operations?: string[]; // 钻孔、攻丝、铣槽、去毛刺 等
    holes?: { count: number; diameter_range?: string };
    tapped_holes?: { count: number; size?: string };
    slots?: { count: number; type?: string };
    cut_count?: number;  // 锯切次数（铝型材）
    stamping_tonnage?: string;   // 冲压吨位（如 '<=35T', '45T', '200T双轴' 等）
    stamping_count?: number;     // 冲次数量
    cnc_time?: { minutes: number }; // CNC/车加工时间
  } | null;
  aluminum_price_override?: number; // 铝锭价覆盖值（元/吨）
  weight_per_piece_kg?: number;     // 单件重量，不填则根据体积×密度估算
  mold_cost?: number;               // 模具费（元），可选
  use_existing_mold?: boolean;          // 使用已有模具（模具费为0）
  product_name?: string;            // 产品名称（可选，用于保存报价记录）
  product_code?: string;            // 产品编号（可选，用于保存报价记录）
}

/** 响应体类型 */
interface QuoteResponse {
  success: boolean;
  quotation_id?: string;
  material_cost?: number;
  processing_cost?: number;
  surface_treatment_cost?: number;
  secondary_operations_cost?: number;
  packaging_cost?: number;
  transport_cost?: number;
  management_fee?: number;
  unit_price?: number;
  unit_price_ex_tax?: number;
  unit_price_in_tax?: number;
  total_ex_tax?: number;
  total_in_tax?: number;
  total_price?: number;
  weight_per_piece_kg?: number;
  breakdown?: Record<string, { formula: string; detail: string }>;
  aluminum_index?: number;
  min_order_met?: boolean;
  min_order_weight_kg?: number;
  min_order_qty?: number;
  material_utilization_rate?: number; // 材料利用率(0-1)
  notes?: string[];
  product_name?: string;
  product_code?: string;
  error?: string;
  mold_cost?: number;              // 模具费（元），一次性，不计入单件价
  mold_spec?: string;              // 模具规格，如 Φ297×230 分流模
}

// ============================================================
// 报价规则数据（内嵌默认值，运行时尝试从远程加载覆盖）
// ============================================================

interface PricingRules {
  material_prices: Record<string, any>;
  default_sheet_size: { length_mm: number; width_mm: number };
  process_rates: Record<string, any>;
  processing_fee_formula: Record<string, any>;
  surface_treatment: Record<string, any>;
  die_casting_rates: Record<string, any>;
  injection_molding_rates: Record<string, any>;
  cnc_rates: Record<string, any>;
  loss_rates: Record<string, any>;
  total_formula: Record<string, any>;
  die_cost: Record<string, any>;
}

/** 内嵌的默认报价规则（精简版，与远程 JSON 保持一致） */
const DEFAULT_PRICING_RULES: PricingRules = {
  material_prices: {
    '铝板': {
      density: 2.7,
      price_source: '南海灵通铝锭价',
      default_grade: '5系(5052)',
      grade_premiums: {
        '1系(1050/1060/1100)': 1000,
        '3系(3003)': 2000,
        '5系(5052/5083)': 3000,
        '7系(7075)': 4000,
      },
    },
    '冷板SPCC': {
      density: 7.85,
      price_formula: '热卷期货价 × 1.05',
    },
    '不锈钢': {
      density: 7.93,
      grades: {
        '304': { ratio: 1.0 },
        '201': { ratio: 0.5 },
        '430': { ratio: 0.5 },
        '316L': { ratio: 2.0 },
      },
    },
    '压铸铝ADC12': { density: 2.7, price_per_ton: 22000 },
    '锌合金ZA-8': { density: 6.3, price_per_ton: 24000 },
    'ABS': { density: 1.05, price_range: [12, 18] },
    'PC': { density: 1.2, price_range: [18, 30] },
    'PA': { density: 1.14, price_range: [20, 35] },
    'POM': { density: 1.41, price_range: [15, 22] },
    'PP': { density: 0.91, price_range: [8, 12] },
    'PMMA': { density: 1.19, price_range: [18, 25] },
    '挤压铝型材': {
      density: 2.7,
      price_formula: '铝锭价 + 挤压加工费',
      extrusion_fee_per_ton: 3000,
      default_grade: '6063-T5',
      fill_factor: 0.35,
    },
  },
  default_sheet_size: { length_mm: 2440, width_mm: 1220 },
  process_rates: {
    '冲压吨位费率': {
      rates: {
        '≤35T': 0.10, '45T': 0.24, '60T': 0.30, '80T': 0.40,
        '110T': 0.50, '160T': 0.60, '200T': 1.00, '200T双轴': 1.20, '250T双轴': 1.80,
      },
    },
    '冲压吨位计算': {
      shear_strength: { '铝': 150, '冷板': 350, '不锈钢304': 570 },
    },
  },
  processing_fee_formula: {
    size_surcharge: { formula: 'floor((最大尺寸 - 100) / 100) × 0.01' },
    volume_surcharge: { formula: '体积(mm³) × 0.00000003' },
  },
  surface_treatment: {
    '铝板': {
      '氧化本色': { base: 0.2, stamping_coeff: 2, weight_coeff: 2 },
      '氧化上色': { base: 0.3, stamping_coeff: 3, weight_coeff: 3 },
      '喷砂': { base: 0, stamping_coeff: 2, weight_coeff: 1 },
      '拉丝': { base: 0.3, stamping_coeff: 3, weight_coeff: 3 },
    },
    '冷板_不锈钢': {
      '喷涂/喷粉': { base: 0.2, stamping_coeff: 2, weight_coeff: 2 },
      '磷化': { base: 0.2, stamping_coeff: 2, weight_coeff: 2 },
      '镀锌/镀镍': { base: 0, stamping_coeff: 2, weight_coeff: 1.5 },
      '抛光/镀铬': { base: 0.3, stamping_coeff: 3, weight_coeff: 3 },
    },
  },
  die_casting_rates: {
    '压铸铝ADC12_A380': { casting_fee_range: [3, 5], loss_rate: 0.05 },
    '锌合金压铸': {
      casting_fee_range: [2, 4], loss_rate: 0.06,
      processing_fee_by_weight: {
        '<10g': [18, 20], '10~20g': [15, 18], '20~50g': [13, 15],
        '50~200g': [11, 13], '>200g': [10, 11],
      },
    },
  },
  injection_molding_rates: {
    loss_rate: { '普通': 0.02, '精密': 0.05 },
    plastic_prices: {
      'PP': [8, 12], 'ABS': [12, 18], 'PC': [18, 30],
      'PA': [20, 35], 'POM': [15, 22], 'PMMA': [18, 25],
    },
    injection_fee_by_tonnage: {
      '50T以下': [0.3, 0.5], '50~100T': [0.5, 0.8], '100~200T': [0.8, 1.2],
      '200~350T': [1.2, 2.0], '350~530T': [2.0, 3.5], '530~800T': [3.5, 5.0],
    },
  },
  cnc_rates: {
    '钻孔': { 'ø3~6mm': [0.3, 0.5], 'ø6~10mm': [0.5, 0.8], 'ø10~16mm': [0.8, 1.2], 'ø16~25mm': [1.2, 2.0] },
    '攻丝': { 'M3~M4': [0.3, 0.5], 'M5~M6': [0.5, 0.8], 'M8~M10': [0.8, 1.2], 'M12~M16': [1.2, 2.0] },
    '铣槽': { '开口槽': [0.02, 0.05], '封闭槽': [0.05, 0.10] },
    '去毛刺': { '手工': [0.5, 1.0], '振动研磨': [0.3, 0.8] },
    '批量系数': {
      '1~10件': 1.3, '11~50件': 1.1, '51~100件': 1.0,
      '101~500件': 0.9, '501~1000件': 0.8, '1000件以上': 0.7,
    },
  },
  loss_rates: {
    '挤压铝型材': 0.03,
    '板材加工_每工序': 0.06, // 1.03 × 1.03 ≈ 6%
    '铝合金压铸': 0.05,
    '锌合金压铸': 0.06,
    '注塑_普通': 0.02,
    '注塑_精密': 0.05,
  },
  total_formula: {
    '包装费': 0.5, // 重量(kg) × 0.5 元
    '运输费': 0.5, // 重量(kg) × 0.5 元
  },
  die_cost: {
    '冲压模具费': { base_fee: 600, area_rate: 1, perimeter_rate: 10 },
    '挤压模具费': { base_fee: 600, perimeter_rate: 0.1, max_size_rate: 0.05 },
    '线割费': { rate: 0.035 },
  },
};

// ============================================================
// 辅助函数
// ============================================================

/** 安全地四舍五入到两位小数 */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
/** 安全地四舍五入到三位小数（米重等小数值） */
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
/** 保留左边3位有效数字（如 1.234→1.23, 12.34→12.3, 1234→1230） */
function r3sig(n: number): number {
  if (n <= 0) return 0;
  if (n < 0.001) return n; // 太小的数不处理
  const digits = Math.floor(Math.log10(n));
  if (digits < 0) {
    // 小于1的数，如 0.1234 → 保留3位有效数字
    const unit = Math.pow(10, -digits - 1 + 3);
    return Math.round(n * unit) / unit;
  }
  const unit = Math.pow(10, digits - 2); // 保留3位有效数字
  return Math.round(n / unit) * unit;
}

/** 生成报价单号: Q-YYYYMMDD-XXX */
function generateQuotationId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `Q-${date}-${seq}`;
}

/** 从范围字符串取中间值，如 "3~5" → 4 */
function midOfRange(rangeStr: string | number[]): number {
  if (Array.isArray(rangeStr)) return (rangeStr[0] + rangeStr[1]) / 2;
  const parts = String(rangeStr).split(/[~\-]/);
  const nums = parts.map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[nums.length - 1]) / 2;
}

/** 获取批量系数 */
function getBatchCoefficient(qty: number, rules: PricingRules): number {
  const batchMap = rules.cnc_rates?.['批量系数'] || {};
  if (qty <= 10) return batchMap['1~10件'] || 1.3;
  if (qty <= 50) return batchMap['11~50件'] || 1.1;
  if (qty <= 100) return batchMap['51~100件'] || 1.0;
  if (qty <= 500) return batchMap['101~500件'] || 0.9;
  if (qty <= 1000) return batchMap['501~1000件'] || 0.8;
  return batchMap['1000件以上'] || 0.7;
}

// ============================================================
// 铝锭价获取 — 优先从 lvdingjia.com 抓取，失败则降级
// ============================================================


// ============================================================
// 加载报价规则 — 优先从 Supabase Storage 读取
// ============================================================

async function loadPricingRules(): Promise<PricingRules> {
  try {
    const res = await fetch(PRICING_CONFIG_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      // 合并远程配置到默认值
      // 注意：surface_treatment 远程JSON是公式字符串格式，代码需要数值格式，
      // 所以不覆盖默认的数值格式配置
      const { surface_treatment: _remoteST, ...restData } = data;
      return { ...DEFAULT_PRICING_RULES, ...restData };
    }
  } catch { /* 使用默认值 */ }
  return DEFAULT_PRICING_RULES;
}

// ============================================================
// 材料费计算
// ============================================================

/**
 * 计算板材材料费（铝板/冷板/不锈钢）
 * 公式：整张板材价格 ÷ 排版数量
 */
function calcSheetMaterialCost(
  category: string,
  grade: string | undefined,
  dimensions: NonNullable<QuoteRequest['dimensions']>,
  aluminumPrice: number,
  rules: PricingRules,
): { cost: number; weight: number; rawWeight: number; formula: string; detail: string; utilizationRate?: number } {
  const { length_mm, width_mm } = dimensions;
  // 板材厚度优先使用 wall_thickness_mm，其次 height_mm（兼容旧格式）
  const t = dimensions.wall_thickness_mm || dimensions.height_mm || 2;

  const matRule = rules.material_prices;
  const sheetSize = rules.default_sheet_size;

  let density = 7.85;
  let pricePerTon = 0;
  let formulaStr = '';
  let detailStr = '';

  if (category === '铝板' || category === '铝') {
    density = matRule['铝板']?.density || 2.7;
    // 铝板价格 = 铝锭价 ×（1 + 牌号加价/1000）
    const premiums = matRule['铝板']?.grade_premiums || {};
    let premium = 3000; // 默认 5系
    for (const [key, val] of Object.entries(premiums)) {
      if (grade && (key.includes(grade) || grade.includes(key.split('(')[0]))) {
        premium = val as number;
        break;
      }
    }
    pricePerTon = aluminumPrice * (1 + premium / 1000);
    formulaStr = '铝锭价 × (1 + 牌号加价/1000) × 密度 × 体积';
    detailStr = `${aluminumPrice} × (1 + ${premium}/1000) = ${r2(pricePerTon)} 元/吨`;
  } else if (category === '冷板SPCC' || category === '冷板' || category === '冷轧板' || category === '镀锌板') {
    density = matRule['冷板SPCC']?.density || 7.85;
    pricePerTon = DEFAULT_HOT_ROLL_PRICE * 1.05;
    formulaStr = '热卷期货价 × 1.05 × 密度 × 体积';
    detailStr = `${DEFAULT_HOT_ROLL_PRICE} × 1.05 = ${r2(pricePerTon)} 元/吨`;
  } else if (category === '不锈钢') {
    density = matRule['不锈钢']?.density || 7.93; // 不锈钢7.93 g/cm³（304约7.93）
    const grades = matRule['不锈钢']?.grades || {};
    let ratio = 1.0;
    for (const [key, val] of Object.entries(grades)) {
      if (grade && grade.includes(key)) {
        ratio = (val as any).ratio || 1.0;
        break;
      }
    }
    pricePerTon = DEFAULT_STEEL_304_PRICE * ratio * 1.05;
    formulaStr = `不锈钢304基准价 × ${ratio} × 1.05 × 密度 × 体积`;
    detailStr = `${DEFAULT_STEEL_304_PRICE} × ${ratio} × 1.05 = ${r2(pricePerTon)} 元/吨`;
  }

  // 体积（cm³）→ 重量（kg）= 体积cm³ × 密度 / 1000
  const volumeCm3 = (length_mm * width_mm * t) / 1000; // mm³ → cm³
  const weightKg = volumeCm3 * density / 1000; // cm³ × g/cm³ / 1000 = kg
  const materialCost = weightKg * pricePerTon / 1000; // kg × (元/吨) / 1000 = 元

  // 排版计算（简化：按面积排版）
  const partArea = length_mm * width_mm;
  const sheetArea = sheetSize.length_mm * sheetSize.width_mm;
  const nestingQty = Math.max(1, Math.floor(sheetArea / partArea));

  detailStr += ` | 体积: ${length_mm}×${width_mm}×${t}mm = ${r2(volumeCm3)}cm³ × ${density}g/cm³ = 单件${r2(weightKg)}kg, 排版: ${nestingQty}件/张`;

  return {
    cost: r2(materialCost),
    weight: r2(weightKg),
    rawWeight: weightKg,
    formula: formulaStr,
    detail: detailStr,
  };
}

/**
 * 计算压铸/注塑材料费
 */
function calcVolumetricMaterialCost(
  category: string,
  volumeCm3: number,
  aluminumPrice: number,
  rules: PricingRules,
): { cost: number; weight: number; rawWeight: number; formula: string; detail: string; utilizationRate?: number } {
  const matRule = rules.material_prices;
  let density = 2.7;
  let pricePerKg = 0;
  let formulaStr = '';
  let detailStr = '';

  if (category.includes('铝') || category.includes('ADC') || category.includes('压铸铝')) {
    density = matRule['压铸铝ADC12']?.density || matRule['铝板']?.density || 2.7;
    const matPricePerTon = matRule['压铸铝ADC12']?.price_per_ton || aluminumPrice * 0.95;
    pricePerKg = matPricePerTon / 1000;
    formulaStr = '体积 × 密度 × 材料单价';
    detailStr = `${volumeCm3}cm³ × ${density}g/cm³ × ${r2(pricePerKg)}元/kg`;
  } else if (category.includes('锌')) {
    density = matRule['锌合金ZA-8']?.density || 6.3;
    const matPricePerTon = matRule['锌合金ZA-8']?.price_per_ton || 24000;
    pricePerKg = matPricePerTon / 1000;
    formulaStr = '体积 × 密度 × 锌合金单价';
    detailStr = `${volumeCm3}cm³ × ${density}g/cm³ × ${r2(pricePerKg)}元/kg`;
  } else {
    // 塑料类
    const plasticKey = category;
    const priceRange = matRule[plasticKey]?.price_range || [12, 18];
    density = matRule[plasticKey]?.density || 1.1;
    pricePerKg = midOfRange(priceRange);
    formulaStr = `体积 × 密度 × ${category}单价`;
    detailStr = `${volumeCm3}cm³ × ${density}g/cm³ × ${r2(pricePerKg)}元/kg`;
  }

  const weightKg = volumeCm3 * density / 1000;
  const cost = weightKg * pricePerKg;

  return { cost: r2(cost), weight: r2(weightKg), rawWeight: weightKg, formula: formulaStr, detail: detailStr };
}

// ============================================================
// 铝型材材料费计算
// ============================================================

// ============================================================
// 标准件理论米重（规则截面，按6063铝密度2.7g/cm³计算）
// ============================================================
const AL_DENSITY_G_CM3 = 2.7;

/**
 * 按标准件类别与截面尺寸计算理论米重(kg/m)。
 * 截面积单位mm²，米重 = 截面积mm² × 2.7 / 1000
 * 返回 { weight, formula }；尺寸不足返回 null
 */
function calcStandardMeterWeight(
  dims: NonNullable<QuoteRequest['dimensions']>,
): { weight: number; formula: string; area: number } | null {
  const cat = dims.standard_category;
  const w = dims.width_mm || 0;
  const h = dims.height_mm || 0;
  const t = dims.wall_thickness_mm || 0;
  const d = dims.diameter_mm || 0;
  const s = dims.hex_flat_mm || 0;   // 六角对边距
  const od = dims.outer_diameter_mm || 0;
  const id = dims.inner_diameter_mm || 0;

  let area = 0;   // 截面积 mm²
  let formula = '';

  switch (cat) {
    case '铝圆棒': {
      if (!(d > 0)) return null;
      area = Math.PI * d * d / 4;
      formula = `圆棒 Ø${d}mm：π×${d}²/4 = ${area.toFixed(2)}mm²`;
      break;
    }
    case '铝方/扁棒': {
      if (!(w > 0 && h > 0)) return null;
      area = w * h;
      formula = `方/扁棒 ${w}×${h}mm：${w}×${h} = ${area.toFixed(2)}mm²`;
      break;
    }
    case '铝六角棒': {
      if (!(s > 0)) return null;
      area = 2.598 * s * s;  // 正六边形面积 = 3√3/2 × S² ≈ 2.598×S²
      formula = `六角棒 对边距${s}mm：2.598×${s}² = ${area.toFixed(2)}mm²`;
      break;
    }
    case '角铝': {
      if (!(w > 0 && h > 0 && t > 0)) return null;
      area = t * (w + h - t);
      formula = `角铝 ${w}×${h}×${t}mm：${t}×(${w}+${h}-${t}) = ${area.toFixed(2)}mm²`;
      break;
    }
    case '铝圆管': {
      if (!(od > 0 && id >= 0 && od > id)) {
        // 只有外径没内径时按实心圆棒算
        if (od > 0 && !(id > 0)) { area = Math.PI * od * od / 4; formula = `圆棒 Ø${od}mm（未填内径按实心）：${area.toFixed(2)}mm²`; break; }
        return null;
      }
      area = Math.PI * (od * od - id * id) / 4;
      formula = `圆管 Ø${od}/Ø${id}mm：π×(${od}²-${id}²)/4 = ${area.toFixed(2)}mm²`;
      break;
    }
    case '铝六角管': {
      if (!(s > 0 && id >= 0)) return null;
      const outer = 2.598 * s * s;
      const inner = id > 0 ? Math.PI * id * id / 4 : 0;
      area = outer - inner;
      formula = `六角管 对边距${s}/内Ø${id || 0}mm：2.598×${s}²${id > 0 ? `-π×${id}²/4` : ''} = ${area.toFixed(2)}mm²`;
      break;
    }
    case '铝方管': {
      if (!(w > 0 && h > 0 && t > 0)) return null;
      if (!(w > 2 * t && h > 2 * t)) return null;
      area = w * h - (w - 2 * t) * (h - 2 * t);
      formula = `方管 ${w}×${h}×${t}mm：${w}×${h}-${(w - 2 * t).toFixed(1)}×${(h - 2 * t).toFixed(1)} = ${area.toFixed(2)}mm²`;
      break;
    }
    default:
      return null;
  }

  if (!(area > 0)) return null;
  const weight = area * AL_DENSITY_G_CM3 / 1000;
  return { weight, formula, area };
}

/**
 * 按标准件类别与截面尺寸计算外周长/内孔周长(mm)，用于模具费兜底。
 * 中空管材(圆管/六角管/方管)=分流模，外周长+内孔周长均参与加工费。
 * 字段槽位与 calcStandardMeterWeight 一致：diameter/hex/outer→width，inner→height
 */
// 请求参数归一化：前端 input 可能以字符串提交数字字段，统一转为数值（空串/非法→undefined）
function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function normalizeDims<T extends Record<string, unknown>>(raw: T): T {
  const numericKeys = ['length_mm','width_mm','height_mm','wall_thickness_mm','diameter_mm','hex_flat_mm',
    'outer_diameter_mm','inner_diameter_mm','cross_section_area_mm2','perimeter_mm','inner_perimeter_mm',
    'num_dies','meter_weight_kg_per_m','net_weight_g','die_steel_price'];
  const out: Record<string, unknown> = { ...raw };
  for (const k of numericKeys) {
    if (k in out) {
      const nv = num(out[k]);
      if (nv === undefined) delete out[k];
      else out[k] = nv;
    }
  }
  return out as T;
}

function calcStandardPerimeters(
  dims: NonNullable<QuoteRequest['dimensions']>,
): { outer: number; inner: number } | null {
  const cat = dims.standard_category;
  if (!cat) return null;
  const w = dims.width_mm || 0;
  const h = dims.height_mm || 0;
  const t = dims.wall_thickness_mm || 0;
  const d = dims.diameter_mm || 0;
  const sHex = dims.hex_flat_mm || 0;
  const od = dims.outer_diameter_mm || 0;
  const id = dims.inner_diameter_mm || 0;

  switch (cat) {
    case '铝圆棒': return d > 0 ? { outer: Math.PI * d, inner: 0 } : null;
    case '铝方/扁棒': return (w > 0 && h > 0) ? { outer: 2 * (w + h), inner: 0 } : null;
    case '铝六角棒': return sHex > 0 ? { outer: 6 * sHex / Math.sqrt(3), inner: 0 } : null; // 正六边形边长=S/√3
    case '角铝': return (w > 0 && h > 0) ? { outer: 2 * (w + h), inner: 0 } : null;
    case '铝圆管': {
      const o = od || d;
      if (!(o > 0)) return null;
      return { outer: Math.PI * o, inner: id > 0 ? Math.PI * id : 0 };
    }
    case '铝六角管': {
      if (!(sHex > 0)) return null;
      return { outer: 6 * sHex / Math.sqrt(3), inner: id > 0 ? Math.PI * id : 0 };
    }
    case '铝方管': {
      if (!(w > 0 && h > 0 && t > 0)) return null;
      const innerW = w - 2 * t;
      const innerH = h - 2 * t;
      return { outer: 2 * (w + h), inner: (innerW > 0 && innerH > 0) ? 2 * (innerW + innerH) : 0 };
    }
    default: return null;
  }
}

/**
 * 计算铝型材材料费
 * 公式：材料单价 = 铝锭价 + 挤压加工费
 * 重量 = 截面积 × 长度 × 密度 / 1000000 (如果有截面数据)
 * 或 重量 = 长 × 宽 × 高 × 填充系数 × 密度 / 1000000 (简化计算)
 */
function calcExtrusionMaterialCost(
  dimensions: NonNullable<QuoteRequest['dimensions']>,
  aluminumPrice: number,
  rules: PricingRules,
  weightOverride?: number,
): { cost: number; weight: number; rawWeight: number; formula: string; detail: string; utilizationRate?: number } {
  const matRule = rules.material_prices['挤压铝型材'] || {};
  const extrusionFeePerTon = matRule.extrusion_fee_per_ton || 3000;
  
  // 材料单价 = 铝锭价 + 挤压加工费 (元/吨)
  const materialPricePerTon = aluminumPrice + extrusionFeePerTon;
  const materialPricePerKg = materialPricePerTon / 1000; // 元/kg
  
  let weightKg: number;
  let formulaStr: string;
  let detailStr: string;
  
  // 材料费 = 产品米重(kg/m) × (长度mm + 5mm) / 1000 → 得到kg
  let meterWeight = dimensions.meter_weight_kg_per_m || 0;
  const lengthMm = dimensions.length_mm || 0;  // 未填长度不再默认1000

  // 标准件（棒/管/角铝/方管等规则截面）：无米重时按几何尺寸自动算理论米重
  let stdWeightInfo: { weight: number; formula: string } | null = null;
  if (!(meterWeight > 0)) {
    stdWeightInfo = calcStandardMeterWeight(dimensions);
    if (stdWeightInfo) meterWeight = stdWeightInfo.weight;
  }

  if (meterWeight > 0 && lengthMm > 0) {
    weightKg = meterWeight * (lengthMm + 5) / 1000;
    formulaStr = '米重(kg/m) × (长度+5) / 1000';
    detailStr = `${r3(meterWeight)}kg/m × (${lengthMm}mm + 5mm) ÷ 1000 = ${r2(weightKg)}kg`;
    if (stdWeightInfo) {
      detailStr += ` | 理论米重: ${stdWeightInfo.formula} × 2.7g/cm³ ÷ 1000 = ${r3(meterWeight)}kg/m`;
    }
  } else if (weightOverride && weightOverride > 0) {
    weightKg = weightOverride;
    formulaStr = '用户提供重量';
    detailStr = `${weightKg}kg`;
  } else {
    // 降级：截面积 × 长度 × 密度
    const area = dimensions.cross_section_area_mm2 || 0;
    const density = matRule.density || 2.7;
    if (area > 0 && lengthMm > 0) {
      weightKg = (area * lengthMm * density) / 1000000;
      formulaStr = '截面积 × 长度 × 密度';
      detailStr = `${area}mm² × ${lengthMm}mm × ${density}g/cm³ ÷ 1000000 = ${r2(weightKg)}kg`;
    } else {
      weightKg = 0;
      formulaStr = '缺少参数';
      detailStr = meterWeight > 0 ? '需填入长度才能计算材料费' : '需提供米重或截面积';
    }
  }
  
  const cost = weightKg * materialPricePerKg;
  
  detailStr += ` | 材料单价: ${aluminumPrice} + ${extrusionFeePerTon} = ${materialPricePerTon}元/吨 = ${r2(materialPricePerKg)}元/kg`;
  detailStr += ` | 材料费: ${r2(weightKg)}kg × ${r2(materialPricePerKg)}元/kg = ${r2(cost)}元`;
  
  // 计算材料利用率
  let utilizationRate: number | undefined;
  if (dimensions.net_weight_g && dimensions.net_weight_g > 0 && weightKg > 0) {
    const netWeightKg = dimensions.net_weight_g / 1000;
    utilizationRate = r2(netWeightKg / weightKg);
    detailStr += ` | 净重: ${dimensions.net_weight_g}g = ${r2(netWeightKg)}kg, 材料利用率: ${(utilizationRate * 100).toFixed(1)}%`;
  }

  return {
    cost: r2(cost),
    weight: r2(weightKg),
    rawWeight: weightKg, // 未舍入的原始重量，用于精确计算MOQ
    formula: formulaStr,
    detail: detailStr,
    utilizationRate,
  };
}

// ============================================================
// 主计算引擎 — 铝型材挤压（完全复用板材的加工逻辑，仅材料费不同）
// ============================================================

function calcExtrusion(
  req: QuoteRequest,
  aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[]; utilizationRate?: number } {
  const dims = normalizeDims(req.dimensions || { length_mm: 1000, width_mm: 50, height_mm: 25 });
  const notes: string[] = [];
  const breakdown: Record<string, { formula: string; detail: string }> = {};
  
  // 1. 材料费（铝型材专用：铝锭价 + 挤压加工费）
  const mat = calcExtrusionMaterialCost(dims, aluminumPrice, rules, req.weight_per_piece_kg);
  breakdown['material'] = { formula: mat.formula, detail: mat.detail };
  
  let accumulated = mat.cost;
  

  // 取整工具：按数量级向上进位（如 350→400, 35→40, 3500→4000）
  // 保留左边两位有效数字，后面补零
  const ceilByMagnitude = (n: number): number => {
    if (n <= 0) return 0;
    if (n <= 10) return Math.ceil(n);
    if (n <= 100) return Math.ceil(n / 10) * 10; // 11-100: 保留一位小数（十位）
    // 100+: 保留左边两位有效数字
    const digits = Math.floor(Math.log10(n));
    const unit = Math.pow(10, digits - 1); // 保留两位有效数字
    return Math.ceil(n / unit) * unit;
  };
  // 取整工具：保留左边两位有效数字，后面补零（如 999→1000, 6840→6800, 12345→12000）
  const roundByMagnitude = (n: number): number => {
    if (n <= 0) return 0;
    if (n <= 10) return Math.round(n);
    if (n <= 100) return Math.round(n / 10) * 10; // 11-100: 保留一位小数（十位）
    // 100+: 保留左边两位有效数字
    const digits = Math.floor(Math.log10(n));
    const unit = Math.pow(10, digits - 1); // 保留两位有效数字
    return Math.round(n / unit) * unit;
  };

  // 2. 模具费（挤压模具，单独列出）
  let moldCost = 0;
  let moldSpec = ''; // 模具规格，如 Φ297×230 分流模
  let finalDieDiameter = 0; // 最终选定的模具直径（用于起订量分档）
  let minOrderWeightKg = 300; // 最低起订重量(kg)，按模具规格分档
  if (req.mold_cost && req.mold_cost > 0) {
    moldCost = req.mold_cost;
    notes.push(`挤压模具费: ${moldCost}元（用户指定，一次性，不计入单件价格）`);
    breakdown['mold'] = {
      formula: '用户指定模具费',
      detail: `模具费: ${moldCost}元（单独列出）`,
    };
  } else {
    // ====== 新挤压模具费计算 ======

    // 标准模具规格（mm）
    const STANDARD_DIE_SIZES = [139, 158, 178, 198, 218, 248, 278, 297, 338, 397];

    // 分流模标准厚度档位（mm）
    const STANDARD_THICKNESS = [90, 110, 120, 130, 160, 190, 230, 260, 360];

    // 安全米重上限表：key="Φ×H" → 上限值(kg/m)
    // 安全米重上限表：key="Φ×H" → 上限值(kg/m)，已按实际生产经验上调一倍
    const SAFE_METER_WEIGHT_LIMITS: Record<string, number> = {
      '139x55': 2.4, '139x65': 3.42, '139x90': 4.42, '139x110': 4.42,
      '158x120': 5.84, '158x130': 5.84,
      '178x130': 6.92,
      '198x130': 8.48, '198x160': 8.48,
      '218x160': 10.74,
      '248x160': 13.76, '248x190': 13.76,
      '278x190': 15.42, '278x230': 15.42,
      '297x190': 19.68, '297x230': 19.68, '297x260': 19.68,
      '338x190': 26.66, '338x230': 26.66, '338x260': 26.66,
      '397x230': 32, '397x260': 32, '397x360': 32,
    };

    // 每个规格的最大米重上限（=最厚档位的值）
    const MAX_METER_WEIGHT_BY_SIZE: Record<number, number> = {
      139: 4.42, 158: 5.84, 178: 6.92, 198: 8.48, 218: 10.74,
      248: 13.76, 278: 15.42, 297: 19.68, 338: 26.66, 397: 32,
    };

    // 管理费率（Φ139和Φ158统一35%，其余按厚度H递减，保底15%封顶35%）
    function getManagementRate(H: number, dieDia?: number): number {
      if (dieDia === 139 || dieDia === 158) return 0.35;
      if (H <= 60) return 0.35;
      if (H <= 130) return 0.25;
      if (H <= 190) return 0.18;
      return 0.15; // H >= 230
    }

    // 步骤1：对角线 → 模具直径
    const W = dims.width_mm || 50;
    const H_dim = dims.height_mm || 25;
    // 按标准件类型计算外接圆直径（对角线）
    const cat = dims.standard_category;
    let diagonal: number;
    if (cat === '铝圆管') {
      // 圆管外接圆 = 外径
      diagonal = dims.outer_diameter_mm || W;
    } else if (cat === '铝圆棒') {
      // 圆棒外接圆 = 直径
      diagonal = dims.diameter_mm || W;
    } else if (cat === '铝六角棒' || cat === '铝六角管') {
      // 六角外接圆 = 对边 / sin(60°) = 对边 × 2/√3
      const hexFlat = dims.hex_flat_mm || W;
      diagonal = hexFlat / Math.sin(Math.PI / 3);
    } else {
      // 方/扁棒、角铝、方管、异型材：矩形对角线
      diagonal = Math.sqrt(W * W + H_dim * H_dim);
    }
    let phiDiag = diagonal * 1.1 + 80;
    let dieDiameter = STANDARD_DIE_SIZES.find(s => s >= phiDiag) || STANDARD_DIE_SIZES[STANDARD_DIE_SIZES.length - 1];
    if (phiDiag <= 140) dieDiameter = 139;

    // 步骤2：模具类型确定 → 基础厚度
    // 优先使用用户手动选择的 die_type，没有则根据 num_dies 自动推断
    const numCavities = dims.num_dies || 1;
    // 公头数量系数：1公头×1.0，2公头×1.2，3公头×1.5，4公头及以上×1.8
    let cavityMultiplier = 1.0;
    if (numCavities >= 4) cavityMultiplier = 1.8;
    else if (numCavities === 3) cavityMultiplier = 1.5;
    else if (numCavities === 2) cavityMultiplier = 1.2;
    else cavityMultiplier = 1.0;
    let dieTypeKey: 'flat' | 'split';
    if (dims.die_type) {
      // 向后兼容：旧版传入 pseudo 按分流模处理
      dieTypeKey = (dims.die_type as string) === 'pseudo' ? 'split' : dims.die_type;
    } else {
      dieTypeKey = numCavities <= 1 ? 'flat' : 'split';
    }
    // 标准件：模具类型是截面几何固有属性（中空管材=分流模），以类别为准强制修正，
    // 不依赖库存 num_dies 是否录入（铝方管等0库存类别曾被误判为平模）
    // 注意：异型材是用户自选模具类型（平模/分流模按钮），绝不能被类别覆盖
    const STD_GEOMETRY_CATS = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管'];
    if (dims.standard_category && STD_GEOMETRY_CATS.includes(dims.standard_category)) {
      const hollowCats = ['铝圆管', '铝六角管', '铝方管'];
      dieTypeKey = hollowCats.includes(dims.standard_category) ? 'split' : 'flat';
    }
    const isFlatDie = dieTypeKey === 'flat';
    const stdPerimeters = dims.standard_category ? calcStandardPerimeters(dims) : null;
    let dieThickness: number;
    let finalPerimeter = 0; // 用于加工费计算

    if (isFlatDie) {
      dieThickness = 60; // 平模固定H=60
      // 平模优先使用用户输入的周长
      if (dims.perimeter_mm && dims.perimeter_mm > 0) {
        finalPerimeter = dims.perimeter_mm;
      } else if (stdPerimeters?.outer) {
        finalPerimeter = stdPerimeters.outer; // 标准件几何周长兜底
      } else {
        finalPerimeter = 2 * (W + H_dim); // 未提供时使用矩形周长
      }
      // 周长合理性钳制：实心件外周长不应超过外接矩形周长的5倍（异型翅片上限），
      // 防止误填/识图异常值（如把mm当0.1mm、把面积当周长）导致模具费离谱
      const flatMaxPerimeter = 2 * (W + H_dim) * 5;
      if (finalPerimeter > flatMaxPerimeter) {
        notes.push(`周长${Math.round(finalPerimeter)}mm明显超出${W}×${H_dim}截面合理范围（上限约${Math.round(flatMaxPerimeter)}mm），已按矩形轮廓${Math.round(2*(W+H_dim))}mm计算模具费，请核对图纸标注`);
        finalPerimeter = 2 * (W + H_dim);
      }
    } else {
      // 分流模/假整体模：判断异型复杂度
      const straightPerimeter = 2 * (W + H_dim);
      const actualPerimeter = dims.perimeter_mm || stdPerimeters?.outer || straightPerimeter;
      finalPerimeter = actualPerimeter; // 保存周长用于加工费计算
      const complexityRatio = actualPerimeter / straightPerimeter;

      const estimatedH = (W + H_dim) / 5;

      if (complexityRatio < 1.5) {
        dieThickness = STANDARD_THICKNESS.find(t => t >= estimatedH) || 90;
      } else {
        const idx = STANDARD_THICKNESS.findIndex(t => t >= estimatedH);
        dieThickness = idx >= 0 && idx < STANDARD_THICKNESS.length - 1
          ? STANDARD_THICKNESS[idx + 1]
          : (STANDARD_THICKNESS[idx] || 130);
      }
    }


    // 步骤2.5：校验 Φ×H 组合是否实际存在于安全表
    // 若不存在，升级到该规格的最近可用厚度（优先取≥当前H的最小可用值）
    const availableThicknessBySize: Record<number, number[]> = {};
    for (const key of Object.keys(SAFE_METER_WEIGHT_LIMITS)) {
      const parts = key.split('x');
      const sz = parseInt(parts[0]);
      const th = parseInt(parts[1]);
      if (!availableThicknessBySize[sz]) availableThicknessBySize[sz] = [];
      if (!availableThicknessBySize[sz].includes(th)) availableThicknessBySize[sz].push(th);
    }
    const checkKey = `${dieDiameter}x${dieThickness}`;
    if (SAFE_METER_WEIGHT_LIMITS[checkKey] === undefined) {
      const available = (availableThicknessBySize[dieDiameter] || []).sort((a, b) => a - b);
      if (available.length > 0) {
        const larger = available.find(t => t >= dieThickness);
        const newH = larger !== undefined ? larger : available[available.length - 1];
        notes.push(`模具规格 Φ${dieDiameter}×${dieThickness} 不可用，自动升级到 Φ${dieDiameter}×${newH}`);
        dieThickness = newH;
      }
    }
    // 步骤3：米重负载校验
    // 优先使用用户手动输入的米重(kg/m)，否则用公式计算
    const stdMw = calcStandardMeterWeight(dims);
    const meterWeightKgPerM = dims.meter_weight_kg_per_m
      ? dims.meter_weight_kg_per_m
      : (stdMw
        ? stdMw.weight
        : (dims.cross_section_area_mm2
          ? dims.cross_section_area_mm2 * 2.7 / 1000
          : (W * H_dim * 2.7 / 1000)));

    const limitKey = `${dieDiameter}x${dieThickness}`;
    let safeLimit = SAFE_METER_WEIGHT_LIMITS[limitKey];
    if (safeLimit === undefined) {
      const maxLimit = MAX_METER_WEIGHT_BY_SIZE[dieDiameter] || 13.33;
      safeLimit = maxLimit;
    }

    while (meterWeightKgPerM > safeLimit) {
      const currentIdx = STANDARD_DIE_SIZES.indexOf(dieDiameter);
      if (currentIdx < STANDARD_DIE_SIZES.length - 1) {
        dieDiameter = STANDARD_DIE_SIZES[currentIdx + 1];
        const newKey = `${dieDiameter}x${dieThickness}`;
        safeLimit = SAFE_METER_WEIGHT_LIMITS[newKey] || MAX_METER_WEIGHT_BY_SIZE[dieDiameter] || 13.33;
      } else {
        break;
      }
    }

    // 步骤3.5：步骤3升级直径后，重新校验 Φ×H 组合是否存在于安全表
    const checkKey2 = `${dieDiameter}x${dieThickness}`;
    if (SAFE_METER_WEIGHT_LIMITS[checkKey2] === undefined) {
      const available2 = (availableThicknessBySize[dieDiameter] || []).sort((a, b) => a - b);
      if (available2.length > 0) {
        const larger2 = available2.find((t: number) => t >= dieThickness);
        const newH2 = larger2 !== undefined ? larger2 : available2[available2.length - 1];
        notes.push(`模具规格 Φ${dieDiameter}×${dieThickness} 不可用，自动升级到 Φ${dieDiameter}×${newH2}`);
        dieThickness = newH2;
      }
    }

    // 步骤4：计算模具费（加入周长影响，支持实时模具钢价）
    const dieSteelPrice = dims.die_steel_price || DEFAULT_DIE_STEEL_PRICE;
    const materialFee = dieSteelPrice * DIE_STEEL_DENSITY * DIE_MATERIAL_WASTE_FACTOR * (dieDiameter / 2) * (dieDiameter / 2) * Math.PI * dieThickness / 1000000000;
    const baseProcessingFee = 0.028 * dieDiameter * dieThickness;
    let perimeterFee: number;
    let processingFee: number;
    // 分流模加工总周长 = 外周长 + 内孔周长（AI识别提供inner_perimeter_mm时用实际值；
    // 标准件用几何内周长；异型材未提供时按矩形管壁厚2mm估算内轮廓，不再用外周长×2高估）
    let innerPerimeterForFee = 0;
    if (!isFlatDie) {
      if (dims.inner_perimeter_mm && dims.inner_perimeter_mm > 0) {
        innerPerimeterForFee = dims.inner_perimeter_mm;
      } else if (stdPerimeters?.inner) {
        innerPerimeterForFee = stdPerimeters.inner;
      } else {
        // 异型材：按外接矩形内缩2mm壁厚估算内孔周长
        const estInnerW = Math.max(W - 4, W * 0.8);
        const estInnerH = Math.max(H_dim - 4, H_dim * 0.8);
        innerPerimeterForFee = 2 * (estInnerW + estInnerH);
      }
      // 内周长合理性钳制：不得大于外周长
      if (innerPerimeterForFee > finalPerimeter) innerPerimeterForFee = finalPerimeter;
    }
    if (isFlatDie) {
      // 平模：加工费 = 基础加工 + 外周长×厚度×系数
      const processingArea = finalPerimeter * dieThickness;
      perimeterFee = 0.0035 * processingArea;
      processingFee = baseProcessingFee + perimeterFee;
    } else {
      // 分流模：加工费 = 基础加工 + (外周长+内孔周长)×厚度×系数
      perimeterFee = 0.0035 * (finalPerimeter + innerPerimeterForFee) * dieThickness;
      processingFee = baseProcessingFee + perimeterFee;
    }
    const mgmtRate = getManagementRate(dieThickness, dieDiameter);
    moldCost = roundByMagnitude((materialFee + processingFee) * (1 + mgmtRate));
    // 所有挤压模具统一加价100元
    const preSurcharge = moldCost;
    moldCost = moldCost + 100;

    const dieTypeMap: Record<string, string> = { flat: '平模', split: '分流模' };
    const dieType = dieTypeMap[dieTypeKey] || '分流模';
    moldSpec = `Φ${dieDiameter}×${dieThickness} ${dieType}`;
    // 使用已有模具时，模具费为0
    if (req.use_existing_mold) {
      moldCost = 0;
      notes.push('使用已有模具，模具费为0元');
    }
    finalDieDiameter = dieDiameter;
    notes.push(`模具钢价: ${dieSteelPrice}元/吨${dims.die_steel_price ? '（用户指定）' : '（默认H13均价）'}`);
    if (isFlatDie) {
      notes.push(`模具费: ${moldCost}元 = (${Math.round(materialFee)}材料 + (${Math.round(baseProcessingFee)}基础 + ${Math.round(perimeterFee)}周长×厚度加工) × ${(mgmtRate*100).toFixed(0)}%管理费)`);
    } else {
      notes.push(`模具费: ${moldCost}元 = (${Math.round(materialFee)}材料 + (${Math.round(baseProcessingFee)}基础 + ${Math.round(perimeterFee)}(外周长${Math.round(finalPerimeter)}+内周长${Math.round(innerPerimeterForFee)})×厚度加工) × ${(mgmtRate*100).toFixed(0)}%管理费)`);
    }
    notes.push(`模具统一加价+100元: ${preSurcharge}→${moldCost}元`);
    notes.push(`模具费一次性，不计入单件价格`);

    breakdown['mold'] = {
      formula: `(材料费: 钢价×密度7.85×损耗1.2×πR²×H/10⁹ + (基础加工费0.028×Φ×H + 周长加工费0.0035×周长×2×厚度(分流模)或周长×厚度(平模)) × (1+管理费率)`,
      detail: `模具钢价${dieSteelPrice}元/吨(密度7.85,损耗1.2) | Φ${dieDiameter}×${dieThickness}${dieType} | ${numCavities}公头(系数×${cavityMultiplier}): 材料费${dieSteelPrice}×7.85×1.2×π×(${dieDiameter}/2)²×${dieThickness}/10⁹=${Math.round(materialFee)} + 加工费(${Math.round(baseProcessingFee)}基础+${Math.round(perimeterFee)}周长)×${cavityMultiplier}=${Math.round((baseProcessingFee + perimeterFee) * cavityMultiplier)} → ×${(1+mgmtRate).toFixed(2)} = ${moldCost}元`,
    };
  }

  
  // ===== 长/小料判定 =====
  // 三种场景：
  //  A. 物理长料（length >= 3000mm）：仅材料费+表面处理费，跳过所有加工/包装/管销
  //  B. 短件长料氧化（length < 3000 但用户选"长料"）：表面处理走长料费率，锯切/CNC/冲压等加工费、包装、管销利润照算
  //  C. 小料（length < 3000 且用户选"小料"，默认）：表面处理走小料费率，加工费、包装、管销利润照算
  const productLengthMm = dims.length_mm || 0;
  const userPickedLong = dims.material_size_type === 'long';
  const isPhysicalLong = productLengthMm >= 3000;
  const isShortLongOxidation = !isPhysicalLong && userPickedLong;
  const isLongMaterial = isPhysicalLong || userPickedLong;

  let stampingSurchargePerPass = 0;
  let totalSecondaryCost = 0;
  const secondaryDetails: string[] = [];
  const secondaryFormulaParts: string[] = [];
  let surfaceCost = 0;
  let packagingCost = 0;
  let transportCost = 0;
  let managementFee = 0;
  let profitFee = 0;

  // 冲压附加费（仅体积附加，与是否选冲压工序无关，仅用于表面处理费计算）
  const dimVolMm3 = (dims.length_mm || 0) * (dims.width_mm || 0) * (dims.height_mm || 0);
  const stampingSurcharge = dimVolMm3 * 0.00000003;

  const applySurfaceCost = (long: boolean) => {
    if (!req.surface_treatment?.type) return;
    const treatmentType = req.surface_treatment.type;
    const weightKg = mat.weight;
    let base = 0, weightCoeff = 0, stampingCoeff = 0;
    if (long) {
      switch (treatmentType) {
        case '氧化本色': base = 0; stampingCoeff = 2; weightCoeff = 2; break;
        case '氧化上色': base = 0; stampingCoeff = 3; weightCoeff = 5; break;
        case '喷涂': base = 0; stampingCoeff = 2; weightCoeff = 2; break;
        case '喷砂': base = 0; stampingCoeff = 2; weightCoeff = 1; break;
        case '拉丝': base = 0; stampingCoeff = 3; weightCoeff = 2; break;
        default: base = 0; stampingCoeff = 2; weightCoeff = 2;
      }
    } else {
      switch (treatmentType) {
        case '氧化本色': base = 0.2; stampingCoeff = 2; weightCoeff = 2; break;
        case '氧化上色': base = 0.3; stampingCoeff = 3; weightCoeff = 3; break;
        case '喷涂': base = 0.2; stampingCoeff = 2; weightCoeff = 2; break;
        case '喷砂': base = 0.2; stampingCoeff = 2; weightCoeff = 1; break;
        case '拉丝': base = 0.2; stampingCoeff = 3; weightCoeff = 3; break;
        default: base = 0.2; stampingCoeff = 2; weightCoeff = 2;
      }
    }
    const stampingPart = r2(stampingSurcharge * stampingCoeff);
    let oxidationExtra = 0;
    // 小料氧化：额外加材料费的10%
    if (!long && treatmentType.startsWith('氧化')) {
      oxidationExtra = r2(mat.cost * 0.1);
    }
    surfaceCost = r2(base + stampingPart + weightKg * weightCoeff + oxidationExtra);
    const label = long ? '长料' : '小料';
    const extra = long ? '' : '（含小料附加费）';
    const parts: string[] = [];
    if (base > 0) parts.push(`${base}${extra}`);
    if (stampingCoeff > 0) parts.push(`冲压附加费${r2(stampingSurcharge)}×${stampingCoeff}`);
    parts.push(`重量×${weightCoeff}`);
    if (oxidationExtra > 0) parts.push(`材料费×10%(${oxidationExtra})`);
    breakdown['surface'] = {
      formula: parts.join(' + '),
      detail: `[${label}] ${base}${extra} + ${r2(stampingSurcharge)}×${stampingCoeff} + ${r2(weightKg)}×${weightCoeff}${oxidationExtra > 0 ? ' + 材料费' + mat.cost + '×10%=' + oxidationExtra : ''} = ${r2(surfaceCost)}元`,
    };
    accumulated += surfaceCost;
  };

  if (isPhysicalLong) {
    applySurfaceCost(true);
    breakdown['secondary'] = { formula: '无', detail: '长料(≥3m)不另计加工费' };
    notes.push('长料(≥3m)：仅材料费+表面处理费，不含加工/包装/运输/管销利润');
  } else {
    const useLongRate = isShortLongOxidation;

    if (req.process?.stamping_tonnage) {
      const tonnageRates = rules.process_rates?.['冲压吨位费率']?.rates || {};
      const tonnage = req.process.stamping_tonnage.replace('<=', '≤');
      const rate = tonnageRates[tonnage] || 0.3;
      const count = req.process.stamping_count || 1;

      const lengthMm = dims.length_mm || 0;
      const widthMm = dims.width_mm || 0;
      const heightMm = dims.height_mm || 0;
      const maxDim = Math.max(lengthMm, widthMm, heightMm);
      const lengthSurcharge = maxDim > 100 ? Math.floor((maxDim - 1) / 100) * 0.01 : 0;
      const volumeMm3 = lengthMm * widthMm * heightMm;
      const volumeSurcharge = volumeMm3 * 0.00000003;
      stampingSurchargePerPass = lengthSurcharge + volumeSurcharge;

      const actualRate = rate * 2;
      const stampingFeePerPass = r2(actualRate + lengthSurcharge + volumeSurcharge);
      for (let i = 0; i < count; i++) {
        accumulated = (accumulated + stampingFeePerPass) * 1.03;
      }
      totalSecondaryCost += accumulated - mat.cost;

      const lengthPart = lengthSurcharge > 0 ? ` + 长度附加${lengthSurcharge}` : '';
      const volumePart = volumeSurcharge > 0 ? ` + 体积附加${r2(volumeSurcharge)}` : '';
      secondaryDetails.push(`冲压(${req.process.stamping_tonnage}): ${count}次 × (${actualRate}=${rate}×2${lengthPart}${volumePart}) ×1.03损耗 = ${r2(accumulated - mat.cost)}元`);
      secondaryFormulaParts.push(`冲压×${count}`);
    }

    applySurfaceCost(useLongRate);

    if (req.process) {
      const sec = calcSecondaryOperationsCost(req.process, rules, mat.cost);
      if (sec.cost > 0 && sec.detail && sec.detail !== '无二次加工') {
        const opsCount = countSecondaryOps(req.process);
        const perOpCost = r2(sec.cost / opsCount);
        const prevAccumulated = accumulated;
        for (let i = 0; i < opsCount; i++) {
          accumulated = (accumulated + perOpCost) * 1.03;
        }
        totalSecondaryCost += accumulated - prevAccumulated;
        secondaryDetails.push(sec.detail);
        secondaryFormulaParts.push(sec.formula);
      }
    }

    if (productLengthMm > 0) {
      const sawCost = r2(mat.cost * 0.1);
      accumulated = (accumulated + sawCost) * 1.03;
      totalSecondaryCost += sawCost * 1.03;
      secondaryDetails.push(`锯切(默认,长度<3m): 材料费${mat.cost}元 × 10% ×1.03损耗 = ${r2(sawCost * 1.03)}元`);
      secondaryFormulaParts.push('锯切(材料×10%)');
      breakdown['sawing'] = {
        formula: '材料费 × 10%（长度<3m默认锯切）',
        detail: `${mat.cost} × 10% = ${sawCost}元（含×1.03损耗后 ${r2(sawCost * 1.03)}元）`,
      };
    }

    breakdown['secondary'] = {
      formula: secondaryFormulaParts.length > 0 ? secondaryFormulaParts.join(' + ') : '无',
      detail: secondaryDetails.length > 0 ? secondaryDetails.join('; ') : '无二次加工',
    };

    packagingCost = r2(mat.weight * 0.5);
    transportCost = r2(mat.weight * 0.5);
    accumulated += packagingCost + transportCost;
    breakdown['packaging'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${packagingCost}元` };
    breakdown['transport'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${transportCost}元` };

    profitFee = r2(accumulated * 0.05);
    accumulated += profitFee;
    managementFee = 0;
    breakdown['management_profit'] = {
      formula: '合计 × 5%(利润)',
      detail: `利润: ${profitFee}元`,
    };

    if (isShortLongOxidation) {
      notes.push('短件长料氧化：表面处理按长料费率（整根氧化后再锯切加工），其余费用按小料流程');
    }
  }

  const preTaxPrice = accumulated;
  const taxRate = isLongMaterial ? 0.09 : 0.13;
  const taxFee = r2(preTaxPrice * taxRate);
  const unitPrice = r3sig(preTaxPrice + taxFee);
  breakdown['tax'] = {
    formula: isLongMaterial ? '总价 × 9%(长料税)' : '总价 × 13%(小料税)',
    detail: `${r2(preTaxPrice)} × ${(taxRate * 100).toFixed(0)}% = ${taxFee}元`,
  };
  
  // 使用未舍入的原始重量计算MOQ，避免精度丢失导致MOQ为0
  const rawWeight = mat.rawWeight || mat.weight;
  
  // 最小起订量：按模具规格分档最低起订重量换算件数，按数量级向上进位
  // Φ397及以上→1000kg，Φ338→500kg，其余（含无模具/小模具）→300kg
  if (finalDieDiameter >= 397) minOrderWeightKg = 1000;
  else if (finalDieDiameter >= 338) minOrderWeightKg = 500;
  else minOrderWeightKg = 300;
  const minOrderQtyRaw = rawWeight > 0 ? Math.ceil(minOrderWeightKg / rawWeight) : 0;
  const minOrderQty = ceilByMagnitude(minOrderQtyRaw);
  if (minOrderQty > 0) {
    notes.push(`最小起订量: ${minOrderQty}件（按${minOrderWeightKg}kg换算，向上取整）`);
  }
  if (productLengthMm === 0 && moldCost > 0) {
    notes.push('未输入型材长度：模具费可独立核算；材料费/加工费/单件价请填入长度后自动计算');
  }
  
  return {
    costs: {
      material_cost: mat.cost,
      processing_cost: 0, // 挤压加工费已含在材料单价中
      surface_treatment_cost: r2(surfaceCost),
      secondary_operations_cost: r2(totalSecondaryCost),
      packaging_cost: packagingCost,
      transport_cost: transportCost,
      management_fee: r2(managementFee + profitFee),
      unit_price: unitPrice,
      unit_price_ex_tax: r2(preTaxPrice),
      unit_price_in_tax: unitPrice,
      total_ex_tax: r2(preTaxPrice),
      total_in_tax: unitPrice,
      weight_per_piece_kg: mat.weight,
      min_order_qty: minOrderQty,
      min_order_weight_kg: minOrderWeightKg,
      mold_cost: req.use_existing_mold ? 0 : moldCost,
      mold_spec: moldSpec,
    },
    breakdown,
    weight: rawWeight, // 返回未舍入的重量，用于后续总重计算
    notes,
    utilizationRate: mat.utilizationRate,
  };
}

// ============================================================
// 加工费计算
// ============================================================

/**
 * 板材冲压加工费
 * 公式：冲压吨位基数 + 尺寸附加费 + 体积附加费
 */
function calcSheetProcessingFee(
  dimensions: NonNullable<QuoteRequest['dimensions']>,
  volumeCm3: number,
  materialCategory: string,
  rules: PricingRules,
): { cost: number; tonnage: number; baseFee: number; sizeSurcharge: number; volumeSurcharge: number; formula: string; detail: string } {
  const { length_mm, width_mm } = dimensions;
  // 板材厚度优先使用 wall_thickness_mm，其次 height_mm
  const t = dimensions.wall_thickness_mm || dimensions.height_mm || 2;

  // 冲裁周长（简化：矩形件 2×(L+W)）
  const perimeter = 2 * (length_mm + width_mm);

  // 抗剪强度（MPa）— 支持数值或范围字符串 "110~180 MPa"
  const shearMap = rules.process_rates['冲压吨位计算']?.shear_strength || {};
  let shearStrength = 350; // 默认冷板
  if (materialCategory.includes('铝')) shearStrength = midOfRange(shearMap['铝'] || 150);
  else if (materialCategory.includes('不锈钢')) shearStrength = midOfRange(shearMap['不锈钢304'] || 570);

  // 冲压吨位 = 冲裁周长 × 板厚 × 抗剪强度 ÷ 1000
  const tonnage = (perimeter * t * shearStrength) / 1000; // 单位：kN → 换算为吨(近似)
  const tonnageT = tonnage / 10; // 简化换算

  // 根据吨位选择费率（硬编码标准费率，避免远程配置键名不一致问题）
  let baseFee = 0.3;
  const rateEntries: [number, number][] = [
    [35, 0.10],   // ≤35T
    [45, 0.24],   // 45T
    [60, 0.30],   // 60T
    [80, 0.40],   // 80T
    [110, 0.50],  // 110T
    [160, 0.60],  // 160T
    [200, 1.00],  // 200T
    [400, 1.80],  // 250T双轴
  ];
  for (const [limit, rate] of rateEntries) {
    if (tonnageT <= limit) { baseFee = rate as number; break; }
  }

  // 尺寸附加费
  const maxDim = Math.max(length_mm, width_mm);
  let sizeSurcharge = 0;
  if (maxDim > 100) {
    sizeSurcharge = Math.floor((maxDim - 100) / 100) * 0.01;
  }

  // 体积附加费
  const volumeMm3 = volumeCm3 * 1000; // cm³ → mm³
  const volumeSurcharge = volumeMm3 * 0.00000003;

  const processingCost = baseFee + sizeSurcharge + volumeSurcharge;

  return {
    cost: r2(processingCost),
    tonnage: r2(tonnageT),
    baseFee: r2(baseFee),
    sizeSurcharge: r2(sizeSurcharge),
    volumeSurcharge: r2(volumeSurcharge),
    formula: '冲压吨位基数 + 尺寸附加费 + 体积附加费',
    detail: `吨位${r2(tonnageT)}T→基数${baseFee}元 + 尺寸附加${r2(sizeSurcharge)}元 + 体积附加${r2(volumeSurcharge)}元`,
  };
}

/**
 * 压铸加工费（压铸铝/锌合金）
 */
function calcDieCastingProcessingFee(
  weightKg: number,
  productType: string,
  rules: PricingRules,
): { cost: number; formula: string; detail: string } {
  let castingFeePerKg = 4; // 默认 元/kg

  if (productType === 'die_casting') {
    const range = rules.die_casting_rates?.['压铸铝ADC12_A380']?.casting_fee_range || [3, 5];
    castingFeePerKg = midOfRange(range);
  } else if (productType === 'zinc_alloy') {
    const feeMap = rules.die_casting_rates?.['锌合金压铸']?.processing_fee_by_weight || {};
    const weightG = weightKg * 1000;
    if (weightG < 10) castingFeePerKg = midOfRange(feeMap['<10g'] || [18, 20]);
    else if (weightG < 20) castingFeePerKg = midOfRange(feeMap['10~20g'] || [15, 18]);
    else if (weightG < 50) castingFeePerKg = midOfRange(feeMap['20~50g'] || [13, 15]);
    else if (weightG < 200) castingFeePerKg = midOfRange(feeMap['50~200g'] || [11, 13]);
    else castingFeePerKg = midOfRange(feeMap['>200g'] || [10, 11]);
  }

  const cost = weightKg * castingFeePerKg;
  return {
    cost: r2(cost),
    formula: `重量 × 压铸单价(${castingFeePerKg}元/kg)`,
    detail: `${r2(weightKg)}kg × ${castingFeePerKg}元/kg = ${r2(cost)}元`,
  };
}

/**
 * 注塑加工费
 */
function calcInjectionProcessingFee(
  weightKg: number,
  wallThickness: number,
  rules: PricingRules,
): { cost: number; formula: string; detail: string } {
  // 根据壁厚估算注塑吨位和加工费
  const feeMap = rules.injection_molding_rates?.injection_fee_by_tonnage || {};
  let injectionFee = 1.0; // 默认 元/shot

  if (wallThickness <= 1) injectionFee = midOfRange(feeMap['50T以下'] || [0.3, 0.5]);
  else if (wallThickness <= 2) injectionFee = midOfRange(feeMap['50~100T'] || [0.5, 0.8]);
  else if (wallThickness <= 3) injectionFee = midOfRange(feeMap['100~200T'] || [0.8, 1.2]);
  else injectionFee = midOfRange(feeMap['200~350T'] || [1.2, 2.0]);

  // 简化：每件 = 1 shot
  const cost = injectionFee;
  return {
    cost: r2(cost),
    formula: `注塑加工费(按壁厚对应吨位: ${injectionFee}元/shot)`,
    detail: `壁厚${wallThickness}mm → ${injectionFee}元/件`,
  };
}

// ============================================================
// 表面处理费计算
// ============================================================

/**
 * 计算表面处理费
 * 公式：base_fee + 冲压附加费×系数 + 重量×系数
 * 冲压附加费 = 尺寸附加费 + 体积附加费（不含吨位基数）
 */
function calcSurfaceTreatmentCost(
  treatmentType: string,
  materialCategory: string,
  weightKg: number,
  stampingSurcharge: number, // 尺寸附加 + 体积附加
  rules: PricingRules,
): { cost: number; formula: string; detail: string } {
  // 判断材料属于哪个表面处理组
  let stGroup: Record<string, any> = {};
  if (materialCategory.includes('铝')) {
    stGroup = rules.surface_treatment?.['铝板'] || {};
  } else {
    stGroup = rules.surface_treatment?.['冷板_不锈钢'] || {};
  }

  const stConfig = stGroup[treatmentType];
  if (!stConfig) {
    // 未找到匹配的表面处理配置，使用默认估算
    return {
      cost: r2(weightKg * 2),
      formula: `默认估算: 重量 × 2`,
      detail: `未找到 "${treatmentType}" 的费率配置，按默认估算`,
    };
  }

  const base = stConfig.base || 0;
  const stampingCoeff = stConfig.stamping_coeff || 0;
  const weightCoeff = stConfig.weight_coeff || 0;

  const cost = base + stampingSurcharge * stampingCoeff + weightKg * weightCoeff;

  return {
    cost: r2(cost),
    formula: `${base} + 冲压附加费×${stampingCoeff} + 重量×${weightCoeff}`,
    detail: `${base} + ${r2(stampingSurcharge)}×${stampingCoeff} + ${r2(weightKg)}×${weightCoeff} = ${r2(cost)}元`,
  };
}

// ============================================================
// 二次加工费计算
// ============================================================

/**
 * 统计二次加工的工序数量（钻孔/攻丝/铣槽/去毛刺/CNC 各算1道）
 */
function countSecondaryOps(
  process: NonNullable<QuoteRequest['process']>,
): number {
  let count = 0;
  if (process.holes && process.holes.count > 0) count++;
  if (process.tapped_holes && process.tapped_holes.count > 0) count++;
  if (process.slots && process.slots.count > 0) count++;
  const ops = process.secondary_operations || [];
  if (ops.includes('去毛刺')) count++;
  if (process.cnc_time && process.cnc_time.minutes > 0) count++;
  return count || (ops.length > 0 ? 1 : 0);
}

/**
 * 计算二次加工费（钻孔、攻丝、铣槽、去毛刺等）
 */
function calcSecondaryOperationsCost(
  process: NonNullable<QuoteRequest['process']>,
  rules: PricingRules,
  materialCost = 0,
): { cost: number; formula: string; detail: string } {
  let totalCost = 0;
  const details: string[] = [];
  const formulaParts: string[] = [];
  const cncRates = rules.cnc_rates || {};

  // 钻孔费
  if (process.holes && process.holes.count > 0) {
    const holeRates = cncRates['钻孔'] || {};
    const range = process.holes.diameter_range || 'ø6~10mm';
    // 匹配费率
    let rate = midOfRange(holeRates['ø6~10mm'] || [0.5, 0.8]);
    for (const [key, val] of Object.entries(holeRates)) {
      if (range.includes(key.replace('ø', '').split('~')[0]) || key.includes(range)) {
        rate = midOfRange(val as number[]);
        break;
      }
    }
    const holeCost = process.holes.count * rate;
    totalCost += holeCost;
    details.push(`钻孔: ${process.holes.count}孔 × ${rate}元 = ${r2(holeCost)}元`);
  }

  // 攻丝费
  if (process.tapped_holes && process.tapped_holes.count > 0) {
    const tapRates = cncRates['攻丝'] || {};
    const size = process.tapped_holes.size || 'M5~M6';
    let rate = midOfRange(tapRates['M5~M6'] || [0.5, 0.8]);
    for (const [key, val] of Object.entries(tapRates)) {
      if (size.includes(key) || key.includes(size)) {
        rate = midOfRange(val as number[]);
        break;
      }
    }
    const tapCost = process.tapped_holes.count * rate;
    totalCost += tapCost;
    details.push(`攻丝: ${process.tapped_holes.count}孔 × ${rate}元 = ${r2(tapCost)}元`);
  }

  // 铣槽费
  if (process.slots && process.slots.count > 0) {
    const slotRates = cncRates['铣槽'] || {};
    const slotType = process.slots.type === '封闭槽' ? '封闭槽' : '开口槽';
    const rate = midOfRange(slotRates[slotType] || [0.02, 0.05]);
    // 简化：每个槽按 10mm 长度估算
    const slotCost = process.slots.count * 10 * rate;
    totalCost += slotCost;
    details.push(`铣槽(${slotType}): ${process.slots.count}个 × 10mm × ${rate}元/mm = ${r2(slotCost)}元`);
  }

  // 去毛刺费
  const ops = process.secondary_operations || [];
  if (ops.includes('去毛刺')) {
    const deburrRates = cncRates['去毛刺'] || {};
    const rate = midOfRange(deburrRates['手工'] || [0.5, 1.0]);
    // 去毛刺按件计费，这里按 0.75 元/件估算
    const deburrCost = rate; // 单位是元/件
    totalCost += deburrCost;
    details.push(`去毛刺: ${rate}元/件`);
  }

  // CNC/车加工：时间费 1元/分钟 + 材料费的10%（2026-08-30 龙哥规则）
  if (process.cnc_time && process.cnc_time.minutes > 0) {
    const CNC_RATE_PER_MIN = 1; // 元/分钟
    const timeCost = r2(process.cnc_time.minutes * CNC_RATE_PER_MIN);
    const cncSurcharge = materialCost > 0 ? r2(materialCost * 0.1) : 0;
    const cncTotal = r2(timeCost + cncSurcharge);
    totalCost += cncTotal;
    details.push(`CNC/车加工: ${process.cnc_time.minutes}分钟×1元/分=${timeCost}元${cncSurcharge > 0 ? ` + 材料费×10%=${cncSurcharge}元` : ''} = ${cncTotal}元`);
    formulaParts.push(cncSurcharge > 0 ? 'CNC/车加工(工时+材料×10%)' : 'CNC/车加工(工时)');
  }

  if (details.length === 0) {
    details.push('无二次加工');
  }

  return {
    cost: r2(totalCost),
    formula: formulaParts.length > 0 ? formulaParts.join(' + ') : '各项二次加工费之和',
    detail: details.join('; '),
  };
}

// ============================================================
// 主计算引擎 — 板材加工
// ============================================================

function calcSheetMetal(
  req: QuoteRequest,
  aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[]; utilizationRate?: number } {
  const dims = normalizeDims(req.dimensions!);
  // 板材体积：优先使用请求中的值，否则用 长×宽×壁厚 估算（注意是壁厚不是高度）
  const volumeCm3 = req.volume_cm3 || (dims.length_mm * dims.width_mm * (dims.wall_thickness_mm || dims.height_mm || 2)) / 1000;
  const notes: string[] = [];
  const breakdown: Record<string, { formula: string; detail: string }> = {};

  // 1. 材料费
  const mat = calcSheetMaterialCost(req.material.category, req.material.grade, dims, aluminumPrice, rules);
  breakdown['material'] = { formula: mat.formula, detail: mat.detail };

  // 2. 加工费
  const proc = calcSheetProcessingFee(dims, volumeCm3, req.material.category, rules);
  breakdown['processing'] = { formula: proc.formula, detail: proc.detail };

  // 3. 工序累计（每道工序: 累计 = (前面累计 + 加工费) × 1.03(损耗) × 1.03(管销)）
  // 简化：假设只有1道冲压工序
  let accumulated = mat.cost;
  accumulated = (accumulated + proc.cost) * 1.03 * 1.03;

  // 冲压附加费 = 尺寸附加 + 体积附加（不含吨位基数）
  const stampingSurcharge = proc.sizeSurcharge + proc.volumeSurcharge;

  // 4. 表面处理费
  let surfaceCost = 0;
  if (req.surface_treatment?.type) {
    const st = calcSurfaceTreatmentCost(req.surface_treatment.type, req.material.category, mat.weight, stampingSurcharge, rules);
    surfaceCost = st.cost;
    accumulated += surfaceCost;
    breakdown['surface'] = { formula: st.formula, detail: st.detail };
  }

  // 5. 二次加工费
  let secondaryCost = 0;
  if (req.process) {
    const sec = calcSecondaryOperationsCost(req.process, rules, mat.cost);
    secondaryCost = sec.cost;
    accumulated += secondaryCost;
    breakdown['secondary'] = { formula: sec.formula, detail: sec.detail };
  }

  // 6. × 1.05（最终损耗）
  accumulated *= 1.05;

  // 7. 包装 + 运输
  const packagingCost = r2(mat.weight * 0.5);
  const transportCost = r2(mat.weight * 0.5);
  accumulated += packagingCost + transportCost;
  breakdown['packaging'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${packagingCost}元` };
  breakdown['transport'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${transportCost}元` };

  // 管销费已在工序累计中（×1.03），这里单独列出供参考
  const managementFee = r2(mat.cost * 0.03 + proc.cost * 0.03);
  breakdown['management'] = {
    formula: '每工序累计 × 1.03(损耗) × 1.03(管销)',
    detail: `管销费已包含在工序累计中: ≈${managementFee}元`,
  };

  const preTaxPrice = accumulated;
  const taxRate = 0.13;
  const taxFee = r2(preTaxPrice * taxRate);
  const unitPrice = r3sig(preTaxPrice + taxFee);
  breakdown['tax'] = {
    formula: '总价 × 13%',
    detail: `${r2(preTaxPrice)} × ${(taxRate * 100).toFixed(0)}% = ${taxFee}元`,
  };

  return {
    costs: {
      material_cost: mat.cost,
      processing_cost: proc.cost,
      surface_treatment_cost: r2(surfaceCost),
      secondary_operations_cost: r2(secondaryCost),
      packaging_cost: packagingCost,
      transport_cost: transportCost,
      management_fee: managementFee,
      unit_price: unitPrice,
      unit_price_ex_tax: r2(preTaxPrice),
      unit_price_in_tax: unitPrice,
      total_ex_tax: r2(preTaxPrice),
      total_in_tax: unitPrice,
      weight_per_piece_kg: mat.weight,
    },
    breakdown,
    weight: mat.weight,
    notes,
    utilizationRate: mat.utilizationRate,
  };
}

// ============================================================
// 主计算引擎 — 压铸铝
// ============================================================

function calcDieCasting(
  req: QuoteRequest,
  aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[]; utilizationRate?: number } {
  const volumeCm3 = req.volume_cm3 || 100;
  const notes: string[] = [];
  const breakdown: Record<string, { formula: string; detail: string }> = {};

  // 1. 材料费
  const mat = calcVolumetricMaterialCost(req.material.category, volumeCm3, aluminumPrice, rules);
  breakdown['material'] = { formula: mat.formula, detail: mat.detail };

  // 2. 压铸加工费
  const proc = calcDieCastingProcessingFee(mat.weight, 'die_casting', rules);
  breakdown['processing'] = { formula: proc.formula, detail: proc.detail };

  // 累计（含损耗 5%）
  let accumulated = mat.cost + proc.cost;
  accumulated *= (1 + (rules.die_casting_rates?.['压铸铝ADC12_A380']?.loss_rate || 0.05));

  // 3. 模具费（单独列出，不计入单价）
  let moldTotal = req.mold_cost && req.mold_cost > 0 ? req.mold_cost : 20000;
  notes.push(`压铸模具费: ${moldTotal}元（一次性，不计入单件价格）`);
  breakdown['mold'] = {
    formula: '模具费（一次性，不分摊）',
    detail: `模具费: ${moldTotal}元（单独列出）`,
  };

  // 4. 表面处理费
  let surfaceCost = 0;
  if (req.surface_treatment?.type) {
    const st = calcSurfaceTreatmentCost(req.surface_treatment.type, req.material.category, mat.weight, 0, rules);
    surfaceCost = st.cost;
    accumulated += surfaceCost;
    breakdown['surface'] = { formula: st.formula, detail: st.detail };
  }

  // 5. 二次加工费
  let secondaryCost = 0;
  if (req.process) {
    const sec = calcSecondaryOperationsCost(req.process, rules, mat.cost);
    secondaryCost = sec.cost;
    accumulated += secondaryCost;
    breakdown['secondary'] = { formula: sec.formula, detail: sec.detail };
  }

  // 6. × 1.05（最终损耗）
  accumulated *= 1.05;

  // 7. 包装 + 运输
  const packagingCost = r2(mat.weight * 0.5);
  const transportCost = r2(mat.weight * 0.5);
  accumulated += packagingCost + transportCost;
  breakdown['packaging'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${packagingCost}元` };
  breakdown['transport'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${transportCost}元` };

  const managementFee = r2((mat.cost + proc.cost) * 0.03);
  const preTaxPrice = accumulated;
  const taxRate = 0.13;
  const taxFee = r2(preTaxPrice * taxRate);
  const unitPrice = r3sig(preTaxPrice + taxFee);
  breakdown['tax'] = {
    formula: '总价 × 13%',
    detail: `${r2(preTaxPrice)} × ${(taxRate * 100).toFixed(0)}% = ${taxFee}元`,
  };

  return {
    costs: {
      material_cost: mat.cost,
      processing_cost: proc.cost,
      surface_treatment_cost: r2(surfaceCost),
      secondary_operations_cost: r2(secondaryCost),
      packaging_cost: packagingCost,
      transport_cost: transportCost,
      management_fee: managementFee,
      unit_price: unitPrice,
      unit_price_ex_tax: r2(preTaxPrice),
      unit_price_in_tax: unitPrice,
      total_ex_tax: r2(preTaxPrice),
      total_in_tax: unitPrice,
      weight_per_piece_kg: mat.weight,
      mold_cost: moldTotal,
    },
    breakdown,
    weight: mat.weight,
    notes,
    utilizationRate: mat.utilizationRate,
  };
}

// ============================================================
// 主计算引擎 — 锌合金压铸
// ============================================================

function calcZincAlloy(
  req: QuoteRequest,
  _aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[]; utilizationRate?: number } {
  const volumeCm3 = req.volume_cm3 || 50;
  const notes: string[] = [];
  const breakdown: Record<string, { formula: string; detail: string }> = {};

  // 1. 材料费
  const mat = calcVolumetricMaterialCost(req.material.category, volumeCm3, _aluminumPrice, rules);
  breakdown['material'] = { formula: mat.formula, detail: mat.detail };

  // 2. 压铸加工费（按重量分段计价）
  const proc = calcDieCastingProcessingFee(mat.weight, 'zinc_alloy', rules);
  breakdown['processing'] = { formula: proc.formula, detail: proc.detail };

  // 累计（含损耗 6%）
  let accumulated = mat.cost + proc.cost;
  accumulated *= (1 + (rules.die_casting_rates?.['锌合金压铸']?.loss_rate || 0.06));

  // 3. 模具费（单独列出，不计入单价）
  let moldTotal = req.mold_cost && req.mold_cost > 0 ? req.mold_cost : 25000;
  notes.push(`锌合金模具费: ${moldTotal}元（一次性，不计入单件价格）`);
  breakdown['mold'] = {
    formula: '模具费（一次性，不分摊）',
    detail: `模具费: ${moldTotal}元（单独列出）`,
  };

  // 4. 表面处理费
  let surfaceCost = 0;
  if (req.surface_treatment?.type) {
    const st = calcSurfaceTreatmentCost(req.surface_treatment.type, '锌合金', mat.weight, 0, rules);
    surfaceCost = st.cost;
    accumulated += surfaceCost;
    breakdown['surface'] = { formula: st.formula, detail: st.detail };
  }

  // 5. 二次加工费
  let secondaryCost = 0;
  if (req.process) {
    const sec = calcSecondaryOperationsCost(req.process, rules, mat.cost);
    secondaryCost = sec.cost;
    accumulated += secondaryCost;
    breakdown['secondary'] = { formula: sec.formula, detail: sec.detail };
  }

  // 6. × 1.05（最终损耗）
  accumulated *= 1.05;

  // 7. 包装 + 运输
  const packagingCost = r2(mat.weight * 0.5);
  const transportCost = r2(mat.weight * 0.5);
  accumulated += packagingCost + transportCost;
  breakdown['packaging'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${packagingCost}元` };
  breakdown['transport'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${transportCost}元` };

  const managementFee = r2((mat.cost + proc.cost) * 0.03);
  const preTaxPrice = accumulated;
  const taxRate = 0.13;
  const taxFee = r2(preTaxPrice * taxRate);
  const unitPrice = r3sig(preTaxPrice + taxFee);
  breakdown['tax'] = {
    formula: '总价 × 13%',
    detail: `${r2(preTaxPrice)} × ${(taxRate * 100).toFixed(0)}% = ${taxFee}元`,
  };

  return {
    costs: {
      material_cost: mat.cost,
      processing_cost: proc.cost,
      surface_treatment_cost: r2(surfaceCost),
      secondary_operations_cost: r2(secondaryCost),
      packaging_cost: packagingCost,
      transport_cost: transportCost,
      management_fee: managementFee,
      unit_price: unitPrice,
      unit_price_ex_tax: r2(preTaxPrice),
      unit_price_in_tax: unitPrice,
      total_ex_tax: r2(preTaxPrice),
      total_in_tax: unitPrice,
      weight_per_piece_kg: mat.weight,
      mold_cost: moldTotal,
    },
    breakdown,
    weight: mat.weight,
    notes,
    utilizationRate: mat.utilizationRate,
  };
}

// ============================================================
// 主计算引擎 — 注塑
// ============================================================

function calcInjection(
  req: QuoteRequest,
  _aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[]; utilizationRate?: number } {
  const volumeCm3 = req.volume_cm3 || 50;
  const wallThickness = req.dimensions?.wall_thickness_mm || 2;
  const notes: string[] = [];
  const breakdown: Record<string, { formula: string; detail: string }> = {};

  // 1. 材料费
  const mat = calcVolumetricMaterialCost(req.material.category, volumeCm3, _aluminumPrice, rules);
  breakdown['material'] = { formula: mat.formula, detail: mat.detail };

  // 2. 注塑加工费
  const proc = calcInjectionProcessingFee(mat.weight, wallThickness, rules);
  breakdown['processing'] = { formula: proc.formula, detail: proc.detail };

  // 累计（含损耗 2%~5%）
  const lossRate = rules.injection_molding_rates?.loss_rate?.['普通'] || 0.02;
  let accumulated = mat.cost + proc.cost;
  accumulated *= (1 + lossRate);

  // 3. 模具费（单独列出，不计入单价）
  let moldTotal = req.mold_cost && req.mold_cost > 0 ? req.mold_cost : 18000;
  notes.push(`注塑模具费: ${moldTotal}元（一次性，不计入单件价格）`);
  breakdown['mold'] = {
    formula: '模具费（一次性，不分摊）',
    detail: `模具费: ${moldTotal}元（单独列出）`,
  };

  // 4. 表面处理费（注塑件表面处理较少）
  let surfaceCost = 0;
  if (req.surface_treatment?.type) {
    const st = calcSurfaceTreatmentCost(req.surface_treatment.type, '塑胶', mat.weight, 0, rules);
    surfaceCost = st.cost;
    accumulated += surfaceCost;
    breakdown['surface'] = { formula: st.formula, detail: st.detail };
  }

  // 5. 二次加工费
  let secondaryCost = 0;
  if (req.process) {
    const sec = calcSecondaryOperationsCost(req.process, rules, mat.cost);
    secondaryCost = sec.cost;
    accumulated += secondaryCost;
    breakdown['secondary'] = { formula: sec.formula, detail: sec.detail };
  }

  // 6. × 1.05（最终损耗）
  accumulated *= 1.05;

  // 7. 包装 + 运输
  const packagingCost = r2(mat.weight * 0.5);
  const transportCost = r2(mat.weight * 0.5);
  accumulated += packagingCost + transportCost;
  breakdown['packaging'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${packagingCost}元` };
  breakdown['transport'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${transportCost}元` };

  const managementFee = r2((mat.cost + proc.cost) * 0.03);
  const preTaxPrice = accumulated;
  const taxRate = 0.13;
  const taxFee = r2(preTaxPrice * taxRate);
  const unitPrice = r3sig(preTaxPrice + taxFee);
  breakdown['tax'] = {
    formula: '总价 × 13%',
    detail: `${r2(preTaxPrice)} × ${(taxRate * 100).toFixed(0)}% = ${taxFee}元`,
  };

  return {
    costs: {
      material_cost: mat.cost,
      processing_cost: proc.cost,
      surface_treatment_cost: r2(surfaceCost),
      secondary_operations_cost: r2(secondaryCost),
      packaging_cost: packagingCost,
      transport_cost: transportCost,
      management_fee: managementFee,
      unit_price: unitPrice,
      unit_price_ex_tax: r2(preTaxPrice),
      unit_price_in_tax: unitPrice,
      total_ex_tax: r2(preTaxPrice),
      total_in_tax: unitPrice,
      weight_per_piece_kg: mat.weight,
      mold_cost: moldTotal,
    },
    breakdown,
    weight: mat.weight,
    notes,
    utilizationRate: mat.utilizationRate,
  };
}


// ============================================================
// 请求校验
// ============================================================

function validateRequest(body: any): string | null {
  if (!body.product_type) return '缺少 product_type 字段';
  if (!['sheet_metal', 'die_casting', 'zinc_alloy', 'injection', 'extrusion'].includes(body.product_type)) {
    return `不支持的 product_type: ${body.product_type}，可选值: sheet_metal, die_casting, zinc_alloy, injection, extrusion`;
  }
  if (!body.material || !body.material.category) return '缺少 material.category 字段';
  if (!body.quantity || body.quantity <= 0) return 'quantity 必须为正整数';
  if (body.product_type === 'sheet_metal' && !body.dimensions) return '板材加工需要提供 dimensions 字段';
  return null;
}

// ============================================================
// OPTIONS — CORS 预检
// ============================================================

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ============================================================
// POST — 报价计算主入口
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 兼容 Coze 插件传入方法为 Query 的情况：优先从 Query 取 RequestBody
    const queryBody = request.nextUrl.searchParams.get('RequestBody');
    let rawBody: Record<string, unknown> = {};

    if (queryBody) {
      try {
        rawBody = JSON.parse(queryBody) as Record<string, unknown>;
      } catch (_e) {
        rawBody = {};
      }
    } else {
      const parsed = await request.json() as Record<string, unknown>;
      rawBody = parsed;

      // 兼容 Coze 插件：如果 body 被包在 RequestBody 字符串里，先解包
      if (parsed && typeof parsed['RequestBody'] === 'string') {
        try {
          rawBody = JSON.parse(parsed['RequestBody'] as string) as Record<string, unknown>;
        } catch (_e) {}
      } else if (parsed && typeof parsed['RequestBody'] === 'object' && parsed['RequestBody'] !== null) {
        // Bot 直接发送 Object（Coze 插件参数类型为 Object 时）
        rawBody = parsed['RequestBody'] as Record<string, unknown>;
      } else {
        // 兼容其他参数名包装
        const candidates = ['data', 'body', 'params', 'json', 'request', 'input'];
        for (const key of candidates) {
          if (parsed[key] && typeof parsed[key] === 'string') {
            try { rawBody = JSON.parse(parsed[key] as string) as Record<string, unknown>; break; } catch (_e) {}
          }
        }
      }
    }
    const body = rawBody as unknown as QuoteRequest;

    // 1. 请求校验
    const validationError = validateRequest(body);
    if (validationError) {
      return Response.json(
        { success: false, error: validationError } as QuoteResponse,
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // 2. 并行加载：铝锭价 + 报价规则
    const [aluminumPrice, rules] = await Promise.all([
      body.aluminum_price_override ? Promise.resolve(body.aluminum_price_override) : getAluminumPrice(23530).then(r => r.price),
      loadPricingRules(),
    ]);

    // 3. 根据产品类型分发计算
    let result: { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[]; utilizationRate?: number };

    switch (body.product_type) {
      case 'sheet_metal':
        result = calcSheetMetal(body, aluminumPrice, rules);
        break;
      case 'die_casting':
        result = calcDieCasting(body, aluminumPrice, rules);
        break;
      case 'zinc_alloy':
        result = calcZincAlloy(body, aluminumPrice, rules);
        break;
      case 'injection':
        result = calcInjection(body, aluminumPrice, rules);
        break;
      case 'extrusion':
        result = calcExtrusion(body, aluminumPrice, rules);
        break;
      default:
        return Response.json(
          { success: false, error: `未知产品类型: ${body.product_type}` } as QuoteResponse,
          { status: 400, headers: CORS_HEADERS },
        );
    }

    // 4. 计算总价
    const unitPrice = result.costs.unit_price || 0;
    const totalPrice = r2(unitPrice * body.quantity);
    const exTaxUnit = result.costs.unit_price_ex_tax || unitPrice;
    const inTaxUnit = result.costs.unit_price_in_tax || unitPrice;
    result.costs.unit_price_ex_tax = exTaxUnit;
    result.costs.unit_price_in_tax = inTaxUnit;
    result.costs.total_ex_tax = r2(exTaxUnit * body.quantity);
    result.costs.total_in_tax = r2(inTaxUnit * body.quantity);

    // 5. 最低订单量检查（按模具规格分档：300/500/1000kg）
    const totalWeight = result.weight * body.quantity;
    const minOrderWeight = result.costs.min_order_weight_kg || 300;
    const minOrderMet = totalWeight >= minOrderWeight;
    if (!minOrderMet) {
      result.notes.push(`订单总重量 ${r2(totalWeight)}kg 未达到最低起订量 ${minOrderWeight}kg`);
    }

    // 6. 构造响应
    const response: QuoteResponse = {
      success: true,
      quotation_id: generateQuotationId(),
      ...result.costs,
      total_price: totalPrice,
      breakdown: result.breakdown,
      aluminum_index: aluminumPrice,
      min_order_met: minOrderMet,
      min_order_weight_kg: minOrderWeight,
      material_utilization_rate: result.utilizationRate,
      notes: result.notes,
      product_name: body.product_name,
      product_code: body.product_code,
    };

    // 返回 {"Response": data} 格式，与插件输出参数 "Response"(Object) 名称匹配
    return Response.json(response, { headers: CORS_HEADERS });

  } catch (error) {
    console.error('[quote/calculate] Error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '报价计算失败',
      } as QuoteResponse,
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// ============================================================
export async function GET(request: NextRequest) {
  // 支持 Coze 插件通过 GET + Query 参数调用
  // 参数格式: ?RequestBody={"product_type":"sheet_metal",...}
  try {
    const requestBodyStr = request.nextUrl.searchParams.get('RequestBody');
    
    if (!requestBodyStr) {
      // 没有 RequestBody 参数时返回 API 说明
      return Response.json({
        endpoint: '/api/v1/quote/calculate',
        method: 'GET/POST',
        description: '制造业零配件报价计算引擎 v1 — Coze Bot 专用',
        usage: 'GET /api/v1/quote/calculate?RequestBody={...}',
        supported_product_types: ['sheet_metal', 'die_casting', 'zinc_alloy', 'injection', 'extrusion'],
      }, { headers: CORS_HEADERS });
    }

    const body: QuoteRequest = JSON.parse(decodeURIComponent(requestBodyStr));

    // 1. 请求校验
    const validationError = validateRequest(body);
    if (validationError) {
      return Response.json(
        { success: false, error: validationError } as QuoteResponse,
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // 2. 并行加载：铝锭价 + 报价规则
    const [aluminumPrice, rules] = await Promise.all([
      body.aluminum_price_override ? Promise.resolve(body.aluminum_price_override) : getAluminumPrice(23530).then(r => r.price),
      loadPricingRules(),
    ]);

    // 3. 根据产品类型分发计算
    let result: { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[]; utilizationRate?: number };

    switch (body.product_type) {
      case 'sheet_metal':
        result = calcSheetMetal(body, aluminumPrice, rules);
        break;
      case 'die_casting':
        result = calcDieCasting(body, aluminumPrice, rules);
        break;
      case 'zinc_alloy':
        result = calcZincAlloy(body, aluminumPrice, rules);
        break;
      case 'injection':
        result = calcInjection(body, aluminumPrice, rules);
        break;
      case 'extrusion':
        result = calcExtrusion(body, aluminumPrice, rules);
        break;
      default:
        return Response.json(
          { success: false, error: `未知产品类型: ${body.product_type}` } as QuoteResponse,
          { status: 400, headers: CORS_HEADERS },
        );
    }

    // 4. 计算总价
    const unitPrice = result.costs.unit_price || 0;
    const totalPrice = r2(unitPrice * body.quantity);
    const exTaxUnit = result.costs.unit_price_ex_tax || unitPrice;
    const inTaxUnit = result.costs.unit_price_in_tax || unitPrice;
    result.costs.unit_price_ex_tax = exTaxUnit;
    result.costs.unit_price_in_tax = inTaxUnit;
    result.costs.total_ex_tax = r2(exTaxUnit * body.quantity);
    result.costs.total_in_tax = r2(inTaxUnit * body.quantity);

    // 5. 最低订单量检查（按模具规格分档：300/500/1000kg）
    const totalWeight = result.weight * body.quantity;
    const minOrderWeight = result.costs.min_order_weight_kg || 300;
    const minOrderMet = totalWeight >= minOrderWeight;
    if (!minOrderMet) {
      result.notes.push(`订单总重量 ${r2(totalWeight)}kg 未达到最低起订量 ${minOrderWeight}kg`);
    }

    // 6. 构造响应
    const response: QuoteResponse = {
      success: true,
      quotation_id: generateQuotationId(),
      ...result.costs,
      total_price: totalPrice,
      breakdown: result.breakdown,
      aluminum_index: aluminumPrice,
      min_order_met: minOrderMet,
      min_order_weight_kg: minOrderWeight,
      material_utilization_rate: result.utilizationRate,
      notes: result.notes,
      product_name: body.product_name,
      product_code: body.product_code,
    };

    // 返回 {"Response": data} 格式，与插件输出参数 "Response"(Object) 名称匹配
    return Response.json(response, { headers: CORS_HEADERS });

  } catch (error) {
    console.error('[quote/calculate GET] Error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '报价计算失败',
      } as QuoteResponse,
      { status: 500, headers: CORS_HEADERS },
    );
  }
}


