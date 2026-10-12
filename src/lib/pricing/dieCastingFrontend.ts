// ============================================================
// 压铸 / 锌合金 前端算价（价格归前端）
// ------------------------------------------------------------
// 分工（业主裁定 2026-10-12）：
//   后端只回纯几何/特征（volume_cm3、surface_area_cm2、加工特征数量）；
//   材料费 / 表面处理费 / 二次加工费 / 模具费 由前端按下方配置单价计算。
// 本模块为「门控」实现：仅当后端返回原始几何字段（volume_cm3）时激活，
// 否则返回 null，QuoteForm 继续走原后端算价路径（零回归）。
// ⚠️ 下列单价/系数均为「待业主校准」的默认值，集中放在 DC_CONFIG，便于一处调参。
// ============================================================

export interface DCFeatures {
  holeCount?: number;   // 钻孔 次数
  tapCount?: number;    // 攻牙 次数
  cncMinutes?: number;  // CNC 分钟
  polishCount?: number; // 抛光 件数
  deburrCount?: number; // 除披锋 件数
}

export interface DCRawInput {
  materialCategory: '压铸铝' | '锌合金';
  volumeCm3?: number;          // 后端回的纯几何（分工#1）
  surfaceAreaCm2?: number;     // 后端回的表面积/投影面积（分工#2）
  netWeightKg?: number;        // 用户表单填的净重（优先于体积×密度）
  features?: DCFeatures;       // 后端回的加工特征数量（分工#3）
  productSize?: { l: number; w: number; h: number }; // cm，用于模具费估算（分工#5）
  quantity: number;
  surfaceTreatments?: string[]; // ['喷涂'] / ['电镀']
}

// ---- 单价配置（待业主校准）----
export const DC_CONFIG = {
  // 密度 g/cm³
  density: { '压铸铝': 2.7, '锌合金': 6.6 } as Record<string, number>,
  // 材料单价 元/kg（ADC12≈22.35 取自原后端；锌合金占位待校准）
  materialPricePerKg: { '压铸铝': 22.35, '锌合金': 20.0 } as Record<string, number>,
  // 压铸加工费 元/kg
  castingRatePerKg: 4.0,
  // 包装 / 运输 元/kg
  packagingRatePerKg: 0.5,
  transportRatePerKg: 0.5,
  // 表面处理：按重量计费（元/kg）；后端若回 surfaceAreaCm2 可改面积计费
  surface: {
    '喷涂': { perKg: 2.0 },
    '电镀': { perKg: 3.0 },
  } as Record<string, { perKg: number }>,
  // 二次加工工序单价（待校准）
  secondary: {
    '钻孔': 0.3,   // 元/次
    '攻牙': 0.5,   // 元/次
    'CNC加工': 1.0, // 元/分钟
    '抛光': 0.5,   // 元/件
    '除披锋': 0.3, // 元/件
  } as Record<string, number>,
  // 模具费估算（分工#5：按产品尺寸，无穴数输入时按最大外廓）
  mold: {
    base: 8000,
    perMaxDimCm: 60, // 元/cm（max(L,W)）
  },
  // 利润 / 税（待校准）
  margin: 1.10,
  tax: 1.13,
};

export interface DCFrontendResult {
  weightKg: number;
  material_cost: number;
  processing_cost: number;     // 压铸加工费
  secondary_operations_cost: number;
  surface_treatment_cost: number;
  packaging_cost: number;
  transport_cost: number;
  mold_cost: number;
  unit_cost: number;
  unit_price_ex_tax: number;
  unit_price_in_tax: number;
  unit_price: number;
  total_price: number;
  weight_per_piece_kg: number;
  min_order_qty: number;
  breakdown: Record<string, { formula: string; detail: string }>;
  notes: string[];
}

function classifyMaterial(cat?: string): '压铸铝' | '锌合金' {
  if (cat && cat.includes('锌')) return '锌合金';
  return '压铸铝';
}

/** 触发条件：后端回原始几何字段（volume_cm3）。返回 null 表示走原后端路径。 */
export function tryFrontendDieCasting(
  data: any,
  payload: any,
): DCFrontendResult | null {
  const volume =
    (data && (data.volume_cm3 ?? data.geometry?.volume_cm3));
  if (volume == null) return null; // 后端尚未回原始几何 → 门控不激活

  const matCatRaw: string =
    data?.material_category ?? data?.material?.category ?? payload?.material?.category ?? '';
  const materialCategory = classifyMaterial(matCatRaw);

  // 重量：优先用用户表单净重，否则 体积×密度
  let weightKg = payload?.weight_per_piece_kg ?? data?.weight_per_piece_kg;
  if (!weightKg || weightKg <= 0) {
    const density = DC_CONFIG.density[materialCategory] ?? 2.7;
    weightKg = (Number(volume) * density) / 1000; // cm³ × g/cm³ = g → kg
  }

  // 材料费
  const matPrice = DC_CONFIG.materialPricePerKg[materialCategory] ?? 22.35;
  const materialCost = round2(weightKg * matPrice);

  // 压铸加工费
  const castingCost = round2(weightKg * DC_CONFIG.castingRatePerKg);

  // 表面处理费
  let surfaceCost = 0;
  const stArr = normSurfaceList(data?.surface_treatment)
    .concat(normSurfaceList(payload?.surface_treatment))
    .filter((v, i, a) => a.indexOf(v) === i); // 去重
  const stFormulas: string[] = [];
  for (const st of stArr) {
    const cfg = DC_CONFIG.surface[String(st)];
    if (cfg) {
      const c = round2(weightKg * cfg.perKg);
      surfaceCost += c;
      stFormulas.push(`${st} ${weightKg.toFixed(3)}kg×${cfg.perKg}=${c}`);
    }
  }

  // 二次加工费（后端回特征数量）
  let secondaryCost = 0;
  const feats: DCFeatures =
    data?.features ??
    parseFeaturesFromProcess(data?.process ?? payload?.process);
  const secParts: string[] = [];
  const map: [keyof DCFeatures, string][] = [
    ['holeCount', '钻孔'], ['tapCount', '攻牙'],
    ['cncMinutes', 'CNC加工'], ['polishCount', '抛光'], ['deburrCount', '除披锋'],
  ];
  for (const [key, label] of map) {
    const n = Number(feats?.[key] ?? 0);
    const rate = DC_CONFIG.secondary[label];
    if (n > 0 && rate != null) {
      const c = round2(n * rate);
      secondaryCost += c;
      const unit = label === 'CNC加工' ? '分钟' : (label === '抛光' || label === '除披锋') ? '件' : '次';
      secParts.push(`${label}×${n}${unit}×${rate}=${c}`);
    }
  }

  // 包装 / 运输
  const packagingCost = round2(weightKg * DC_CONFIG.packagingRatePerKg);
  const transportCost = round2(weightKg * DC_CONFIG.transportRatePerKg);

  // 模具费（分工#5 前端算；无尺寸时回退后端原值）
  let moldCost = 0;
  const size = data?.dimensions ?? payload?.dimensions;
  if (size && (size.l || size.length) && (size.w || size.width)) {
    const L = Number(size.l ?? size.length ?? 0);
    const W = Number(size.w ?? size.width ?? 0);
    const maxDim = Math.max(L, W);
    moldCost = round2(DC_CONFIG.mold.base + maxDim * DC_CONFIG.mold.perMaxDimCm);
  } else if (data?.mold_cost) {
    moldCost = round2(data.mold_cost);
  }

  // 单件成本（模具费一次性，不计入单件成本）
  const unitCost = round2(
    materialCost + castingCost + surfaceCost + secondaryCost + packagingCost + transportCost,
  );
  const unitPriceExTax = round2(unitCost * DC_CONFIG.margin);
  const unitPriceInTax = round2(unitPriceExTax * DC_CONFIG.tax);
  const qty = Number(payload?.quantity ?? data?.quantity ?? 1) || 1;
  const totalPrice = round2(unitPriceExTax * qty);

  // 起订量（分工#4：后端可不回，前端自算）
  let minOrderQty = data?.min_order_qty ?? 0;
  const minOrderWeightKg = data?.min_order_weight_kg ?? 0;
  if (!minOrderQty && minOrderWeightKg > 0 && weightKg > 0) {
    minOrderQty = Math.ceil(minOrderWeightKg / weightKg);
  }

  const breakdown: Record<string, { formula: string; detail: string }> = {
    material_cost: {
      formula: `体积×密度×材料单价（${materialCategory}）`,
      detail: `${Number(volume).toFixed(1)}cm³×${DC_CONFIG.density[materialCategory]}×${matPrice}元/kg = ${materialCost}元`,
    },
    processing_cost: {
      formula: `重量×压铸加工费率`,
      detail: `${weightKg.toFixed(3)}kg×${DC_CONFIG.castingRatePerKg} = ${castingCost}元`,
    },
    surface_treatment_cost: {
      formula: stFormulas.length ? `表面处理按重量计费` : `无表面处理`,
      detail: stFormulas.length ? stFormulas.join('；') : '0',
    },
    secondary_operations_cost: {
      formula: secParts.length ? `二次加工各工序×单价` : `无二次加工`,
      detail: secParts.length ? secParts.join('；') : '0',
    },
    packaging_cost: {
      formula: `重量×包装费率`,
      detail: `${weightKg.toFixed(3)}kg×${DC_CONFIG.packagingRatePerKg} = ${packagingCost}元`,
    },
    transport_cost: {
      formula: `重量×运输费率`,
      detail: `${weightKg.toFixed(3)}kg×${DC_CONFIG.transportRatePerKg} = ${transportCost}元`,
    },
  };

  const notes: string[] = [
    `压铸前端算价（价格归前端）· ${materialCategory}`,
    `模具费(一次性): ${moldCost}元${moldCost ? '' : '（无尺寸，未估算）'}`,
  ];
  if (minOrderWeightKg > 0) {
    notes.push(`最低起订重量 ${minOrderWeightKg}kg → 约 ${minOrderQty} 件`);
  }

  return {
    weightKg: round3(weightKg),
    material_cost: materialCost,
    processing_cost: castingCost,
    secondary_operations_cost: secondaryCost,
    surface_treatment_cost: surfaceCost,
    packaging_cost: packagingCost,
    transport_cost: transportCost,
    mold_cost: moldCost,
    unit_cost: unitCost,
    unit_price_ex_tax: unitPriceExTax,
    unit_price_in_tax: unitPriceInTax,
    unit_price: unitPriceInTax,
    total_price: totalPrice,
    weight_per_piece_kg: round3(weightKg),
    min_order_qty: minOrderQty,
    breakdown,
    notes,
  };
}

function normSurfaceList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') return [v];
  if (typeof v === 'object' && v.type) return [String(v.type)];
  return [];
}

function parseFeaturesFromProcess(proc: any): DCFeatures {
  const out: DCFeatures = {};
  const ops = proc?.secondary_operations ?? [];
  for (const op of ops) {
    const name = String(op?.name ?? '');
    const n = Number(op?.count ?? op?.value ?? 0);
    if (name.includes('钻孔')) out.holeCount = (out.holeCount ?? 0) + n;
    else if (name.includes('攻牙') || name.includes('牙')) out.tapCount = (out.tapCount ?? 0) + n;
    else if (name.includes('CNC')) out.cncMinutes = (out.cncMinutes ?? 0) + n;
    else if (name.includes('抛光')) out.polishCount = (out.polishCount ?? 0) + n;
    else if (name.includes('披锋')) out.deburrCount = (out.deburrCount ?? 0) + n;
  }
  return out;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }
