/**
 * DXF 板材展开解析器 v1.0
 *
 * 移植自 Python ezdxf 版本 parser_v3.py，基于 dxf-parser npm 包。
 * 核心逻辑：
 *  1. 按 X 坐标聚类找 3 个视图区域（俯视图 / 截面图 / 展开图）
 *  2. 绿色线条（ACI color=3 → RGB 65280）间距众数 = 板厚
 *  3. 俯视图 DIMENSION：水平最大 DIM + 折弯延伸(outlier 垂直 DIM) - BD(≈板厚) = 展开长
 *  4. 展开图几何包围盒高度 = 展开宽（排除 DIMENSION 实体）
 *  5. 展开图 CIRCLE 统计 = 孔信息
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DxfParserLib = require('dxf-parser');

// ─── 类型定义 ────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
  z?: number;
}

interface DxfEntity {
  type: string;
  vertices?: Point[];
  center?: Point;
  radius?: number;
  color?: number;
  colorIndex?: number;
  layer?: string;
  actualMeasurement?: number;
  linearOrAngularPoint1?: Point;
  linearOrAngularPoint2?: Point;
  anchorPoint?: Point;
  [key: string]: unknown;
}

interface Region {
  id: number;
  x_range: [number, number];
  y_range: [number, number];
  width: number;
  height: number;
  entity_count: number;
  has_green: boolean;
  green_line_count: number;
  circle_count: number;
  dim_count: number;
  entities: DxfEntity[];
}

interface ViewMap {
  top_view?: Region;
  cross_section?: Region;
  unfolded_view?: Region;
}

interface HoleInfo {
  diameter: number;
  count: number;
}

interface GreenCenterlineResult {
  outer_total: number;
  centerline: number;
  bend_count: number;
  horizontal_lengths: number[];
  vertical_lengths: number[];
  detail: string;
}

// ─── 常量 ────────────────────────────────────────────────────

export const DISCLAIMER = '此尺寸仅用于报价估算，不可作为开模依据';

// ACI color 3 (green) → RGB 65280 (0x00FF00)
const GREEN_RGB = 65280;

// ─── 工具函数 ────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ACI 色号 → RGB 整数（简化映射，仅覆盖常用色号） */
function aciToRgb(aci: number): number {
  const map: Record<number, number> = {
    1: 0xff0000, // red
    2: 0xffff00, // yellow
    3: 0x00ff00, // green
    4: 0x00ffff, // cyan
    5: 0x0000ff, // blue
    6: 0xff00ff, // magenta
    7: 0xffffff, // white/black
    8: 0x808080, // dark gray
    9: 0xc0c0c0, // light gray
  };
  return map[aci] ?? 0xffffff;
}

/**
 * 获取实体颜色。
 * dxf-parser 的 entity.color 为 RGB 整数值。
 * 如果 color 为 undefined（BYLAYER），则查 layer 的 colorIndex。
 */
function getEntityColor(
  e: DxfEntity,
  layerMap: Record<string, { colorIndex: number }>
): number {
  if (e.color !== undefined && e.color !== 256) {
    return e.color;
  }
  // BYLAYER: 查找图层的 ACI colorIndex
  if (e.layer && layerMap[e.layer]) {
    return aciToRgb(layerMap[e.layer].colorIndex);
  }
  return 7; // 默认白色
}

/** 判断实体是否为绿色 */
function isGreen(
  e: DxfEntity,
  layerMap: Record<string, { colorIndex: number }>
): boolean {
  return getEntityColor(e, layerMap) === GREEN_RGB;
}

// ─── 坐标范围提取 ────────────────────────────────────────────

function getEntityXRange(e: DxfEntity): [number, number] | null {
  const xs: number[] = [];
  switch (e.type) {
    case 'LINE':
      if (e.vertices && e.vertices.length >= 2) {
        xs.push(e.vertices[0].x, e.vertices[1].x);
      }
      break;
    case 'CIRCLE':
    case 'ARC':
      if (e.center && e.radius) {
        xs.push(e.center.x - e.radius, e.center.x + e.radius);
      }
      break;
    case 'LWPOLYLINE':
      if (e.vertices) {
        for (const p of e.vertices) xs.push(p.x);
      }
      break;
    case 'DIMENSION':
      if (e.anchorPoint) xs.push((e.anchorPoint as Point).x);
      if (e.linearOrAngularPoint1)
        xs.push((e.linearOrAngularPoint1 as Point).x);
      if (e.linearOrAngularPoint2)
        xs.push((e.linearOrAngularPoint2 as Point).x);
      break;
    default:
      break;
  }
  if (xs.length === 0) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

// ─── X 聚类 ─────────────────────────────────────────────────

function clusterByX(
  entities: DxfEntity[],
  layerMap: Record<string, { colorIndex: number }>,
  minGap = 20.0
): Region[] {
  const withRange: { xRange: [number, number]; entity: DxfEntity }[] = [];
  for (const e of entities) {
    const xr = getEntityXRange(e);
    if (xr) withRange.push({ xRange: xr, entity: e });
  }
  if (withRange.length === 0) return [];

  // 按最小 X 排序
  withRange.sort((a, b) => a.xRange[0] - b.xRange[0]);

  // 聚类
  const clusters: { xRange: [number, number]; entity: DxfEntity }[][] = [];
  let currentCluster = [withRange[0]];
  let currentMaxX = withRange[0].xRange[1];

  for (let i = 1; i < withRange.length; i++) {
    const currMinX = withRange[i].xRange[0];
    if (currMinX - currentMaxX > minGap) {
      clusters.push(currentCluster);
      currentCluster = [withRange[i]];
      currentMaxX = withRange[i].xRange[1];
    } else {
      currentCluster.push(withRange[i]);
      currentMaxX = Math.max(currentMaxX, withRange[i].xRange[1]);
    }
  }
  clusters.push(currentCluster);

  // 计算区域信息
  const regions: Region[] = [];
  for (let idx = 0; idx < clusters.length; idx++) {
    const cluster = clusters[idx];
    const ents = cluster.map((c) => c.entity);

    const allMinX = Math.min(...cluster.map((c) => c.xRange[0]));
    const allMaxX = Math.max(...cluster.map((c) => c.xRange[1]));

    // 计算 Y 范围
    const allY: number[] = [];
    for (const e of ents) {
      if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
        allY.push(e.vertices[0].y, e.vertices[1].y);
      } else if (
        (e.type === 'CIRCLE' || e.type === 'ARC') &&
        e.center &&
        e.radius
      ) {
        allY.push(e.center.y - e.radius, e.center.y + e.radius);
      }
    }
    const allMinY = allY.length > 0 ? Math.min(...allY) : 0;
    const allMaxY = allY.length > 0 ? Math.max(...allY) : 0;

    const circles = ents.filter((e) => e.type === 'CIRCLE');
    const dims = ents.filter((e) => e.type === 'DIMENSION');
    const greenLines = ents.filter(
      (e) => isGreen(e, layerMap) && e.type === 'LINE'
    );

    regions.push({
      id: idx,
      x_range: [round2(allMinX), round2(allMaxX)],
      y_range: [round2(allMinY), round2(allMaxY)],
      width: round2(allMaxX - allMinX),
      height: round2(allMaxY - allMinY),
      entity_count: ents.length,
      has_green: greenLines.length > 0,
      green_line_count: greenLines.length,
      circle_count: circles.length,
      dim_count: dims.length,
      entities: ents,
    });
  }

  return regions;
}

// ─── 视图分类 ────────────────────────────────────────────────

function classifyViews(regions: Region[]): ViewMap {
  const views: ViewMap = {};
  for (const r of regions) {
    const { width: w, height: h } = r;
    const isNarrow = w < h * 0.5 || h < w * 0.5;

    if (r.has_green && isNarrow) {
      views.cross_section = r;
    } else if (r.has_green && r.green_line_count >= 2) {
      views.top_view = r;
    } else if (r.circle_count >= 4) {
      views.unfolded_view = r;
    }
  }
  return views;
}

// ─── 板厚计算（绿色线条间距众数）────────────────────────────

function getThicknessFromGreenLines(
  entities: DxfEntity[],
  layerMap: Record<string, { colorIndex: number }>,
  maxThickness = 3.0
): number | null {
  const greenLines = entities.filter(
    (e) =>
      isGreen(e, layerMap) &&
      e.type === 'LINE' &&
      e.vertices &&
      e.vertices.length >= 2
  );
  if (greenLines.length < 2) return null;

  const horizontal: number[] = [];
  const vertical: number[] = [];

  for (const line of greenLines) {
    const v = line.vertices!;
    const dx = Math.abs(v[1].x - v[0].x);
    const dy = Math.abs(v[1].y - v[0].y);
    if (dx > dy * 3) {
      horizontal.push((v[0].y + v[1].y) / 2);
    } else if (dy > dx * 3) {
      vertical.push((v[0].x + v[1].x) / 2);
    }
  }

  // 收集有效间距
  const allGaps: number[] = [];
  for (const coords of [horizontal, vertical]) {
    coords.sort((a, b) => a - b);
    for (let i = 0; i < coords.length - 1; i++) {
      const thickness = Math.abs(coords[i + 1] - coords[i]);
      if (thickness > 0.5 && thickness < maxThickness) {
        allGaps.push(Math.round(thickness * 10) / 10);
      }
    }
  }

  if (allGaps.length === 0) return null;

  // 取众数
  const counter = new Map<number, number>();
  for (const g of allGaps) {
    counter.set(g, (counter.get(g) || 0) + 1);
  }
  let best = allGaps[0];
  let bestCount = 0;
  for (const [val, cnt] of counter) {
    if (cnt > bestCount) {
      best = val;
      bestCount = cnt;
    }
  }
  return best;
}

// ─── DIMENSION 方向与值提取 ─────────────────────────────────

interface DimInfo {
  value: number;
  direction: 'horizontal' | 'vertical' | 'unknown';
}

function getDimensionsByView(region: Region): DimInfo[] {
  const dims: DimInfo[] = [];
  for (const e of region.entities) {
    if (e.type !== 'DIMENSION') continue;

    // 计算测量值
    let val: number | null = null;
    if (e.actualMeasurement && e.actualMeasurement > 0) {
      val = round2(e.actualMeasurement);
    } else if (e.linearOrAngularPoint2 && e.linearOrAngularPoint1) {
      const p1 = e.linearOrAngularPoint1 as Point;
      const p2 = e.linearOrAngularPoint2 as Point;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      val = round2(Math.sqrt(dx * dx + dy * dy));
    }
    if (!val) continue;

    // 判断方向
    let direction: 'horizontal' | 'vertical' | 'unknown' = 'unknown';
    const p1 = e.linearOrAngularPoint1 as Point | undefined;
    const p2 = e.linearOrAngularPoint2 as Point | undefined;
    if (p1 && p2) {
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      if (dx > dy * 2) {
        direction = 'horizontal';
      } else if (dy > dx * 2) {
        direction = 'vertical';
      }
    }

    dims.push({ value: val, direction });
  }
  return dims;
}

// ─── 去重线条 ────────────────────────────────────────────────

type LineTuple = [number, number, number]; // [coord, length, center]

function dedupLines(
  lines: LineTuple[],
  mergeThreshold: number
): LineTuple[] {
  if (lines.length === 0) return [];
  lines.sort((a, b) => a[0] - b[0]);

  const groups: LineTuple[][] = [];
  let currentGroup: LineTuple[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    if (
      Math.abs(lines[i][0] - currentGroup[currentGroup.length - 1][0]) <
      mergeThreshold
    ) {
      currentGroup.push(lines[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [lines[i]];
    }
  }
  groups.push(currentGroup);

  return groups.map((group) =>
    group.reduce((a, b) => (a[1] >= b[1] ? a : b))
  );
}

// ─── 绿色线条中心线法 ────────────────────────────────────────

function calcCenterlineFromGreen(
  region: Region,
  thickness: number,
  layerMap: Record<string, { colorIndex: number }>,
  minSegmentRatio = 3
): GreenCenterlineResult | null {
  const greenLines = region.entities.filter(
    (e) =>
      isGreen(e, layerMap) &&
      e.type === 'LINE' &&
      e.vertices &&
      e.vertices.length >= 2
  );
  if (greenLines.length === 0) return null;

  const minLen = thickness * minSegmentRatio;
  const hLines: LineTuple[] = [];
  const vLines: LineTuple[] = [];

  for (const line of greenLines) {
    const v = line.vertices!;
    const x1 = v[0].x,
      y1 = v[0].y,
      x2 = v[1].x,
      y2 = v[1].y;
    const length = round2(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
    if (length < minLen) continue;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    if (dx > dy * 3) {
      hLines.push([(y1 + y2) / 2, length, (x1 + x2) / 2]);
    } else if (dy > dx * 3) {
      vLines.push([(x1 + x2) / 2, length, (y1 + y2) / 2]);
    }
  }

  const hDeduped = dedupLines(hLines, thickness * 2.5);
  const vDeduped = dedupLines(vLines, thickness * 2.5);

  const outerTotal =
    hDeduped.reduce((s, l) => s + l[1], 0) +
    vDeduped.reduce((s, l) => s + l[1], 0);
  const segmentCount = hDeduped.length + vDeduped.length;
  const bendCount = Math.max(0, segmentCount - 1);
  const centerline = outerTotal - bendCount * thickness;

  const hLengths = hDeduped.map((l) => round2(l[1])).sort((a, b) => a - b);
  const vLengths = vDeduped.map((l) => round2(l[1])).sort((a, b) => a - b);

  return {
    outer_total: round2(outerTotal),
    centerline: round2(centerline),
    bend_count: bendCount,
    horizontal_lengths: hLengths,
    vertical_lengths: vLengths,
    detail: `外轮廓=[${hLengths}]+[${vLengths}]=${round2(outerTotal)}, 折弯${bendCount}个, 中心线=${round2(centerline)}`,
  };
}

// ─── 主入口 ──────────────────────────────────────────────────

export interface DxfParseResult {
  success: boolean;
  data?: {
    unfolded_length_mm: number | null;
    unfolded_width_mm: number | null;
    thickness_mm: number | null;
    holes: HoleInfo[];
    disclaimer: string;
    summary: string;
    confidence: string;
    views_detected: string[];
    region_count: number;
    detail: Record<string, unknown>;
  };
  error?: string;
}

/**
 * 解析 DXF 板材展开图纸
 * @param dxfContent DXF 文件文本内容
 */
export function parseDxfForSheetMetal(
  dxfContent: string
): DxfParseResult {
  try {
    const parser = new DxfParserLib();
    const dxf = parser.parseSync(dxfContent);

    if (!dxf || !dxf.entities || dxf.entities.length === 0) {
      return { success: false, error: 'DXF 文件中没有实体' };
    }

    const entities: DxfEntity[] = dxf.entities as DxfEntity[];

    // 构建图层颜色映射
    const layerMap: Record<string, { colorIndex: number }> = {};
    if (dxf.tables?.layer?.layers) {
      for (const [name, info] of Object.entries(
        dxf.tables.layer.layers
      ) as [string, { colorIndex: number }][]) {
        layerMap[name] = { colorIndex: info.colorIndex ?? 7 };
      }
    }

    // 1. X 聚类
    const regions = clusterByX(entities, layerMap);

    // 2. 视图分类
    const views = classifyViews(regions);

    // 3. 计算结果
    const detail: Record<string, unknown> = {};
    let thickness: number | null = null;
    let unfoldedLength: number | null = null;
    let unfoldedWidth: number | null = null;
    const holes: HoleInfo[] = [];

    // 板厚
    thickness = getThicknessFromGreenLines(entities, layerMap);
    if (thickness !== null) {
      detail.thickness_mm = thickness;
      detail.thickness_source = '绿色线条间距(众数)';
    }

    // 展开长：俯视图 DIMENSION
    if (views.top_view) {
      const tvDims = getDimensionsByView(views.top_view);
      const hDims = tvDims
        .filter((d) => d.direction === 'horizontal')
        .map((d) => d.value);
      const vDims = tvDims
        .filter((d) => d.direction === 'vertical')
        .map((d) => d.value);

      detail.top_view_horizontal_dims = hDims;
      detail.top_view_vertical_dims = vDims;

      if (hDims.length > 0 && vDims.length > 0 && thickness !== null) {
        const hMax = Math.max(...hDims);

        // 识别主体高度（众数）和折弯延伸（outlier）
        const vRounded = vDims.map((v) => Math.round(v));
        const vCounter = new Map<number, number>();
        for (const v of vRounded) {
          vCounter.set(v, (vCounter.get(v) || 0) + 1);
        }
        let mainBodyRounded = vRounded[0];
        let maxCount = 0;
        for (const [val, cnt] of vCounter) {
          if (cnt > maxCount) {
            mainBodyRounded = val;
            maxCount = cnt;
          }
        }

        // 找折弯延伸（不接近主体高度的垂直 DIM）
        const flangeDim = vDims.find(
          (v) => Math.abs(Math.round(v) - mainBodyRounded) > 5
        );

        if (flangeDim !== undefined) {
          const bd = thickness; // 90° 折弯 BD ≈ 板厚
          unfoldedLength = round2(hMax + flangeDim - bd);
          detail.unfolded_length_mm = unfoldedLength;
          detail.unfolded_length_calc = `${hMax} + ${flangeDim} - ${bd} = ${unfoldedLength}`;
          detail.bend_deduction_mm = bd;
          detail.flange_height_mm = flangeDim;
        }
      }

      // 辅助验证：绿色线条中心线法
      const tvCalc = calcCenterlineFromGreen(
        views.top_view,
        thickness || 1.2,
        layerMap
      );
      if (tvCalc) {
        detail.top_view_green_centerline = tvCalc.centerline;
        detail.top_view_green_detail = tvCalc.detail;
      }
    }

    // 展开宽：展开图包围盒高度
    if (views.unfolded_view) {
      const uv = views.unfolded_view;
      const geoEnts = uv.entities.filter((e) =>
        ['LINE', 'ARC', 'CIRCLE'].includes(e.type)
      );

      const allX: number[] = [];
      const allY: number[] = [];
      for (const e of geoEnts) {
        if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
          allX.push(e.vertices[0].x, e.vertices[1].x);
          allY.push(e.vertices[0].y, e.vertices[1].y);
        } else if (
          (e.type === 'CIRCLE' || e.type === 'ARC') &&
          e.center &&
          e.radius
        ) {
          allX.push(e.center.x - e.radius, e.center.x + e.radius);
          allY.push(e.center.y - e.radius, e.center.y + e.radius);
        }
      }

      if (allX.length > 0 && allY.length > 0) {
        const bboxW = round2(Math.max(...allX) - Math.min(...allX));
        const bboxH = round2(Math.max(...allY) - Math.min(...allY));
        unfoldedWidth = bboxH;
        detail.unfolded_width_mm = bboxH;
        detail.unfolded_bbox_width = bboxW;
        detail.dimension_source = '展开图包围盒高度+俯视图DIMENSION';
      }

      // 孔信息
      const circles = uv.entities.filter((e) => e.type === 'CIRCLE');
      if (circles.length > 0) {
        const holeMap = new Map<number, number>();
        for (const c of circles) {
          if (c.radius) {
            const d = round2(c.radius * 2);
            holeMap.set(d, (holeMap.get(d) || 0) + 1);
          }
        }
        for (const [diameter, count] of [
          ...holeMap.entries(),
        ].sort((a, b) => a[0] - b[0])) {
          holes.push({ diameter, count });
        }
      }
    }

    // 截面图辅助验证
    if (views.cross_section) {
      const csCalc = calcCenterlineFromGreen(
        views.cross_section,
        thickness || 1.2,
        layerMap
      );
      if (csCalc) {
        detail.cross_section_centerline = csCalc.centerline;
        detail.cross_section_detail = csCalc.detail;
      }
    }

    // 摘要
    const summaryParts: string[] = [];
    if (unfoldedLength !== null) summaryParts.push(`展开长: ${unfoldedLength}mm`);
    if (unfoldedWidth !== null) summaryParts.push(`展开宽: ${unfoldedWidth}mm`);
    if (thickness !== null) summaryParts.push(`板厚: ${thickness}mm`);
    if (holes.length > 0) {
      const holeStr = holes
        .map((h) => `Ø${h.diameter}×${h.count}`)
        .join(' + ');
      summaryParts.push(`孔: ${holeStr}`);
    }
    const summary =
      summaryParts.length > 0 ? summaryParts.join(' | ') : '无法解析';

    return {
      success: true,
      data: {
        unfolded_length_mm: unfoldedLength,
        unfolded_width_mm: unfoldedWidth,
        thickness_mm: thickness,
        holes,
        disclaimer: DISCLAIMER,
        summary,
        confidence: 'high',
        views_detected: Object.keys(views),
        region_count: regions.length,
        detail,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `DXF 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
