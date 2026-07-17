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
  AssemblyInput,
  AssemblyPricingResult,
  AssemblyPartResult,
  FullPricingInput,
  FullPricingResult,
} from './types';

// ------------------------------------------------------------
// 常量
// ------------------------------------------------------------

const ALUMINUM_DENSITY = 2.7; // g/cm³

/** 默认铝锭价 元/kg（质稳公式） */
const DEFAULT_ALUMINUM_PRICE_PER_KG = 23.53;

/** 默认加工费 元（质稳公式） */
const DEFAULT_PROCESSING_FEE = 8;

// ---- 板材/压铸 专用常量（保持原有逻辑） ----

const EXTRUSION_RATE: Record<string, number> = {
  'solid-simple': 3.0,    // 实心简单截面 (元/kg)
  'hollow-simple': 2.5,   // 空心简单截面 (元/kg)
  'solid-complex': 4.0,   // 实心复杂截面 (元/kg)
  'hollow-complex': 4.0,  // 空心复杂截面 (元/kg)
};

// 表面处理费 - 按板材公式统一计算（板材/压铸专用）
interface SurfaceTreatmentResult {
  cost: number;
  formula: string;
}

function calculateSurfaceTreatmentLegacy(
  treatment: string,
  processingSurcharge: number,
  weight: number,
): SurfaceTreatmentResult {
  switch (treatment) {
    case '氧化本色':
    case '阳极氧化':
    case '阳极氧化原色':
      return {
        cost: 0.2 + processingSurcharge * 2 + weight * 2,
        formula: `0.2 + ${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×2`,
      };
    case '氧化黑色':
    case '氧化银白':
      return {
        cost: 0.3 + processingSurcharge * 3 + weight * 3,
        formula: `0.3 + ${processingSurcharge.toFixed(2)}×3 + ${weight.toFixed(4)}×3`,
      };
    case '白色哑光':
      return {
        cost: 0.2 + processingSurcharge * 2 + weight * 2,
        formula: `0.2 + ${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×2`,
      };
    case '喷涂':
      return {
        cost: 0.2 + processingSurcharge * 2 + weight * 2,
        formula: `0.2 + ${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×2`,
      };
    case '电泳':
      return {
        cost: 0.2 + processingSurcharge * 2 + weight * 2,
        formula: `0.2 + ${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×2`,
      };
    default:
      return { cost: 0, formula: '无处理' };
  }
}

const STAMPING_COST_SOLID = 1.5;   // 冲压费-实心 (元/件)
const STAMPING_COST_HOLLOW = 0.8;  // 冲压费-空心 (元/件)
const DRILLING_COST_PER_HOLE = 0.3;  // 元/孔
const TAPPING_COST_PER_HOLE = 0.5;   // 元/孔

const PACKAGING_RATE = 0.5;   // 元/kg
const TRANSPORTATION_RATE = 0.5; // 元/kg

const DEFAULT_ALUMINUM_PRICE_PER_TON = 23530; // 元/吨

// ============================================================
// 挤压铝型材报价（质稳 v4 公式）
// ============================================================

/**
 * 质稳 v4 公式 — 13步计算
 *
 * 1.  米重 F(kg/m)     = crossSectionArea × 0.0027
 * 2.  净重量(kg)       = F × length / 1000
 * 3.  切割余量系数 E    = length + 5 + (100 / floor(3100 / length))
 * 4.  有效重量(kg)     = crossSectionArea × E × 0.0000027
 * 5.  材料费 K         = 有效重量 × aluminumPricePerKg
 * 6.  挤压费 P         = 有效重量 × 2（仅展示不计入成本）
 * 7.  表面处理费 J     = 净重量 × 系数（6.5 / 2.5 / 0）
 * 8.  加工费 G         = processingFee（默认 8）
 * 9.  包装运输费 I     = 净重量 × 0.5
 * 10. 成本合计 L       = K + J + I + G（不含 P）
 * 11. 损耗(5%)         = L × 0.05
 * 12. 利润(10%)        = L × 0.10
 * 13. 税金(13%)        = L × 0.13
 * 14. 含税单价         = L × 1.28
 */
export function calculateExtrusion(input: ExtrusionInput): PricingResult {
  const breakdown: CostBreakdown[] = [];

  const aluminumPricePerKg = input.aluminumPricePerKg ?? DEFAULT_ALUMINUM_PRICE_PER_KG;
  const processingFee = input.processingFee ?? DEFAULT_PROCESSING_FEE;
  const { crossSectionArea, length, surfaceTreatment, quantity } = input;

  // Step 1: 米重 F(kg/m) = crossSectionArea × 0.0027
  const weightPerMeter = crossSectionArea * 0.0027;
  breakdown.push({
    item: '米重 F',
    calculation: `${crossSectionArea} × 0.0027 = ${weightPerMeter.toFixed(6)} kg/m`,
    cost: 0,
  });

  // Step 2: 净重量(kg) = F × length / 1000
  const netWeight = weightPerMeter * length / 1000;
  breakdown.push({
    item: '净重量',
    calculation: `${weightPerMeter.toFixed(6)} × ${length} / 1000 = ${netWeight.toFixed(6)} kg`,
    cost: netWeight,
  });

  // Step 3: 切割余量系数 E_coef = length + 5 + (100 / Math.floor(3100 / length))
  const cutAllowanceCoef = length + 5 + (100 / Math.floor(3100 / length));
  const piecesPerBar = Math.floor(3100 / length);
  breakdown.push({
    item: '切割余量系数 E',
    calculation: `${length} + 5 + (100 / ${piecesPerBar}) = ${cutAllowanceCoef.toFixed(4)}`,
    cost: 0,
  });

  // Step 4: 有效重量(kg) = crossSectionArea × E_coef × 0.0000027
  const effectiveWeight = crossSectionArea * cutAllowanceCoef * 0.0000027;
  breakdown.push({
    item: '有效重量',
    calculation: `${crossSectionArea} × ${cutAllowanceCoef.toFixed(4)} × 0.0000027 = ${effectiveWeight.toFixed(6)} kg`,
    cost: effectiveWeight,
  });

  // Step 5: 材料费 K = 有效重量 × aluminumPricePerKg
  const materialCost = effectiveWeight * aluminumPricePerKg;
  breakdown.push({
    item: '材料费 K',
    calculation: `${effectiveWeight.toFixed(6)} × ¥${aluminumPricePerKg} = ¥${materialCost.toFixed(2)}`,
    cost: materialCost,
  });

  // Step 6: 挤压费 P = 有效重量 × 2（仅展示不计入成本）
  const extrusionCost = effectiveWeight * 2;
  breakdown.push({
    item: '挤压费 P（仅展示，不计入成本）',
    calculation: `${effectiveWeight.toFixed(6)} × ¥2/kg = ¥${extrusionCost.toFixed(2)}`,
    cost: extrusionCost,
  });

  // Step 7: 表面处理费 J
  let surfaceTreatmentCost = 0;
  let stFormula = '';
  if (['白色哑光', '阳极氧化', '阳极氧化原色', '氧化银白', '氧化黑色'].includes(surfaceTreatment)) {
    surfaceTreatmentCost = netWeight * 6.5;
    stFormula = `${netWeight.toFixed(6)} × 6.5 = ¥${surfaceTreatmentCost.toFixed(2)}`;
  } else if (['喷涂', '电泳'].includes(surfaceTreatment)) {
    surfaceTreatmentCost = netWeight * 2.5;
    stFormula = `${netWeight.toFixed(6)} × 2.5 = ¥${surfaceTreatmentCost.toFixed(2)}`;
  } else {
    stFormula = '无处理';
  }
  breakdown.push({
    item: `表面处理费 J（${surfaceTreatment}）`,
    calculation: stFormula,
    cost: surfaceTreatmentCost,
  });

  // Step 8: 加工费 G = processingFee（默认 8 元）
  const processingFeeCost = processingFee;
  breakdown.push({
    item: '加工费 G',
    calculation: `¥${processingFeeCost}`,
    cost: processingFeeCost,
  });

  // Step 9: 包装运输费 I = 净重量 × 0.5
  const packagingTransportCost = netWeight * 0.5;
  breakdown.push({
    item: '包装运输费 I',
    calculation: `${netWeight.toFixed(6)} × 0.5 = ¥${packagingTransportCost.toFixed(2)}`,
    cost: packagingTransportCost,
  });

  // Step 10: 成本合计 L = K + J + I + G（注意：不含挤压费 P）
  const costTotal = materialCost + surfaceTreatmentCost + packagingTransportCost + processingFeeCost;
  breakdown.push({
    item: '成本合计 L',
    calculation: `K(${materialCost.toFixed(2)}) + J(${surfaceTreatmentCost.toFixed(2)}) + I(${packagingTransportCost.toFixed(2)}) + G(${processingFeeCost.toFixed(2)}) = ¥${costTotal.toFixed(2)}`,
    cost: costTotal,
  });

  // Step 11: 损耗(5%) = L × 0.05
  const wasteCost = costTotal * 0.05;
  breakdown.push({
    item: '损耗 5%',
    calculation: `${costTotal.toFixed(2)} × 0.05 = ¥${wasteCost.toFixed(2)}`,
    cost: wasteCost,
  });

  // Step 12: 利润(10%) = L × 0.10
  const profitCost = costTotal * 0.10;
  breakdown.push({
    item: '利润 10%',
    calculation: `${costTotal.toFixed(2)} × 0.10 = ¥${profitCost.toFixed(2)}`,
    cost: profitCost,
  });

  // Step 13: 税金(13%) = L × 0.13
  const taxCost = costTotal * 0.13;
  breakdown.push({
    item: '税金 13%',
    calculation: `${costTotal.toFixed(2)} × 0.13 = ¥${taxCost.toFixed(2)}`,
    cost: taxCost,
  });

  // Step 14: 含税单价 = L × 1.28
  const unitPriceWithTax = costTotal * 1.28;
  breakdown.push({
    item: '含税单价',
    calculation: `${costTotal.toFixed(2)} × 1.28 = ¥${unitPriceWithTax.toFixed(2)}`,
    cost: unitPriceWithTax,
  });

  return {
    productType: 'extrusion',
    quantity,

    section: {
      outerArea: 0,
      chamferArea: 0,
      cavityArea: 0,
      crossSectionArea,
      perimeter: 0,
      weightPerMeter,
      unitWeight: netWeight,
    },

    // 映射到现有字段（保持接口兼容）
    materialCost: round6(materialCost),
    extrusionCost: round6(extrusionCost),
    cncCost: round6(processingFeeCost),
    surfaceTreatmentCost: round6(surfaceTreatmentCost),
    packagingCost: round6(packagingTransportCost),
    transportationCost: 0,  // 已合并至 packagingCost

    unitCost: round2(unitPriceWithTax),
    totalCost: round2(unitPriceWithTax * quantity),

    breakdown,

    aluminumPrice: {
      pricePerTon: aluminumPricePerKg * 1000,
      pricePerKg: aluminumPricePerKg,
      source: '南海铝锭价',
    },

    // 质稳 v4 公式专属字段
    netWeight: round6(netWeight),
    effectiveWeight: round6(effectiveWeight),
    cutAllowanceCoef: round6(cutAllowanceCoef),
    costTotal: round6(costTotal),
    wasteCost: round6(wasteCost),
    profitCost: round6(profitCost),
    taxCost: round6(taxCost),
    unitPriceWithTax: round2(unitPriceWithTax),
    processingFeeCost: round6(processingFeeCost),
  };
}

// ============================================================
// 截面面积计算（保留供旧版兼容和板材使用）
// ============================================================

export function calculateSection(
  outerWidth: number,
  outerHeight: number,
  chamfer?: { count: number; size: number },
  isHollow?: boolean,
  cavity?: { width: number; height: number },
): SectionCalculation {
  const outerArea = outerWidth * outerHeight;
  const chamferArea = chamfer ? chamfer.count * ((chamfer.size * chamfer.size) / 2) : 0;
  const cavityArea = isHollow && cavity ? cavity.width * cavity.height : 0;
  const crossSectionArea = outerArea - cavityArea - chamferArea;
  const perimeter = 2 * (outerWidth + outerHeight);
  const weightPerMeter = (crossSectionArea * ALUMINUM_DENSITY) / 1000;

  return {
    outerArea,
    chamferArea,
    cavityArea,
    crossSectionArea,
    perimeter,
    weightPerMeter,
    unitWeight: 0,
  };
}

// ============================================================
// 板材报价（保持原有逻辑）
// ============================================================

export function calculatePlate(input: PlateInput): PricingResult {
  const breakdown: CostBreakdown[] = [];

  const aluminumPricePerTon = input.aluminumPricePerTon ?? DEFAULT_ALUMINUM_PRICE_PER_TON;
  const aluminumPricePerKg = aluminumPricePerTon / 1000;

  const unitWeight = (input.width * input.thickness * input.height * ALUMINUM_DENSITY) / 1_000_000;

  const materialCost = unitWeight * aluminumPricePerKg;
  breakdown.push({
    item: '铝材费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${aluminumPricePerKg.toFixed(4)}/kg`,
    cost: materialCost,
  });

  const extrusionCost = unitWeight * 3.0;
  breakdown.push({
    item: '板材加工费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥3/kg`,
    cost: extrusionCost,
  });

  const cncCost = STAMPING_COST_SOLID;
  breakdown.push({
    item: '切割费',
    calculation: `标准冲压 ¥${STAMPING_COST_SOLID}/件`,
    cost: cncCost,
  });

  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceResult = calculateSurfaceTreatmentLegacy(input.surfaceTreatment, extrusionCost, unitWeight);
    surfaceTreatmentCost = surfaceResult.cost;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: surfaceResult.formula,
      cost: surfaceTreatmentCost,
    });
  }

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
// 压铸报价（保持原有逻辑）
// ============================================================

export function calculateDieCasting(input: DieCastingInput): PricingResult {
  const breakdown: CostBreakdown[] = [];

  const unitWeight = input.weight;

  const aluminumPricePerTon = DEFAULT_ALUMINUM_PRICE_PER_TON;
  const aluminumPricePerKg = aluminumPricePerTon / 1000;
  const materialCost = unitWeight * aluminumPricePerKg;
  breakdown.push({
    item: '铝材费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥${aluminumPricePerKg.toFixed(4)}/kg`,
    cost: materialCost,
  });

  const castingCost = unitWeight * 5.0;
  breakdown.push({
    item: '压铸加工费',
    calculation: `${unitWeight.toFixed(4)}kg × ¥5/kg`,
    cost: castingCost,
  });

  const cncCost = STAMPING_COST_SOLID;
  breakdown.push({
    item: '切割费',
    calculation: `标准冲压 ¥${STAMPING_COST_SOLID}/件`,
    cost: cncCost,
  });

  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceResult = calculateSurfaceTreatmentLegacy(input.surfaceTreatment, castingCost, unitWeight);
    surfaceTreatmentCost = surfaceResult.cost;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: surfaceResult.formula,
      cost: surfaceTreatmentCost,
    });
  }

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
// 装配体报价（适配质稳 v4 公式）
// ============================================================

export function calculateAssembly(input: AssemblyInput): AssemblyPricingResult {
  const aluminumPricePerKg = input.aluminumPricePerKg
    ?? (input.aluminumPricePerTon ? input.aluminumPricePerTon / 1000 : DEFAULT_ALUMINUM_PRICE_PER_KG);
  const aluminumPricePerTon = input.aluminumPricePerTon ?? aluminumPricePerKg * 1000;

  const partsPricing: AssemblyPartResult[] = [];
  let grandTotal = 0;

  for (const part of input.parts) {
    let partResult: PricingResult;

    if (part.productType === 'extrusion') {
      // 质稳 v4 公式：需要 crossSectionArea
      const csa = part.crossSectionArea ?? 0;
      partResult = calculateExtrusion({
        productType: 'extrusion',
        crossSectionArea: csa,
        length: part.length ?? 100,
        quantity: 1,
        surfaceTreatment: (part.surfaceTreatment ?? input.surfaceTreatment ?? '无') as SurfaceTreatment,
        processingFee: part.processingFee,
        aluminumPricePerKg: part.aluminumPricePerKg ?? aluminumPricePerKg,
      });
    } else {
      partResult = calculatePlate({
        productType: 'plate',
        width: part.width ?? 10,
        height: part.height ?? 10,
        thickness: part.thickness ?? 1,
        quantity: 1,
        surfaceTreatment: (part.surfaceTreatment ?? input.surfaceTreatment ?? '无') as SurfaceTreatment,
        aluminumPricePerTon,
      });
    }

    const unitCost = round2(partResult.unitCost);
    const partTotalCost = round2(unitCost * part.quantity);
    grandTotal += partTotalCost;

    partsPricing.push({
      partId: part.partId,
      quantity: part.quantity,
      dimensions: [],
      volume: 0,
      weight: part.unitWeight ? round2(part.unitWeight * 1000) : 0,
      isExtrusion: part.productType === 'extrusion',
      crossSectionArea: part.crossSectionArea ?? 0,
      length: part.length ?? 0,
      unitCost,
      partTotalCost,
      breakdown: partResult.breakdown,
    });
  }

  return {
    productType: 'assembly',
    partsCount: input.parts.reduce((sum, p) => sum + p.quantity, 0),
    uniqueParts: partsPricing,
    partsPricing,
    totalCost: round2(grandTotal),
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

/**
 * 支持装配体的扩展入口
 */
export function calculatePriceFull(input: FullPricingInput): FullPricingResult {
  if (input.productType === 'assembly') {
    return calculateAssembly(input as AssemblyInput);
  }
  return calculatePrice(input as PricingInput);
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
