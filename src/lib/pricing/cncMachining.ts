/**
 * CNC 机加计价 —— 节拍计算（业主 2026-10-15 定案口径）
 *
 * 数据流：后端 A 给几何量（刀路 / 空行程 air_travel_mm / 装夹次数 blank_model.clamp_count /
 *         净体积 / 毛坯）→ 前端算节拍 → 价格 = 节拍 × 机时费率/60 + 材料费×10%（附加保留）。
 * 没有刀路时退回手填分钟（原口径），老数据不受影响。
 *
 * 定案口径：
 * - 材料费按【毛坯】体积算（挤出主链路的米重×长度本来就是毛坯口径，主引擎负责）
 * - CNC 附加 = 材料费 × 10%，保留
 * - 投影体积由【前端】算：挤压件 = 外廓长×宽×高（包围盒），非挤压件 = 净体积
 * - 余量系数：挤压件 = 0（表面挤压成形不做），非挤压件 = 1
 * - 装夹时间 = (0.3 + 投影体积 × 8E-8) × 装夹次数（0.3 为固定基准，编程不计）
 */

export const CNC_DEFAULTS = {
  feedVf: 720,            // 进给速度 mm/min（B 填，默认按交付卡 08-27）
  rapidG0: 6000,          // 快速进给 G0 mm/min（B 填）
  machineRatePerHour: 60, // 机时费率 元/h（B 填）
} as const;

/** 投影体积：前端自算（挤压件 = 外廓包围盒，非挤压件 = 净体积） */
export function calcProjVolumeMm3(opts: {
  isExtrusion?: boolean;
  outerLMm?: number;
  outerWMm?: number;
  outerHMm?: number;
  netVolumeMm3?: number;
}): number {
  if (opts.isExtrusion) {
    const box = (opts.outerLMm || 0) * (opts.outerWMm || 0) * (opts.outerHMm || 0);
    if (box > 0) return box;
  }
  return opts.netVolumeMm3 || 0;
}

/** 余量系数：挤压件 0（表面挤压成形不做），非挤压件 1 */
export function calcAllowance(isExtrusion?: boolean): number {
  return isExtrusion ? 0 : 1;
}

export interface CncCycleInput {
  toolPathMm?: number;    // 刀路合计（A 给）
  airTravelMm?: number;   // 空行程（A 给 air_travel_mm）
  clampCount?: number;    // 装夹次数（A 给 blank_model.clamp_count）
  projVolumeMm3?: number; // 投影体积（前端 calcProjVolumeMm3 算出）
  manualMinutes?: number; // 手填分钟（无刀路时退回）
  feedVf?: number;        // 进给 mm/min
  rapidG0?: number;       // G0 mm/min
}

export interface CncCycleResult {
  source: 'auto' | 'manual' | 'none';
  cuttingMin: number;
  airMin: number;
  clampMin: number;
  cycleMin: number; // 节拍 min/件
}

/**
 * CNC 节拍：
 *   切削时间 = 刀路 ÷ 进给Vf
 *   空行程时间 = 空行程 ÷ G0
 *   装夹时间 = (0.3 + 投影体积 × 8E-8) × 装夹次数
 *   节拍 = 切削 + 空行程 + 装夹
 * A 给了刀路 → 全自动；否则退回手填分钟（manual）。
 */
export function calcCncCycleMin(i: CncCycleInput): CncCycleResult {
  const vf = i.feedVf || CNC_DEFAULTS.feedVf;
  const g0 = i.rapidG0 || CNC_DEFAULTS.rapidG0;
  if ((i.toolPathMm || 0) > 0) {
    const cuttingMin = (i.toolPathMm || 0) / vf;
    const airMin = (i.airTravelMm || 0) / g0;
    const clampMin = (0.3 + (i.projVolumeMm3 || 0) * 8e-8) * (i.clampCount || 1);
    return {
      source: 'auto',
      cuttingMin,
      airMin,
      clampMin,
      cycleMin: cuttingMin + airMin + clampMin,
    };
  }
  if ((i.manualMinutes || 0) > 0) {
    return { source: 'manual', cuttingMin: 0, airMin: 0, clampMin: 0, cycleMin: i.manualMinutes || 0 };
  }
  return { source: 'none', cuttingMin: 0, airMin: 0, clampMin: 0, cycleMin: 0 };
}
