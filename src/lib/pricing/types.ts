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
