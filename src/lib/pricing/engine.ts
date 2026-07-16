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

const EXTRUSION_RATE: Record<string, number> = {
  'solid-simple': 3.0,    // 实心简单截面 (元/kg)
  'hollow-simple': 2.5,   // 空心简单截面 (元/kg)
  'solid-complex': 4.0,   // 实心复杂截面 (元/kg)
  'hollow-complex': 4.0,  // 空心复杂截面 (元/kg)
};

// 表面处理费 - 按板材公式统一计算
// 公式：基础费 + 加工附加费×系数 + 重量×系数
// 铝板/挤压件通用
interface SurfaceTreatmentResult {
  cost: number;
  formula: string;
}

function calculateSurfaceTreatment(
  treatment: string,
  processingSurcharge: number, // 加工附加费（挤压件=挤压费，板材=冲压附加费）
  weight: number,              // 单件重量(kg)
): SurfaceTreatmentResult {
  switch (treatment) {
    case '氧化本色':
      return {
        cost: 0.2 + processingSurcharge * 2 + weight * 2,
        formula: `0.2 + ${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×2`,
      };
    case '氧化黑色':
      return {
        cost: 0.3 + processingSurcharge * 3 + weight * 3,
        formula: `0.3 + ${processingSurcharge.toFixed(2)}×3 + ${weight.toFixed(4)}×3`,
      };
    case '喷砂':
      return {
        cost: processingSurcharge * 2 + weight * 1,
        formula: `${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×1`,
      };
    case '拉丝':
      return {
        cost: 0.3 + processingSurcharge * 3 + weight * 3,
        formula: `0.3 + ${processingSurcharge.toFixed(2)}×3 + ${weight.toFixed(4)}×3（同氧化上色）`,
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
    case '磷化':
      return {
        cost: 0.2 + processingSurcharge * 2 + weight * 2,
        formula: `0.2 + ${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×2`,
      };
    case '镀锌':
    case '镀镍':
      return {
        cost: processingSurcharge * 2 + weight * 1.5,
        formula: `${processingSurcharge.toFixed(2)}×2 + ${weight.toFixed(4)}×1.5`,
      };
    case '抛光':
    case '镀铬':
      return {
        cost: 0.3 + processingSurcharge * 3 + weight * 3,
        formula: `0.3 + ${processingSurcharge.toFixed(2)}×3 + ${weight.toFixed(4)}×3（同氧化上色）`,
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

  // ---- 4. 冲压费 ----
  const stampingCost = input.isHollow ? STAMPING_COST_HOLLOW : STAMPING_COST_SOLID;
  // 钻孔费
  const drillingCost = (input.drillingHoles ?? 0) * DRILLING_COST_PER_HOLE;
  // 攻丝费
  const tappingCost = (input.tappingHoles ?? 0) * TAPPING_COST_PER_HOLE;

  const cncCost = stampingCost + drillingCost + tappingCost;

  const cncParts: string[] = [
    `冲压工序: ¥${stampingCost}(${input.isHollow ? '空心' : '实心'})`,
  ];
  if (drillingCost > 0) {
    cncParts.push(`钻孔: ${input.drillingHoles}孔 × ¥${DRILLING_COST_PER_HOLE} = ¥${drillingCost.toFixed(2)}`);
  }
  if (tappingCost > 0) {
    cncParts.push(`攻丝: ${input.tappingHoles}孔 × ¥${TAPPING_COST_PER_HOLE} = ¥${tappingCost.toFixed(2)}`);
  }

  breakdown.push({
    item: '切割费',
    calculation: cncParts.join('; '),
    cost: cncCost,
  });

  // ---- 5. 表面处理费（按板材公式统一计算） ----
  // 加工附加费 = 挤压费（按重量算，与冲压附加费同理）
  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceResult = calculateSurfaceTreatment(input.surfaceTreatment, extrusionCost, unitWeight);
    surfaceTreatmentCost = surfaceResult.cost;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: surfaceResult.formula,
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

  // 冲压费
  const cncCost = STAMPING_COST_SOLID;
  breakdown.push({
    item: '切割费',
    calculation: `标准冲压 ¥${STAMPING_COST_SOLID}/件`,
    cost: cncCost,
  });

  // 表面处理费（统一公式计算）
  // 加工附加费 = 冲压附加费（尺寸附加+体积附加，基于重量和体积）
  // 这里用板材加工费作为冲压附加费
  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceResult = calculateSurfaceTreatment(input.surfaceTreatment, extrusionCost, unitWeight);
    surfaceTreatmentCost = surfaceResult.cost;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: surfaceResult.formula,
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

  // 冲压费
  const cncCost = STAMPING_COST_SOLID;
  breakdown.push({
    item: '切割费',
    calculation: `标准冲压 ¥${STAMPING_COST_SOLID}/件`,
    cost: cncCost,
  });

  // 表面处理（统一公式）
  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    const surfaceResult = calculateSurfaceTreatment(input.surfaceTreatment, castingCost, unitWeight);
    surfaceTreatmentCost = surfaceResult.cost;
    breakdown.push({
      item: `表面处理费（${input.surfaceTreatment}）`,
      calculation: surfaceResult.formula,
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
// 装配体报价（无焊接费，各零件加总）
// ============================================================

export function calculateAssembly(input: AssemblyInput): AssemblyPricingResult {
  const aluminumPricePerTon = input.aluminumPricePerTon ?? DEFAULT_ALUMINUM_PRICE_PER_TON;
  const aluminumPricePerKg = aluminumPricePerTon / 1000;

  const partsPricing: AssemblyPartResult[] = [];
  let grandTotal = 0;

  for (const part of input.parts) {
    let partResult: PricingResult;

    if (part.productType === 'extrusion') {
      partResult = calculateExtrusion({
        productType: 'extrusion',
        outerWidth: part.outerWidth ?? 10,
        outerHeight: part.outerHeight ?? 10,
        length: part.length ?? 100,
        quantity: 1,
        isHollow: part.isHollow ?? false,
        surfaceTreatment: (part.surfaceTreatment ?? input.surfaceTreatment ?? '氧化本色') as SurfaceTreatment,
        sectionComplexity: part.sectionComplexity ?? 'simple',
        drillingHoles: part.drillingHoles,
        tappingHoles: part.tappingHoles,
        aluminumPricePerTon,
      });
    } else {
      partResult = calculatePlate({
        productType: 'plate',
        width: part.width ?? 10,
        height: part.height ?? 10,
        thickness: part.thickness ?? 1,
        quantity: 1,
        surfaceTreatment: (part.surfaceTreatment ?? input.surfaceTreatment ?? '氧化本色') as SurfaceTreatment,
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
