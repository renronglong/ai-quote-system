/**
 * 冲压复合模（落料+冲孔一套工序）模具费计算器
 * 纯计算函数，不依赖 React
 */

// ==================== 配置参数（常量对象，方便后续改成可配置） ====================

export const STAMPING_MOLD_CONFIG = {
  /** Cr12MoV 材料单价（元/kg） */
  price_r12: 18,
  /** 热处理单价（元/kg） */
  price_heat_treatment: 8,
  /** A3 材料单价（元/kg） */
  price_a3: 5,
  /** 圆凸模单价（元/支） */
  price_round_punch: 6.5,
  /** 线割系数 */
  coeff_wire_cutting: 0.0035,
  /** 基础加工费系数 */
  coeff_base_processing: 0.0035,
  /** 加工倍数 */
  processing_multiplier: 1.25,
  /** 基础附加费（元） */
  base_surcharge: 100,
  /** 最小壁厚 c_min（mm） */
  c_min: 20,
  /** 公头高度（mm） */
  punch_height: 60,
} as const;

// ==================== 标准模架表（7档） ====================

interface MoldFrameSpec {
  frame: [number, number];     // 模架外框
  cavity: [number, number];    // 凹模边界
  closingHeight: number;       // 闭合高度
}

const MOLD_FRAME_TABLE: MoldFrameSpec[] = [
  { frame: [160, 125], cavity: [100, 80],   closingHeight: 100 },
  { frame: [200, 160], cavity: [125, 100],  closingHeight: 120 },
  { frame: [250, 200], cavity: [160, 125],  closingHeight: 140 },
  { frame: [315, 250], cavity: [200, 160],  closingHeight: 160 },
  { frame: [400, 315], cavity: [250, 200],  closingHeight: 180 },
  { frame: [500, 400], cavity: [315, 250],  closingHeight: 200 },
  { frame: [630, 500], cavity: [400, 315],  closingHeight: 250 },
];

// ==================== 六件套定义 ====================

interface PartSpec {
  name: string;
  material: 'R12' | 'A3';
  thickness: number;       // mm
  sizeBasis: 'cavity' | 'frame' | 'unfold';  // 尺寸依据
}

const PART_SPECS: PartSpec[] = [
  { name: '凹模板',   material: 'R12', thickness: 30, sizeBasis: 'cavity' },
  { name: '落料凸模', material: 'R12', thickness: 60, sizeBasis: 'unfold' },
  { name: '下模座',   material: 'A3',  thickness: 30, sizeBasis: 'frame'  },
  { name: '上板',     material: 'A3',  thickness: 30, sizeBasis: 'frame'  },
  { name: '脱料板',   material: 'A3',  thickness: 20, sizeBasis: 'cavity' },
  { name: '固公板',   material: 'A3',  thickness: 20, sizeBasis: 'cavity' },
];

// 钢材密度 (g/cm³ → 转换为 kg/mm³: 7.85e-6)
const STEEL_DENSITY = 7.85e-6; // kg per mm³

// 模具总高（固定）
const TOTAL_MOLD_HEIGHT = 30 + 30 + 20 + 20 + 30; // = 130mm

// ==================== 输入/输出接口 ====================

export interface StampingMoldInput {
  /** 展开长 mm */
  unfoldLength: number;
  /** 展开宽 mm */
  unfoldWidth: number;
  /** 板厚 mm */
  thickness: number;
  /** 展开外轮廓周长 mm */
  outerPerimeter: number;
  /** 孔周长合计 mm */
  holesPerimeter: number;
  /** 孔数 */
  holeCount: number;
  /** 最小壁厚，默认 20 */
  cMin?: number;
}

export interface StampingMoldResult {
  /** 模架外框 */
  frameSize: [number, number];
  /** 凹模边界 */
  cavitySize: [number, number];
  /** 闭合高度 */
  closingHeight: number;
  /** 模具总高 */
  totalHeight: number;
  /** 总重 kg */
  totalWeight: number;
  /** R12件总重 */
  r12Weight: number;
  /** A3件总重 */
  a3Weight: number;
  /** 钢材费 */
  steelCost: number;
  /** 热处理费 */
  heatTreatmentCost: number;
  /** 线割费 */
  wireCuttingCost: number;
  /** 圆孔凸模费 */
  punchCost: number;
  /** 基础加工费 */
  baseProcessingCost: number;
  /** 模具费合计 */
  totalMoldFee: number;
  /** 是否超最大档需非标 */
  isNonStandard: boolean;
  /** 六件套明细 */
  partsDetail: Array<{
    name: string;
    material: string;
    thickness: number;
    length: number;
    width: number;
    weight: number;
  }>;
}

// ==================== 核心计算函数 ====================

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * 计算冲压复合模模具费
 * @returns 计算结果，输入不合法时返回 null
 */
export function calculateStampingMoldFee(input: StampingMoldInput): StampingMoldResult | null {
  const config = STAMPING_MOLD_CONFIG;
  const cMin = input.cMin ?? config.c_min;

  // 输入校验
  const { unfoldLength, unfoldWidth, thickness, outerPerimeter, holesPerimeter, holeCount } = input;
  if (!(unfoldLength > 0) || !(unfoldWidth > 0) || !(thickness > 0)) {
    return null;
  }

  // ---- 1. 模架选型 ----
  // 判据：产品长+2×c_min ≤ 凹模边界长 且 产品宽+2×c_min ≤ 凹模边界宽
  const requiredLength = unfoldLength + 2 * cMin;
  const requiredWidth = unfoldWidth + 2 * cMin;

  // 确保长对应长边、宽对应短边（产品展开尺寸可能长>宽或宽>长）
  const reqMax = Math.max(requiredLength, requiredWidth);
  const reqMin = Math.min(requiredLength, requiredWidth);

  let selectedFrame: MoldFrameSpec | null = null;
  for (const spec of MOLD_FRAME_TABLE) {
    const cavMax = Math.max(spec.cavity[0], spec.cavity[1]);
    const cavMin = Math.min(spec.cavity[0], spec.cavity[1]);
    if (reqMax <= cavMax && reqMin <= cavMin) {
      selectedFrame = spec;
      break;
    }
  }

  if (!selectedFrame) {
    // 超最大档，返回非标标识
    const lastFrame = MOLD_FRAME_TABLE[MOLD_FRAME_TABLE.length - 1];
    return {
      frameSize: lastFrame.frame,
      cavitySize: lastFrame.cavity,
      closingHeight: lastFrame.closingHeight,
      totalHeight: TOTAL_MOLD_HEIGHT,
      totalWeight: 0,
      r12Weight: 0,
      a3Weight: 0,
      steelCost: 0,
      heatTreatmentCost: 0,
      wireCuttingCost: 0,
      punchCost: 0,
      baseProcessingCost: 0,
      totalMoldFee: 0,
      isNonStandard: true,
      partsDetail: [],
    };
  }

  // ---- 2. 六件套尺寸与重量 ----
  const partsDetail: StampingMoldResult['partsDetail'] = [];
  let r12Weight = 0;
  let a3Weight = 0;

  for (const partSpec of PART_SPECS) {
    let partL: number, partW: number;

    switch (partSpec.sizeBasis) {
      case 'cavity':
        partL = selectedFrame.cavity[0];
        partW = selectedFrame.cavity[1];
        break;
      case 'frame':
        partL = selectedFrame.frame[0];
        partW = selectedFrame.frame[1];
        break;
      case 'unfold':
        // 落料凸模按产品展开尺寸
        partL = unfoldLength;
        partW = unfoldWidth;
        break;
      default:
        partL = selectedFrame.cavity[0];
        partW = selectedFrame.cavity[1];
    }

    const partThickness = partSpec.thickness;
    const weight = partL * partW * partThickness * STEEL_DENSITY;

    partsDetail.push({
      name: partSpec.name,
      material: partSpec.material,
      thickness: partThickness,
      length: partL,
      width: partW,
      weight: r2(weight),
    });

    if (partSpec.material === 'R12') {
      r12Weight += weight;
    } else {
      a3Weight += weight;
    }
  }

  const totalWeight = r12Weight + a3Weight;

  // ---- 3. 费用计算 ----

  // 钢材费 = Σ(单件重量 × 对应单价)
  const steelCost = r12Weight * config.price_r12 + a3Weight * config.price_a3;

  // 热处理费 = (凹模板重量 + 落料凸模重量) × 单价_热处理
  // 用精确值（不四舍五入的累加）
  const heatTreatmentCost = r12Weight * config.price_heat_treatment;

  // 刃口有效高度 = 凹模板厚(30) + 4×板厚
  const effectiveHeight = 30 + 4 * thickness;

  // 线割费 = (展开外轮廓周长 + 各孔周长合计) × 刃口有效高度 × 系数_线割 + 展开外轮廓周长 × 公头高度 × 系数_线割
  const safeOuterPerimeter = outerPerimeter > 0 ? outerPerimeter : 0;
  const safeHolesPerimeter = holesPerimeter > 0 ? holesPerimeter : 0;
  const wireCuttingCost = (safeOuterPerimeter + safeHolesPerimeter) * effectiveHeight * config.coeff_wire_cutting
    + safeOuterPerimeter * config.punch_height * config.coeff_wire_cutting;

  // 圆孔凸模费 = 圆孔数 × 6.5
  const safeHoleCount = holeCount > 0 ? holeCount : 0;
  const punchCost = safeHoleCount * config.price_round_punch;

  // 基础加工费 = 0.0035 × 模架外框周长 × 130
  const framePerimeter = 2 * (selectedFrame.frame[0] + selectedFrame.frame[1]);
  const baseProcessingCost = config.coeff_base_processing * framePerimeter * TOTAL_MOLD_HEIGHT;

  // 模具费 = (钢材费 + 热处理费 + 基础加工费 + 圆孔凸模费 + 线割费) × 1.25 + 100
  const subtotal = steelCost + heatTreatmentCost + baseProcessingCost + punchCost + wireCuttingCost;
  const totalMoldFee = subtotal * config.processing_multiplier + config.base_surcharge;

  // ---- 输出 ----
  return {
    frameSize: selectedFrame.frame,
    cavitySize: selectedFrame.cavity,
    closingHeight: selectedFrame.closingHeight,
    totalHeight: TOTAL_MOLD_HEIGHT,
    totalWeight: r2(totalWeight),
    r12Weight: r2(r12Weight),
    a3Weight: r2(a3Weight),
    steelCost: r2(steelCost),
    heatTreatmentCost: r2(heatTreatmentCost),
    wireCuttingCost: r2(wireCuttingCost),
    punchCost: r2(punchCost),
    baseProcessingCost: r2(baseProcessingCost),
    totalMoldFee: Math.round(totalMoldFee),
    isNonStandard: false,
    partsDetail,
  };
}

// ==================== 激光切割计价 ====================

// 切割单价表（按板厚查表，元/米）
const LASER_UNIT_PRICE: Record<number, number> = {
  0.8: 0.8, 1: 0.9, 1.2: 1.0, 1.5: 1.4, 2: 1.7, 3: 2.3, 4: 3.5,
  5: 4.0, 6: 5.2, 8: 5.6, 10: 6.5, 12: 8.0, 14: 12, 16: 14, 18: 16, 20: 18, 22: 20,
};

// 板厚档位（升序）
const LASER_TIERS = [0.8, 1, 1.2, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22];

// 穿孔费率（按板厚递增）
const laserPierceRate = (t: number): number => {
  if (t <= 4) return 0.1;
  return 0.1 * (Math.ceil((t - 4) / 4) + 1);
};

// 根据板厚查切割单价（元/米）
// 板厚不在档里 → 往上取（1.8→2档，2.5→3档，7→8档）
// 板厚 > 22mm → null（激光做不了）
const laserUnitPrice = (t: number): number | null => {
  const hit = LASER_TIERS.find(x => x >= t);
  return hit == null ? null : LASER_UNIT_PRICE[hit];
};

export interface LaserCuttingInput {
  /** 板厚 mm */
  thickness: number;
  /** 切割总路径 mm（已含孔周长，优先用 cut_total_path_mm） */
  cutTotalPath: number;
  /** 孔数（用 unfold_hole_count） */
  holeCount: number;
}

export interface LaserCuttingResult {
  /** 切割费（元/件） */
  cuttingFee: number;
  /** 穿孔费（元/件） */
  piercingFee: number;
  /** 激光费合计（元/件） */
  totalLaserFee: number;
  /** 使用的单价（元/米） */
  unitPrice: number;
  /** 使用的穿孔费率（元/孔） */
  pierceRate: number;
  /** 是否不可用（板厚 > 22mm） */
  unavailable: boolean;
}

/**
 * 计算激光切割费用（不开模方案 B）
 * 公式：切割费 = 切割长度 ÷ 1000 × 切割单价(元/米)
 *       穿孔费 = 费率 × 孔数
 *       激光费 = 切割费 + 穿孔费
 */
export function calculateLaserCuttingFee(input: LaserCuttingInput): LaserCuttingResult | null {
  const { thickness, cutTotalPath, holeCount } = input;

  if (!(thickness > 0) || !(cutTotalPath > 0)) {
    return null;
  }

  const unitPrice = laserUnitPrice(thickness);

  // 板厚 > 22mm → 激光做不了
  if (unitPrice == null) {
    return {
      cuttingFee: 0,
      piercingFee: 0,
      totalLaserFee: 0,
      unitPrice: 0,
      pierceRate: 0,
      unavailable: true,
    };
  }

  const safeHoleCount = holeCount > 0 ? holeCount : 0;
  const pierceRate = laserPierceRate(thickness);

  const cuttingFee = r2((cutTotalPath / 1000) * unitPrice);
  const piercingFee = r2(pierceRate * safeHoleCount);
  const totalLaserFee = r2(cuttingFee + piercingFee);

  return {
    cuttingFee,
    piercingFee,
    totalLaserFee,
    unitPrice,
    pierceRate,
    unavailable: false,
  };
}
