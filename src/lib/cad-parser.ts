/**
 * CAD 文件解析器（客户端）
 * 支持 DXF / STEP / IGES 文件，提取截面参数用于铝型材报价
 */

export interface CadDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface CadPartInfo {
  name: string;
  crossSectionArea: number;
  weightPerMeter: number;
}

export interface CadParseResult {
  success: boolean;
  format: 'dxf' | 'step' | 'iges';
  weightPerMeter: number;
  width: number;
  height: number;
  length: number;
  crossSectionArea: number;
  volume?: number;
  meshCount?: number;
  entityNames?: string[];
  parts?: CadPartInfo[];
  error?: string;
  diagnostics?: CadDiagnostic[];
}

const ALUMINUM_DENSITY = 2.7e-6; // kg/mm³ (铝合金 2700 kg/m³)

/**
 * 解析 DXF 文件
 */
export async function parseDxfFile(file: File): Promise<CadParseResult> {
  const diagnostics: CadDiagnostic[] = [];
  try {
    const text = await file.text();
    diagnostics.push({ severity: 'info', message: `文件大小: ${(file.size / 1024).toFixed(1)} KB` });

    if (!text || text.length < 10) {
      return {
        success: false,
        format: 'dxf',
        weightPerMeter: 0,
        width: 0,
        height: 0,
        length: 0,
        crossSectionArea: 0,
        error: 'DXF 文件内容为空或过小',
        diagnostics,
      };
    }

    // 提取所有坐标点
    const coords = extractDxfCoordinates(text);
    diagnostics.push({ severity: 'info', message: `提取到 ${coords.length} 个坐标点` });

    if (coords.length < 2) {
      return {
        success: false,
        format: 'dxf',
        weightPerMeter: 0,
        width: 0,
        height: 0,
        length: 0,
        crossSectionArea: 0,
        error: 'DXF 文件中未找到有效几何图形',
        diagnostics,
      };
    }

    // 计算包围盒
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of coords) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const width = Math.round((maxX - minX) * 100) / 100;
    const height = Math.round((maxY - minY) * 100) / 100;
    const length = Math.round((maxZ - minZ) * 100) / 100;

    diagnostics.push({ severity: 'info', message: `包围盒: ${width} x ${height} x ${length} mm` });

    // 估算截面积（XY 平面投影）
    const crossSectionArea = estimateCrossSectionArea(text, coords, width, height);

    // 计算米重
    const weightPerMeter = Math.round((crossSectionArea * ALUMINUM_DENSITY * 1000) * 100) / 100;

    // 提取实体名称
    const entityNames = extractDxfEntityNames(text);

    return {
      success: true,
      format: 'dxf',
      weightPerMeter,
      width,
      height,
      length: length || 1000, // 型材默认长度 1000mm
      crossSectionArea: Math.round(crossSectionArea * 100) / 100,
      volume: Math.round(crossSectionArea * (length || 1000) * 100) / 100,
      meshCount: entityNames.length || 1,
      entityNames: entityNames.length > 0 ? entityNames : undefined,
      diagnostics,
    };
  } catch (err) {
    diagnostics.push({ severity: 'error', message: `解析异常: ${err instanceof Error ? err.message : String(err)}` });
    return {
      success: false,
      format: 'dxf',
      weightPerMeter: 0,
      width: 0,
      height: 0,
      length: 0,
      crossSectionArea: 0,
      error: `DXF 解析失败: ${err instanceof Error ? err.message : String(err)}`,
      diagnostics,
    };
  }
}

/**
 * 解析 STEP 或 IGES 文件
 */
export async function parseStepOrIgesFile(file: File, format: 'step' | 'iges'): Promise<CadParseResult> {
  const diagnostics: CadDiagnostic[] = [];
  try {
    const text = await file.text();
    diagnostics.push({ severity: 'info', message: `文件大小: ${(file.size / 1024).toFixed(1)} KB` });

    if (!text || text.length < 10) {
      return {
        success: false,
        format,
        weightPerMeter: 0,
        width: 0,
        height: 0,
        length: 0,
        crossSectionArea: 0,
        error: `${format.toUpperCase()} 文件内容为空或过小`,
        diagnostics,
      };
    }

    // STEP/IGES 文件中提取坐标
    const coords = extractStepIgesCoordinates(text, format);
    diagnostics.push({ severity: 'info', message: `提取到 ${coords.length} 个坐标点` });

    if (coords.length < 2) {
      return {
        success: false,
        format,
        weightPerMeter: 0,
        width: 0,
        height: 0,
        length: 0,
        crossSectionArea: 0,
        error: `${format.toUpperCase()} 文件中未找到有效几何数据`,
        diagnostics,
      };
    }

    // 计算包围盒
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of coords) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const dims = [maxX - minX, maxY - minY, maxZ - minZ].sort((a, b) => a - b);
    // 最短维度视为截面方向，最长视为挤压方向
    const crossW = Math.round(dims[0] * 100) / 100;
    const crossH = Math.round(dims[1] * 100) / 100;
    const length = Math.round(dims[2] * 100) / 100;

    // 截面积估算（椭圆形截面近似）
    const crossSectionArea = Math.round(crossW * crossH * 0.8 * 100) / 100; // 0.8 填充系数
    const weightPerMeter = Math.round((crossSectionArea * ALUMINUM_DENSITY * 1000) * 100) / 100;

    // 提取实体名
    const entityNames = extractStepEntityNames(text);

    return {
      success: true,
      format,
      weightPerMeter,
      width: crossW,
      height: crossH,
      length: length || 1000,
      crossSectionArea,
      volume: Math.round(crossSectionArea * (length || 1000) * 100) / 100,
      meshCount: entityNames.length || 1,
      entityNames: entityNames.length > 0 ? entityNames : undefined,
      diagnostics,
    };
  } catch (err) {
    diagnostics.push({ severity: 'error', message: `解析异常: ${err instanceof Error ? err.message : String(err)}` });
    return {
      success: false,
      format,
      weightPerMeter: 0,
      width: 0,
      height: 0,
      length: 0,
      crossSectionArea: 0,
      error: `${format.toUpperCase()} 解析失败: ${err instanceof Error ? err.message : String(err)}`,
      diagnostics,
    };
  }
}

// ---- 内部辅助函数 ----

/**
 * 从 DXF 文本提取坐标点 [[x, y, z], ...]
 */
function extractDxfCoordinates(text: string): number[][] {
  const coords: number[][] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const code = lines[i]?.trim();
    if (code === '10' || code === '11' || code === '12' || code === '13') {
      const x = parseFloat(lines[i + 1]?.trim() || '');
      let y = 0, z = 0;
      // 向后查找 20/30
      for (let j = i + 2; j < i + 8 && j < lines.length - 1; j += 2) {
        const c = lines[j]?.trim();
        if (c === '20') y = parseFloat(lines[j + 1]?.trim() || '0');
        if (c === '30') z = parseFloat(lines[j + 1]?.trim() || '0');
      }
      if (!isNaN(x) && !isNaN(y)) {
        coords.push([x, y, isNaN(z) ? 0 : z]);
      }
    }
    i++;
  }
  return coords;
}

/**
 * 估算 DXF 截面积（基于包围盒和实体数量）
 */
function estimateCrossSectionArea(text: string, coords: number[][], width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;

  // 统计 LINE/ARC/CIRCLE/LWPOLYLINE 等实体数
  const entityCount = (text.match(/\b(LINE|ARC|CIRCLE|LWPOLYLINE|POLYLINE|SPLINE|ELLIPSE)\b/gi) || []).length;

  // 如果是多个实体组成的截面，使用填充系数
  // 单实体简单截面：面积 ≈ 宽 × 高 × 0.6~0.8
  // 多实体复杂截面：面积 ≈ 宽 × 高 × 0.4~0.6
  const fillFactor = entityCount > 10 ? 0.45 : entityCount > 3 ? 0.55 : 0.7;

  return Math.round(width * height * fillFactor * 100) / 100;
}

/**
 * 从 DXF 中提取实体名称（图层名/块名）
 */
function extractDxfEntityNames(text: string): string[] {
  const names = new Set<string>();
  // 提取 LAYER 名称
  const layerRegex = /^2\s*$/gm;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '2' && lines[i + 1]) {
      const name = lines[i + 1].trim();
      if (name && !name.startsWith('*') && name.length < 50) {
        names.add(name);
      }
    }
  }
  return Array.from(names).slice(0, 10);
}

/**
 * 从 STEP/IGES 文本提取坐标
 */
function extractStepIgesCoordinates(text: string, format: 'step' | 'iges'): number[][] {
  const coords: number[][] = [];

  if (format === 'step') {
    // STEP 文件中查找 CARTESIAN_POINT 的坐标值
    const pointRegex = /CARTESIAN_POINT\s*\([^,]*,\s*\(\s*([0-9eE.+\-]+)\s*,\s*([0-9eE.+\-]+)\s*,?\s*([0-9eE.+\-]*)\s*\)/gi;
    let match;
    while ((match = pointRegex.exec(text)) !== null) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      const z = match[3] ? parseFloat(match[3]) : 0;
      if (!isNaN(x) && !isNaN(y)) {
        coords.push([x, y, isNaN(z) ? 0 : z]);
      }
    }

    // 备用：提取所有浮点数三元组
    if (coords.length === 0) {
      const numRegex = /([+-]?\d+\.?\d*(?:[eE][+-]?\d+)?)/g;
      const nums: number[] = [];
      let m;
      while ((m = numRegex.exec(text)) !== null) {
        nums.push(parseFloat(m[1]));
      }
      for (let i = 0; i + 2 < nums.length; i += 3) {
        if (Math.abs(nums[i]) < 1e6 && Math.abs(nums[i + 1]) < 1e6 && Math.abs(nums[i + 2]) < 1e6) {
          coords.push([nums[i], nums[i + 1], nums[i + 2]]);
        }
      }
    }
  } else {
    // IGES 文件：参数段中的数据
    const numRegex = /([+-]?\d+\.?\d*(?:[eE][+-]?\d+)?)/g;
    const nums: number[] = [];
    let m;
    while ((m = numRegex.exec(text)) !== null) {
      nums.push(parseFloat(m[1]));
    }
    for (let i = 0; i + 2 < nums.length; i += 3) {
      if (Math.abs(nums[i]) < 1e6 && Math.abs(nums[i + 1]) < 1e6 && Math.abs(nums[i + 2]) < 1e6) {
        coords.push([nums[i], nums[i + 1], nums[i + 2]]);
      }
    }
  }

  return coords;
}

/**
 * 从 STEP 文件提取实体名称
 */
function extractStepEntityNames(text: string): string[] {
  const names = new Set<string>();
  // 提取 PRODUCT_DEFINITION 名称
  const nameRegex = /PRODUCT_DEFINITION\s*\([^,]*,\s*'[^']*',\s*'([^']*)'/gi;
  let match;
  while ((match = nameRegex.exec(text)) !== null) {
    if (match[1]) names.add(match[1]);
  }

  // 也提取 NAME 字段
  const nameRegex2 = /(?:PRODUCT|SHAPE_REPRESENTATION)\s*\([^,]*,\s*'([^']+)'/gi;
  while ((match = nameRegex2.exec(text)) !== null) {
    if (match[1]) names.add(match[1]);
  }

  return Array.from(names).slice(0, 10);
}
