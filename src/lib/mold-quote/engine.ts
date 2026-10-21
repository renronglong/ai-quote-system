// ============================================================
// 压铸/注塑模具报价引擎（复刻飞书报价体系）
// 布局链：滑块数 → 穴数 → 穴排 → 机台吨位
// 成本五块：模架费 / 滑块费 / 模芯钢 / 型腔加工 / 浇道费
// 市场联动：模架费 = 钢板重量 × 市场钢板价 + 2800
// ============================================================

export type MoldMaterial = '铝压铸' | '锌合金压铸' | '塑料注塑';

// ---- 材质参数表（飞书「材质参数」表复刻）----
export interface MaterialParam {
  steel: string;          // 模具钢
  steelPrice: number;     // 钢材单价(元/kg)
  multiplier: number;     // 钢/铝倍率
  pressure: number;       // 压射比压(MPa)
  machineType: string;    // 机台类型
  cavityFee: number;      // 单穴型腔费基数(元)
  runnerSystem: string;   // 浇道系统
  hourlyRate: number;     // 机时费率(60×倍率)
  tonnage: number;        // 机台吨位(T)
}

export const MATERIAL_PARAMS: Record<MoldMaterial, MaterialParam> = {
  '铝压铸':   { steel: 'H13',  steelPrice: 25, multiplier: 4, pressure: 40, machineType: '冷室压铸机', cavityFee: 700, runnerSystem: '有溢流槽',     hourlyRate: 240, tonnage: 160 },
  '锌合金压铸': { steel: 'P20',  steelPrice: 18, multiplier: 3, pressure: 25, machineType: '热室压铸机', cavityFee: 600, runnerSystem: '有溢流槽',     hourlyRate: 180, tonnage: 100 },
  '塑料注塑':  { steel: '718H', steelPrice: 18, multiplier: 3, pressure: 15, machineType: '注塑机',     cavityFee: 600, runnerSystem: '无溢流·冷料井', hourlyRate: 180, tonnage: 80 },
};

export const MATERIAL_NAMES = Object.keys(MATERIAL_PARAMS) as MoldMaterial[];

// ---- 模架规格表（飞书「模架价格」表复刻，12 规格）----
export interface MoldFrame {
  spec: string;       // 规格
  size: string;       // 宽×长(mm)
  weightKg: number;   // 钢板重量(kg)
  cavityArea: number; // 型腔可用面积(cm²)
}

export const MOLD_FRAMES: MoldFrame[] = [
  { spec: '2020', size: '200×200', weightKg: 15, cavityArea: 225 },
  { spec: '2025', size: '200×250', weightKg: 18, cavityArea: 300 },
  { spec: '2525', size: '250×250', weightKg: 25, cavityArea: 400 },
  { spec: '2535', size: '250×350', weightKg: 30, cavityArea: 600 },
  { spec: '3030', size: '300×300', weightKg: 35, cavityArea: 625 },
  { spec: '3035', size: '300×350', weightKg: 40, cavityArea: 750 },
  { spec: '3040', size: '300×400', weightKg: 45, cavityArea: 875 },
  { spec: '3535', size: '350×350', weightKg: 50, cavityArea: 900 },
  { spec: '3540', size: '350×400', weightKg: 55, cavityArea: 1050 },
  { spec: '4040', size: '400×400', weightKg: 65, cavityArea: 1225 },
  { spec: '4545', size: '450×450', weightKg: 80, cavityArea: 1600 },
  { spec: '5050', size: '500×500', weightKg: 95, cavityArea: 2025 },
];

// ---- 固定参数 ----
export const SLIDER_STD_PART = 300;  // 滑块标准件(元/个)
export const RUNNER_CONE = 300;      // 分流锥(元)
export const STEEL_DENSITY = 7850;   // 钢密度(kg/m³，公式用 7850/10⁹ 处理 mm³)
export const FRAME_BASE_FEE = 2800;  // 模架加工底费(元)
export const DIRECT_RATIO = 0.7;     // 直接占比（合计=小计/0.7）
export const DEFAULT_STEEL_PRICE = 7; // 默认市场钢板价(元/kg)

// ---- 输入 ----
export interface MoldQuoteInput {
  L: number;            // 产品外廓L(滑块向·mm)
  W: number;            // 产品宽W(mm)
  H: number;            // 产品高H(mm)
  netWeightG: number;   // 净重(g)
  removalVolume: number;// 去除量(mm³)
  cncCycleMin: number;  // CNC节拍(min)
  sideCount: number;    // 侧面数N
  material: MoldMaterial;
  moldFrame: string;    // 模架规格
  steelPrice: number;   // 市场钢板价(元/kg)
}

// ---- 结果 ----
export interface LayoutResult {
  sliderCount: number;    // 滑块数
  cavityCount: number;    // 穴数
  cavityRows: number;     // 穴排
  tonnage: number;        // 机台吨位(T)
  machineType: string;    // 机台类型
  runnerSystem: string;   // 浇道系统
}

export interface CostItem {
  item: string;
  calculation: string;
  amount: number;
}

export interface MoldQuoteResult {
  success: true;
  input: MoldQuoteInput;
  materialParams: MaterialParam;
  layout: LayoutResult;
  costs: CostItem[];
  subtotal: number;
  total: number;
  moldFrame: MoldFrame;
  comparisons: ComparisonRow[]; // 三材质对比
  warnings: string[];
}

export interface ComparisonRow {
  material: MoldMaterial;
  steel: string;
  steelPrice: number;
  tonnage: number;
  hourlyRate: number;
  cavityFee: number;
  sliderCount: number;
  cavityCount: number;
  frameFee: number;
  sliderFee: number;
  coreSteel: number;
  cavityProcess: number;
  runnerFee: number;
  subtotal: number;
  total: number;
}

// ---- 工具 ----
function num(v: any, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

export function findMoldFrame(spec: string): MoldFrame {
  return MOLD_FRAMES.find(f => f.spec === spec) || MOLD_FRAMES[3]; // 默认 2535
}

/** 按产品外廓推荐模架规格（型腔占位 ≤ 可用面积，取最小满足的规格） */
export function recommendMoldFrame(L: number, W: number): MoldFrame {
  const pitch = L <= 40 ? 45 : L <= 100 ? 60 : 80;
  const needArea = ((W + pitch) * (L + pitch)) / 100; // cm²
  return MOLD_FRAMES.find(f => f.cavityArea >= needArea) || MOLD_FRAMES[MOLD_FRAMES.length - 1];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- 单材质计算 ----
function calcForMaterial(
  input: MoldQuoteInput,
  material: MoldMaterial,
): {
  materialParams: MaterialParam;
  layout: LayoutResult;
  frameFee: number; sliderFee: number; sliderSteel: number; sliderMachining: number; coreSteel: number; cavityProcess: number; runnerFee: number;
  subtotal: number; total: number;
  warnings: string[];
} {
  const mat = MATERIAL_PARAMS[material];
  const { L, W, H } = input;
  const warnings: string[] = [];

  // 1. 分档参数
  const projArea = (L * W) / 100; // 投影面积 cm²
  const cavityMultiplier = projArea <= 50 ? 1 : projArea <= 150 ? 1.5 : projArea <= 400 ? 2 : 3;
  const cavityFeePer = mat.cavityFee * cavityMultiplier;

  const pitch = L <= 40 ? 45 : L <= 100 ? 60 : 80;      // 穴距
  const edge = L <= 40 ? 25 : L <= 100 ? 30 : 40;       // 边距
  const baseThick = L <= 40 ? 25 : L <= 100 ? 30 : 35;  // 底厚

  const frame = findMoldFrame(input.moldFrame);

  // 2. 布局链
  const sideCount = num(input.sideCount);
  const sliderCount: number = sideCount === 0 ? 0 : sideCount <= 2 ? 1 : sideCount <= 4 ? 2 : 4;
  const defaultCavityBySlider = sliderCount === 0 ? 8 : sliderCount <= 2 ? 4 : sliderCount === 3 ? 2 : 1;
  const cavityAreaLimit = Math.floor(frame.cavityArea / ((W + pitch) * (L + pitch) / 100));
  const cavityCount = Math.min(defaultCavityBySlider, cavityAreaLimit);
  const cavityRows = Math.ceil(Math.sqrt(cavityCount));

  const layout: LayoutResult = {
    sliderCount,
    cavityCount,
    cavityRows,
    tonnage: mat.tonnage,
    machineType: mat.machineType,
    runnerSystem: mat.runnerSystem,
  };

  // 3. 成本五块
  // ① 模架费 = 钢板重量 × 市场钢板价 + 2800
  const steelPrice = num(input.steelPrice, DEFAULT_STEEL_PRICE);
  const frameFee = frame.weightKg * steelPrice + FRAME_BASE_FEE;

  // ② 滑块费 = 滑块数 × (滑块钢料 + 滑块加工 + 标准件)
  const sliderVol = (L + 10 + 25) * (W + 20) * (H + 25); // mm³
  const sliderSteel = (sliderVol * STEEL_DENSITY * mat.steelPrice) / 1e9;
  const sliderMachining = (1.5 + cavityCount * 0.9) * mat.hourlyRate;
  const sliderFee = sliderCount * (sliderSteel + sliderMachining + SLIDER_STD_PART);

  // ③ 模芯钢 = (穴排×L+穴距+2×边距) × (穴排×W+穴距+2×边距) × (H+底厚) × 密度 × 钢价
  const coreSteel =
    ((cavityRows * L + pitch + 2 * edge) * (cavityRows * W + pitch + 2 * edge) * (H + baseThick) * STEEL_DENSITY * mat.steelPrice) / 1e9;

  // ④ 型腔加工 = 单穴型腔费 × 穴数
  const cavityProcess = cavityFeePer * cavityCount;

  // ⑤ 浇道费 = (1.5+穴数×0.25) × 机时费率 + 分流锥
  const runnerFee = (1.5 + cavityCount * 0.25) * mat.hourlyRate + RUNNER_CONE;

  const subtotal = frameFee + sliderFee + coreSteel + cavityProcess + runnerFee;
  const total = Math.round(subtotal / DIRECT_RATIO);

  return {
    materialParams: mat,
    layout,
    frameFee, sliderFee, sliderSteel, sliderMachining, coreSteel, cavityProcess, runnerFee,
    subtotal, total,
    warnings,
  };
}

// ---- 主入口 ----
export function calcMoldQuote(rawInput: Partial<MoldQuoteInput>): MoldQuoteResult | { success: false; error: string } {
  const input: MoldQuoteInput = {
    L: num(rawInput.L),
    W: num(rawInput.W),
    H: num(rawInput.H),
    netWeightG: num(rawInput.netWeightG),
    removalVolume: num(rawInput.removalVolume),
    cncCycleMin: num(rawInput.cncCycleMin),
    sideCount: num(rawInput.sideCount),
    material: (rawInput.material as MoldMaterial) || '铝压铸',
    moldFrame: rawInput.moldFrame || recommendMoldFrame(num(rawInput.L), num(rawInput.W)).spec,
    steelPrice: num(rawInput.steelPrice) > 0 ? num(rawInput.steelPrice) : DEFAULT_STEEL_PRICE,
  };

  if (input.L <= 0 || input.W <= 0 || input.H <= 0) {
    return { success: false, error: '请提供产品外廓 L/W/H（mm，必须大于0）' };
  }

  const main = calcForMaterial(input, input.material);
  const frame = findMoldFrame(input.moldFrame);

  const costs: CostItem[] = [
    {
      item: '① 模架费',
      calculation: `${frame.weightKg}kg × ¥${input.steelPrice}/kg + ${FRAME_BASE_FEE}`,
      amount: round2(main.frameFee),
    },
    {
      item: '② 滑块费',
      calculation: `${main.layout.sliderCount}个 × (滑块钢料 ¥${round2(main.sliderSteel).toLocaleString()} + 加工 ¥${round2(main.sliderMachining).toLocaleString()} + 标准件 ¥${SLIDER_STD_PART})`,
      amount: round2(main.sliderFee),
    },
    {
      item: '③ 模芯钢',
      calculation: `(${main.layout.cavityRows}×${input.L}+${(input.L <= 40 ? 45 : input.L <= 100 ? 60 : 80)}+2×${(input.L <= 40 ? 25 : input.L <= 100 ? 30 : 40)})×(${main.layout.cavityRows}×${input.W}+${(input.L <= 40 ? 45 : input.L <= 100 ? 60 : 80)}+2×${(input.L <= 40 ? 25 : input.L <= 100 ? 30 : 40)})×(${input.H}+${(input.L <= 40 ? 25 : input.L <= 100 ? 30 : 35)})×7850×¥${main.materialParams.steelPrice}/10⁹`,
      amount: round2(main.coreSteel),
    },
    {
      item: '④ 型腔加工',
      calculation: `¥${main.materialParams.cavityFee}×${cavityMultiplierLabel(input)} × ${main.layout.cavityCount}穴`,      amount: round2(main.cavityProcess),
    },
    {
      item: '⑤ 浇道费',
      calculation: `(1.5+${main.layout.cavityCount}×0.25)×¥${main.materialParams.hourlyRate} + ${RUNNER_CONE}`,
      amount: round2(main.runnerFee),
    },
  ];

  // 三材质对比（同参数换材质重算）
  const comparisons: ComparisonRow[] = MATERIAL_NAMES.map((m) => {
    const r = calcForMaterial(input, m);
    return {
      material: m,
      steel: r.materialParams.steel,
      steelPrice: r.materialParams.steelPrice,
      tonnage: r.layout.tonnage,
      hourlyRate: r.materialParams.hourlyRate,
      cavityFee: r.materialParams.cavityFee,
      sliderCount: r.layout.sliderCount,
      cavityCount: r.layout.cavityCount,
      frameFee: round2(r.frameFee),
      sliderFee: round2(r.sliderFee),
      coreSteel: round2(r.coreSteel),
      cavityProcess: round2(r.cavityProcess),
      runnerFee: round2(r.runnerFee),
      subtotal: round2(r.subtotal),
      total: r.total,
    };
  });

  return {
    success: true,
    input,
    materialParams: main.materialParams,
    layout: main.layout,
    costs,
    subtotal: round2(main.subtotal),
    total: main.total,
    moldFrame: frame,
    comparisons,
    warnings: main.warnings,
  };
}

function cavityMultiplierLabel(input: MoldQuoteInput): string {
  const projArea = (input.L * input.W) / 100;
  return projArea <= 50 ? '1' : projArea <= 150 ? '1.5' : projArea <= 400 ? '2' : '3';
}
