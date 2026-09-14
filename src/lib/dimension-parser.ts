/**
 * 截面尺寸类型
 * rect = 矩形（宽×高），circle = 圆形（ø直径）
 */
export type SectionType = 'rect' | 'circle';

export interface SectionDimension {
  type: SectionType;
  width: number;         // 矩形=宽，圆形=直径
  height: number | null; // 矩形=高，圆形=null
}

/**
 * 解析截面尺寸字符串
 * 支持格式：
 *   矩形：50×30, 50*30, 50x30, W50 H30, 宽50*高30, 50 30
 *   圆形：ø30, Φ30, ∅30, φ30, Ø30, D30, 直径30
 */
export function parseDimensions(dimStr: string | null): SectionDimension | null {
  if (!dimStr) return null;
  const s = dimStr.trim();
  if (!s) return null;

  // 检测圆形：ø/Φ/∅/φ/Ø/D/直径 + 数字
  const circlePatterns = [
    /[øΦ∅φØ]\s*(\d+\.?\d*)/,
    /D\s*(\d+\.?\d*)/i,
    /直径\s*[：:=]?\s*(\d+\.?\d*)/,
  ];
  for (const pat of circlePatterns) {
    const m = s.match(pat);
    if (m) {
      const d = parseFloat(m[1]);
      if (!isNaN(d) && d > 0) {
        return { type: 'circle', width: d, height: null };
      }
    }
  }

  // 检测矩形：提取前两个数字作为宽和高
  const nums: number[] = [];
  const numMatches = s.match(/(\d+\.?\d*)/g);
  if (numMatches) {
    for (const m of numMatches) {
      const n = parseFloat(m);
      if (!isNaN(n) && n > 0) nums.push(n);
    }
  }

  if (nums.length >= 2) {
    return { type: 'rect', width: nums[0], height: nums[1] };
  }

  // 只有一个数字 + 有直径符号 → 圆形
  if (nums.length === 1 && /[øΦ∅φØdD]/.test(s)) {
    return { type: 'circle', width: nums[0], height: null };
  }

  return null;
}

/**
 * 比较两个截面尺寸的相似度 (0-100)
 * 类型匹配时逐维比较，类型不同时取最优维并打折
 */
export function compareDimensions(
  a: SectionDimension | null,
  b: SectionDimension | null
): number {
  if (!a || !b) return 0;

  const pctScore = (va: number, vb: number) => {
    if (va <= 0 || vb <= 0) return 0;
    const diff = Math.abs(va - vb) / Math.max(va, vb);
    return Math.max(0, 100 - diff * 200); // 差异<5%→100, 差异50%→0
  };

  // 两个矩形：宽比宽、高比高，取平均
  if (a.type === 'rect' && b.type === 'rect') {
    const wScore = pctScore(a.width, b.width);
    const hScore = (a.height && b.height) ? pctScore(a.height, b.height) : 50;
    return (a.height && b.height) ? (wScore + hScore) / 2 : wScore;
  }

  // 两个圆形：直径比直径
  if (a.type === 'circle' && b.type === 'circle') {
    return pctScore(a.width, b.width);
  }

  // 类型不匹配：矩形 vs 圆形 → 惩罚
  const circle = a.type === 'circle' ? a : b;
  const rect = a.type === 'rect' ? a : b;
  const sW = pctScore(rect.width, circle.width);
  const sH = rect.height ? pctScore(rect.height, circle.width) : 0;
  return Math.max(sW, sH) * 0.7; // 类型不同打7折
}

/**
 * 比较米重的相似度 (0-100)
 */
export function compareWeight(a: number | null, b: number | null): number {
  if (a == null || b == null) return 0;
  if (a === 0 || b === 0) return 0;
  const diff = Math.abs(a - b) / Math.max(a, b);
  return Math.max(0, 100 - diff * 333); // 差异<3%→100, 差异30%→0
}

/**
 * 综合匹配评分
 * 优先级：截面尺寸(50%) > 米重(30%) > 周长(20%)
 * 无参数时降级到图片相似度
 */
export function computeMatchScore(
  inputDim: SectionDimension | null,
  inputWeight: number | null,
  inputPerimeter: number | null,
  productDim: SectionDimension | null,
  productWeight: number | null,
  productPerimeter: number | null,
  imageSimilarity: number
): number {
  const dimScore = compareDimensions(inputDim, productDim);
  const weightScore = compareWeight(inputWeight, productWeight);
  const perimeterScore = compareWeight(inputPerimeter, productPerimeter);

  // 有截面尺寸 → 加权
  if (inputDim && productDim) {
    return Math.round(dimScore * 0.5 + weightScore * 0.3 + perimeterScore * 0.2);
  }

  // 只有米重
  if (inputWeight != null && productWeight != null) {
    return Math.round(weightScore * 0.7 + perimeterScore * 0.3);
  }

  // 只有周长
  if (inputPerimeter != null && productPerimeter != null) {
    return Math.round(perimeterScore * 0.6 + imageSimilarity * 0.4);
  }

  // 纯图片匹配
  return imageSimilarity;
}
