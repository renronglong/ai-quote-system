// 挤压模具选型（唯一来源）
// 业主 2026-11-12 定案规则：
//  - 对角线→模具直径：对角 <100 ×1.1+90；<200 ×1.1+120；<300 ×1.1+150；≥300 ×1.1+180；系数均 ×1.1
//  - 模具加工费档：Φ248 起各档按 10% 递增（248×1.1 … 450×1.7），Φ560 由 1.8 调为 2.0
//  - 米重安全升档：件越重需要的模具越大（安全米重上限表）
// 选模归前端：前端用识别出的真实米重调用 selectExtrusionDie 选定模具规格，
// 再把 selected_die_diameter / selected_die_thickness 传给 /api/v1/quote/calculate；
// 后端收到前端选定的模具后跳过自动选型（含米重升档/组合校验升级），只按该规格算费。

export const STANDARD_DIE_SIZES = [139, 158, 178, 198, 218, 248, 278, 297, 338, 358, 397, 450, 560];

export const STANDARD_THICKNESS = [90, 110, 120, 130, 160, 190, 230, 260, 360];

export const SAFE_METER_WEIGHT_LIMITS: Record<string, number> = {
  '139x55': 2.4, '139x65': 3.42, '139x90': 4.42, '139x110': 4.42,
  '158x120': 5.84, '158x130': 5.84,
  '178x130': 6.92,
  '198x130': 8.48, '198x160': 8.48,
  '218x160': 10.74,
  '248x160': 13.76, '248x190': 13.76,
  '278x190': 15.42, '278x230': 15.42,
  '297x190': 19.68, '297x230': 19.68, '297x260': 19.68,
  // Φ338 米重上限 19.4（供应商判定线约 19.7，卡 19.68 会让 19.496 的件漏过仍停 338×190）
  '338x190': 19.4, '338x230': 19.4, '338x260': 19.4,
  '358x230': 29.9, '358x260': 29.9,
  '397x230': 32, '397x260': 32, '397x360': 32,
  // 业主 2026-11-12 新增大模具 ∅450×275 / ∅560×300，安全米重外推：450→45、560→70 kg/m
  '450x275': 45, '560x300': 70,
};

export const MAX_METER_WEIGHT_BY_SIZE: Record<number, number> = {
  139: 4.42, 158: 5.84, 178: 6.92, 198: 8.48, 218: 10.74,
  248: 13.76, 278: 15.42, 297: 19.68, 338: 19.4, 358: 29.9, 397: 32,
  450: 45, 560: 70,
};

export const PROCESSING_FEE_TIER_FACTOR: Record<number, number> = {
  248: 1.1, 278: 1.2, 297: 1.3, 338: 1.4, 358: 1.5, 397: 1.6, 450: 1.7, 560: 2.0,
};

export interface DieSelectionInput {
  width_mm?: number;
  height_mm?: number;
  wall_thickness_mm?: number;
  standard_category?: string;
  outer_diameter_mm?: number;
  diameter_mm?: number;
  hex_flat_mm?: number;
  perimeter_mm?: number;        // 总周长(mm，识图返回已含内孔)
  inner_perimeter_mm?: number;  // 内孔周长之和
  inner_diameter_mm?: number;   // 圆管/六角管内径（用于标准件几何周长计算）
  num_dies?: number;            // 公头数（0=平模，≥1=分流模）
  num_cavities?: number;        // 兼容前端字段名
  die_type?: 'flat' | 'split';
  meter_weight_kg_per_m?: number;
  cross_section_area_mm2?: number;
}

export interface DieSelectionResult {
  dieDiameter: number;
  dieThickness: number;
  dieTypeKey: 'flat' | 'split';
  finalPerimeter: number;
  warnings: string[];
}

/** 标准件几何周长（外周长/内孔周长），用于模具费兜底。字段槽位与后端一致。 */
export function calcStandardPerimeters(dims: DieSelectionInput): { outer: number; inner: number } | null {
  const cat = dims.standard_category;
  if (!cat) return null;
  const w = dims.width_mm || 0;
  const h = dims.height_mm || 0;
  const t = dims.wall_thickness_mm || 0;
  const d = dims.diameter_mm || 0;
  const sHex = dims.hex_flat_mm || 0;
  const od = dims.outer_diameter_mm || 0;
  const id = dims.inner_diameter_mm || 0;

  switch (cat) {
    case '铝圆棒': return d > 0 ? { outer: Math.PI * d, inner: 0 } : null;
    case '铝方/扁棒': return (w > 0 && h > 0) ? { outer: 2 * (w + h), inner: 0 } : null;
    case '铝六角棒': return sHex > 0 ? { outer: 6 * sHex / Math.sqrt(3), inner: 0 } : null;
    case '角铝': return (w > 0 && h > 0) ? { outer: 2 * (w + h), inner: 0 } : null;
    case '铝圆管': {
      const o = od || d;
      if (!(o > 0)) return null;
      return { outer: Math.PI * o, inner: id > 0 ? Math.PI * id : 0 };
    }
    case '铝六角管': {
      if (!(sHex > 0)) return null;
      return { outer: 6 * sHex / Math.sqrt(3), inner: id > 0 ? Math.PI * id : 0 };
    }
    case '铝方管': {
      if (!(w > 0 && h > 0 && t > 0)) return null;
      const innerW = w - 2 * t;
      const innerH = h - 2 * t;
      return { outer: 2 * (w + h), inner: (innerW > 0 && innerH > 0) ? 2 * (innerW + innerH) : 0 };
    }
    default: return null;
  }
}

/**
 * 选模：输入截面尺寸 + 真实米重，输出模具直径/厚度/类型 + 提示。
 * 与后端 calculate/route.ts 步骤1-3 + 2.5/3.5 规则保持一致（后端收到前端选定值后会跳过这部分）。
 */
export function selectExtrusionDie(dims: DieSelectionInput): DieSelectionResult {
  const warnings: string[] = [];
  const W = dims.width_mm || 50;
  const H_dim = dims.height_mm || 25;
  const cat = dims.standard_category;

  // 步骤1：对角线 → 模具直径
  let diagonal: number;
  if (cat === '铝圆管') diagonal = dims.outer_diameter_mm || W;
  else if (cat === '铝圆棒') diagonal = dims.diameter_mm || W;
  else if (cat === '铝六角棒' || cat === '铝六角管') diagonal = (dims.hex_flat_mm || W) / Math.sin(Math.PI / 3);
  else diagonal = Math.sqrt(W * W + H_dim * H_dim); // 方/扁棒、角铝、方管、异型材：矩形对角线

  let phiDiag: number;
  if (diagonal < 100) phiDiag = diagonal * 1.1 + 90;
  else if (diagonal < 200) phiDiag = diagonal * 1.1 + 120;
  else if (diagonal < 300) phiDiag = diagonal * 1.1 + 150;
  else phiDiag = diagonal * 1.1 + 180;

  let dieDiameter = STANDARD_DIE_SIZES.find(s => s >= phiDiag) || STANDARD_DIE_SIZES[STANDARD_DIE_SIZES.length - 1];
  if (phiDiag <= 140) dieDiameter = 139;

  // 步骤2：模具类型（平模/分流模）由后端（识图）提供，前端只认 dims.die_type，绝不自行按类别推断
  // 缺失时仅按公头数兜底（num_dies>=1 = 分流模）；该兜底不应在正常识别流程触发
  const numCavities = dims.num_dies ?? dims.num_cavities ?? 1;
  let dieTypeKey: 'flat' | 'split';
  if (dims.die_type) dieTypeKey = dims.die_type;
  else dieTypeKey = numCavities <= 1 ? 'flat' : 'split';

  const isFlatDie = dieTypeKey === 'flat';
  const stdPerimeters = dims.standard_category ? calcStandardPerimeters(dims) : null;
  let dieThickness: number;
  let finalPerimeter = 0;

  if (isFlatDie) {
    dieThickness = 60; // 平模固定H=60
    if (dims.perimeter_mm && dims.perimeter_mm > 0) finalPerimeter = dims.perimeter_mm;
    else if (stdPerimeters?.outer) finalPerimeter = stdPerimeters.outer;
    else finalPerimeter = 2 * (W + H_dim);
    const flatMaxPerimeter = 2 * (W + H_dim) * 5;
    if (finalPerimeter > flatMaxPerimeter) {
      warnings.push(`周长${Math.round(finalPerimeter)}mm明显超出${W}×${H_dim}截面合理范围（上限约${Math.round(flatMaxPerimeter)}mm），已按矩形轮廓${Math.round(2 * (W + H_dim))}mm计算模具费，请核对图纸标注`);
      finalPerimeter = 2 * (W + H_dim);
    }
  } else {
    const straightPerimeter = 2 * (W + H_dim);
    const actualPerimeter = dims.perimeter_mm || stdPerimeters?.outer || straightPerimeter;
    finalPerimeter = actualPerimeter;
    const complexityRatio = actualPerimeter / straightPerimeter;
    const estimatedH = (W + H_dim) / 5;
    if (complexityRatio < 1.5) dieThickness = STANDARD_THICKNESS.find(t => t >= estimatedH) || 90;
    else {
      const idx = STANDARD_THICKNESS.findIndex(t => t >= estimatedH);
      dieThickness = idx >= 0 && idx < STANDARD_THICKNESS.length - 1
        ? STANDARD_THICKNESS[idx + 1]
        : (STANDARD_THICKNESS[idx] || 130);
    }
  }

  // 步骤2.5：校验 Φ×H 组合是否实际存在于安全表
  const availableThicknessBySize: Record<number, number[]> = {};
  for (const key of Object.keys(SAFE_METER_WEIGHT_LIMITS)) {
    const parts = key.split('x');
    const sz = parseInt(parts[0]);
    const th = parseInt(parts[1]);
    if (!availableThicknessBySize[sz]) availableThicknessBySize[sz] = [];
    if (!availableThicknessBySize[sz].includes(th)) availableThicknessBySize[sz].push(th);
  }
  const checkKey = `${dieDiameter}x${dieThickness}`;
  if (SAFE_METER_WEIGHT_LIMITS[checkKey] === undefined) {
    const available = (availableThicknessBySize[dieDiameter] || []).sort((a, b) => a - b);
    if (available.length > 0) {
      const larger = available.find(t => t >= dieThickness);
      const newH = larger !== undefined ? larger : available[available.length - 1];
      warnings.push(`模具规格 Φ${dieDiameter}×${dieThickness} 不可用，自动升级到 Φ${dieDiameter}×${newH}`);
      dieThickness = newH;
    }
  }

  // 步骤3：米重负载校验（使用调用方传入的真实米重；缺失才兜底估算）
  const meterWeightKgPerM = dims.meter_weight_kg_per_m
    ? dims.meter_weight_kg_per_m
    : (dims.cross_section_area_mm2
      ? dims.cross_section_area_mm2 * 2.7 / 1000
      : (W * H_dim * 2.7 / 1000));
  const limitKey = `${dieDiameter}x${dieThickness}`;
  let safeLimit = SAFE_METER_WEIGHT_LIMITS[limitKey];
  if (safeLimit === undefined) safeLimit = MAX_METER_WEIGHT_BY_SIZE[dieDiameter] || 13.33;
  while (meterWeightKgPerM > safeLimit) {
    const currentIdx = STANDARD_DIE_SIZES.indexOf(dieDiameter);
    if (currentIdx < STANDARD_DIE_SIZES.length - 1) {
      dieDiameter = STANDARD_DIE_SIZES[currentIdx + 1];
      const newKey = `${dieDiameter}x${dieThickness}`;
      safeLimit = SAFE_METER_WEIGHT_LIMITS[newKey] || MAX_METER_WEIGHT_BY_SIZE[dieDiameter] || 13.33;
    } else break;
  }

  // 步骤3.5：步骤3升级直径后，重新校验 Φ×H 组合
  const checkKey2 = `${dieDiameter}x${dieThickness}`;
  if (SAFE_METER_WEIGHT_LIMITS[checkKey2] === undefined) {
    const available2 = (availableThicknessBySize[dieDiameter] || []).sort((a, b) => a - b);
    if (available2.length > 0) {
      const larger2 = available2.find((t: number) => t >= dieThickness);
      const newH2 = larger2 !== undefined ? larger2 : available2[available2.length - 1];
      warnings.push(`模具规格 Φ${dieDiameter}×${dieThickness} 不可用，自动升级到 Φ${dieDiameter}×${newH2}`);
      dieThickness = newH2;
    }
  }

  return { dieDiameter, dieThickness, dieTypeKey, finalPerimeter, warnings };
}
