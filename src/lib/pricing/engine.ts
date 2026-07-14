// ============================================================
// 报价计算引擎 - 核心纯函数
// ============================================================

import type {
  PricingInput,
  PricingResult,
  CostBreakdown,
  SectionCalculation,
  ExtrusionInput,
  PlateInput,
  DieCastingInput,
  SurfaceTreatment,
} from './types';

// ------------------------------------------------------------
// 常量
// ------------------------------------------------------------

const ALUMINUM_DENSITY = 2.7; // g/cm³

const EXTRUSION_RATE: Record<string, number> = {
  'solid-simple': 3.0,    // 实心简单截面 (元/kg)
  'hollow-simple': 2.5,   // 空心简单截面 (元/kg)
  'solid-complex': 4.0,   // 实心复杂截面 (元/kg)
  'hollow-complex': 4.0,  // 空心复杂截面 (元/kg)
};

const SURFACE_TREATMENT_RATE: Record<string, number> = {
  '氧化本色': 8,   // 元/m²
  '氧化黑色': 10,
  '喷涂': 20,
  '电泳': 15,
};

const CUTTING_COST_SOLID = 1.5;   // 元/件
const CUTTING_COST_HOLLOW = 0.8;  // 元/件
const DRILLING_COST_PER_HOLE = 0.3;  // 元/孔
const TAPPING_COST_PER_HOLE = 0.5;   // 元/孔

const PACKAGING_RATE = 0.5;   // 元/kg
const TRANSPORTATION_RATE = 0.5; // 元/kg

const DEFAULT_ALUMINUM_PRICE_PER_TON = 23530; // 元/吨

// ============================================================
// 截面面积计算
// ============================================================

/**
 * 计算截面几何参数
 * 截面面积 = 外轮廓面积 - 内腔面积 - 倒角面积
 * 倒角面积 = 倒角数 × (倒角尺寸² / 2)
 */
export function calculateSection(
  outerWidth: number,
  outerHeight: number,
  chamfer?: { count: number; size: number },
  isHollow?: boolean,
  cavity?: { width: number; height: number },
): SectionCalculation {
  // 外轮廓面积
  const outerArea = outerWidth * outerHeight;

  // 倒角面积（直角三角形）
  const chamferArea = chamfer
    ? chamfer.count * ((chamfer.size * chamfer.size) / 2)
    : 0;

  // 内腔面积
  const cavityArea = isHollow && cavity
    ? cavity.width * cavity.height
    : 0;

  // 净截面面积
  const crossSectionArea = outerArea - cavityArea - chamferArea;

  // 外周长（矩形截面）
  const perimeter = 2 * (outerWidth + outerHeight);

  // 米重 = 截面面积(mm²) × 2.7(g/cm³) / 1000 = kg/m
  // 推导: mm² × (1cm/10mm)² × 2.7g/cm³ × (1kg/1000g) × (1000mm/1m)
  //      = mm² × 0.01cm² × 2.7g/cm³ × 0.001kg/g × 1000/mm
  // 简化: 截面面积 × 2.7 / 1000
  const weightPerMeter = (crossSectionArea * ALUMINUM_DENSITY) / 1000;

  return {
    outerArea,
    chamferArea,
    cavityArea,
    crossSectionArea,
    perimeter,
    weightPerMeter,
    unitWeight: 0, // 后续由调用方设置
  };
}

// ============================================================
// 挤压铝型材报价
// ============================================================

export function calculateExtrusion(input: ExtrusionInput): PricingResult {
  const breakdown: CostBreakdown[] = [];

  const aluminumPricePerTon = input.aluminumPricePerTon ?? DEFAULT_ALUMINUM_PRICE_PER_TON;
  const aluminumPricePerKg = aluminumPricePerTon / 1000;

  // ---- 1. 截面计算 ----
  const section = calculateSection(
    input.outerWidth,
    input.outerHeight,
    input.chamfer,
    input.isHollow,
    input.cavity,
  );

  // 单件重量 = 米重 × 长度(m)
  const lengthM = input.length / 1000;
  const unitWeight = section.weightPerMeter * lengthM;
  section.unitWeight = unitWeight;

  // ---- 2. 铝材费 = 单件重量 × 铝锭价(元/kg) ----
  const materialCost = unitWeight * aluminumPricePerKg;
  breakdown.push({
    item: '铝材费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${aluminumPricePerKg.toFixed(4)}/kg`,
    cost: materialCost,
  });

  // ---- 3. 挤压费 = 单件重量 × 挤压单价 ----
  const complexity = input.sectionComplexity ?? 'simple';
  const hollowKey = input.isHollow ? 'hollow' : 'solid';
  const extrusionRate = EXTRUSION_RATE[`${hollowKey}-${complexity}`] ?? 3.0;
  const extrusionCost = unitWeight * extrusionRate;
  breakdown.push({
    item: '挤压加工费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${extrusionRate}/kg (${input.isHollow ? '空心' : '实心'}${complexity === 'complex' ? '复杂' : '简单'}截面)`,
    cost: extrusionCost,
  });

  // ---- 4. CNC 费 ----
  // 切割+去毛刺
  const cuttingCost = input.isHollow ? CUTTING_COST_HOLLOW : CUTTING_COST_SOLID;
  // 钻孔费
  const drillingCost = (input.drillingHoles ?? 0) * DRILLING_COST_PER_HOLE;
  // 攻丝费
  const tappingCost = (input.tappingHoles ?? 0) * TAPPING_COST_PER_HOLE;

  const cncCost = cuttingCost + drillingCost + tappingCost;

  const cncParts: string[] = [
    `切割+去毛刺: ¥${cuttingCost}(${input.isHollow ? '空心' : '实心'})`,
  ];
  if (drillingCost > 0) {
    cncParts.push(`钻孔: ${input.drillingHoles}孔 × ¥${DRILLING_COST_PER_HOLE} = ¥${drillingCost.toFixed(2)}`);
  }
  if (tappingCost > 0) {
    cncParts.push(`攻丝: ${input.tappingHoles}孔 × ¥${TAPPING_COST_PER_HOLE} = ¥${tappingCost.toFixed(2)}`);
  }

  breakdown.push({
    item: 'CNC加工费',
    calculation: cncParts.join('; '),
    cost: cncCost,
  });

  // ---- 5. 表面处理费 ----
  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceRate = SURFACE_TREATMENT_RATE[input.surfaceTreatment] ?? 0;

    // 表面积 = 周长(m) × 长度(m) + 2 × 截面积(m²)
    const perimeterM = section.perimeter / 1000; // mm → m
    const sectionAreaM2 = section.crossSectionArea / 1_000_000; // mm² → m²
    const surfaceArea = perimeterM * lengthM + 2 * sectionAreaM2;

    surfaceTreatmentCost = surfaceArea * surfaceRate;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: `${surfaceArea.toFixed(6)}m² × ¥${surfaceRate}/m²`,
      cost: surfaceTreatmentCost,
    });
  }

  // ---- 6. 包装费 ----
  const packagingCost = unitWeight * PACKAGING_RATE;
  breakdown.push({
    item: '包装费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${PACKAGING_RATE}/kg`,
    cost: packagingCost,
  });

  // ---- 7. 运输费 ----
  const transportationCost = unitWeight * TRANSPORTATION_RATE;
  breakdown.push({
    item: '运输费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${TRANSPORTATION_RATE}/kg`,
    cost: transportationCost,
  });

  // ---- 汇总 ----
  const unitCost = materialCost + extrusionCost + cncCost + surfaceTreatmentCost + packagingCost + transportationCost;
  const totalCost = unitCost * input.quantity;

  return {
    productType: 'extrusion',
    quantity: input.quantity,
    section,
    materialCost: round6(materialCost),
    extrusionCost: round6(extrusionCost),
    cncCost: round6(cncCost),
    surfaceTreatmentCost: round6(surfaceTreatmentCost),
    packagingCost: round6(packagingCost),
    transportationCost: round6(transportationCost),
    unitCost: round6(unitCost),
    totalCost: round2(totalCost),
    breakdown,
    aluminumPrice: {
      pricePerTon: aluminumPricePerTon,
      pricePerKg: aluminumPricePerKg,
      source: '南海铝锭价',
    },
  };
}

// ============================================================
// 板材报价
// ============================================================

export function calculatePlate(input: PlateInput): PricingResult {
  const breakdown: CostBreakdown[] = [];

  const aluminumPricePerTon = input.aluminumPricePerTon ?? DEFAULT_ALUMINUM_PRICE_PER_TON;
  const aluminumPricePerKg = aluminumPricePerTon / 1000;

  // 重量 = 宽(mm) × 厚(mm) × 长(mm) × 密度 / 1e6 (kg)
  const unitWeight = (input.width * input.thickness * input.height * ALUMINUM_DENSITY) / 1_000_000;

  // 铝材费
  const materialCost = unitWeight * aluminumPricePerKg;
  breakdown.push({
    item: '铝材费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${aluminumPricePerKg.toFixed(4)}/kg`,
    cost: materialCost,
  });

  // 挤压费（板材按 3元/kg）
  const extrusionCost = unitWeight * 3.0;
  breakdown.push({
    item: '板材加工费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥3/kg`,
    cost: extrusionCost,
  });

  // CNC 费
  const cncCost = CUTTING_COST_SOLID;
  breakdown.push({
    item: '切割费',
    calculation: `标准切割 ¥${CUTTING_COST_SOLID}/件`,
    cost: cncCost,
  });

  // 表面处理费
  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceRate = SURFACE_TREATMENT_RATE[input.surfaceTreatment] ?? 0;
    // 表面积 = 2 × (宽×厚 + 宽×长 + 厚×长) mm² → m²
    const w = input.width / 1000;
    const h = input.height / 1000;
    const t = input.thickness / 1000;
    const surfaceArea = 2 * (w * t + w * h + t * h);
    surfaceTreatmentCost = surfaceArea * surfaceRate;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: `${surfaceArea.toFixed(6)}m² × ¥${surfaceRate}/m²`,
      cost: surfaceTreatmentCost,
    });
  }

  // 包装费 + 运输费
  const packagingCost = unitWeight * PACKAGING_RATE;
  breakdown.push({
    item: '包装费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${PACKAGING_RATE}/kg`,
    cost: packagingCost,
  });

  const transportationCost = unitWeight * TRANSPORTATION_RATE;
  breakdown.push({
    item: '运输费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${TRANSPORTATION_RATE}/kg`,
    cost: transportationCost,
  });

  const unitCost = materialCost + extrusionCost + cncCost + surfaceTreatmentCost + packagingCost + transportationCost;

  return {
    productType: 'plate',
    quantity: input.quantity,
    materialCost: round6(materialCost),
    extrusionCost: round6(extrusionCost),
    cncCost: round6(cncCost),
    surfaceTreatmentCost: round6(surfaceTreatmentCost),
    packagingCost: round6(packagingCost),
    transportationCost: round6(transportationCost),
    unitCost: round6(unitCost),
    totalCost: round2(unitCost * input.quantity),
    breakdown,
    aluminumPrice: {
      pricePerTon: aluminumPricePerTon,
      pricePerKg: aluminumPricePerKg,
      source: '南海铝锭价',
    },
  };
}

// ============================================================
// 压铸报价
// ============================================================

export function calculateDieCasting(input: DieCastingInput): PricingResult {
  const breakdown: CostBreakdown[] = [];

  const unitWeight = input.weight;

  // 铝材费
  const aluminumPricePerTon = DEFAULT_ALUMINUM_PRICE_PER_TON;
  const aluminumPricePerKg = aluminumPricePerTon / 1000;
  const materialCost = unitWeight * aluminumPricePerKg;
  breakdown.push({
    item: '铝材费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${aluminumPricePerKg.toFixed(4)}/kg`,
    cost: materialCost,
  });

  // 压铸加工费（按件估算）
  const castingCost = unitWeight * 5.0;
  breakdown.push({
    item: '压铸加工费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥5/kg`,
    cost: castingCost,
  });

  // CNC 费
  const cncCost = CUTTING_COST_SOLID;
  breakdown.push({
    item: '后处理费',
    calculation: `标准后处理 ¥${CUTTING_COST_SOLID}/件`,
    cost: cncCost,
  });

  // 表面处理
  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceRate = SURFACE_TREATMENT_RATE[input.surfaceTreatment] ?? 0;
    // 估算表面积
    const surfaceArea = 0.01 * unitWeight; // 粗略估算
    surfaceTreatmentCost = surfaceArea * surfaceRate;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: `${surfaceArea.toFixed(6)}m² × ¥${surfaceRate}/m²`,
      cost: surfaceTreatmentCost,
    });
  }

  // 包装费 + 运输费
  const packagingCost = unitWeight * PACKAGING_RATE;
  breakdown.push({
    item: '包装费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${PACKAGING_RATE}/kg`,
    cost: packagingCost,
  });

  const transportationCost = unitWeight * TRANSPORTATION_RATE;
  breakdown.push({
    item: '运输费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${TRANSPORTATION_RATE}/kg`,
    cost: transportationCost,
  });

  const unitCost = materialCost + castingCost + cncCost + surfaceTreatmentCost + packagingCost + transportationCost;

  return {
    productType: 'die_casting',
    quantity: input.quantity,
    materialCost: round6(materialCost),
    extrusionCost: round6(castingCost),
    cncCost: round6(cncCost),
    surfaceTreatmentCost: round6(surfaceTreatmentCost),
    packagingCost: round6(packagingCost),
    transportationCost: round6(transportationCost),
    unitCost: round6(unitCost),
    totalCost: round2(unitCost * input.quantity),
    breakdown,
    aluminumPrice: {
      pricePerTon: aluminumPricePerTon,
      pricePerKg: aluminumPricePerKg,
      source: '南海铝锭价',
    },
  };
}

// ============================================================
// 统一入口
// ============================================================

export function calculatePrice(input: PricingInput): PricingResult {
  switch (input.productType) {
    case 'extrusion':
      return calculateExtrusion(input);
    case 'plate':
      return calculatePlate(input);
    case 'die_casting':
      return calculateDieCasting(input);
    default:
      throw new Error(`不支持的产品类型: ${(input as PricingInput).productType}`);
  }
}

// ============================================================
// 工具函数
// ============================================================

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
