// ============================================================
// 报价计算引擎 - 类型定义
// ============================================================

/** 产品类型 */
export type ProductType = 'extrusion' | 'plate' | 'die_casting';

/** 表面处理类型（质稳 v4 公式） */
export type SurfaceTreatment = '无' | '白色哑光' | '阳极氧化' | '阳极氧化原色' | '氧化银白' | '氧化黑色' | '喷涂' | '电泳';

/** 截面复杂度 */
export type SectionComplexity = 'simple' | 'complex';

// ------------------------------------------------------------
// 输入参数
// ------------------------------------------------------------

/** 倒角参数 */
export interface Chamfer {
  /** 倒角数量 */
  count: number;
  /** 倒角尺寸 (mm) */
  size: number;
}

/** 内腔参数 */
export interface Cavity {
  /** 内腔宽度 (mm) */
  width: number;
  /** 内腔高度 (mm) */
  height: number;
}

/** 挤压铝型材输入参数（质稳 v4 公式） */
export interface ExtrusionInput {
  productType: 'extrusion';

  // 截面面积（质稳公式核心输入）
  crossSectionArea: number;  // mm²

  // 尺寸与数量
  length: number;   // mm
  quantity: number;

  // 表面处理
  surfaceTreatment: SurfaceTreatment;

  // 加工费（可选，默认 8 元）
  processingFee?: number;

  // 铝锭价 元/kg（可选，默认 23.45）
  aluminumPricePerKg?: number;

  // ---- 以下为旧版兼容字段（可选） ----
  outerWidth?: number;   // mm
  outerHeight?: number;  // mm
  chamfer?: Chamfer;
  isHollow?: boolean;
  cavity?: Cavity;
  drillingHoles?: number;   // 钻孔数量
  tappingHoles?: number;    // 攻丝数量
  aluminumPricePerTon?: number; // 元/吨（旧版兼容）
  sectionComplexity?: SectionComplexity;
}

/** 板材输入参数 */
export interface PlateInput {
  productType: 'plate';
  width: number;       // mm
  height: number;      // mm
  thickness: number;   // mm
  quantity: number;
  surfaceTreatment?: SurfaceTreatment;
  aluminumPricePerTon?: number;
}

/** 压铸输入参数 */
export interface DieCastingInput {
  productType: 'die_casting';
  weight: number;      // kg (单件重量)
  quantity: number;
  surfaceTreatment?: SurfaceTreatment;
}

/** 联合输入类型 */
export type PricingInput = ExtrusionInput | PlateInput | DieCastingInput;

// ------------------------------------------------------------
// 输出结果
// ------------------------------------------------------------

/** 单条成本明细 */
export interface CostBreakdown {
  item: string;          // 费用项名称
  calculation: string;   // 计算过程描述
  cost: number;          // 金额（元）
}

/** 截面计算中间结果 */
export interface SectionCalculation {
  outerArea: number;          // 外轮廓面积 (mm²)
  chamferArea: number;        // 倒角面积 (mm²)
  cavityArea: number;         // 内腔面积 (mm²)
  crossSectionArea: number;   // 净截面面积 (mm²)
  perimeter: number;          // 外周长 (mm)
  weightPerMeter: number;     // 米重 (kg/m)
  unitWeight: number;         // 单件重量 (kg)
}

/** 报价计算结果 */
export interface PricingResult {
  productType: ProductType;
  quantity: number;

  // 截面计算（仅挤压型材）
  section?: SectionCalculation;

  // 六项成本（单件）— 保留兼容
  materialCost: number;        // 铝材费 / 材料费 K
  extrusionCost: number;       // 挤压费 P（仅展示，不计入成本）
  cncCost: number;             // 加工费 G（挤压件） / 切割费（板材/压铸）
  surfaceTreatmentCost: number; // 表面处理费 J
  packagingCost: number;       // 包装运输费 I（挤压件合并） / 包装费（其他）
  transportationCost: number;  // 运输费（挤压件为 0，已合并至 packagingCost）

  // 汇总
  unitCost: number;            // 含税单价（挤压件） / 单件总价（其他）
  totalCost: number;           // 批量总价

  // 明细
  breakdown: CostBreakdown[];

  // 铝价信息
  aluminumPrice: {
    pricePerTon: number;
    pricePerKg: number;
    source: string;
  };

  // ---- 质稳 v4 公式专属字段（仅挤压件） ----
  netWeight?: number;            // 净重量 (kg)
  effectiveWeight?: number;      // 有效重量 (kg)
  cutAllowanceCoef?: number;    // 切割余量系数 E_coef
  costTotal?: number;            // 成本合计 L（不含挤压费）
  wasteCost?: number;            // 损耗 5%
  profitCost?: number;           // 利润 10%
  taxCost?: number;              // 税金 13%
  unitPriceWithTax?: number;     // 含税单价 = L × 1.28
  processingFeeCost?: number;    // 加工费 G
}

// ------------------------------------------------------------
// 装配体报价类型
// ------------------------------------------------------------

/** 装配体中的单个零件信息 */
export interface AssemblyPartInput {
  /** 零件ID (A, B, C...) */
  partId: string;
  /** 产品类型（assembly中每个零件都是挤压件或板材件） */
  productType: 'extrusion' | 'plate';
  /** 该零件的数量 */
  quantity: number;
  /** 挤压件参数 */
  outerWidth?: number;
  outerHeight?: number;
  length?: number;
  isHollow?: boolean;
  /** 板材件参数 */
  width?: number;
  height?: number;
  thickness?: number;
  /** 通用参数 */
  unitWeight?: number;        // kg
  crossSectionArea?: number;  // mm²
  surfaceTreatment?: SurfaceTreatment;
  sectionComplexity?: SectionComplexity;
  drillingHoles?: number;
  tappingHoles?: number;
  processingFee?: number;
  aluminumPricePerKg?: number;
}

/** 装配体输入参数 */
export interface AssemblyInput {
  productType: 'assembly';
  parts: AssemblyPartInput[];
  surfaceTreatment?: SurfaceTreatment;
  aluminumPricePerKg?: number;
  aluminumPricePerTon?: number; // 旧版兼容
}

/** 装配体报价中的单个零件结果 */
export interface AssemblyPartResult {
  partId: string;
  quantity: number;
  dimensions: number[];        // [smallest, middle, largest] mm
  volume: number;              // mm³
  weight: number;              // g
  isExtrusion: boolean;
  crossSectionArea: number;    // mm²
  length: number;              // mm
  /** 该零件的单件报价 */
  unitCost: number;
  /** 该零件的批量总价 = unitCost × quantity */
  partTotalCost: number;
  /** 该零件的成本明细 */
  breakdown: CostBreakdown[];
}

/** 装配体报价结果 */
export interface AssemblyPricingResult {
  productType: 'assembly';
  /** 装配体中的零件总数（含重复） */
  partsCount: number;
  /** 去重后的零件列表 */
  uniqueParts: AssemblyPartResult[];
  /** 每个零件的报价明细 */
  partsPricing: AssemblyPartResult[];
  /** 所有零件总价（无焊接费，直接加总） */
  totalCost: number;
  /** 铝价信息 */
  aluminumPrice: {
    pricePerTon: number;
    pricePerKg: number;
    source: string;
  };
}

/** 扩展联合输入类型 */
export type FullPricingInput = PricingInput | AssemblyInput;

/** 扩展联合输出类型 */
export type FullPricingResult = PricingResult | AssemblyPricingResult;
