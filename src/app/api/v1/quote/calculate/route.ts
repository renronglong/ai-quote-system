import { NextRequest } from 'next/server';

// ============================================================
// 报价计算 API v1 — 供 Coze Bot 插件调用
// 端点: POST /api/v1/quote/calculate
// 支持四种产品类型: sheet_metal | die_casting | zinc_alloy | injection
// ============================================================

// ---- 默认铝锭价（元/吨），获取失败时降级使用 ----
const DEFAULT_ALUMINUM_PRICE = 23530;

// ---- 默认不锈钢基准价（元/吨），获取失败时降级 ----
const DEFAULT_STEEL_304_PRICE = 14500;

// ---- 默认热卷期货价（元/吨） ----
const DEFAULT_HOT_ROLL_PRICE = 3800;

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
    cross_section_area_mm2?: number; // 截面积 mm²（挤压铝型材）
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
  } | null;
  aluminum_price_override?: number; // 铝锭价覆盖值（元/吨）
  weight_per_piece_kg?: number;     // 单件重量，不填则根据体积×密度估算
  mold_cost?: number;               // 模具费（元），可选
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
  total_price?: number;
  weight_per_piece_kg?: number;
  breakdown?: Record<string, { formula: string; detail: string }>;
  aluminum_index?: number;
  min_order_met?: boolean;
  min_order_weight_kg?: number;
  notes?: string[];
  error?: string;
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
      density: 7.85,
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
        '<=35T': 0.10, '45T': 0.24, '60T': 0.30, '80T': 0.40,
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

async function fetchAluminumPrice(): Promise<number> {
  // 数据源1：大沥铝材网 dynamic 页面
  try {
    const res = await fetch('https://www.lvdingjia.com/dynamic', {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (res.ok) {
      const text = await res.text();
      // 匹配 "南海铝锭XXXXX" 格式
      const match = text.match(/南海铝锭[^\d]*(\d{5})/);
      if (match) {
        const price = parseInt(match[1]);
        if (price > 10000 && price < 50000) return price;
      }
      // 备用匹配
      const match2 = text.match(/\d{2}月\d{2}日南海铝锭(\d{5})/);
      if (match2) {
        const price = parseInt(match2[1]);
        if (price > 10000 && price < 50000) return price;
      }
    }
  } catch { /* 降级到下一数据源 */ }

  // 数据源2：主页面
  try {
    const res = await fetch('https://www.lvdingjia.com/price/nanhai/', {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/json,*/*',
      },
    });
    if (res.ok) {
      const text = await res.text();
      const avgMatch = text.match(/南海铝锭[\s\S]*?均价[▼\s]*(\d{4,6})/);
      if (avgMatch) {
        const price = parseInt(avgMatch[1]);
        if (price > 10000 && price < 50000) return price;
      }
    }
  } catch { /* 降级到默认值 */ }

  // 全部失败，返回默认值
  return DEFAULT_ALUMINUM_PRICE;
}

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
): { cost: number; weight: number; formula: string; detail: string } {
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
  } else if (category === '冷板SPCC' || category === '冷板' || category === '冷轧板') {
    density = matRule['冷板SPCC']?.density || 7.85;
    pricePerTon = DEFAULT_HOT_ROLL_PRICE * 1.05;
    formulaStr = '热卷期货价 × 1.05 × 密度 × 体积';
    detailStr = `${DEFAULT_HOT_ROLL_PRICE} × 1.05 = ${r2(pricePerTon)} 元/吨`;
  } else if (category === '不锈钢') {
    density = matRule['不锈钢']?.density || 7.85;
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

  detailStr += ` | 单件重量: ${r2(weightKg)}kg, 排版: ${nestingQty}件/张`;

  return {
    cost: r2(materialCost),
    weight: r2(weightKg),
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
): { cost: number; weight: number; formula: string; detail: string } {
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

  return { cost: r2(cost), weight: r2(weightKg), formula: formulaStr, detail: detailStr };
}

// ============================================================
// 铝型材材料费计算
// ============================================================

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
): { cost: number; weight: number; formula: string; detail: string } {
  const matRule = rules.material_prices['挤压铝型材'] || {};
  const density = matRule.density || 2.7;
  const extrusionFeePerTon = matRule.extrusion_fee_per_ton || 3000;
  const fillFactor = matRule.fill_factor || 0.35;
  
  // 材料单价 = 铝锭价 + 挤压加工费 (元/吨)
  const materialPricePerTon = aluminumPrice + extrusionFeePerTon;
  const materialPricePerKg = materialPricePerTon / 1000; // 元/kg
  
  let weightKg: number;
  let formulaStr: string;
  let detailStr: string;
  
  if (weightOverride && weightOverride > 0) {
    // 使用用户提供的重量
    weightKg = weightOverride;
    formulaStr = '用户提供重量';
    detailStr = `${weightKg}kg`;
  } else if (dimensions.cross_section_area_mm2 && dimensions.length_mm) {
    // 有截面面积和长度：重量 = 截面积 × 长度 × 密度 / 1000000
    weightKg = (dimensions.cross_section_area_mm2 * dimensions.length_mm * density) / 1000000;
    formulaStr = '截面积 × 长度 × 密度';
    detailStr = `${dimensions.cross_section_area_mm2}mm² × ${dimensions.length_mm}mm × ${density}g/cm³ ÷ 1000000 = ${r2(weightKg)}kg`;
  } else {
    // 简化计算：用外形尺寸 × 填充系数
    const length = dimensions.length_mm || 1000;
    const width = dimensions.width_mm || 50;
    const height = dimensions.height_mm || 25;
    
    weightKg = (length * width * height * fillFactor * density) / 1000000;
    formulaStr = '长 × 宽 × 高 × 填充系数 × 密度';
    detailStr = `${length} × ${width} × ${height} × ${fillFactor} × ${density} ÷ 1000000 = ${r2(weightKg)}kg`;
  }
  
  const cost = weightKg * materialPricePerKg;
  
  detailStr += ` | 材料单价: ${aluminumPrice} + ${extrusionFeePerTon} = ${materialPricePerTon}元/吨 = ${r2(materialPricePerKg)}元/kg`;
  detailStr += ` | 材料费: ${r2(weightKg)}kg × ${r2(materialPricePerKg)}元/kg = ${r2(cost)}元`;
  
  return {
    cost: r2(cost),
    weight: r2(weightKg),
    formula: formulaStr,
    detail: detailStr,
  };
}

// ============================================================
// 主计算引擎 — 铝型材挤压（完全复用板材的加工逻辑，仅材料费不同）
// ============================================================

function calcExtrusion(
  req: QuoteRequest,
  aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] } {
  const dims = req.dimensions || { length_mm: 1000, width_mm: 50, height_mm: 25 };
  const notes: string[] = [];
  const breakdown: Record<string, { formula: string; detail: string }> = {};
  
  // 1. 材料费（铝型材专用：铝锭价 + 挤压加工费）
  const mat = calcExtrusionMaterialCost(dims, aluminumPrice, rules, req.weight_per_piece_kg);
  breakdown['material'] = { formula: mat.formula, detail: mat.detail };
  
  let accumulated = mat.cost;
  
  // 2. 模具费（挤压模具，单独列出）
  let moldCost = 0;
  if (req.mold_cost && req.mold_cost > 0) {
    moldCost = req.mold_cost;
  } else {
    // 估算挤压模具费
    const maxDim = Math.max(dims.width_mm || 50, dims.height_mm || 25);
    const perimeter = 2 * ((dims.width_mm || 50) + (dims.height_mm || 25));
    moldCost = 600 + perimeter * 0.1 + maxDim * 0.05;
    moldCost = Math.round(moldCost);
  }
  notes.push(`挤压模具费: ${moldCost}元（一次性，不计入单件价格）`);
  breakdown['mold'] = {
    formula: '基础费600 + 截面周长×0.1 + 最大尺寸×0.05',
    detail: `模具费: ${moldCost}元（单独列出）`,
  };
  
  // 3. 以下全部复用板材的加工逻辑
  // 构造一个临时的板材请求，用铝型材的重量和尺寸
  const sheetReq: QuoteRequest = {
    ...req,
    product_type: 'sheet_metal',
    material: { category: '铝板', grade: req.material.grade || '6063-T5' },
    weight_per_piece_kg: mat.weight,
    volume_cm3: (mat.weight * 1000) / 2.7, // 反算体积 cm³
  };
  
  // 3.1 冲压加工费（复用板材逻辑）
  const volumeCm3 = sheetReq.volume_cm3 || (dims.length_mm * dims.width_mm * (dims.wall_thickness_mm || dims.height_mm || 2)) / 1000;
  const proc = calcSheetProcessingFee(dims, volumeCm3, '铝板', rules);
  accumulated += proc.cost;
  breakdown['processing'] = { formula: proc.formula, detail: proc.detail };
  
  const stampingSurcharge = proc.sizeSurcharge + proc.volumeSurcharge;
  
  // 3.2 表面处理费（复用板材逻辑）
  let surfaceCost = 0;
  if (req.surface_treatment?.type) {
    const st = calcSurfaceTreatmentCost(req.surface_treatment.type, '铝板', mat.weight, stampingSurcharge, rules);
    surfaceCost = st.cost;
    accumulated += surfaceCost;
    breakdown['surface'] = { formula: st.formula, detail: st.detail };
  }
  
  // 3.3 CNC二次加工费（复用板材逻辑）
  let secondaryCost = 0;
  if (req.process) {
    const sec = calcSecondaryOperationsCost(req.process, rules);
    secondaryCost = sec.cost;
    accumulated += secondaryCost;
    breakdown['secondary'] = { formula: sec.formula, detail: sec.detail };
  }
  
  // 3.4 锯切下料费（铝型材特有，每根2元）
  const cutCount = req.process?.cut_count || 1;
  const cutCost = cutCount * 2;
  accumulated += cutCost;
  breakdown['cutting'] = {
    formula: '锯切次数 × 2元',
    detail: `${cutCount}次 × 2元 = ${cutCost}元`,
  };
  
  // 3.5 包装 + 运输（复用板材逻辑）
  const packagingCost = r2(mat.weight * 0.5);
  const transportCost = r2(mat.weight * 0.5);
  accumulated += packagingCost + transportCost;
  breakdown['packaging'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${packagingCost}元` };
  breakdown['transport'] = { formula: '重量 × 0.5', detail: `${mat.weight}kg × 0.5 = ${transportCost}元` };
  
  // 4. 管销费 + 利润
  const managementFee = r2(accumulated * 0.03);
  const profitFee = r2(accumulated * 0.05);
  accumulated += managementFee + profitFee;
  breakdown['management_profit'] = {
    formula: '合计 × 3%(管销) + 合计 × 5%(利润)',
    detail: `管销费: ${managementFee}元, 利润: ${profitFee}元`,
  };
  
  const unitPrice = r2(accumulated);
  
  return {
    costs: {
      material_cost: mat.cost,
      processing_cost: r2(proc.cost + cutCost),
      surface_treatment_cost: r2(surfaceCost),
      secondary_operations_cost: r2(secondaryCost),
      packaging_cost: packagingCost,
      transport_cost: transportCost,
      management_fee: r2(managementFee + profitFee),
      unit_price: unitPrice,
      weight_per_piece_kg: mat.weight,
    },
    breakdown,
    weight: mat.weight,
    notes,
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
 * 计算二次加工费（钻孔、攻丝、铣槽、去毛刺等）
 */
function calcSecondaryOperationsCost(
  process: NonNullable<QuoteRequest['process']>,
  rules: PricingRules,
): { cost: number; formula: string; detail: string } {
  let totalCost = 0;
  const details: string[] = [];
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

  if (details.length === 0) {
    details.push('无二次加工');
  }

  return {
    cost: r2(totalCost),
    formula: '各项二次加工费之和',
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
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] } {
  const dims = req.dimensions!;
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
    const sec = calcSecondaryOperationsCost(req.process, rules);
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

  const unitPrice = r2(accumulated);

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
      weight_per_piece_kg: mat.weight,
    },
    breakdown,
    weight: mat.weight,
    notes,
  };
}

// ============================================================
// 主计算引擎 — 压铸铝
// ============================================================

function calcDieCasting(
  req: QuoteRequest,
  aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] } {
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

  // 3. 模具摊销
  let moldAmortize = 0;
  if (req.mold_cost && req.mold_cost > 0) {
    moldAmortize = req.mold_cost / req.quantity;
  } else {
    // 估算模具费: 简单件 15000~30000
    const estimatedMold = 20000;
    moldAmortize = estimatedMold / req.quantity;
    notes.push(`模具费估算: ${estimatedMold}元 / ${req.quantity}件 = ${r2(moldAmortize)}元/件`);
  }
  accumulated += moldAmortize;
  breakdown['mold'] = {
    formula: '模具费 ÷ 数量',
    detail: `${r2(moldAmortize * req.quantity)}元 ÷ ${req.quantity}件 = ${r2(moldAmortize)}元/件`,
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
    const sec = calcSecondaryOperationsCost(req.process, rules);
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
  const unitPrice = r2(accumulated);

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
      weight_per_piece_kg: mat.weight,
    },
    breakdown,
    weight: mat.weight,
    notes,
  };
}

// ============================================================
// 主计算引擎 — 锌合金压铸
// ============================================================

function calcZincAlloy(
  req: QuoteRequest,
  _aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] } {
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

  // 3. 模具摊销
  let moldAmortize = 0;
  if (req.mold_cost && req.mold_cost > 0) {
    moldAmortize = req.mold_cost / req.quantity;
  } else {
    const estimatedMold = 25000; // 锌合金模具费估算
    moldAmortize = estimatedMold / req.quantity;
    notes.push(`模具费估算: ${estimatedMold}元 / ${req.quantity}件 = ${r2(moldAmortize)}元/件`);
  }
  accumulated += moldAmortize;
  breakdown['mold'] = {
    formula: '模具费 ÷ 数量',
    detail: `${r2(moldAmortize * req.quantity)}元 ÷ ${req.quantity}件 = ${r2(moldAmortize)}元/件`,
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
    const sec = calcSecondaryOperationsCost(req.process, rules);
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
  const unitPrice = r2(accumulated);

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
      weight_per_piece_kg: mat.weight,
    },
    breakdown,
    weight: mat.weight,
    notes,
  };
}

// ============================================================
// 主计算引擎 — 注塑
// ============================================================

function calcInjection(
  req: QuoteRequest,
  _aluminumPrice: number,
  rules: PricingRules,
): { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] } {
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

  // 3. 模具摊销
  let moldAmortize = 0;
  if (req.mold_cost && req.mold_cost > 0) {
    moldAmortize = req.mold_cost / req.quantity;
  } else {
    const estimatedMold = 18000; // 注塑模具费估算
    moldAmortize = estimatedMold / req.quantity;
    notes.push(`模具费估算: ${estimatedMold}元 / ${req.quantity}件 = ${r2(moldAmortize)}元/件`);
  }
  accumulated += moldAmortize;
  breakdown['mold'] = {
    formula: '模具费 ÷ 数量',
    detail: `${r2(moldAmortize * req.quantity)}元 ÷ ${req.quantity}件 = ${r2(moldAmortize)}元/件`,
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
    const sec = calcSecondaryOperationsCost(req.process, rules);
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
  const unitPrice = r2(accumulated);

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
      weight_per_piece_kg: mat.weight,
    },
    breakdown,
    weight: mat.weight,
    notes,
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
      body.aluminum_price_override ? Promise.resolve(body.aluminum_price_override) : fetchAluminumPrice(),
      loadPricingRules(),
    ]);

    // 3. 根据产品类型分发计算
    let result: { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] };

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

    // 5. 最低订单量检查（最低 300kg）
    const totalWeight = result.weight * body.quantity;
    const minOrderWeight = 300;
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
      notes: result.notes,
    };

    // 返回 {"Response": data} 格式，与插件输出参数 "Response"(Object) 名称匹配
    return Response.json({ Response: response }, { headers: CORS_HEADERS });

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
      body.aluminum_price_override ? Promise.resolve(body.aluminum_price_override) : fetchAluminumPrice(),
      loadPricingRules(),
    ]);

    // 3. 根据产品类型分发计算
    let result: { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] };

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

    // 5. 最低订单量检查（最低 300kg）
    const totalWeight = result.weight * body.quantity;
    const minOrderWeight = 300;
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
      notes: result.notes,
    };

    // 返回 {"Response": data} 格式，与插件输出参数 "Response"(Object) 名称匹配
    return Response.json({ Response: response }, { headers: CORS_HEADERS });

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
