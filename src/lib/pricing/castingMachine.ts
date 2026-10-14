// ============================================================
// 压铸机选型 + 一模穴数（业主提供《压铸机参数表》2026-10-13）
// ------------------------------------------------------------
// 口径：
//   单件投影 A1 = 长×宽 / 100 (cm²)（未扣孔，保守）
//   含浇排单穴投影 = A1 × (1 + k)，k：铝合金 0.5 / 锌合金 0.3（待业主校准）
//   穴数 N = min(投影允许, 射料量允许, 外廓排列允许)，再向下取常用穴数 {1,2,4,6}
//   选机：取最小满足 N ≥ 1 的档位
// ⚠️ 200T / 630T / 1250T 缺投影·外廓·模具数据，暂不参与自动选型（保留射料量供参考）
// ============================================================

export interface CastingMachine {
  ton: string;
  clampKn: number;
  maxProjCm2?: number;         // 最大铸件投影面积(cm²)，undefined=数据待补
  outline?: { w: number; h: number }; // 产品最大外廓(mm)
  moldSize?: string;           // 模具最大外形
  moldThickness?: string;      // 模具最大厚度
  moldWeight?: string;         // 模具参考重量
  shotKg?: [number, number];   // 料筒容量/射料量 kg/次（区间取上限用于穴数）
  plungerMm?: string;          // 锤头直径
  note?: string;
}

export const CASTING_MACHINES: CastingMachine[] = [
  { ton: '160T', clampKn: 1600, maxProjCm2: 400, outline: { w: 200, h: 200 }, moldSize: '450×450', moldThickness: '~500', moldWeight: '3~5t', shotKg: [0.8, 1.8], plungerMm: '60/65/70', note: '小件' },
  { ton: '200T', clampKn: 2000, shotKg: [1.0, 2.2], plungerMm: '60~70', note: '缺投影/外廓数据，暂不参与选型' },
  { ton: '280T', clampKn: 2800, maxProjCm2: 700, outline: { w: 260, h: 270 }, moldSize: '650×650', moldThickness: '~650', moldWeight: '5~8t', shotKg: [1.5, 2.9], plungerMm: '50/60/70' },
  { ton: '400T', clampKn: 4000, maxProjCm2: 1000, outline: { w: 320, h: 310 }, moldSize: '750×750', moldThickness: '~750', moldWeight: '8~12t', shotKg: [2.4, 4.7], plungerMm: '60/70/80', note: '中型件主流' },
  { ton: '500T', clampKn: 5000, maxProjCm2: 1300, outline: { w: 360, h: 360 }, moldSize: '780×780', moldThickness: '~850', moldWeight: '10~15t', shotKg: [4.3, 7.1], plungerMm: '80/90/100' },
  { ton: '630T', clampKn: 6300, shotKg: [4.3, 7.2], plungerMm: '80~110', note: '缺投影/外廓数据，暂不参与选型' },
  { ton: '800T', clampKn: 8000, maxProjCm2: 2000, outline: { w: 450, h: 450 }, moldSize: '1050×1090', moldThickness: '~950', moldWeight: '15~25t', shotKg: [7.2, 11.2], plungerMm: '80/90/100', note: '大件/多腔' },
  { ton: '1000T', clampKn: 10000, maxProjCm2: 2500, outline: { w: 500, h: 500 }, moldSize: '1030×1030', moldThickness: '~1150', moldWeight: '20~30t', shotKg: [10, 18], plungerMm: '90~120' },
  { ton: '1250T', clampKn: 12500, shotKg: [12, 20], note: '估算值；缺投影/外廓数据，暂不参与选型' },
  { ton: '1600T', clampKn: 16000, maxProjCm2: 3500, outline: { w: 600, h: 600 }, moldSize: '~1300×1300', moldThickness: '~1300', moldWeight: '30~45t', shotKg: [16, 28], note: '射料量为估算值' },
  { ton: '2500T', clampKn: 25000, maxProjCm2: 5500, outline: { w: 750, h: 750 }, moldSize: '~1500×1500', moldThickness: '~1500', moldWeight: '45~70t', shotKg: [25, 45], note: '射料量为估算值' },
  { ton: '3000T+', clampKn: 30000, maxProjCm2: 7000, outline: { w: 850, h: 850 }, moldSize: '~1600×1600+', moldThickness: '1600+', moldWeight: '70~120t+', shotKg: [45, 999], note: '一体化大机' },
];

// 浇排系统系数（浇道+溢流+料饼占铸件投影/重量的比例）
// 业主 2026-10-14 定案：统一按 0.5（锌合金暂不单独区分）
export const RUNNER_FACTOR: Record<string, number> = { '铝': 0.5, '锌合金': 0.5 };
export const DEFAULT_RUNNER_FACTOR = 0.5;
// 常用穴数（向下取）；业主 2026-10-14 定案：上限 32 穴
const ALLOWED_CAVITIES = [1, 2, 4, 6, 8, 12, 16, 24, 32];
// 模内排列余量：单边留边 50mm，件间间距 25mm
const EDGE_MM = 50;
const GAP_MM = 25;

/** 单件能否放得下该机台的「产品最大外廓」（允许旋转；这是单件上限，不限制穴数） */
function partFitsOutline(L: number, W: number, outlineW: number, outlineH: number): boolean {
  if (L <= 0 || W <= 0) return false;
  return (L <= outlineW && W <= outlineH) || (W <= outlineW && L <= outlineH);
}

export interface MachineAdvice {
  machine?: CastingMachine;
  cavities: number;          // 推荐穴数（已取常用值）
  maxCavities: number;       // 该机台理论最大穴数
  projPerCavityCm2: number;  // 含浇排单穴投影
  totalProjCm2: number;      // 总投影
  shotPerPieceKg: number;    // 单件含浇排合金重(kg)
  totalShotKg: number;       // 一模总射料(kg)
  reason: string;            // 受限原因
  alternatives: { ton: string; cavities: number }[];
}

export function adviseCastingMachine(params: {
  lengthMm: number;
  widthMm: number;
  volumeCm3?: number;
  density: number;          // g/cm³
  materialCategory: string; // '铝' | '锌合金'
}): MachineAdvice | null {
  const { lengthMm, widthMm, volumeCm3, density, materialCategory } = params;
  if (!(lengthMm > 0) || !(widthMm > 0)) return null;
  const k = RUNNER_FACTOR[materialCategory] ?? DEFAULT_RUNNER_FACTOR;
  const a1 = (lengthMm * widthMm) / 100; // cm²
  const perCavity = a1 * (1 + k);
  const pieceKg = volumeCm3 && volumeCm3 > 0 ? (volumeCm3 * density / 1000) * (1 + k) : 0;

  const usable = CASTING_MACHINES.filter(m => m.maxProjCm2 && m.outline && m.shotKg);
  const results = usable
    .filter(m => partFitsOutline(lengthMm, widthMm, (m.outline as any).w, (m.outline as any).h))
    .map(m => {
      const nProj = Math.floor((m.maxProjCm2 as number) / perCavity);
      const nShot = pieceKg > 0 ? Math.floor((m.shotKg as [number, number])[1] / pieceKg) : 99;
      const raw = Math.min(nProj, nShot);
      const snapped = ALLOWED_CAVITIES.filter(c => c <= raw).pop() ?? 0;
      return { m, raw, snapped, nProj, nShot, nOutline: 1 };
    });

  const hit = results.find(r => r.snapped >= 1);
  if (!hit) {
    return {
      cavities: 0,
      maxCavities: 0,
      projPerCavityCm2: Math.round(perCavity * 10) / 10,
      totalProjCm2: 0,
      shotPerPieceKg: Math.round(pieceKg * 1000) / 1000,
      totalShotKg: 0,
      reason: '超出最大机台能力（单件外廓或投影/射料量不满足），需更大机台或改工艺',
      alternatives: [],
    };
  }
  const limitName = hit.raw === hit.nProj ? '投影面积' : '射料量';
  return {
    machine: hit.m,
    cavities: hit.snapped,
    maxCavities: hit.raw,
    projPerCavityCm2: Math.round(perCavity * 10) / 10,
    totalProjCm2: Math.round(perCavity * hit.snapped * 10) / 10,
    shotPerPieceKg: Math.round(pieceKg * 1000) / 1000,
    totalShotKg: Math.round(pieceKg * hit.snapped * 1000) / 1000,
    reason: `受限：${limitName}（投影${hit.nProj}穴 / 射料${hit.nShot}穴）`,
    alternatives: results.filter(r => r.snapped >= 1).map(r => ({ ton: r.m.ton, cavities: r.snapped })),
  };
}
