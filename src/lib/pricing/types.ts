// ============================================================
// 报价计算引擎 - 类型定义
// ============================================================

/** 产品类型 */
export type ProductType = 'extrusion' | 'plate' | 'die_casting';

/** 表面处理类型 */
export type SurfaceTreatment = '无' | '氧化本色' | '氧化黑色' | '喷涂' | '电泳';

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

/** 挤压铝型材输入参数 */
export interface ExtrusionInput {
  productType: 'extrusion';

  // 外轮廓尺寸
  outerWidth: number;   // mm
  outerHeight: number;  // mm

  // 倒角
  chamfer?: Chamfer;

  // 内腔
  isHollow: boolean;
  cavity?: Cavity;

  // 尺寸与数量
  length: number;   // mm
  quantity: number;

  // 表面处理
  surfaceTreatment: SurfaceTreatment;

  // CNC 加工（可选）
  drillingHoles?: number;   // 钻孔数量
  tappingHoles?: number;    // 攻丝数量

  // 铝锭价
  aluminumPricePerTon?: number; // 元/吨，默认 23530

  // 截面复杂度（可选，默认 simple）
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

  // 六项成本（单件）
  materialCost: number;        // 铝材费
  extrusionCost: number;       // 挤压费
  cncCost: number;             // CNC 费
  surfaceTreatmentCost: number; // 表面处理费
  packagingCost: number;       // 包装费
  transportationCost: number;  // 运输费

  // 汇总
  unitCost: number;            // 单件总价
  totalCost: number;           // 批量总价

  // 明细
  breakdown: CostBreakdown[];

  // 铝价信息
  aluminumPrice: {
    pricePerTon: number;
    pricePerKg: number;
    source: string;
  };
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
}

/** 装配体输入参数 */
export interface AssemblyInput {
  productType: 'assembly';
  parts: AssemblyPartInput[];
  surfaceTreatment?: SurfaceTreatment;
  aluminumPricePerTon?: number;
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
