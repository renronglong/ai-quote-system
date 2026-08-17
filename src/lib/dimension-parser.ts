/**
 * 解析截面尺寸字符串，提取数值数组
 * 支持格式: "50×30×2.0", "50x30x2.0", "50*30*2.0", "50 30 2.0", "Φ30", "W50 H30 T2.0"
 */
export function parseDimensions(dimStr: string | null): number[] {
  if (!dimStr) return [];
  
  // 先尝试提取所有数字（支持小数）
  const nums: number[] = [];
  // 匹配：数字 可选×x*空格 数字
  const matches = dimStr.match(/(\d+\.?\d*)/g);
  if (matches) {
    for (const m of matches) {
      const n = parseFloat(m);
      if (!isNaN(n) && n > 0) nums.push(n);
    }
  }
  return nums;
}

/**
 * 比较两组尺寸的相似度 (0-100)
 * 策略：按位置逐个比较，数值差异百分比越小越相似
 */
export function compareDimensions(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  
  const len = Math.max(a.length, b.length);
  let totalScore = 0;
  let count = 0;
  
  // 逐个位置比较
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va === 0 || vb === 0) continue;
    
    const diff = Math.abs(va - vb) / Math.max(va, vb);
    // 差异 < 5% → 100分, 差异 50% → 0分
    const score = Math.max(0, 100 - diff * 200);
    totalScore += score;
    count++;
  }
  
  return count > 0 ? totalScore / count : 0;
}

/**
 * 比较米重的相似度 (0-100)
 */
export function compareWeight(a: number | null, b: number | null): number {
  if (a == null || b == null) return 0;
  if (a === 0 || b === 0) return 0;
  
  const diff = Math.abs(a - b) / Math.max(a, b);
  // 差异 < 3% → 100分, 差异 30% → 0分
  return Math.max(0, 100 - diff * 333);
}

/**
 * 综合匹配评分
 * 优先级：尺寸(50%) > 米重(30%) > 周长(20%)
 * 如果都没有则降级到图片相似度
 */
export function computeMatchScore(
  inputDims: number[],
  inputWeight: number | null,
  inputPerimeter: number | null,
  productDims: number[],
  productWeight: number | null,
  productPerimeter: number | null,
  imageSimilarity: number
): number {
  const dimScore = compareDimensions(inputDims, productDims);
  const weightScore = compareWeight(inputWeight, productWeight);
  const perimeterScore = compareWeight(inputPerimeter, productPerimeter);
  
  // 有尺寸数据时，用参数匹配
  if (inputDims.length > 0 && productDims.length > 0) {
    return Math.round(dimScore * 0.5 + weightScore * 0.3 + perimeterScore * 0.2);
  }
  
  // 只有米重数据
  if (inputWeight != null && productWeight != null) {
    return Math.round(weightScore * 0.7 + perimeterScore * 0.3);
  }
  
  // 只有周长数据
  if (inputPerimeter != null && productPerimeter != null) {
    return Math.round(perimeterScore * 0.6 + imageSimilarity * 0.4);
  }
  
  // 没有任何参数，降级到纯图片匹配
  return imageSimilarity;
}
